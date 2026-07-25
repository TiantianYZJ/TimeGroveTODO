# 系统安全审查报告

审查日期: 2026-07-25
覆盖范围: 认证安全 / 多人协作 / 数据同步 / 社区系统 / API 输入验证

---

## 统计

| 等级 | 数量 |
|------|------|
| 🔴 高风险 | 11 |
| 🟡 中风险 | 19 |
| 🟢 低风险 | 16 |
| 保留（非问题） | 1 |
| **总计** | **46** |

---

## 🔴 高风险 (11)

### H1. JWT Secret 硬编码回退
- **文件**: `backend/middleware/auth.js:3`
- **描述**: 当环境变量 `JWT_SECRET` 未设置时，回退到源码中的硬编码字符串 `'timegreenpath_jwt_secret_key_2024'`，且无启动校验。
- **场景**: 部署遗漏 .env 或变量名拼错时，任何知道此值的攻击者可伪造任意用户 JWT，包括管理员。

### H2. getTodosBatch 越权读取
- **文件**: `backend/controllers/todoController.js:1257`
- **描述**: `getTodosBatch` 查询 todo 时没有加 `AND user_id = ?` 过滤。社区帖子暴露的 `todoIds` 可被任何用户通过此接口读取完整的待办数据（含备注、图片URL、位置、子任务）。
- **场景**: 攻击者从社区帖看到 todoIds，调用 `POST /todos/batch` 获取其他用户的私密待办数据。

### H3. QR 码状态接口返回 JWT
- **文件**: `backend/controllers/authController.js:299`
- **描述**: `GET /auth/qrcode/status` 未加 authMiddleware。当 QR 会话确认时返回完整 JWT token。
- **场景**: 攻击者获得 sceneId（从 URL、日志等），轮询此接口捕获用户刚确认登录时的 JWT。

### H4. proxyUpload SSRF
- **文件**: `backend/controllers/uploadController.js:157`
- **描述**: `uploadUrl` 直接取自 `req.body`，服务器向其发起 HTTP PUT。无 URL 白名单。
- **场景**: 攻击者传入 `uploadUrl=http://127.0.0.1:3000/admin/config` 修改管理员配置，或访问云元数据端点。

### H5. proxyUpload 任意文件上传 + 100MB
- **文件**: `backend/controllers/uploadController.js:148`
- **描述**: proxyUploader 无 fileFilter，限 100MB。可上传任意类型文件到任意目标。
- **场景**: 上传 HTML 含 XSS payload 并转发到公开路径，在服务器域名下托管恶意内容。

### H6. increaseTodoLimit 无正负边界检查
- **文件**: `backend/controllers/authController.js:198`
- **描述**: amount 参数无范围校验。负值可导致 todo_limit 为负数，超大正值可绕过限制。
- **场景**: 前端或攻击者传 `amount=-1000`，导致待办上限为负数，创建待办检查永远失败。

### H7. 无全局请求频率限制
- **文件**: `backend/app.js:37`
- **描述**: 全站无 rate-limiting 中间件。所有接口无频率限制。
- **场景**: 攻击者快速调用 POST /auth/login 耗尽微信 API 额度；大量 POST /todos/sync 耗尽数据库连接池。

### H8. POST /log/report 未认证未限速
- **文件**: `backend/routes/logRoutes.js:5`
- **描述**: 日志上报接口完全开放，无认证无限制，接收任意数据。
- **场景**: 攻击者每秒注入 10,000 条假日志，填满日志存储，掩盖真实攻击行为。

### H9. pageSize 无上限
- **文件**: `backend/controllers/todoController.js:103`
- **描述**: 分页 pageSize 通过 parseInt 解析但无硬性上限。`pageSize=9999999` 可触发全表扫描。
- **场景**: 请求 `GET /todos/list?pageSize=9999999` 导致数据库排序并返回数百万行，耗尽服务器内存和 I/O。

### H10. approveRequest 绕过 member_limit
- **文件**: `backend/controllers/collabController.js:321`
- **描述**: 审批加入请求时不检查当前成员数是否已达 member_limit。与 autoJoin 和 sendRequest 不同。
- **场景**: member_limit=50 的组合已有 50 人，管理员仍然可以审批第 51 个加入请求。

### H11. getMembers 和 getById 无权限检查
- **文件**: `backend/controllers/comboController.js:532` 和 `:82`
- **描述**: getMembers 返回任意组合的完整成员列表；getById 返回组合名称、描述、成员列表、共享待办。均不要求调用者是组合成员。组合 ID 是自增整数可枚举。
- **场景**: 攻击者遍历 combo ID 1-10000，收集所有共享组合的成员身份（昵称、角色）和待办内容。

---

## 🟡 中风险 (19)

### M1. CORS 配置为全开放
- **文件**: `backend/app.js:37`
- **描述**: `app.use(cors())` 无参数，`Access-Control-Allow-Origin: *`。
- **场景**: 任意第三方网站可跨域访问 API，未认证端点可被直接读取。

