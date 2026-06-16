# 社区机器人设计规格

**目标：** 在 new-api 管理员侧新增“社区机器人”功能，统一接入 dc.hhhl.cc 社区聊天室，实现“群组签到”和“令牌解锁”两个能力。

**架构：** 后端使用同一套 dc.hhhl.cc API 客户端、配置、轮询器和消息处理框架，分别为不同房间、关键词和业务动作注册处理逻辑。前端只提供管理员配置与状态页，所有奖励发放和令牌创建限制必须在后端校验，避免用户绕过前端直接调用 API。

**技术栈：** Go + Gin + GORM，数据库兼容 SQLite/MySQL/PostgreSQL；前端沿用默认主题 React 19 + TypeScript + TanStack Router + i18next。

---

## 背景与已确认信息

1. new-api 源码路径为 `C:\Users\Administrator\Downloads\new-api-main`，部署路径为 `C:\Users\Administrator\Downloads\newapi`。
2. 当前 new-api 仅允许 dc.hhhl.cc OAuth 登录，本地数据库已有 OAuth 绑定信息，可用社区用户 ID 映射 new-api 用户。
3. dc.hhhl.cc API 文档已确认聊天室能力：
   - `POST /chat/messages/room-timeline`，需要 `read:chat`
   - `POST /chat/messages/create-to-room`，需要 `write:chat`
   - `POST /chat/rooms/show`，需要 `read:chat`
4. 文档未发现公开的聊天室消息 webhook 或 streaming 接口，因此本期采用后端轮询房间消息。
5. 社区消息结构中可使用 `fromUserId` 匹配 `user_oauth_bindings.provider_user_id`。
6. 额度换算按现有 new-api 口径：`500000 Tokens = $1.00`。

## 权限申请

dc.hhhl.cc 开发者中心申请权限：

- `read:chat`
- `write:chat`

申请用途建议填写：

```text
用于 new-api 站点和 dc.hhhl.cc 社区聊天室联动。
机器人需要读取指定聊天室消息，识别用户发送的签到关键词和令牌解锁关键词，并根据社区 OAuth 绑定关系为对应 new-api 用户发放余额或临时解锁令牌创建权限。
同时需要在聊天室内发送处理结果提示，例如签到成功、今日已签到、账号未绑定、令牌创建已解锁等反馈消息。
```

权限边界：

- `read:chat` 只用于读取指定房间消息、识别关键词和读取发送者社区用户 ID。
- `write:chat` 只用于发送业务处理结果提示。
- 本期不需要读取用户隐私资料，不需要管理聊天室，不需要删除消息。

## 管理员菜单

侧边栏 Admin 区新增菜单：

- 名称：`社区机器人`
- 建议路径：`/community-bot`
- 建议配置键：`community_bot`

页面内分两个模块或标签：

- `群组签到`
- `令牌解锁`

设计理由：

- 两个功能共用同一套社区 API Token、API Base、轮询机制、OAuth 账号映射和运行日志。
- 管理员只需要维护一个“社区机器人”入口，后续如果继续增加社区联动能力，不需要继续把侧边栏拆散。
- 页面内按模块隔离配置，避免把两个业务的房间、关键词和状态混在一起。

## 共用配置

社区机器人共用配置项：

- `enabled`：总开关
- `api_base_url`：默认 `https://dc.hhhl.cc/api`
- `api_token`：开发者中心申请的个人 API Token 或应用 Token
- `poll_interval_seconds`：默认 15 秒
- `reply_enabled`：是否允许机器人回群提示，默认开启
- `provider_id` 或 `provider_slug`：用于定位 dc.hhhl.cc OAuth Provider
- `last_error`：最近一次错误
- `last_sync_at`：最近一次同步时间

安全要求：

- `api_token` 后端存储，前端读取配置时不返回明文，只返回是否已配置。
- 更新 Token 时允许覆盖；不填写 Token 时保持原值。
- 管理员接口必须要求管理员权限，建议限制 Root 级别用户操作 Token。

