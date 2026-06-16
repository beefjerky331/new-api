package controller

import (
	"context"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type communityBotConfigRequest struct {
	Enabled             bool   `json:"enabled"`
	APIBaseURL          string `json:"api_base_url"`
	APIToken            string `json:"api_token"`
	PollIntervalSeconds int    `json:"poll_interval_seconds"`
	ReplyEnabled        bool   `json:"reply_enabled"`
	OAuthProviderId     int    `json:"oauth_provider_id"`
	OAuthProviderSlug   string `json:"oauth_provider_slug"`
}

type communityBotModuleRequest struct {
	Enabled            bool   `json:"enabled"`
	RoomId             string `json:"room_id"`
	Keyword            string `json:"keyword"`
	MinQuota           int    `json:"min_quota"`
	MaxQuota           int    `json:"max_quota"`
	UnlockDurationMins int    `json:"unlock_duration_mins"`
}

func communityBotConfigResponse(config *model.CommunityBotConfig, groupState *model.CommunityBotRoomState, unlockState *model.CommunityBotRoomState) gin.H {
	return gin.H{
		"config": gin.H{
			"enabled":               config.Enabled,
			"api_base_url":          config.APIBaseURL,
			"api_token_configured":  config.APIToken != "",
			"poll_interval_seconds": config.PollIntervalSeconds,
			"reply_enabled":         config.ReplyEnabled,
			"oauth_provider_id":     config.OAuthProviderId,
			"oauth_provider_slug":   config.OAuthProviderSlug,
			"last_error":            config.LastError,
			"last_sync_at":          config.LastSyncAt,
		},
		"group_checkin": groupState,
		"token_unlock":  unlockState,
	}
}

func GetCommunityBotConfig(c *gin.Context) {
	config, err := model.GetCommunityBotConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	groupState, err := model.GetOrCreateCommunityRoomState(model.CommunityBotModuleGroupCheckin)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	unlockState, err := model.GetOrCreateCommunityRoomState(model.CommunityBotModuleTokenUnlock)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, communityBotConfigResponse(config, groupState, unlockState))
}

func UpdateCommunityBotConfig(c *gin.Context) {
	var req communityBotConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	config, err := model.GetCommunityBotConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	config.Enabled = req.Enabled
	config.APIBaseURL = req.APIBaseURL
	if req.APIToken != "" {
		config.APIToken = req.APIToken
	}
	config.PollIntervalSeconds = req.PollIntervalSeconds
	config.ReplyEnabled = req.ReplyEnabled
	config.OAuthProviderId = req.OAuthProviderId
	config.OAuthProviderSlug = req.OAuthProviderSlug
	if err := model.SaveCommunityBotConfig(config); err != nil {
		common.ApiError(c, err)
		return
	}
	GetCommunityBotConfig(c)
}

func UpdateCommunityBotGroupCheckin(c *gin.Context) {
	updateCommunityBotModule(c, model.CommunityBotModuleGroupCheckin)
}

func UpdateCommunityBotTokenUnlock(c *gin.Context) {
	updateCommunityBotModule(c, model.CommunityBotModuleTokenUnlock)
}

func updateCommunityBotModule(c *gin.Context, module string) {
	var req communityBotModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	state, err := model.GetOrCreateCommunityRoomState(module)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	state.Enabled = req.Enabled
	if req.RoomId != "" {
		state.RoomId = req.RoomId
	}
	if req.Keyword != "" {
		state.Keyword = req.Keyword
	}
	if module == model.CommunityBotModuleGroupCheckin {
		state.MinQuota = req.MinQuota
		state.MaxQuota = req.MaxQuota
		if state.MinQuota <= 0 {
			state.MinQuota = model.DefaultCommunityGroupCheckinMinQuota
		}
		if state.MaxQuota < state.MinQuota {
			state.MaxQuota = state.MinQuota
		}
	} else {
		state.UnlockDurationMins = req.UnlockDurationMins
		if state.UnlockDurationMins <= 0 {
			state.UnlockDurationMins = model.DefaultCommunityTokenUnlockDurationMinute
		}
	}
	if err := model.SaveCommunityRoomState(state); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, state)
}

func SyncCommunityBotOnce(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()
	if err := service.RunCommunityBotSyncOnce(ctx); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}
