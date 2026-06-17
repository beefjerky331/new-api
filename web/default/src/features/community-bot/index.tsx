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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionPageLayout } from '@/components/layout'
import {
  CommunityBotLog,
  CommunityBotConfig,
  CommunityBotRoomState,
  getCommunityBotConfig,
  getCommunityBotLogs,
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

const logPageSize = 20

const moduleOptions = [
  { value: 'all', label: 'All Modules' },
  { value: 'group_checkin', label: 'Group Check-in' },
  { value: 'token_unlock', label: 'Token Unlock' },
]

const resultOptions = [
  { value: 'all', label: 'All Results' },
  { value: 'ignored', label: 'Ignored' },
  { value: 'unbound', label: 'Unbound' },
  { value: 'already_checked_in', label: 'Already checked in' },
  { value: 'checkin_awarded', label: 'Check-in awarded' },
  { value: 'token_unlocked', label: 'Token unlocked' },
  { value: 'duplicate_message', label: 'Duplicate message' },
]

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='grid gap-2'>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function formatDate(value?: string | null) {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function formatQuota(value: number) {
  if (!value) {
    return '-'
  }
  return value.toLocaleString()
}

export function CommunityBot() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<CommunityBotConfig>(defaultConfig)
  const [apiToken, setApiToken] = useState('')
  const [groupCheckin, setGroupCheckin] =
    useState<CommunityBotRoomState>(defaultGroupCheckin)
  const [tokenUnlock, setTokenUnlock] =
    useState<CommunityBotRoomState>(defaultTokenUnlock)
  const [logs, setLogs] = useState<CommunityBotLog[]>([])
  const [logTotal, setLogTotal] = useState(0)
  const [logPage, setLogPage] = useState(1)
  const [logModule, setLogModule] = useState('all')
  const [logResult, setLogResult] = useState('all')
  const [loading, setLoading] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)

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

  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      const res = await getCommunityBotLogs({
        p: logPage,
        size: logPageSize,
        module: logModule === 'all' ? undefined : logModule,
        result_code: logResult === 'all' ? undefined : logResult,
      })
      if (!res.success) {
        toast.error(res.message || t('Failed to load community bot logs'))
        return
      }
      setLogs(res.data.items || [])
      setLogTotal(res.data.total || 0)
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    void loadConfig()
  }, [])

  useEffect(() => {
    void loadLogs()
  }, [logPage, logModule, logResult])

  const saveAll = async () => {
    setLoading(true)
    try {
      const configRes = await updateCommunityBotConfig({
        ...config,
        api_token: apiToken,
      })
      if (!configRes.success) {
        toast.error(
          configRes.message || t('Failed to save community bot config')
        )
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
        await loadLogs()
      } else {
        toast.error(res.message || t('Sync failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  const totalLogPages = Math.max(1, Math.ceil(logTotal / logPageSize))

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Community Bot')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <div className='flex gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={syncOnce}
            disabled={loading}
          >
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
                  <Input
                    value={groupCheckin.last_cursor_message_id || '-'}
                    readOnly
                  />
                </Field>
                <Field label={t('Group Check-in Error')}>
                  <Input value={groupCheckin.last_error || '-'} readOnly />
                </Field>
                <Field label={t('Token Unlock Cursor')}>
                  <Input
                    value={tokenUnlock.last_cursor_message_id || '-'}
                    readOnly
                  />
                </Field>
                <Field label={t('Token Unlock Error')}>
                  <Input value={tokenUnlock.last_error || '-'} readOnly />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card className='lg:col-span-3'>
            <CardHeader>
              <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                <CardTitle>{t('Community Bot Logs')}</CardTitle>
                <div className='flex flex-wrap gap-2'>
                  <Select
                    items={moduleOptions.map((option) => ({
                      value: option.value,
                      label: t(option.label),
                    }))}
                    value={logModule}
                    onValueChange={(value) => {
                      if (value === null) return
                      setLogModule(value)
                      setLogPage(1)
                    }}
                  >
                    <SelectTrigger className='h-8 w-[150px]'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {moduleOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select
                    items={resultOptions.map((option) => ({
                      value: option.value,
                      label: t(option.label),
                    }))}
                    value={logResult}
                    onValueChange={(value) => {
                      if (value === null) return
                      setLogResult(value)
                      setLogPage(1)
                    }}
                  >
                    <SelectTrigger className='h-8 w-[170px]'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {resultOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={loadLogs}
                    disabled={logsLoading}
                  >
                    <RefreshCw className='h-4 w-4' />
                    {t('Refresh')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Time')}</TableHead>
                    <TableHead>{t('Module')}</TableHead>
                    <TableHead>{t('Result')}</TableHead>
                    <TableHead>{t('Message ID')}</TableHead>
                    <TableHead>{t('Community User')}</TableHead>
                    <TableHead>{t('new-api User ID')}</TableHead>
                    <TableHead>{t('Message')}</TableHead>
                    <TableHead>{t('Reward / Unlock')}</TableHead>
                    <TableHead>{t('Reply / Error')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className='text-muted-foreground h-20 text-center'
                      >
                        {logsLoading ? t('Loading...') : t('No logs')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{formatDate(log.created_at)}</TableCell>
                        <TableCell>
                          {t(
                            moduleOptions.find(
                              (option) => option.value === log.module
                            )?.label || log.module
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              log.success
                                ? 'text-green-600'
                                : log.handled
                                  ? 'text-amber-600'
                                  : 'text-muted-foreground'
                            }
                          >
                            {t(
                              resultOptions.find(
                                (option) => option.value === log.result_code
                              )?.label || log.result_code
                            )}
                          </span>
                        </TableCell>
                        <TableCell>{log.message_id || '-'}</TableCell>
                        <TableCell>
                          {log.chat_username ||
                            log.provider_user_id ||
                            log.chat_user_id ||
                            '-'}
                        </TableCell>
                        <TableCell>{log.user_id || '-'}</TableCell>
                        <TableCell className='max-w-[260px] break-words whitespace-normal'>
                          {log.message_text || '-'}
                        </TableCell>
                        <TableCell>
                          {log.quota_awarded
                            ? `${formatQuota(log.quota_awarded)} Tokens`
                            : formatDate(log.unlocked_until)}
                        </TableCell>
                        <TableCell className='max-w-[320px] break-words whitespace-normal'>
                          {log.error || log.reply_text || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className='mt-4 flex items-center justify-between gap-3'>
                <div className='text-muted-foreground text-sm'>
                  {t('{{count}} log entries', { count: logTotal })}
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() =>
                      setLogPage((value) => Math.max(1, value - 1))
                    }
                    disabled={logsLoading || logPage <= 1}
                  >
                    {t('Previous')}
                  </Button>
                  <span className='text-sm tabular-nums'>
                    {logPage} / {totalLogPages}
                  </span>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() =>
                      setLogPage((value) => Math.min(totalLogPages, value + 1))
                    }
                    disabled={logsLoading || logPage >= totalLogPages}
                  >
                    {t('Next')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