## 共用消息轮询

采用 worker 定时轮询 `POST /chat/messages/room-timeline`。

轮询策略：

- 每个启用模块维护独立房间游标。
- 每次按房间拉取最新消息，最多处理 100 条。
- 消息按创建时间或消息 ID 从旧到新处理。
- 成功处理或明确跳过后再推进游标。
- 网络错误、429、Token 无效、房间无权限时不推进游标，并记录错误。
- 应用重启后继续从数据库保存的游标恢复。

通用忽略规则：

- 忽略空文本消息。
- 忽略机器人自己发送的消息。
- 忽略未包含对应关键词的消息。
- 忽略已处理过的 `source_message_id`。

## 账号映射

映射来源：

- 表：`user_oauth_bindings`
- 字段：`provider_id`
- 字段：`provider_user_id`
- 字段：`user_id`

匹配规则：

1. 用配置中的 dc OAuth Provider 找到 `provider_id`。
2. 用聊天室消息的 `fromUserId` 匹配 `provider_user_id`。
3. 找到后得到 new-api 的 `user_id`。

未绑定处理：

- 群组签到：不发奖励，可回群提示用户先绑定 dc OAuth。
- 令牌解锁：不创建解锁记录，可回群提示用户先绑定 dc OAuth。
- 前端添加令牌时，如果当前 new-api 用户没有 dc OAuth 绑定，弹窗提醒先绑定。

建议提示文本：

- 群内未绑定：`未找到你的 new-api 账号绑定，请先使用 本社区 OAuth 登录或绑定账号。`
- 前端未绑定：`请先绑定 本社区 OAuth 后再去本站点的社区聊天室发送关键词解锁。`

## 模块一：群组签到

### 业务规则

- 房间：`chat/room/anicsahlur`
- 房间 ID：`anicsahlur`
- 关键词：消息文本包含 `我要领鸡蛋`
- 签到周期：北京时间每天 0 点重置
- 奖励范围：`$2-$10`
- Tokens 范围：`1000000-5000000`
- 换算说明：`500000 Tokens = $1.00`

### 签到流程

1. worker 读取 `anicsahlur` 房间消息。
2. 消息文本包含 `我要领鸡蛋` 时进入签到处理。
3. 用 `fromUserId` 查 OAuth 绑定用户。
4. 未绑定则跳过发奖，并按配置决定是否回群提示。
5. 已绑定则检查该用户北京时间当天是否已签到。
6. 未签到则随机发放 `1000000-5000000` Tokens。
7. 写入签到记录。
8. 按配置决定是否回群提示签到结果。

### 去重规则

必须同时防止两类重复：

- 同一用户同一天重复签到。
- 同一条社区消息被 worker 重复处理。

建议唯一约束：

- `user_id + checkin_date`
- `source_message_id`

### 回群提示

建议文案：

- 成功：`签到成功，获得 {quota} Tokens。`
- 已签到：`今天已经签过了，明天 0 点后再来。`
- 未绑定：`未找到你的 new-api 账号绑定，请先使用 本社区 OAuth 登录或绑定账号。`

## 模块二：令牌解锁

### 业务规则

- 房间：`chat/room/amlc1bekzi`
- 房间 ID：`amlc1bekzi`
- 关键词：消息文本包含 `我要添加令牌`
- 解锁时长：30 分钟
- 解锁目标：允许该用户在 30 分钟内创建新的 API Token
- 过期规则：超过 `unlocked_until` 后自动失效

### 解锁流程

1. worker 读取 `amlc1bekzi` 房间消息。
2. 消息文本包含 `我要添加令牌` 时进入令牌解锁处理。
3. 用 `fromUserId` 查 OAuth 绑定用户。
4. 未绑定则不解锁，可回群提示先绑定。
5. 已绑定则写入或刷新该用户的解锁记录：
   - `unlocked_until = 当前时间 + 30 分钟`
   - 记录来源房间、来源消息 ID、关键词和社区用户 ID。
