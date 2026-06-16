package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func setupCommunityBotServiceTest(t *testing.T) *model.CustomOAuthProvider {
	t.Helper()

	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	require.NoError(t, model.DB.AutoMigrate(
		&model.User{},
		&model.CustomOAuthProvider{},
		&model.UserOAuthBinding{},
		&model.CommunityBotConfig{},
		&model.CommunityBotRoomState{},
		&model.CommunityCheckinRecord{},
		&model.CommunityTokenUnlock{},
	))
	model.DB.Exec("DELETE FROM community_token_unlocks")
	model.DB.Exec("DELETE FROM community_checkin_records")
	model.DB.Exec("DELETE FROM community_bot_room_states")
	model.DB.Exec("DELETE FROM community_bot_configs")
	model.DB.Exec("DELETE FROM user_oauth_bindings")
	model.DB.Exec("DELETE FROM custom_oauth_providers")
	model.DB.Exec("DELETE FROM users")

	provider := &model.CustomOAuthProvider{
		Name:                  "dc.hhhl.cc",
		Slug:                  "dc-hhhl",
		Enabled:               true,
		ClientId:              "client",
		AuthorizationEndpoint: "https://dc.hhhl.cc/oauth/authorize",
		TokenEndpoint:         "https://dc.hhhl.cc/oauth/token",
		UserInfoEndpoint:      "https://dc.hhhl.cc/api/oauth/userinfo",
	}
	require.NoError(t, model.DB.Create(provider).Error)
	require.NoError(t, model.DB.Create(&model.CommunityBotConfig{
		Enabled:             true,
		APIBaseURL:          model.DefaultCommunityBotAPIBaseURL,
		APIToken:            "community-token",
		PollIntervalSeconds: model.DefaultCommunityBotPollIntervalSeconds,
		ReplyEnabled:        true,
		OAuthProviderId:     provider.Id,
	}).Error)
	require.NoError(t, model.DB.Create(&model.User{
		Id:       1,
		Username: "bound-user",
		Quota:    0,
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, model.DB.Create(&model.UserOAuthBinding{
		UserId:         1,
		ProviderId:     provider.Id,
		ProviderUserId: "community-user-1",
	}).Error)
	return provider
}

func TestCommunityBotGroupCheckinAwardsQuotaOncePerDay(t *testing.T) {
	setupCommunityBotServiceTest(t)
	state := &model.CommunityBotRoomState{
		Module:   model.CommunityBotModuleGroupCheckin,
		RoomId:   model.DefaultCommunityGroupCheckinRoomID,
		Keyword:  model.DefaultCommunityGroupCheckinKeyword,
		Enabled:  true,
		MinQuota: 1000000,
		MaxQuota: 1000000,
	}
	now := time.Date(2026, 6, 17, 10, 0, 0, 0, time.FixedZone("CST", 8*3600))

	result, err := ProcessCommunityBotMessage(state, CommunityChatMessage{
		ID:         "message-1",
		FromUserID: "community-user-1",
		RoomID:     state.RoomId,
		Text:       "逗鲍签到",
	}, now)
	require.NoError(t, err)
	require.True(t, result.Handled)
	require.True(t, result.Success)
	require.Equal(t, 1000000, result.QuotaAwarded)

	result, err = ProcessCommunityBotMessage(state, CommunityChatMessage{
		ID:         "message-2",
		FromUserID: "community-user-1",
		RoomID:     state.RoomId,
		Text:       "今天继续逗鲍签到",
	}, now.Add(time.Hour))
	require.NoError(t, err)
	require.True(t, result.Handled)
	require.False(t, result.Success)
	require.Equal(t, CommunityBotResultAlreadyCheckedIn, result.Code)

	quota, err := model.GetUserQuota(1, true)
	require.NoError(t, err)
	require.Equal(t, 1000000, quota)
}

func TestCommunityBotTokenUnlockCreatesThirtyMinuteWindow(t *testing.T) {
	setupCommunityBotServiceTest(t)
	state := &model.CommunityBotRoomState{
		Module:             model.CommunityBotModuleTokenUnlock,
		RoomId:             model.DefaultCommunityTokenUnlockRoomID,
		Keyword:            model.DefaultCommunityTokenUnlockKeyword,
		Enabled:            true,
		UnlockDurationMins: 30,
	}
	now := time.Date(2026, 6, 17, 10, 0, 0, 0, time.UTC)

	result, err := ProcessCommunityBotMessage(state, CommunityChatMessage{
		ID:         "unlock-message-1",
		FromUserID: "community-user-1",
		RoomID:     state.RoomId,
		Text:       "我要添加令牌",
	}, now)
	require.NoError(t, err)
	require.True(t, result.Handled)
	require.True(t, result.Success)
	require.Equal(t, CommunityBotResultTokenUnlocked, result.Code)

	status, err := model.GetCommunityTokenCreateUnlockStatus(1)
	require.NoError(t, err)
	require.True(t, status.Bound)
	require.True(t, status.Unlocked)
	require.NotNil(t, status.UnlockedUntil)
	require.WithinDuration(t, now.Add(30*time.Minute), *status.UnlockedUntil, time.Second)
}

func TestCommunityBotSkipsUnboundCommunityUser(t *testing.T) {
	setupCommunityBotServiceTest(t)
	state := &model.CommunityBotRoomState{
		Module:             model.CommunityBotModuleTokenUnlock,
		RoomId:             model.DefaultCommunityTokenUnlockRoomID,
		Keyword:            model.DefaultCommunityTokenUnlockKeyword,
		Enabled:            true,
		UnlockDurationMins: 30,
	}

	result, err := ProcessCommunityBotMessage(state, CommunityChatMessage{
		ID:         "unlock-message-2",
		FromUserID: "unbound-community-user",
		RoomID:     state.RoomId,
		Text:       "我要添加令牌",
	}, time.Now())
	require.NoError(t, err)
	require.True(t, result.Handled)
	require.False(t, result.Success)
	require.Equal(t, CommunityBotResultUnbound, result.Code)

	var count int64
	require.NoError(t, model.DB.Model(&model.CommunityTokenUnlock{}).Count(&count).Error)
	require.EqualValues(t, 0, count)
}
