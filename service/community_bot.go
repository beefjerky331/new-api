package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const (
	CommunityBotResultIgnored          = "ignored"
	CommunityBotResultUnbound          = "unbound"
	CommunityBotResultAlreadyCheckedIn = "already_checked_in"
	CommunityBotResultCheckinAwarded   = "checkin_awarded"
	CommunityBotResultTokenUnlocked    = "token_unlocked"
	CommunityBotResultDuplicateMessage = "duplicate_message"
)

type CommunityChatMessage struct {
	ID         string            `json:"id"`
	CreatedAt  time.Time         `json:"createdAt"`
	FromUserID string            `json:"fromUserId"`
	FromUser   CommunityChatUser `json:"fromUser"`
	RoomID     string            `json:"toRoomId"`
	Text       string            `json:"text"`
}

type CommunityChatUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

type CommunityBotProcessResult struct {
	Handled       bool
	Success       bool
	Code          string
	UserId        int
	QuotaAwarded  int
	UnlockedUntil *time.Time
	ReplyText     string
}

type CommunityBotClient struct {
	BaseURL    string
	APIToken   string
	HTTPClient *http.Client
}

type communityRoomTimelineRequest struct {
	RoomID  string `json:"roomId"`
	SinceID string `json:"sinceId,omitempty"`
	Limit   int    `json:"limit,omitempty"`
}

type communityRoomTimelineResponse struct {
	Messages []CommunityChatMessage `json:"messages"`
	Data     struct {
		Messages []CommunityChatMessage `json:"messages"`
		Items    []CommunityChatMessage `json:"items"`
		List     []CommunityChatMessage `json:"list"`
	} `json:"data"`
}

type communityCreateRoomMessageRequest struct {
	ToRoomID string `json:"toRoomId"`
	Text     string `json:"text"`
}