6. 按配置决定是否回群提示解锁成功。

### 创建令牌限制

必须修改后端创建令牌接口的权限判断。

目标接口：

- `POST /api/token/`

后端规则：

- 未绑定 dc OAuth：拒绝创建，返回明确错误。
- 已绑定但没有有效解锁记录：拒绝创建。
- 有效解锁记录存在且未过期：允许创建。
- 创建成功后是否消耗解锁次数，本期采用“不消耗，只看 30 分钟窗口”。

选择“不消耗”的理由：

- 用户需求是“30分钟内解锁 添加令牌，允许该用户创建新的令牌”，不是“一条消息只允许创建一个令牌”。
- 窗口式规则更容易解释，也减少用户重复发关键词。
- 若后续要限制每次解锁最多创建 N 个令牌，可在记录表增加 `used_count` 和 `max_uses` 扩展。

安全要求：

- 不能只隐藏或禁用前端“添加令牌”按钮。
- 必须在 `POST /api/token/` 后端入口校验。
- 前端提示只是用户体验，不能作为安全边界。

### 前端交互

令牌管理页面点击“添加令牌”时：

1. 查询当前用户令牌创建解锁状态。
2. 如果当前用户未绑定 dc OAuth，弹窗提示：
   - `请先绑定 本社区 OAuth 后再去本站点的社区聊天室发送关键词解锁。`
3. 如果已绑定但未解锁或已过期，弹窗提示：
   - `请先在本站点的社区聊天室发送关键词解锁`
4. 如果已解锁且未过期，正常打开添加令牌抽屉。

状态接口建议返回：

- `bound`: 是否已绑定 dc OAuth
- `unlocked`: 是否处于有效解锁窗口
- `unlocked_until`: 解锁到期时间
- `room_id`: `amlc1bekzi`
- `keyword`: `我要添加令牌`

## 数据设计

### 社区机器人配置表

建议模型：`CommunityBotConfig`

字段：

- `id`
- `enabled`
- `api_base_url`
- `api_token`
- `poll_interval_seconds`
- `reply_enabled`
- `oauth_provider_id`
- `created_at`
- `updated_at`

说明：

- 如果项目已有系统设置表可安全存储结构化配置，也可以使用现有设置机制。
- 如果使用 JSON 字符串存储，业务代码必须使用 `common/json.go` 包装方法。

### 房间模块状态表

建议模型：`CommunityBotRoomState`

字段：

- `id`
- `module`
- `room_id`
- `keyword`
- `enabled`
- `last_cursor_message_id`
- `last_sync_at`
- `last_error`
- `created_at`
- `updated_at`

模块值：

- `group_checkin`
- `token_unlock`

唯一约束：

- `module + room_id`

### 群组签到记录表

建议模型：`CommunityCheckinRecord`

字段：

- `id`
- `user_id`
- `provider_user_id`
- `room_id`
- `source_message_id`
- `keyword`
- `checkin_date`
- `quota_awarded`
- `created_at`

唯一约束：

- `user_id + checkin_date`
- `source_message_id`

### 令牌解锁记录表

建议模型：`CommunityTokenUnlock`

字段：

- `id`
- `user_id`
- `provider_user_id`
- `room_id`
- `source_message_id`
- `keyword`
- `unlocked_until`
- `created_at`
- `updated_at`

唯一约束：

- `source_message_id`

查询索引：

- `user_id + unlocked_until`

有效解锁判断：

- 存在 `user_id = 当前用户`
- 且 `unlocked_until > 当前时间`

## 后端接口

### 管理员接口

建议路径前缀：

- `/api/admin/community-bot`

接口：

