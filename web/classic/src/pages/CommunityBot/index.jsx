/*
Copyright (C) 2025 QuantumNous

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

import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { Bot, RefreshCw, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';

const { Text } = Typography;

const defaultConfig = {
  enabled: false,
  api_base_url: 'https://dc.hhhl.cc/api',
  api_token_configured: false,
  poll_interval_seconds: 15,
  reply_enabled: true,
  oauth_provider_id: 0,
  oauth_provider_slug: '',
  last_error: '',
  last_sync_at: '',
};

const defaultGroupCheckin = {
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
};

const defaultTokenUnlock = {
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
};

const logPageSize = 20;

const moduleOptions = [
  { value: 'all', label: '全部模块' },
  { value: 'group_checkin', label: '群组签到' },
  { value: 'token_unlock', label: '令牌解锁' },
];

const resultOptions = [
  { value: 'all', label: '全部结果' },
  { value: 'ignored', label: '已忽略' },
  { value: 'unbound', label: '未绑定' },
  { value: 'already_checked_in', label: '今日已签到' },
  { value: 'checkin_awarded', label: '签到成功' },
  { value: 'token_unlocked', label: '令牌已解锁' },
  { value: 'duplicate_message', label: '重复消息' },
];

function Field({ label, children }) {
  return (
    <div className='mb-4'>
      <div className='mb-2 font-medium text-sm'>{label}</div>
      {children}
    </div>
  );
}

function formatDate(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatQuota(value) {
  if (!value) {
    return '-';
  }
  return Number(value).toLocaleString();
}

function getOptionLabel(options, value) {
  return (
    options.find((option) => option.value === value)?.label || value || '-'
  );
}

export default function CommunityBot() {
  const { t } = useTranslation();
  const [config, setConfig] = useState(defaultConfig);
  const [apiToken, setApiToken] = useState('');
  const [groupCheckin, setGroupCheckin] = useState(defaultGroupCheckin);
  const [tokenUnlock, setTokenUnlock] = useState(defaultTokenUnlock);
  const [logs, setLogs] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logModule, setLogModule] = useState('all');
  const [logResult, setLogResult] = useState('all');
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadConfig = async () => {
    try {
      const res = await API.get('/api/community-bot/config');
      if (!res.data.success) {
        showError(res.data.message || t('加载社区机器人配置失败'));
        return;
      }
      setConfig(res.data.data.config || defaultConfig);
      setGroupCheckin(res.data.data.group_checkin || defaultGroupCheckin);
      setTokenUnlock(res.data.data.token_unlock || defaultTokenUnlock);
    } catch (error) {
      showError(error);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await API.get('/api/community-bot/logs', {
        params: {
          p: logPage,
          size: logPageSize,
          module: logModule === 'all' ? undefined : logModule,
          result_code: logResult === 'all' ? undefined : logResult,
        },
      });
      if (!res.data.success) {
        showError(res.data.message || t('加载社区机器人日志失败'));
        return;
      }
      setLogs(res.data.data.items || []);
      setLogTotal(res.data.data.total || 0);
    } catch (error) {
      showError(error);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [logPage, logModule, logResult]);

  const saveAll = async () => {
    setLoading(true);
    try {
      const configRes = await API.put('/api/community-bot/config', {
        ...config,
        api_token: apiToken,
      });
      if (!configRes.data.success) {
        showError(configRes.data.message || t('保存社区机器人配置失败'));
        return;
      }

      await API.put('/api/community-bot/modules/group-checkin', groupCheckin);
      await API.put('/api/community-bot/modules/token-unlock', tokenUnlock);
      setApiToken('');
      await loadConfig();
      showSuccess(t('保存成功'));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const syncOnce = async () => {
    setLoading(true);
    try {
      const res = await API.post('/api/community-bot/sync-once');
      if (res.data.success) {
        showSuccess(t('同步完成'));
        await loadConfig();
        await loadLogs();
      } else {
        showError(res.data.message || t('同步失败'));
      }
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const logColumns = [
    {
      title: t('时间'),
      dataIndex: 'created_at',
      width: 180,
      render: (value) => formatDate(value),
    },
    {
      title: t('模块'),
      dataIndex: 'module',
      width: 110,
      render: (value) => getOptionLabel(moduleOptions, value),
    },
    {
      title: t('结果'),
      dataIndex: 'result_code',
      width: 120,
      render: (value, record) => (
        <Tag
          color={record.success ? 'green' : record.handled ? 'orange' : 'grey'}
        >
          {getOptionLabel(resultOptions, value)}
        </Tag>
      ),
    },
    {
      title: t('消息 ID'),
      dataIndex: 'message_id',
      width: 150,
      render: (value) => value || '-',
    },
    {
      title: t('社区用户'),
      dataIndex: 'chat_username',
      width: 150,
      render: (value, record) =>
        value || record.provider_user_id || record.chat_user_id || '-',
    },
    {
      title: t('new-api 用户 ID'),
      dataIndex: 'user_id',
      width: 130,
      render: (value) => value || '-',
    },
    {
      title: t('消息内容'),
      dataIndex: 'message_text',
      width: 260,
      render: (value) => (
        <Text ellipsis={{ showTooltip: true }}>{value || '-'}</Text>
      ),
    },
    {
      title: t('奖励 / 解锁'),
      dataIndex: 'quota_awarded',
      width: 180,
      render: (value, record) =>
        value
          ? `${formatQuota(value)} Tokens`
          : formatDate(record.unlocked_until),
    },
    {
      title: t('回复 / 错误'),
      dataIndex: 'reply_text',
      width: 280,
      render: (value, record) => (
        <Text ellipsis={{ showTooltip: true }}>
          {record.error || value || '-'}
        </Text>
      ),
    },
  ];

  return (
    <div className='mt-[60px] px-2'>
      <div className='mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div>
          <div className='flex items-center gap-2 text-xl font-semibold'>
            <Bot size={20} />
            {t('社区机器人')}
          </div>
          <Text type='secondary'>{t('社区签到与令牌解锁')}</Text>
        </div>
        <Space>
          <Button
            icon={<RefreshCw size={16} />}
            onClick={syncOnce}
            loading={loading}
          >
            {t('手动同步')}
          </Button>
          <Button
            type='primary'
            icon={<Save size={16} />}
            onClick={saveAll}
            loading={loading}
          >
            {t('保存设置')}
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card>
            <Form.Section text={t('基础配置')}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12} lg={6}>
                  <Field label={t('启用')}>
                    <Switch
                      checked={config.enabled}
                      onChange={(enabled) =>
                        setConfig((value) => ({ ...value, enabled }))
                      }
                    />
                  </Field>
                </Col>
                <Col xs={24} md={12} lg={6}>
                  <Field label={t('API 地址')}>
                    <Input
                      value={config.api_base_url}
                      onChange={(api_base_url) =>
                        setConfig((value) => ({ ...value, api_base_url }))
                      }
                    />
                  </Field>
                </Col>
                <Col xs={24} md={12} lg={6}>
                  <Field label={t('API Token')}>
                    <Input
                      mode='password'
                      value={apiToken}
                      placeholder={
                        config.api_token_configured ? t('已配置') : t('未配置')
                      }
                      onChange={setApiToken}
                    />
                  </Field>
                </Col>
                <Col xs={24} md={12} lg={6}>
                  <Field label={t('OAuth Provider ID')}>
                    <InputNumber
                      value={config.oauth_provider_id}
                      onChange={(oauth_provider_id) =>
                        setConfig((value) => ({
                          ...value,
                          oauth_provider_id: Number(oauth_provider_id || 0),
                        }))
                      }
                    />
                  </Field>
                </Col>
                <Col xs={24} md={12} lg={6}>
                  <Field label={t('轮询间隔秒数')}>
                    <InputNumber
                      value={config.poll_interval_seconds}
                      onChange={(poll_interval_seconds) =>
                        setConfig((value) => ({
                          ...value,
                          poll_interval_seconds: Number(
                            poll_interval_seconds || 0,
                          ),
                        }))
                      }
                    />
                  </Field>
                </Col>
                <Col xs={24} md={12} lg={6}>
                  <Field label={t('启用回复')}>
                    <Switch
                      checked={config.reply_enabled}
                      onChange={(reply_enabled) =>
                        setConfig((value) => ({ ...value, reply_enabled }))
                      }
                    />
                  </Field>
                </Col>
                <Col xs={24} md={12} lg={6}>
                  <Field label={t('最近同步')}>
                    <Input value={config.last_sync_at || '-'} readOnly />
                  </Field>
                </Col>
                <Col xs={24} md={12} lg={6}>
                  <Field label={t('最近错误')}>
                    <Input value={config.last_error || '-'} readOnly />
                  </Field>
                </Col>
              </Row>
            </Form.Section>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={t('群组签到')}>
            <Field label={t('启用')}>
              <Switch
                checked={groupCheckin.enabled}
                onChange={(enabled) =>
                  setGroupCheckin((value) => ({ ...value, enabled }))
                }
              />
            </Field>
            <Field label={t('房间 ID')}>
              <Input
                value={groupCheckin.room_id}
                onChange={(room_id) =>
                  setGroupCheckin((value) => ({ ...value, room_id }))
                }
              />
            </Field>
            <Field label={t('关键词')}>
              <Input
                value={groupCheckin.keyword}
                onChange={(keyword) =>
                  setGroupCheckin((value) => ({ ...value, keyword }))
                }
              />
            </Field>
            <Field label={t('最低额度')}>
              <InputNumber
                value={groupCheckin.min_quota}
                onChange={(min_quota) =>
                  setGroupCheckin((value) => ({
                    ...value,
                    min_quota: Number(min_quota || 0),
                  }))
                }
              />
            </Field>
            <Field label={t('最高额度')}>
              <InputNumber
                value={groupCheckin.max_quota}
                onChange={(max_quota) =>
                  setGroupCheckin((value) => ({
                    ...value,
                    max_quota: Number(max_quota || 0),
                  }))
                }
              />
            </Field>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={t('令牌解锁')}>
            <Field label={t('启用')}>
              <Switch
                checked={tokenUnlock.enabled}
                onChange={(enabled) =>
                  setTokenUnlock((value) => ({ ...value, enabled }))
                }
              />
            </Field>
            <Field label={t('房间 ID')}>
              <Input
                value={tokenUnlock.room_id}
                onChange={(room_id) =>
                  setTokenUnlock((value) => ({ ...value, room_id }))
                }
              />
            </Field>
            <Field label={t('关键词')}>
              <Input
                value={tokenUnlock.keyword}
                onChange={(keyword) =>
                  setTokenUnlock((value) => ({ ...value, keyword }))
                }
              />
            </Field>
            <Field label={t('解锁时长分钟数')}>
              <InputNumber
                value={tokenUnlock.unlock_duration_mins}
                onChange={(unlock_duration_mins) =>
                  setTokenUnlock((value) => ({
                    ...value,
                    unlock_duration_mins: Number(unlock_duration_mins || 0),
                  }))
                }
              />
            </Field>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={t('状态')}>
            <Field label={t('群组签到游标')}>
              <Input
                value={groupCheckin.last_cursor_message_id || '-'}
                readOnly
              />
            </Field>
            <Field label={t('群组签到错误')}>
              <Input value={groupCheckin.last_error || '-'} readOnly />
            </Field>
            <Field label={t('令牌解锁游标')}>
              <Input
                value={tokenUnlock.last_cursor_message_id || '-'}
                readOnly
              />
            </Field>
            <Field label={t('令牌解锁错误')}>
              <Input value={tokenUnlock.last_error || '-'} readOnly />
            </Field>
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            title={t('社区机器人日志')}
            headerExtraContent={
              <Space wrap>
                <Select
                  value={logModule}
                  style={{ width: 140 }}
                  optionList={moduleOptions.map((option) => ({
                    value: option.value,
                    label: t(option.label),
                  }))}
                  onChange={(value) => {
                    setLogModule(value);
                    setLogPage(1);
                  }}
                />
                <Select
                  value={logResult}
                  style={{ width: 150 }}
                  optionList={resultOptions.map((option) => ({
                    value: option.value,
                    label: t(option.label),
                  }))}
                  onChange={(value) => {
                    setLogResult(value);
                    setLogPage(1);
                  }}
                />
                <Button
                  icon={<RefreshCw size={16} />}
                  onClick={loadLogs}
                  loading={logsLoading}
                >
                  {t('刷新')}
                </Button>
              </Space>
            }
          >
            <Table
              columns={logColumns}
              dataSource={logs}
              rowKey='id'
              loading={logsLoading}
              scroll={{ x: 'max-content' }}
              pagination={{
                currentPage: logPage,
                pageSize: logPageSize,
                total: logTotal,
                onChange: (page) => setLogPage(page),
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