### M2. openid 暴露给客户端
- **文件**: `backend/controllers/authController.js:93,173`
- **描述**: 用户在微信环境下的持久标识符 openid 在多个 API 响应中返回给客户端。
- **场景**: 客户端或网络观察者可获知用户 openid，可用于跨服务追踪。

### M3. MIME 类型完全由客户端声明
- **文件**: `backend/controllers/uploadController.js:45`
- **描述**: multer fileFilter 检查的 `file.mimetype` 由客户端设置，可随意伪造。无服务端文件签名验证。
- **场景**: 上传 .exe 文件携带 `Content-Type: image/jpeg`，绕过检查存储在 uploads/ 目录下。

### M4. 点赞接口无唯一约束有竞态条件
- **文件**: `backend/controllers/likesController.js:37`
- **描述**: toggleLike 使用 SELECT-then-INSERT/DELETE 模式，表无 UNIQUE(post_id, user_id) 约束。并发请求可重复插入。
- **场景**: 同时发送多个点赞请求，SELECT 全部未找到，全部 INSERT 成功，创建重复点赞记录。

### M5. 同步删除的数据可能复活
- **文件**: `utils/sync.js:302`
- **描述**: `mergeChanges()` 中处理 `cloudDeletedIds` 时读取 `local.deletedAt` 而非云端时间戳。本地未删除时条件永远不成立，导致已删除待办在本地永远不删除，下次同步时重新上传复活。
- **场景**: 用户在网页版删除待办，手机端同步后该待办仍存在，下次同步时作为本地变更重新上传。

### M6. 网络重试导致待办重复
- **文件**: `backend/controllers/todoController.js:839`
- **描述**: sync 接口的 fallback INSERT 未包含 `todo_id`。服务端已写入但响应丢失时，客户端重试会创建重复待办。
- **场景**: 网络超时后客户端重试 sync，待办在服务端已创建，重试的 INSERT 因无 todo_id 创建第二份。

### M7. 创建/更新待办无事务
- **文件**: `backend/controllers/todoController.js:254,443`
- **描述**: 创建和更新待办（增删标签）涉及多步查询但未包裹在事务中。中途失败导致孤立数据。
- **场景**: 更新待办时 `DELETE FROM todo_tags` 成功但 `INSERT INTO todo_tags` 失败，待办丢失所有标签。

### M8. 帖子删除无事务
- **文件**: `backend/controllers/postsController.js:355`
- **描述**: 删除帖子时标记 post/polls/comments 三表 UPDATE 不在事务内。
- **场景**: 帖子标记为已删除后崩溃，投票和评论仍可见。

### M9. 文件上传仅校验客户端声明的 MIME 类型
- **文件**: `backend/controllers/uploadController.js:39`
- **描述**: 评论/头像上传也依赖客户端 mimetype，可伪造。
- **场景**: 上传伪装为图片的 PHP/HTML 文件到 uploads/avatars/，若服务端处理可执行代码则风险升高。

### M10. 组合分享码可被枚举
- **文件**: `backend/controllers/collabController.js:17`
- **描述**: shareCode 端点无频率限制。加入接口对有效/无效码返回不同状态码，可作为枚举 oracle。
- **场景**: 自动化脚本遍历 6 位 shareCode，通过响应区分有效/无效，发现后可自动加入组合。

### M11. completeSharedTodo "全员完成" 竞态条件
- **文件**: `backend/controllers/collabController.js:539`
- **描述**: assign_type 'all' 的待办使用非原子 check-then-update。多人同时完成可看到相同边界值，都触发完成逻辑。
- **场景**: 最后两名成员同时点击完成，都看到 count >= 目标值，都 UPDATE completed_at，触发两次通知。

### M12. approveRequest 无事务
- **文件**: `backend/controllers/collabController.js:288`
- **描述**: 审批加入涉及 4 步写入（插入成员、分配待办、更新状态）无事务。
- **场景**: 成员插入成功后崩溃，请求状态仍为 pending，分配部分完成。

### M13. leaveCombo 无事务
- **文件**: `backend/controllers/collabController.js:909`
- **描述**: 退出组合涉及多表清理和自动解散操作，没有事务保护。
- **场景**: 自动解散时 shared_todos 已删但组合成员记录未删，产生孤立记录。

### M14. autoJoin 和 sendRequest TOCTOU
- **文件**: `backend/controllers/collabController.js:1054,200`
- **描述**: check-then-insert 模式非原子。并发操作可超过 member_limit。
- **场景**: member_limit=2 的组合已有 2 人，两人同时 autoJoin，都通过检查然后都 INSERT，结果 4 人在 2 人限组合中。

### M15. 同步冲突解决忽略版本号
- **文件**: `backend/controllers/todoController.js:1151`
- **描述**: sync 端点冲突解决仅比较时间戳，忽略 version 字段。前端 mergeChanges 也仅用时间戳。
- **场景**: 同一毫秒内在两台设备编辑同一待办，时间戳相等时选择结果不可预测，一方修改静默丢失。

