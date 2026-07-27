# 自建文件存储系统设计

## 背景

弃用第三方 storage.to 文件托管，改为自建存储。后端 ECS 服务器直接存储文件，前端直连上传/下载，消除对第三方 API 的依赖。

## 数据库

### `files` 表（新建）

```sql
CREATE TABLE files (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  post_id VARCHAR(100) DEFAULT NULL,
  todo_id BIGINT DEFAULT NULL,
  filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT NULL,

  INDEX idx_user_id (user_id),
  INDEX idx_post_id (post_id),
  INDEX idx_expires_at (expires_at)
);
```

**字段说明**：

- `post_id`：关联的帖子 ID，删除帖子时据此查找要清理的文件
- `todo_id`：预留，用于后续绑定待办
- `filename`：用户原始文件名（可重命名）
- `stored_filename`：服务器存储的文件名（UUID，不可变）
- `file_size`：文件字节数
- `expires_at`：`NULL` 表示永久有效，有值表示过期时间

## 后端 API

所有文件 API 都需要登录认证（`authMiddleware`）。

### 上传文件

```
POST /api/upload/file
Content-Type: multipart/form-data

Body:
  file: <binary>
  filename: original_name.ext
  expires_in_days: 7    // 可选，默认 7；传空/null 表示永久
```

响应：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "filename": "document.pdf",
    "file_size": 1048576,
    "human_size": "1 MB",
    "mime_type": "application/pdf",
    "expires_at": "2026-08-02T12:00:00.000Z"
  }
}
```

处理逻辑：multer 接收文件 → 生成 UUID 存储名（`${uuid}_${originalExt}`）→ 存入 `uploads/files/{userId}/` → 写 DB → 返回元信息（含后端算好的 `human_size`）。

### 下载文件

```
GET /api/files/{id}
```

- 校验文件存在（404）
- 校验过期（410 Gone）
- 设置 `Content-Type`（从 `mime_type`）和 `Content-Disposition: attachment; filename="xxx"`（UTF-8 编码）
- 返回文件流

### 重命名文件

```
PUT /api/files/{id}
Content-Type: application/json

{
  "filename": "new-name.pdf"
}
```

- 只改 DB 的 `filename` 字段，不改物理文件
- 只允许文件所有者修改
- 返回更新后的文件信息

### 删除文件

```
DELETE /api/files/{id}
```

- `fs.unlink` 物理文件
- 删除 DB 记录
- 只允许文件所有者删除
- 返回 `{ success: true }`

### 文件列表

```
GET /api/files?page=1&page_size=20
```

- 分页查询当前用户所有文件
- 返回 `{ list: [...], total, hasMore }`

## 定时清理

`services/fileCleanup.js`：

- `setInterval` 每小时运行一次（`60 * 60 * 1000`）
- SQL: `SELECT * FROM files WHERE expires_at IS NOT NULL AND expires_at < NOW()`
- 对每条：`fs.unlink` 物理文件 → 删 DB 记录
- 日志记录清理结果

## 前端改动

### post-edit.js

**上传流（handleFileSelect）：**

```
wx.chooseMessageFile → wx.uploadFile(url=/api/upload/file) → 返回 {fileId, filename, ...}
  → attachedFiles 中改用新格式：{fileId, filename, file_size, human_size, mime_type, expires_at}
```

**重命名：**

点击文件项的图标 → `wx.showModal` 弹窗（editable input）
- 预填去掉后缀的原始文件名（如 "报告" from "报告.pdf"）
- 确认后调用 `PUT /api/files/{id}`
- 更新本地 attachedFiles 列表

**下载（openFile）：**

```
wx.request({ url: /api/files/{id}, header: { Authorization: Bearer }, responseType: arraybuffer })
  → fs.writeFile → wx.openDocument
```

注意：`wx.downloadFile` 不支持自定义 header，无法传 JWT，所以沿用 `wx.request` + `arraybuffer` 模式。URL 从 `storage.to/{id}` 改为 `/api/files/{id}`，移除所有 Bearer token 回退、content-type 猜测等逻辑。

**移除的逻辑：**

- `initUpload()` / `confirmUpload()` / `deleteFile()` storage.to 调用
- `visitorToken`（不再需要）
- storage.to 的 `owner_token`、`raw_url`、`url` 字段
- HTML 爬虫下载逻辑

### post-detail.js

**下载（_openFile）：**

```
wx.request({ url: /api/files/{id}, header: { Authorization: Bearer }, responseType: arraybuffer })
  → fs.writeFile → wx.openDocument
```

**`isFileExpired` / `getFileRemainingDays`：**

后端 `expires_at` 是标准 MySQL DATETIME，前端直接用 `new Date()` 解析即可，移除复杂的 `_parseDate` 时区逻辑。

### post-card.js

简化 `_parseDate` 或统一提取到工具函数中复用。由于后端日期格式固定（`YYYY-MM-DD HH:MM:SS`），直接用 `new Date(expires_at)`。

### post-edit.wxml

- 文件项添加重命名图标按钮
- 添加重命名弹窗（`t-dialog` 或 `wx.showModal`）
- 删除 storage.to 托管提示文字

### utils/fileUpload.js

替换为：

```js
function uploadFile(filePath, filename) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: 'https://api.yzjtiantian.cn/api/upload/file',
      filePath, name: 'file',
      header: { 'Authorization': 'Bearer ' + wx.getStorageSync('authToken') },
      formData: { filename, expires_in_days: 7 },
      success(res) {
        const data = JSON.parse(res.data);
        if (data.success) resolve(data.data);
        else reject(new Error(data.message));
      },
      fail: reject
    });
  });
}
```

### post 数据格式变化（files JSON）

旧格式（storage.to）：

```json
[{
  "id": "st-file-id",
  "url": "https://storage.to/xxx",
  "filename": "doc.pdf",
  "size": 1024,
  "human_size": "1 KB",
  "content_type": "application/pdf",
  "expires_at": "2026-07-29T13:41:18+00:00",
  "owner_token": "xxx",
  "_icon": "PDF"
}]
```

新格式（自建）：

```json
[{
  "fileId": 1,
  "filename": "doc.pdf",
  "file_size": 1024,
  "human_size": "1 KB",
  "mime_type": "application/pdf",
  "expires_at": "2026-08-02 12:00:00"
}]
```

## 数据兼容

旧帖子引用 storage.to 文件不受影响——文件仍可从 storage.to 访问直到过期。前端 `isFileExpired` 判断时间后仍能正确显示"已过期"。新上传全部走自建路径。

## 帖子删除时清理文件

postsController `deletePost` 中：

1. 从帖子记录 `files` JSON 字段提取所有 `fileId`
2. 遍历调用 `fileController.deleteFileRecord`（或直接 `fs.unlink` + 删 DB）
3. 然后执行 `UPDATE posts SET is_deleted=1`

这两种删除（手动删除帖子 / 手动删除文件）都是立即物理删除，不软删除。