func NewCommunityBotClient(baseURL string, apiToken string) *CommunityBotClient {
	if baseURL == "" {
		baseURL = model.DefaultCommunityBotAPIBaseURL
	}
	return &CommunityBotClient{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		APIToken:   apiToken,
		HTTPClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *CommunityBotClient) RoomTimeline(ctx context.Context, roomID string, sinceID string, limit int) ([]CommunityChatMessage, error) {
	if c == nil {
		return nil, errors.New("community bot client is nil")
	}
	if limit <= 0 {
		limit = 100
	}
	payload, err := common.Marshal(communityRoomTimelineRequest{
		RoomID:  roomID,
		SinceID: sinceID,
		Limit:   limit,
	})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/chat/messages/room-timeline", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIToken)
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("community room timeline status: %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var messages []CommunityChatMessage
	if err := common.Unmarshal(body, &messages); err == nil {
		return messages, nil
	}
	var decoded communityRoomTimelineResponse
	if err := common.Unmarshal(body, &decoded); err != nil {
		return nil, err
	}
	if len(decoded.Messages) > 0 {
		return decoded.Messages, nil
	}
	if len(decoded.Data.Messages) > 0 {
		return decoded.Data.Messages, nil
	}
	if len(decoded.Data.Items) > 0 {
		return decoded.Data.Items, nil
	}
	return decoded.Data.List, nil
}

func (c *CommunityBotClient) CreateRoomMessage(ctx context.Context, roomID string, text string) error {
	if c == nil {
		return errors.New("community bot client is nil")
	}
	payload, err := common.Marshal(communityCreateRoomMessageRequest{
		ToRoomID: roomID,
		Text:     text,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/chat/messages/create-to-room", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIToken)
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("community create room message status: %d", resp.StatusCode)
	}
	return nil
}

func (c *CommunityBotClient) httpClient() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return http.DefaultClient
}

func communityMessageProviderUserIDs(message CommunityChatMessage) []string {
	ids := make([]string, 0, 2)
	for _, id := range []string{message.FromUserID, message.FromUser.Username} {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		duplicate := false
		for _, existing := range ids {
			if existing == id {
				duplicate = true
				break
			}
		}
		if !duplicate {
			ids = append(ids, id)
		}
	}
	return ids
}

func ProcessCommunityBotMessage(state *model.CommunityBotRoomState, message CommunityChatMessage, now time.Time) (*CommunityBotProcessResult, error) {
	result := &CommunityBotProcessResult{Code: CommunityBotResultIgnored}
	if state == nil || !state.Enabled || strings.TrimSpace(state.Keyword) == "" {
		return result, nil
	}
	if !strings.Contains(message.Text, state.Keyword) {
		return result, nil
	}
	result.Handled = true

	config, err := model.GetCommunityBotConfig()
	if err != nil {
		return nil, err
	}
	providerId, err := model.ResolveCommunityOAuthProviderId(config)
	if err != nil {
		if errors.Is(err, model.ErrCommunityOAuthProviderNotConfigured) {
			result.Code = CommunityBotResultUnbound
			result.ReplyText = "未找到你的 new-api 账号绑定，请先使用 dc.hhhl.cc OAuth 登录或绑定账号。"
			return result, nil
		}
		return nil, err
	}
	var user *model.User
	var matchedProviderUserID string
	for _, providerUserID := range communityMessageProviderUserIDs(message) {
		user, err = model.GetUserByOAuthBinding(providerId, providerUserID)
		if err == nil {
			matchedProviderUserID = providerUserID
			break
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	if user == nil {
		result.Code = CommunityBotResultUnbound
		result.ReplyText = "未找到你的 new-api 账号绑定，请先使用 dc.hhhl.cc OAuth 登录或绑定账号。"
		return result, nil
	}
	message.FromUserID = matchedProviderUserID
	result.UserId = user.Id

	switch state.Module {
	case model.CommunityBotModuleTokenUnlock:
		return processCommunityTokenUnlock(state, message, now, user.Id)
	default:
		return processCommunityGroupCheckin(state, message, now, user.Id)
	}
}

func processCommunityGroupCheckin(state *model.CommunityBotRoomState, message CommunityChatMessage, now time.Time, userId int) (*CommunityBotProcessResult, error) {
	result := &CommunityBotProcessResult{
		Handled: true,
		UserId:  userId,
	}
	var sourceCount int64
	if err := model.DB.Model(&model.CommunityCheckinRecord{}).Where("source_message_id = ?", message.ID).Count(&sourceCount).Error; err != nil {
		return nil, err
	}
	if sourceCount > 0 {
		result.Code = CommunityBotResultDuplicateMessage
		return result, nil
	}

	checkinDate := communityCheckinDate(now)
	var dayCount int64
	if err := model.DB.Model(&model.CommunityCheckinRecord{}).
		Where("user_id = ? AND checkin_date = ?", userId, checkinDate).
		Count(&dayCount).Error; err != nil {
		return nil, err
	}
	if dayCount > 0 {
		result.Code = CommunityBotResultAlreadyCheckedIn
		result.ReplyText = "今天已经签过了，明天 0 点后再来。"
		return result, nil
	}

	quota := communityCheckinQuota(state)
	record := &model.CommunityCheckinRecord{
		UserId:          userId,
		ProviderUserId:  message.FromUserID,
		RoomId:          state.RoomId,
		SourceMessageId: message.ID,
		Keyword:         state.Keyword,
		CheckinDate:     checkinDate,
		QuotaAwarded:    quota,
	}
	if err := model.DB.Create(record).Error; err != nil {
		return nil, err
	}
	if err := model.IncreaseUserQuota(userId, quota, true); err != nil {
		_ = model.DB.Delete(record).Error
		return nil, err
	}
	result.Success = true
	result.Code = CommunityBotResultCheckinAwarded
	result.QuotaAwarded = quota
	result.ReplyText = fmt.Sprintf("签到成功，获得 %d Tokens。", quota)
	return result, nil
}

func processCommunityTokenUnlock(state *model.CommunityBotRoomState, message CommunityChatMessage, now time.Time, userId int) (*CommunityBotProcessResult, error) {
	durationMins := state.UnlockDurationMins
	if durationMins <= 0 {
		durationMins = model.DefaultCommunityTokenUnlockDurationMinute
	}
	unlockedUntil := now.Add(time.Duration(durationMins) * time.Minute)
	if err := model.UpsertCommunityTokenUnlock(userId, message.FromUserID, state.RoomId, message.ID, state.Keyword, unlockedUntil); err != nil {
		return nil, err
	}
	return &CommunityBotProcessResult{
		Handled:       true,
		Success:       true,
		Code:          CommunityBotResultTokenUnlocked,
		UserId:        userId,
		UnlockedUntil: &unlockedUntil,
		ReplyText:     "令牌创建已解锁，30 分钟内可以添加新令牌。",
	}, nil
}

func communityCheckinDate(now time.Time) string {
	location, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		location = time.FixedZone("CST", 8*3600)
	}
	return now.In(location).Format("2006-01-02")
}

func communityCheckinQuota(state *model.CommunityBotRoomState) int {
	minQuota := state.MinQuota
	maxQuota := state.MaxQuota
	if minQuota <= 0 {
		minQuota = model.DefaultCommunityGroupCheckinMinQuota
	}
	if maxQuota < minQuota {
		maxQuota = minQuota
	}
	if maxQuota == minQuota {
		return minQuota
	}
	return minQuota + rand.Intn(maxQuota-minQuota+1)
}

func StartCommunityBotWorker() {
	go communityBotWorkerLoop()
}

func communityBotWorkerLoop() {
	for {
		config, err := model.GetCommunityBotConfig()
		if err == nil && config.Enabled && config.APIToken != "" {
			interval := config.PollIntervalSeconds
			if interval <= 0 {
				interval = model.DefaultCommunityBotPollIntervalSeconds
			}
			runCommunityBotSync(context.Background(), config)
			time.Sleep(time.Duration(interval) * time.Second)
			continue
		}
		time.Sleep(time.Duration(model.DefaultCommunityBotPollIntervalSeconds) * time.Second)
	}
}

func RunCommunityBotSyncOnce(ctx context.Context) error {
	config, err := model.GetCommunityBotConfig()
	if err != nil {
		return err
	}
	if !config.Enabled || config.APIToken == "" {
		return nil
	}
	return runCommunityBotSync(ctx, config)
}

func runCommunityBotSync(ctx context.Context, config *model.CommunityBotConfig) error {
	client := NewCommunityBotClient(config.APIBaseURL, config.APIToken)
	modules := []string{model.CommunityBotModuleGroupCheckin, model.CommunityBotModuleTokenUnlock}
	for _, module := range modules {
		state, err := model.GetOrCreateCommunityRoomState(module)
		if err != nil {
			return err
		}
		if !state.Enabled {
			continue
		}
		if err := syncCommunityBotRoom(ctx, client, config, state); err != nil {
			state.LastError = err.Error()
			_ = model.SaveCommunityRoomState(state)
			config.LastError = err.Error()
			_ = model.SaveCommunityBotConfig(config)
			return err
		}
	}
	config.LastError = ""
	config.LastSyncAt = time.Now()
	return model.SaveCommunityBotConfig(config)
}

func syncCommunityBotRoom(ctx context.Context, client *CommunityBotClient, config *model.CommunityBotConfig, state *model.CommunityBotRoomState) error {
	messages, err := client.RoomTimeline(ctx, state.RoomId, state.LastCursorMessageId, 100)
	if err != nil {
		return err
	}
	for _, message := range messages {
		result, err := ProcessCommunityBotMessage(state, message, time.Now())
		if err != nil {
			return err
		}
		if config.ReplyEnabled && result.Handled && result.ReplyText != "" {
			_ = client.CreateRoomMessage(ctx, state.RoomId, result.ReplyText)
		}
		if message.ID != "" {
			state.LastCursorMessageId = message.ID
		}
	}
	state.LastError = ""
	state.LastSyncAt = time.Now()
	return model.SaveCommunityRoomState(state)
}