- `GET /config`：读取配置和模块状态，不返回 Token 明文。
- `PUT /config`：更新 Token、开关、轮询间隔、OAuth Provider、回群开关。
- `PUT /modules/group-checkin`：更新签到房间、关键词、奖励范围、启停状态。
- `PUT /modules/token-unlock`：更新令牌解锁房间、关键词、解锁时长、启停状态。
- `POST /test-room`：测试 Token 是否能读取指定房间。
- `POST /sync-once`：手动触发一次同步。
- `GET /logs`：查看最近运行日志或最近错误。

### 用户接口

建议路径：

- `GET /api/token/create-unlock-status`

用途：

- 令牌管理页点击“添加令牌”前查询状态。
- 返回是否绑定、是否解锁、解锁到期时间、关键词和房间 ID。

### 现有创建令牌接口

目标：

- `POST /api/token/`

新增校验：

- 调用令牌解锁服务检查当前用户是否有有效解锁。
- 未通过时返回错误，不创建令牌。

## 前端设计

### 社区机器人页面

页面路径：

- `/community-bot`

页面结构：

- 顶部显示总开关、API Base、Token 配置状态、最近同步时间、最近错误。
- `群组签到` 标签页：
  - 房间 ID：默认 `anicsahlur`
  - 关键词：默认 `我要领鸡蛋`
  - 最小奖励：默认 `1000000`
  - 最大奖励：默认 `5000000`
  - 回群提示开关
  - 手动同步按钮
- `令牌解锁` 标签页：
  - 房间 ID：默认 `amlc1bekzi`
  - 关键词：默认 `我要添加令牌`
  - 解锁时长：默认 `30` 分钟
  - 回群提示开关
  - 手动同步按钮

### 侧边栏配置

需要加入：

- `web/default/src/hooks/use-sidebar-data.ts`
- `web/default/src/hooks/use-sidebar-config.ts`
- `web/default/src/features/system-settings/maintenance/config.ts`
- `web/default/src/features/system-settings/maintenance/sidebar-modules-section.tsx`

目标：

- Admin 菜单显示 `社区机器人`。
- 侧边栏模块管理中可启用/禁用 `社区机器人`。
- URL 与模块配置映射包含 `/community-bot`。

### 令牌管理页面

需要修改：

- `web/default/src/features/keys/components/api-keys-primary-buttons.tsx`
- 可能需要补充 `web/default/src/features/keys/api.ts`

点击“添加令牌”行为：

- 原先直接 `setOpen('create')`。
- 修改为先请求 `GET /api/token/create-unlock-status`。
- 状态通过时再 `setOpen('create')`。
- 状态不通过时显示弹窗提示。

弹窗要求：

- 未解锁提示必须使用：`请先在本站点的社区聊天室发送关键词解锁`
- 未绑定 dc OAuth 时必须提醒先绑定。

## 国际化

前端默认主题需补齐：

- `zh`
- `en`
- `fr`
- `ru`
- `ja`
- `vi`

新增文案包括：

- `社区机器人`
- `群组签到`
- `令牌解锁`
- `请先在本站点的社区聊天室发送关键词解锁`
- `请先绑定 本社区 OAuth 后再去本站点的社区聊天室发送关键词解锁。`
- `解锁有效期`
- `房间 ID`
- `关键词`
- `手动同步`
- `最近同步时间`
- `最近错误`

后端错误文案至少需支持：

- 中文
- 英文

## 错误处理

Token 无效：

- 管理员页面显示 Token 无效。
- worker 暂停本轮处理，不推进游标。

房间无权限或不存在：

- 管理员页面显示无法读取房间。
- worker 不处理该房间消息。

社区用户未绑定：

- 业务动作不执行。
- 可回群提醒先绑定。

重复消息：

- 不重复发奖。
- 不重复创建解锁记录。

重复签到：

- 不重复发奖。
- 可回群提示今日已签到。

创建令牌未解锁：

- 后端拒绝创建。
- 前端弹窗提示 `请先在本站点的社区聊天室发送关键词解锁`。

发放额度成功但回群失败：

- 保留额度发放结果。
- 记录回群失败错误，不回滚奖励。

令牌解锁成功但回群失败：