### M16. 请求体明文记录到日志
- **文件**: `backend/middleware/requestLogger.js:12`
- **描述**: requestLogger 记录每个请求的完整 req.body，含备注、位置、个人信息等 PII。
- **场景**: 运维人员查看日志时可看到所有用户提交的敏感数据。

### M17. 无 Token 撤销/刷新机制
- **文件**: `backend/middleware/auth.js:5`
- **描述**: JWT 无黑名单、无撤销列表、无 refresh token。泄露后 7 天内无法吊销。
- **场景**: 用户的 JWT 被盗（如 URL 泄露），攻击者可在 7 天内任意使用，用户无法主动吊销。

### M18. 编辑公告切换类型时表单数据消失
- **文件**: `packageAdmin/notice-edit/notice-edit.js:51`
- **描述**: selectType() 切换类型时直接清空所有表单字段。如果管理员误点切换，已填写的内容就丢失了。
- **场景**: 管理员正在编辑自定义公告，误触"版本更新"标签，所有已写内容被清空，需要重新输入。

### M19. 第三方图片上传后端无法控制
- **文件**: `packageCommunity/post-edit/post-edit.js:25`
- **描述**: 社区帖子图片直接上传到第三方 img.scdn.io，后端仅存 URL。无内容扫描、无病毒检查。
- **场景**: 用户上传违规内容至第三方，后端无法拦截，也无渠道删除。

---

## 🟢 低风险 (16)

### L1. JWT 缺少 iat/jti 标准声明
- **文件**: `backend/middleware/auth.js:5`
- 无法区分 Token 发行时间，无法单独标识/吊销特定 Token。

### L2. 组合 shareCode 基于 Math.random()
- **文件**: `backend/controllers/comboController.js:5`
- 使用伪随机数生成器，理论上可预测后续生成的值。

### L3. checkin getMonth 年月参数无范围校验
- **文件**: `backend/controllers/checkinController.js:320`
- year=0 或 month=13 可导致 MySQL 日期错误。

### L4. X-Forwarded-For 可伪造
- **文件**: `backend/controllers/postsController.js:153`
- 存储的 IP 地址不可信用于审计。

### L5. 用户搜索 LIKE 查询无长度限制
- **文件**: `backend/controllers/userController.js:70`
- 超长搜索字符串影响数据库性能。

### L6. 批准加入时 assigneeIds 未校验为组合成员
- **文件**: `backend/controllers/collabController.js:517`
- 任意 user ID 可被插入 shared_todo_assignments。

### L7. owner 可降低 memberLimit 低于当前人数
- **文件**: `backend/controllers/combosController.js:424`
- 降低后不影响已有成员但阻止新成员加入，显示误导性数值。

### L8. 评论级联删除策略不一致
- **文件**: `backend/controllers/commentController.js:302`
- 删除回复会级联删除子回复；删除顶层评论不会级联。

### L9. 帖子 viewer_ids 无限增长
- **文件**: `backend/controllers/postsController.js:267`
- viewer_ids JSON 数组无清理机制，热门帖子响应会越来越慢。

### L10. Token 在 wx 存储中未加密
- **文件**: `utils/api.js:9`
- JWT 通过 wx.setStorageSync 存储，无额外保护。

### L11. 认证端点无频率限制
- **文件**: `backend/routes/authRoutes.js:6`
- 登录和 QR 码接口无速率限制。

### L12. 头像昵称无校验
- **文件**: `backend/controllers/authController.js:120`
- avatarUrl 无格式验证，昵称无长度限制。

### L13. getRequests 缺少 comboId 时全表扫描
- **文件**: `backend/controllers/collabController.js:230`
- 无 comboId 参数时拉取全部等待请求。

### L14. 文件扩展名与实际内容不匹配
- **文件**: `backend/controllers/uploadController.js:23`
- extname 取自客户端文件名，可与实际内容不同。

### L15. 数据库连接池仅 10
- **文件**: `backend/config/database.js:9`
- `connectionLimit: 10` 在并发高时可能耗尽。

### L16. 同步本地锁不保护 localStorage 写入
- **文件**: `utils/sync.js:9`
- syncLock 仅序列化网络同步，不协调本地写入和同步快照。

---

## 保留（非问题）

### ~~XP1. 管理员 API 可自行提权~~ 保留
- **文件**: `backend/controllers/adminController.js:1241`
- 用户说明: 此为有意设计，管理员应能管理其他管理员。
- **结论**: 保留当前设计。

---

## 需要你决策的项目

### P1. Admin ID 迁移到数据库 + 管理页面
- **文件**: `backend/controllers/adminController.js:50`
- **问题**: admins.json 存储在文件系统，不随数据库备份，部署易丢失
- **方案**: 
  1. 创建 `admin_users` 数据库表（user_id + role + created_at）
  2. 新增 `packageAdmin/admin-manage/` 管理页面（列表/添加/移除管理员）
  3. 用户详情页增加"设为管理员/取消管理员"按钮
- **是否执行？**

### P2. 其余真实发现的修复
- 上述 H1-H11、M1-M19、L1-L16 中除已注明保留的以外，是否全部执行修复？
