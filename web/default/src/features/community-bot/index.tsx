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
import { useEffect, useState, type ReactNode } from 'react'
import { Bot, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  CommunityBotConfig,
  CommunityBotRoomState,
  getCommunityBotConfig,
  syncCommunityBotOnce,
  updateCommunityBotConfig,
  updateCommunityBotModule,
} from './api'

const defaultConfig: CommunityBotConfig = {
  enabled: false,
  api_base_url: 'https://dc.hhhl.cc/api',
  api_token_configured: false,
  poll_interval_seconds: 15,
  reply_enabled: true,
  oauth_provider_id: 0,
  oauth_provider_slug: '',
  last_error: '',
  last_sync_at: '',
}

const defaultGroupCheckin: CommunityBotRoomState = {
  enabled: false,
  module: 'group_checkin',
  room_id: 'anicsahlur',
  keyword: '我要领鸡蛋',
  min_quota: 1000000,
  max_quota: 5000000,
  unlock_duration_mins: 0,
  last_cursor_message_id: '',
  last_error: '',
  last_sync_at: '',
}

const defaultTokenUnlock: CommunityBotRoomState = {
  enabled: false,
  module: 'token_unlock',
  room_id: 'anicsahlur',
  keyword: '我要添加令牌',
  min_quota: 0,
  max_quota: 0,
  unlock_duration_mins: 30,
  last_cursor_message_id: '',
  last_error: '',
  last_sync_at: '',
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className='grid gap-2'>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function CommunityBot() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<CommunityBotConfig>(defaultConfig)
  const [apiToken, setApiToken] = useState('')
  const [groupCheckin, setGroupCheckin] =
    useState<CommunityBotRoomState>(defaultGroupCheckin)
  const [tokenUnlock, setTokenUnlock] =
    useState<CommunityBotRoomState>(defaultTokenUnlock)
  const [loading, setLoading] = useState(false)

  const loadConfig = async () => {
    const res = await getCommunityBotConfig()
    if (!res.success) {
      toast.error(res.message || t('Failed to load community bot config'))
      return
    }
    setConfig(res.data.config)
    setGroupCheckin(res.data.group_checkin)
    setTokenUnlock(res.data.token_unlock)
  }

  useEffect(() => {
    void loadConfig()
  }, [])

  const saveAll = async () => {
    setLoading(true)
    try {
      const configRes = await updateCommunityBotConfig({
        ...config,
        api_token: apiToken,
      })
      if (!configRes.success) {
        toast.error(configRes.message || t('Failed to save community bot config'))
        return
      }
      await updateCommunityBotModule('group-checkin', groupCheckin)
      await updateCommunityBotModule('token-unlock', tokenUnlock)
      setApiToken('')
      await loadConfig()
      toast.success(t('Saved'))
    } finally {
      setLoading(false)
    }
  }

  const syncOnce = async () => {
    setLoading(true)
    try {
      const res = await syncCommunityBotOnce()
      if (res.success) {
        toast.success(t('Synced'))
        await loadConfig()
      } else {
        toast.error(res.message || t('Sync failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Community Bot')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <div className='flex gap-2'>
          <Button size='sm' variant='outline' onClick={syncOnce} disabled={loading}>
            <RefreshCw className='h-4 w-4' />
            {t('Manual Sync')}
          </Button>
          <Button size='sm' onClick={saveAll} disabled={loading}>
            <Save className='h-4 w-4' />
            {t('Save')}
          </Button>
        </div>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='grid gap-4 lg:grid-cols-3'>
          <Card className='lg:col-span-3'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Bot className='h-4 w-4' />
                {t('Community Bot')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                <Field label={t('Enabled')}>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(enabled) =>
                      setConfig((value) => ({ ...value, enabled }))
                    }
                  />
                </Field>
                <Field label={t('API Base URL')}>
                  <Input
                    value={config.api_base_url}
                    onChange={(event) =>
                      setConfig((value) => ({
                        ...value,
                        api_base_url: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label={t('API Token')}>
                  <Input
                    type='password'
                    value={apiToken}
                    placeholder={
                      config.api_token_configured
                        ? t('Configured')
                        : t('Not configured')
                    }
                    onChange={(event) => setApiToken(event.target.value)}
                  />
                </Field>
                <Field label={t('OAuth Provider ID')}>
                  <Input
                    type='number'
                    value={config.oauth_provider_id}
                    onChange={(event) =>
                      setConfig((value) => ({
                        ...value,
                        oauth_provider_id: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label={t('Poll Interval Seconds')}>
                  <Input
                    type='number'
                    value={config.poll_interval_seconds}
                    onChange={(event) =>
                      setConfig((value) => ({
                        ...value,
                        poll_interval_seconds: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label={t('Reply Enabled')}>
                  <Switch
                    checked={config.reply_enabled}
                    onCheckedChange={(reply_enabled) =>
                      setConfig((value) => ({ ...value, reply_enabled }))
                    }
                  />
                </Field>
                <Field label={t('Last Sync At')}>
                  <Input value={config.last_sync_at || '-'} readOnly />
                </Field>
                <Field label={t('Last Error')}>
                  <Input value={config.last_error || '-'} readOnly />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Group Check-in')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-4'>
                <Field label={t('Enabled')}>
                  <Switch
                    checked={groupCheckin.enabled}
                    onCheckedChange={(enabled) =>
                      setGroupCheckin((value) => ({ ...value, enabled }))
                    }
                  />
                </Field>
                <Field label={t('Room ID')}>
                  <Input
                    value={groupCheckin.room_id}
                    onChange={(event) =>
                      setGroupCheckin((value) => ({
                        ...value,
                        room_id: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label={t('Keyword')}>
                  <Input
                    value={groupCheckin.keyword}
                    onChange={(event) =>
                      setGroupCheckin((value) => ({
                        ...value,
                        keyword: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label={t('Minimum Quota')}>
                  <Input
                    type='number'
                    value={groupCheckin.min_quota}
                    onChange={(event) =>
                      setGroupCheckin((value) => ({
                        ...value,
                        min_quota: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label={t('Maximum Quota')}>
                  <Input
                    type='number'
                    value={groupCheckin.max_quota}
                    onChange={(event) =>
                      setGroupCheckin((value) => ({
                        ...value,
                        max_quota: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Token Unlock')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-4'>
                <Field label={t('Enabled')}>
                  <Switch
                    checked={tokenUnlock.enabled}
                    onCheckedChange={(enabled) =>
                      setTokenUnlock((value) => ({ ...value, enabled }))
                    }
                  />
                </Field>
                <Field label={t('Room ID')}>
                  <Input
                    value={tokenUnlock.room_id}
                    onChange={(event) =>
                      setTokenUnlock((value) => ({
                        ...value,
                        room_id: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label={t('Keyword')}>
                  <Input
                    value={tokenUnlock.keyword}
                    onChange={(event) =>
                      setTokenUnlock((value) => ({
                        ...value,
                        keyword: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label={t('Unlock Duration Minutes')}>
                  <Input
                    type='number'
                    value={tokenUnlock.unlock_duration_mins}
                    onChange={(event) =>
                      setTokenUnlock((value) => ({
                        ...value,
                        unlock_duration_mins: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Status')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-4'>
                <Field label={t('Group Check-in Cursor')}>
                  <Input value={groupCheckin.last_cursor_message_id || '-'} readOnly />
                </Field>
                <Field label={t('Group Check-in Error')}>
                  <Input value={groupCheckin.last_error || '-'} readOnly />
                </Field>
                <Field label={t('Token Unlock Cursor')}>
                  <Input value={tokenUnlock.last_cursor_message_id || '-'} readOnly />
                </Field>
                <Field label={t('Token Unlock Error')}>
                  <Input value={tokenUnlock.last_error || '-'} readOnly />
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