- 保留解锁结果。
- 记录回群失败错误，不回滚解锁。

## 安全与审计

必须记录：

- 处理的房间 ID
- 命中的关键词
- 社区消息 ID
- 社区用户 ID
- 映射到的 new-api 用户 ID
- 发放额度或解锁到期时间
- 处理时间
- 错误信息

敏感信息处理：

- 不在日志中输出 API Token 明文。
- 不在前端返回 API Token 明文。
- 不把 Token 写入可公开访问的前端构建产物。

## 验收标准

管理员侧：

- Admin 侧边栏能看到 `社区机器人`。
- 页面能配置 API Base、API Token、轮询间隔和回群开关。
- 页面能分别配置 `群组签到` 和 `令牌解锁`。
- 页面能显示最近同步时间和最近错误。

群组签到：

- 在 `chat/room/anicsahlur` 发送包含 `我要领鸡蛋` 的消息后，绑定用户获得 `1000000-5000000` Tokens。
- 同一用户北京时间同一天重复发送不会重复发奖。
- 未绑定用户不会发奖，并能收到绑定提示。
- 重启服务后不会重复处理已处理消息。

令牌解锁：

- 默认情况下，用户不能直接在令牌管理创建新令牌。
- 未绑定 dc OAuth 的用户点击添加令牌时，会看到绑定提示。
- 已绑定但未在 `chat/room/amlc1bekzi` 发送 `我要添加令牌` 的用户点击添加令牌时，会看到 `请先在本站点的社区聊天室发送关键词解锁`。
- 用户在 `chat/room/amlc1bekzi` 发送包含 `我要添加令牌` 的消息后，30 分钟内可以创建新令牌。
- 超过 30 分钟后再次创建令牌会被拒绝。
- 直接调用 `POST /api/token/` 也会受到同样限制。

兼容性：

- 数据库迁移兼容 SQLite、MySQL、PostgreSQL。
- 前端默认主题可构建。
- 新增 JSON 编解码遵守项目 `common/json.go` 规则。

## 预期修改范围

后端：

- `model/`
- `service/`
- `controller/`
- `router/api-router.go`
- `i18n/`
- 可能涉及应用启动 worker 注册位置

前端：

- `web/default/src/features/community-bot/`
- `web/default/src/routes/_authenticated/community-bot.tsx`
- `web/default/src/hooks/use-sidebar-data.ts`
- `web/default/src/hooks/use-sidebar-config.ts`
- `web/default/src/features/system-settings/maintenance/config.ts`
- `web/default/src/features/system-settings/maintenance/sidebar-modules-section.tsx`
- `web/default/src/features/keys/`
- `web/default/src/i18n/locales/*.json`

不修改：

- 不修改 new-api/QuantumNous 品牌归属信息。
- 不改现有 OAuth 登录主流程，除非只为查询绑定状态补充只读方法。
- 不改现有站内个人签到逻辑。

## 实施顺序建议

1. 后端数据模型与迁移。
2. dc.hhhl.cc API 客户端。
3. OAuth 绑定查询服务。
4. 群组签到服务与测试。
5. 令牌解锁服务与测试。
6. 创建令牌接口后端强制校验。
7. 管理员 API。
8. worker 注册与运行状态。
9. 前端社区机器人页面。
10. 前端令牌管理添加按钮拦截。
11. i18n 补齐。
12. 本地构建与接口验证。

## 规格自检结果

- 已明确两个房间：`anicsahlur`、`amlc1bekzi`。
- 已明确两个关键词：`我要领鸡蛋`、`我要添加令牌`。
- 已明确令牌解锁有效期为 30 分钟。
- 已明确未绑定 dc OAuth 时的前端和群内提示。
- 已明确创建令牌限制必须在后端 `POST /api/token/` 校验。
- 已明确共用 API 权限为 `read:chat` 和 `write:chat`。
- 已明确 SQLite/MySQL/PostgreSQL 兼容要求。
