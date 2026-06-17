package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	CommunityBotModuleGroupCheckin = "group_checkin"
	CommunityBotModuleTokenUnlock  = "token_unlock"

	DefaultCommunityBotAPIBaseURL             = "https://dc.hhhl.cc/api"
	DefaultCommunityBotPollIntervalSeconds    = 15
	DefaultCommunityGroupCheckinRoomID        = "anicsahlur"
	DefaultCommunityGroupCheckinKeyword       = "我要领鸡蛋"
	DefaultCommunityGroupCheckinMinQuota      = 1000000
	DefaultCommunityGroupCheckinMaxQuota      = 5000000
	DefaultCommunityTokenUnlockRoomID         = "anicsahlur"
	DefaultCommunityTokenUnlockKeyword        = "我要添加令牌"
	DefaultCommunityTokenUnlockDurationMinute = 30
)

var ErrCommunityOAuthProviderNotConfigured = errors.New("community oauth provider is not configured")

type CommunityBotConfig struct {
	Id                  int       `json:"id" gorm:"primaryKey"`
	Enabled             bool      `json:"enabled" gorm:"default:false"`
	APIBaseURL          string    `json:"api_base_url" gorm:"type:varchar(512);default:'https://dc.hhhl.cc/api'"`
	APIToken            string    `json:"-" gorm:"type:text"`
	PollIntervalSeconds int       `json:"poll_interval_seconds" gorm:"default:15"`
	ReplyEnabled        bool      `json:"reply_enabled" gorm:"default:true"`
	OAuthProviderId     int       `json:"oauth_provider_id" gorm:"column:oauth_provider_id;default:0"`
	OAuthProviderSlug   string    `json:"oauth_provider_slug" gorm:"type:varchar(64);default:''"`
	LastError           string    `json:"last_error" gorm:"type:text"`
	LastSyncAt          time.Time `json:"last_sync_at"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

func (CommunityBotConfig) TableName() string {
	return "community_bot_configs"
}

type CommunityBotRoomState struct {
	Id                  int       `json:"id" gorm:"primaryKey"`
	Module              string    `json:"module" gorm:"type:varchar(64);not null;uniqueIndex"`
	RoomId              string    `json:"room_id" gorm:"type:varchar(128);not null"`
	Keyword             string    `json:"keyword" gorm:"type:varchar(128);not null"`
	Enabled             bool      `json:"enabled" gorm:"default:false"`
	MinQuota            int       `json:"min_quota" gorm:"default:0"`
	MaxQuota            int       `json:"max_quota" gorm:"default:0"`
	UnlockDurationMins  int       `json:"unlock_duration_mins" gorm:"default:0"`
	LastCursorMessageId string    `json:"last_cursor_message_id" gorm:"type:varchar(128);default:''"`
	LastSyncAt          time.Time `json:"last_sync_at"`
	LastError           string    `json:"last_error" gorm:"type:text"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

func (CommunityBotRoomState) TableName() string {
	return "community_bot_room_states"
}

type CommunityCheckinRecord struct {
	Id              int       `json:"id" gorm:"primaryKey"`
	UserId          int       `json:"user_id" gorm:"not null;uniqueIndex:ux_community_checkin_user_date"`
	ProviderUserId  string    `json:"provider_user_id" gorm:"type:varchar(256);not null"`
	RoomId          string    `json:"room_id" gorm:"type:varchar(128);not null"`
	SourceMessageId string    `json:"source_message_id" gorm:"type:varchar(128);not null;uniqueIndex"`
	Keyword         string    `json:"keyword" gorm:"type:varchar(128);not null"`
	CheckinDate     string    `json:"checkin_date" gorm:"type:varchar(16);not null;uniqueIndex:ux_community_checkin_user_date"`
	QuotaAwarded    int       `json:"quota_awarded" gorm:"not null"`
	CreatedAt       time.Time `json:"created_at"`
}

func (CommunityCheckinRecord) TableName() string {
	return "community_checkin_records"
}

type CommunityTokenUnlock struct {
	Id              int       `json:"id" gorm:"primaryKey"`
	UserId          int       `json:"user_id" gorm:"not null;index:idx_community_token_unlock_user_until"`
	ProviderUserId  string    `json:"provider_user_id" gorm:"type:varchar(256);not null"`
	RoomId          string    `json:"room_id" gorm:"type:varchar(128);not null"`
	SourceMessageId string    `json:"source_message_id" gorm:"type:varchar(128);not null;uniqueIndex"`
	Keyword         string    `json:"keyword" gorm:"type:varchar(128);not null"`
	UnlockedUntil   time.Time `json:"unlocked_until" gorm:"not null;index:idx_community_token_unlock_user_until"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (CommunityTokenUnlock) TableName() string {
	return "community_token_unlocks"
}

type CommunityBotLog struct {
	Id             int        `json:"id" gorm:"primaryKey"`
	Module         string     `json:"module" gorm:"type:varchar(64);not null;index"`
	RoomId         string     `json:"room_id" gorm:"type:varchar(128);not null;index"`
	MessageId      string     `json:"message_id" gorm:"type:varchar(128);not null;index"`
	MessageText    string     `json:"message_text" gorm:"type:text"`
	Keyword        string     `json:"keyword" gorm:"type:varchar(128)"`
	ChatUserId     string     `json:"chat_user_id" gorm:"type:varchar(256);index"`
	ChatUsername   string     `json:"chat_username" gorm:"type:varchar(256);index"`
	ProviderUserId string     `json:"provider_user_id" gorm:"type:varchar(256);index"`
	UserId         int        `json:"user_id" gorm:"index"`
	ResultCode     string     `json:"result_code" gorm:"type:varchar(64);not null;index"`
	Handled        bool       `json:"handled" gorm:"not null;default:false"`
	Success        bool       `json:"success" gorm:"not null;default:false"`
	QuotaAwarded   int        `json:"quota_awarded" gorm:"default:0"`
	UnlockedUntil  *time.Time `json:"unlocked_until"`
	ReplyText      string     `json:"reply_text" gorm:"type:text"`
	Error          string     `json:"error" gorm:"type:text"`
	CreatedAt      time.Time  `json:"created_at" gorm:"index"`
}

func (CommunityBotLog) TableName() string {
	return "community_bot_logs"
}

type CommunityTokenCreateUnlockStatus struct {
	Bound         bool       `json:"bound"`
	Unlocked      bool       `json:"unlocked"`
	UnlockedUntil *time.Time `json:"unlocked_until"`
	RoomId        string     `json:"room_id"`
	Keyword       string     `json:"keyword"`
}

func RecordCommunityBotLog(log *CommunityBotLog) error {
	if log == nil {
		return nil
	}
	return DB.Create(log).Error
}

func GetCommunityBotLogs(page int, size int, module string, resultCode string) ([]CommunityBotLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if size <= 0 || size > 100 {
		size = 20
	}
	query := DB.Model(&CommunityBotLog{})
	if module != "" {
		query = query.Where("module = ?", module)
	}
	if resultCode != "" {
		query = query.Where("result_code = ?", resultCode)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var logs []CommunityBotLog
	err := query.Order("id desc").Limit(size).Offset((page - 1) * size).Find(&logs).Error
	return logs, total, err
}

func defaultCommunityBotConfig() *CommunityBotConfig {
	return &CommunityBotConfig{
		Enabled:             false,
		APIBaseURL:          DefaultCommunityBotAPIBaseURL,
		PollIntervalSeconds: DefaultCommunityBotPollIntervalSeconds,
		ReplyEnabled:        true,
	}
}

func GetCommunityBotConfig() (*CommunityBotConfig, error) {
	var config CommunityBotConfig
	err := DB.Order("id asc").First(&config).Error
	if err == nil {
		if config.APIBaseURL == "" {
			config.APIBaseURL = DefaultCommunityBotAPIBaseURL
		}
		if config.PollIntervalSeconds <= 0 {
			config.PollIntervalSeconds = DefaultCommunityBotPollIntervalSeconds
		}
		return &config, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	config = *defaultCommunityBotConfig()
	if err := DB.Create(&config).Error; err != nil {
		return nil, err
	}
	return &config, nil
}

func SaveCommunityBotConfig(config *CommunityBotConfig) error {
	if config.APIBaseURL == "" {
		config.APIBaseURL = DefaultCommunityBotAPIBaseURL
	}
	if config.PollIntervalSeconds <= 0 {
		config.PollIntervalSeconds = DefaultCommunityBotPollIntervalSeconds
	}
	return DB.Save(config).Error
}

func GetOrCreateCommunityRoomState(module string) (*CommunityBotRoomState, error) {
	defaultState := defaultCommunityRoomState(module)
	var state CommunityBotRoomState
	err := DB.Where("module = ?", defaultState.Module).First(&state).Error
	if err == nil {
		return &state, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err := DB.Create(defaultState).Error; err != nil {
		return nil, err
	}
	return defaultState, nil
}

func SaveCommunityRoomState(state *CommunityBotRoomState) error {
	return DB.Save(state).Error
}

func defaultCommunityRoomState(module string) *CommunityBotRoomState {
	switch module {
	case CommunityBotModuleTokenUnlock:
		return &CommunityBotRoomState{
			Module:             CommunityBotModuleTokenUnlock,
			RoomId:             DefaultCommunityTokenUnlockRoomID,
			Keyword:            DefaultCommunityTokenUnlockKeyword,
			Enabled:            false,
			UnlockDurationMins: DefaultCommunityTokenUnlockDurationMinute,
		}
	default:
		return &CommunityBotRoomState{
			Module:   CommunityBotModuleGroupCheckin,
			RoomId:   DefaultCommunityGroupCheckinRoomID,
			Keyword:  DefaultCommunityGroupCheckinKeyword,
			Enabled:  false,
			MinQuota: DefaultCommunityGroupCheckinMinQuota,
			MaxQuota: DefaultCommunityGroupCheckinMaxQuota,
		}
	}
}

func ResolveCommunityOAuthProviderId(config *CommunityBotConfig) (int, error) {
	if config == nil {
		var err error
		config, err = GetCommunityBotConfig()
		if err != nil {
			return 0, err
		}
	}
	if config.OAuthProviderId > 0 {
		return config.OAuthProviderId, nil
	}
	if config.OAuthProviderSlug != "" {
		provider, err := GetCustomOAuthProviderBySlug(config.OAuthProviderSlug)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return 0, ErrCommunityOAuthProviderNotConfigured
			}
			return 0, err
		}
		return provider.Id, nil
	}
	providers, err := GetEnabledCustomOAuthProviders()
	if err != nil {
		return 0, err
	}
	if len(providers) == 1 {
		return providers[0].Id, nil
	}
	return 0, ErrCommunityOAuthProviderNotConfigured
}

func GetCommunityOAuthBindingForUser(userId int) (*UserOAuthBinding, error) {
	config, err := GetCommunityBotConfig()
	if err != nil {
		return nil, err
	}
	providerId, err := ResolveCommunityOAuthProviderId(config)
	if err != nil {
		if errors.Is(err, ErrCommunityOAuthProviderNotConfigured) {
			return nil, nil
		}
		return nil, err
	}
	var binding UserOAuthBinding
	err = DB.Where("user_id = ? AND provider_id = ?", userId, providerId).First(&binding).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &binding, nil
}

func GetCommunityTokenCreateUnlockStatus(userId int) (*CommunityTokenCreateUnlockStatus, error) {
	status := &CommunityTokenCreateUnlockStatus{
		RoomId:  DefaultCommunityTokenUnlockRoomID,
		Keyword: DefaultCommunityTokenUnlockKeyword,
	}
	state, err := GetOrCreateCommunityRoomState(CommunityBotModuleTokenUnlock)
	if err == nil {
		status.RoomId = state.RoomId
		status.Keyword = state.Keyword
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	var user User
	err = DB.Select("id", "role").First(&user, userId).Error
	if err == nil && user.Role == common.RoleRootUser {
		status.Bound = true
		status.Unlocked = true
		return status, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	binding, err := GetCommunityOAuthBindingForUser(userId)
	if err != nil {
		return nil, err
	}
	if binding == nil {
		return status, nil
	}
	status.Bound = true

	var unlock CommunityTokenUnlock
	err = DB.Where("user_id = ? AND unlocked_until > ?", userId, time.Now()).
		Order("unlocked_until desc").
		First(&unlock).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return status, nil
		}
		return nil, err
	}
	status.Unlocked = true
	status.UnlockedUntil = &unlock.UnlockedUntil
	return status, nil
}

func UpsertCommunityTokenUnlock(userId int, providerUserId string, roomId string, sourceMessageId string, keyword string, unlockedUntil time.Time) error {
	unlock := CommunityTokenUnlock{
		UserId:          userId,
		ProviderUserId:  providerUserId,
		RoomId:          roomId,
		SourceMessageId: sourceMessageId,
		Keyword:         keyword,
		UnlockedUntil:   unlockedUntil,
	}
	var existing CommunityTokenUnlock
	err := DB.Where("source_message_id = ?", sourceMessageId).First(&existing).Error
	if err == nil {
		return DB.Model(&existing).Updates(map[string]interface{}{
			"user_id":          userId,
			"provider_user_id": providerUserId,
			"room_id":          roomId,
			"keyword":          keyword,
			"unlocked_until":   unlockedUntil,
		}).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return DB.Create(&unlock).Error
}
