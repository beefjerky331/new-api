/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { api } from '@/lib/api'

export type CommunityBotConfig = {
  enabled: boolean
  api_base_url: string
  api_token_configured: boolean
  poll_interval_seconds: number
  reply_enabled: boolean
  oauth_provider_id: number
  oauth_provider_slug: string
  last_error: string
  last_sync_at: string
}

export type CommunityBotRoomState = {
  enabled: boolean
  module: string
  room_id: string
  keyword: string
  min_quota: number
  max_quota: number
  unlock_duration_mins: number
  last_cursor_message_id: string
  last_error: string
  last_sync_at: string
}

export type CommunityBotConfigResponse = {
  success: boolean
  message?: string
  data: {
    config: CommunityBotConfig
    group_checkin: CommunityBotRoomState
    token_unlock: CommunityBotRoomState
  }
}

export type TokenCreateUnlockStatus = {
  bound: boolean
  unlocked: boolean
  unlocked_until?: string | null
  room_id: string
  keyword: string
}

export async function getCommunityBotConfig(): Promise<CommunityBotConfigResponse> {
  const res = await api.get('/api/community-bot/config')
  return res.data
}

export async function updateCommunityBotConfig(
  data: Partial<CommunityBotConfig> & { api_token?: string }
): Promise<CommunityBotConfigResponse> {
  const res = await api.put('/api/community-bot/config', data)
  return res.data
}

export async function updateCommunityBotModule(
  module: 'group-checkin' | 'token-unlock',
  data: Partial<CommunityBotRoomState>
) {
  const res = await api.put(`/api/community-bot/modules/${module}`, data)
  return res.data
}

export async function syncCommunityBotOnce() {
  const res = await api.post('/api/community-bot/sync-once')
  return res.data
}

export async function getTokenCreateUnlockStatus(): Promise<{
  success: boolean
  message?: string
  data: TokenCreateUnlockStatus
}> {
  const res = await api.get('/api/token/create-unlock-status')
  return res.data
}
