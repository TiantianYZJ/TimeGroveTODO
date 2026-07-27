# 自建文件存储系统 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 弃用 storage.to，在服务器自建文件存储，集齐 CRUD、7天过期、永久不过期预留。

**Architecture:** 新增 `files` 表 → 后端 5 个 API 端点 (Create/Read/Update/Delete/List) + 定时清理 → 前端改写上传/下载/重命名逻辑。文件路径 `uploads/files/{userId}/{uuid}.ext`。

**Tech Stack:** Express + multer + MySQL 5.5, WeChat Mini Program

---

### Task 1: 数据库迁移 — 创建 files 表

**Files:**
- Create: `backend/migrations/033_create_files_table.sql`
- Run against the database

- [ ] **Step 1: Write the migration SQL**

```sql
-- 自建文件存储表
CREATE TABLE IF NOT EXISTS files (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'files 表创建成功' as result;
```

- [ ] **Step 2: Run the migration**

Run: `mysql -h <host> -u <user> -p timegreenpath < backend/migrations/033_create_files_table.sql`

---

### Task 2: 后端 — fileController (CRUD 核心)

**Files:**
- Create: `backend/controllers/fileController.js`

- [ ] **Step 1: Write the controller**

```js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const FILES_DIR = path.join(__dirname, '../uploads/files');

function humanSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function ensureUserDir(userId) {
  const dir = path.join(FILES_DIR, String(userId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// GET /api/files — 列出当前用户所有文件
const list = async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.page_size) || 20));
  const offset = (page - 1) * pageSize;

  try {
    const rows = await query(
      'SELECT id, user_id, post_id, todo_id, filename, file_size, mime_type, created_at, expires_at FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, pageSize, offset]
    );
    const total = await query('SELECT COUNT(*) as total FROM files WHERE user_id = ?', [userId]);

    const list = rows.map(r => ({
      fileId: r.id,
      filename: r.filename,
      file_size: r.file_size,
      human_size: humanSize(r.file_size),
      mime_type: r.mime_type,
      created_at: r.created_at,
      expires_at: r.expires_at
    }));

    res.json({
      success: true,
      data: {
        list,
        total: total[0].total,
        hasMore: offset + rows.length < total[0].total
      }
    });
  } catch (err) {
    logger.error('FILE', '列表', '获取文件列表失败', { userId, error: err.message });
    res.status(500).json({ success: false, message: '获取文件列表失败' });
  }
};

// GET /api/files/:id — 下载文件
const download = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const rows = await query('SELECT * FROM files WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }
    const file = rows[0];

    // 校验权限：文件所有者可下载
    if (file.user_id !== userId) {
      return res.status(403).json({ success: false, message: '无权访问该文件' });
    }

    // 校验过期
    if (file.expires_at && new Date(file.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: '文件已过期' });
    }

    const filePath = path.join(FILES_DIR, String(file.user_id), file.stored_filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    const encodedFilename = encodeURIComponent(file.filename);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Length', file.file_size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    logger.error('FILE', '下载', '文件下载失败', { fileId: id, userId, error: err.message });
    res.status(500).json({ success: false, message: '下载失败' });
  }
};

// PUT /api/files/:id — 重命名文件
const rename = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { filename } = req.body;

  if (!filename || !filename.trim()) {
    return res.status(400).json({ success: false, message: '文件名不能为空' });
  }

  try {
    const rows = await query('SELECT * FROM files WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: '无权修改该文件' });
    }

    const cleanName = filename.trim();
    await query('UPDATE files SET filename = ? WHERE id = ?', [cleanName, id]);

    const updated = await query('SELECT * FROM files WHERE id = ?', [id]);
    const f = updated[0];
    res.json({
      success: true,
      data: {
        fileId: f.id,
        filename: f.filename,
        file_size: f.file_size,
        human_size: humanSize(f.file_size),
        mime_type: f.mime_type,
        expires_at: f.expires_at
      }
    });
  } catch (err) {
    logger.error('FILE', '重命名', '文件重命名失败', { fileId: id, userId, error: err.message });
    res.status(500).json({ success: false, message: '重命名失败' });
  }
};

// DELETE /api/files/:id — 删除文件
const remove = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const rows = await query('SELECT * FROM files WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: '无权删除该文件' });
    }

    const file = rows[0];
    const filePath = path.join(FILES_DIR, String(file.user_id), file.stored_filename);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {
      logger.error('FILE', '删除', '删除物理文件失败', { fileId: id, error: e.message });
    }

    await query('DELETE FROM files WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    logger.error('FILE', '删除', '文件删除失败', { fileId: id, userId, error: err.message });
    res.status(500).json({ success: false, message: '删除失败' });
  }
};

module.exports = { list, download, rename, remove, humanSize, ensureUserDir };
```

---

### Task 3: 后端 — 文件上传 + multer 配置

**Files:**
- Modify: `backend/controllers/uploadController.js` — add file upload multer config + handler
- Modify: `backend/routes/uploadRoutes.js` — add `/upload/file` route

- [ ] **Step 1: Add multer config and handler to uploadController.js**

Add after `proxyUpload` function (before `module.exports`):

```js
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/files', String(req.user.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const uuid = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
    cb(null, uuid + ext);
  }
});

const fileUploader = multer({
  storage: fileStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

const uploadFile = async (req, res) => {
  const userId = req.user.id;
  if (!req.file) {
    return res.status(400).json({ success: false, message: '请选择要上传的文件' });
  }

  try {
    const filename = req.body.filename || req.file.originalname;
    const expiresInDays = req.body.expires_in_days ? parseInt(req.body.expires_in_days) : 7;
    let expiresAt = null;
    if (expiresInDays > 0) {
      expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
      // Format as MySQL DATETIME
      expiresAt = expiresAt.getFullYear() + '-' +
        String(expiresAt.getMonth() + 1).padStart(2, '0') + '-' +
        String(expiresAt.getDate()).padStart(2, '0') + ' ' +
        String(expiresAt.getHours()).padStart(2, '0') + ':' +
        String(expiresAt.getMinutes()).padStart(2, '0') + ':' +
        String(expiresAt.getSeconds()).padStart(2, '0');
    }

    const result = await query(
      'INSERT INTO files (user_id, filename, stored_filename, file_size, mime_type, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, filename, req.file.filename, req.file.size, req.file.mimetype, expiresAt]
    );

    const fileId = result.insertId;

    res.json({
      success: true,
      data: {
        fileId,
        filename,
        file_size: req.file.size,
        human_size: humanSize(req.file.size),
        mime_type: req.file.mimetype,
        expires_at: expiresAt
      }
    });
  } catch (err) {
    logger.uploadError('上传文件', '文件上传失败', { userId, error: err.message });
    res.status(500).json({ success: false, message: '上传失败' });
  }
};
```

Update `module.exports` to include the new exports:
```js
module.exports = {
  upload,
  imageUpload,
  uploadAvatar,
  uploadTodoImage,
  proxyUploader,
  proxyUpload,
  fileUploader,
  uploadFile,
};
```

Import `crypto` at the top of uploadController.js (required for UUID in filename):
```js
const crypto = require('crypto');
```

Also import `humanSize` from fileController, or define it inline. To keep it simple, define it inline in uploadController.js:

```js
function humanSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}
```

- [ ] **Step 2: Add route to uploadRoutes.js**

```js
router.post('/file', authMiddleware, fileUploader.single('file'), uploadFile);
```

The updated uploadRoutes.js will look like:
```js
const express = require('express');
const router = express.Router();
const { upload, imageUpload, uploadAvatar, uploadTodoImage, proxyUploader, proxyUpload, fileUploader, uploadFile } = require('../controllers/uploadController');
const { authMiddleware } = require('../middleware/auth');

router.post('/avatar', authMiddleware, upload.single('avatar'), uploadAvatar);
router.post('/image', authMiddleware, imageUpload.single('image'), uploadTodoImage);
router.post('/proxy', authMiddleware, proxyUploader.single('file'), proxyUpload);
router.post('/file', authMiddleware, fileUploader.single('file'), uploadFile);

module.exports = router;
```

---

### Task 4: 后端 — fileRoutes + app.js 挂载

**Files:**
- Create: `backend/routes/fileRoutes.js`
- Modify: `backend/app.js` — mount routes + start cleanup

- [ ] **Step 1: Create fileRoutes.js**

```js
const express = require('express');
const router = express.Router();
const { list, download, rename, remove } = require('../controllers/fileController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, list);
router.get('/:id', authMiddleware, download);
router.put('/:id', authMiddleware, rename);
router.delete('/:id', authMiddleware, remove);

module.exports = router;
```

- [ ] **Step 2: Mount routes in app.js**

Add alongside existing route requires:
```js
const fileRoutes = require('./routes/fileRoutes');
const fileCleanup = require('./services/fileCleanup');
```

Add alongside existing app.use lines:
```js
app.use('/api/files', fileRoutes);
```

The `fileCleanup` service auto-starts when required, so just requiring it starts the cleanup schedule.

---

### Task 5: 后端 — 文件清理服务

**Files:**
- Create: `backend/services/fileCleanup.js`

- [ ] **Step 1: Write the cleanup service**

```js
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const FILES_DIR = path.join(__dirname, '../uploads/files');
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

async function cleanupExpiredFiles() {
  try {
    const expired = await query(
      'SELECT id, user_id, stored_filename FROM files WHERE expires_at IS NOT NULL AND expires_at < NOW()'
    );

    let deleted = 0;
    for (const file of expired) {
      const filePath = path.join(FILES_DIR, String(file.user_id), file.stored_filename);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        logger.error('FILE', '清理', '删除过期物理文件失败', { fileId: file.id, error: e.message });
      }
      await query('DELETE FROM files WHERE id = ?', [file.id]);
      deleted++;
    }

    if (deleted > 0) {
      logger.info('FILE', '清理', `清理了 ${deleted} 个过期文件`);
    }
  } catch (err) {
    logger.error('FILE', '清理', '清理过期文件失败', { error: err.message });
  }
}

// Start cleanup schedule
setInterval(cleanupExpiredFiles, CLEANUP_INTERVAL);
cleanupExpiredFiles(); // Run immediately on startup

module.exports = { cleanupExpiredFiles };
```

---

### Task 6: 后端 — 删帖子时清理关联文件

**Files:**
- Modify: `backend/controllers/postsController.js` — `deletePost`

- [ ] **Step 1: Update deletePost to clean up associated files**

Replace the storage.to file cleanup block (lines 349-365) with self-hosted file cleanup:

```js
if (posts[0].files) {
  try {
    const fileList = JSON.parse(posts[0].files);
    for (const f of fileList) {
      if (f.fileId) {
        // Delete from DB and filesystem
        const fileRows = await query('SELECT * FROM files WHERE id = ?', [f.fileId]);
        if (fileRows.length > 0) {
          const file = fileRows[0];
          const filePath = path.join(__dirname, '../uploads/files', String(file.user_id), file.stored_filename);
          try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
          await query('DELETE FROM files WHERE id = ?', [f.fileId]);
        }
      }
    }
  } catch (e) {}
}
```

Add `const path = require('path');` at the top of postsController.js (if not already imported).

---

### Task 7: 前端 — fileUpload.js 工具函数

**Files:**
- Rewrite: `utils/fileUpload.js`

- [ ] **Step 1: Rewrite fileUpload.js**

```js
const API_BASE_URL = 'https://api.yzjtiantian.cn';

function uploadFile(filePath, filename) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('authToken');
    wx.uploadFile({
      url: API_BASE_URL + '/upload/file',
      filePath: filePath,
      name: 'file',
      header: { 'Authorization': 'Bearer ' + token },
      formData: { filename: filename, expires_in_days: 7 },
      success(res) {
        try {
          const data = JSON.parse(res.data);
          if (data.success) resolve(data.data);
          else reject(new Error(data.message || '上传失败'));
        } catch (e) {
          reject(new Error('上传返回格式异常'));
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

module.exports = { uploadFile };
```

---

### Task 8: 前端 — post-edit.js 重构

**Files:**
- Modify: `packageCommunity/post-edit/post-edit.js`

This is the largest frontend change. The following sections need modification:

- [ ] **Step 1: Update imports** — replace `initUpload, uploadToR2, confirmUpload, deleteFile` with `uploadFile`

Line 6 change:
```js
const { uploadFile } = require('../../utils/fileUpload');
```

- [ ] **Step 2: Remove visitorToken from data**

Remove from the `data` object (around line 87): `visitorToken: '',`

- [ ] **Step 3: Remove visitorToken generation from onLoad**

Remove lines 169-170:
```js
const visitorToken = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
this.setData({ visitorToken });
```

- [ ] **Step 4: Simplify onUnload** — remove storage.to file cleanup

Replace the `onUnload` method (lines 194-213) with:
```js
onUnload() {
  if (!this.data.editMode && (this.data.title || this.data.body)) {
    wx.setStorageSync('communityDraft', {
      title: this.data.title, body: this.data.body, fileList: this.data.fileList, imageUrls: this.data.imageUrls,
      selectedTodoIds: this.data.selectedTodoIds, selectedComboCode: this.data.selectedComboCode,
      selectedComboName: this.data.selectedComboName, location: this.data.location, attachedFiles: this.data.attachedFiles,
      pollDraft: this.data.pollDraft,
    });
  } else if (!this.data.title && !this.data.body) { wx.removeStorageSync('communityDraft'); }
},
```

- [ ] **Step 5: Rewrite handleFileSelect** — replace storage.to flow with self-hosted upload

Replace `handleFileSelect` method (lines 850-907) with:
```js
async handleFileSelect() {
  const { attachedFiles } = this.data;
  const remaining = 9 - attachedFiles.length;
  if (remaining <= 0) {
    wx.showToast({ title: '最多上传 9 个文件', icon: 'none' });
    return;
  }

  try {
    const res = await wx.chooseMessageFile({ count: remaining, type: 'all' });
    const files = res.tempFiles;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      wx.showLoading({ title: `上传文件 ${i + 1}/${files.length}`, mask: true });

      try {
        const result = await uploadFile(file.path, file.name);
        const fileInfo = {
          fileId: result.fileId,
          filename: result.filename,
          file_size: result.file_size,
          human_size: result.human_size,
          mime_type: result.mime_type,
          expires_at: result.expires_at,
          _icon: this.getFileIcon(result.mime_type, result.filename)
        };

        this.setData({
          attachedFiles: [...this.data.attachedFiles, fileInfo]
        });
      } catch (err) {
        wx.showToast({ title: `"${file.name}" 上传失败`, icon: 'none' });
      }
    }
  } catch (err) {
    // User cancelled
  }
  wx.hideLoading();
},
```

- [ ] **Step 6: Simplify isFileExpired / getFileRemainingDays**

Replace both methods (lines 910-931):
```js
isFileExpired(expiresAt) {
  if (!expiresAt) return false;
  const date = new Date(expiresAt.replace(/-/g, '/'));
  if (isNaN(date.getTime())) return false;
  return date < new Date();
},

getFileRemainingDays(expiresAt) {
  if (!expiresAt) return null;
  const date = new Date(expiresAt.replace(/-/g, '/'));
  if (isNaN(date.getTime())) return null;
  const remaining = (date - new Date()) / (1000 * 60 * 60 * 24);
  const days = Math.ceil(remaining);
  return days > 0 ? days : 0;
},
```

Note: `replace(/-/g, '/')` is used instead of direct `new Date(str)` because WeChat runtime treats `YYYY-MM-DD` as invalid date on some devices, while `YYYY/MM/DD` works. This is a well-known WeChat quirk.

- [ ] **Step 7: Rewrite openFile** — remove HTML scraping, use self-hosted download

Replace `openFile` method (lines 933-994):
```js
openFile(e) {
  const index = e.currentTarget.dataset.index;
  const file = this.data.attachedFiles[index];
  if (!file) return;
  if (this.isFileExpired(file.expires_at)) {
    wx.showToast({ title: '文件已过期', icon: 'none' });
    return;
  }
  const fileId = file.fileId;
  if (!fileId) { wx.showToast({ title: '文件ID无效', icon: 'none' }); return; }

  const ext = file.filename ? file.filename.split('.').pop().toLowerCase() : '';
  const token = wx.getStorageSync('authToken');

  wx.showLoading({ title: '下载中...' });
  wx.request({
    url: 'https://api.yzjtiantian.cn/api/files/' + fileId,
    method: 'GET',
    header: { 'Authorization': 'Bearer ' + token },
    responseType: 'arraybuffer',
    success: (res) => {
      wx.hideLoading();
      if (res.statusCode === 410) {
        wx.showToast({ title: '文件已过期', icon: 'none' });
        return;
      }
      if (res.statusCode !== 200 || !res.data) {
        wx.showToast({ title: '下载失败', icon: 'none' });
        return;
      }
      const fs = wx.getFileSystemManager();
      const tmpPath = wx.env.USER_DATA_PATH + '/' + fileId + '.' + (ext || 'dat');
      fs.writeFile({
        filePath: tmpPath, data: res.data,
        success: () => {
          wx.openDocument({
            filePath: tmpPath, fileType: getDocFileType(file.mime_type || '', ext),
            showMenu: true,
            success: () => {},
            fail: () => { wx.showToast({ title: '打开文件失败', icon: 'none' }); }
          });
        },
        fail: () => { wx.showToast({ title: '保存文件失败', icon: 'none' }); }
      });
    },
    fail: () => { wx.hideLoading(); wx.showToast({ title: '下载失败', icon: 'none' }); }
  });
},
```

- [ ] **Step 8: Add handleFileRename method**

Add after `handleFileRemove`:
```js
handleFileRename(e) {
  const index = e.currentTarget.dataset.index;
  const file = this.data.attachedFiles[index];
  if (!file) return;

  // Split filename into base name and extension
  const nameParts = file.filename.split('.');
  const ext = nameParts.length > 1 ? nameParts.pop() : '';
  const baseName = nameParts.join('.');

  wx.showModal({
    title: '重命名文件',
    editable: true,
    content: baseName,
    placeholderText: '请输入新文件名',
    success: async (res) => {
      if (!res.confirm) return;
      const newBase = (res.content || '').trim();
      if (!newBase) {
        wx.showToast({ title: '文件名不能为空', icon: 'none' });
        return;
      }
      const newFilename = ext ? newBase + '.' + ext : newBase;

      try {
        const token = wx.getStorageSync('authToken');
        const apiRes = await new Promise((resolve, reject) => {
          wx.request({
            url: 'https://api.yzjtiantian.cn/api/files/' + file.fileId,
            method: 'PUT',
            header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            data: { filename: newFilename },
            success: r => resolve(r),
            fail: reject
          });
        });

        if (apiRes.data && apiRes.data.success) {
          const files = [...this.data.attachedFiles];
          files[index] = { ...files[index], filename: newFilename };
          this.setData({ attachedFiles: files });
          wx.showToast({ title: '重命名成功', icon: 'success' });
        } else {
          wx.showToast({ title: apiRes.data.message || '重命名失败', icon: 'none' });
        }
      } catch (err) {
        wx.showToast({ title: '重命名失败', icon: 'none' });
      }
    }
  });
},
```

- [ ] **Step 9: Update handleFileRemove for edit mode**

When removing a file in edit mode (already saved to server), also delete from server:
```js
handleFileRemove(e) {
  const index = e.currentTarget.dataset.index;
  const file = this.data.attachedFiles[index];
  const files = [...this.data.attachedFiles];
  files.splice(index, 1);
  this.setData({ attachedFiles: files });

  // If file was already uploaded (has fileId), delete from server
  if (file && file.fileId) {
    const token = wx.getStorageSync('authToken');
    wx.request({
      url: 'https://api.yzjtiantian.cn/api/files/' + file.fileId,
      method: 'DELETE',
      header: { 'Authorization': 'Bearer ' + token },
      fail: () => {}
    });
  }
},
```

- [ ] **Step 10: Update handleSubmit `files` mapping**

In `handleSubmit`, change the files mapping (around line 1058-1063) from:
```js
files: this.data.attachedFiles.length > 0 ? this.data.attachedFiles.map(f => ({
  id: f.id, url: f.url, raw_url: f.raw_url,
  filename: f.filename, size: f.size, human_size: f.human_size,
  content_type: f.content_type, expires_at: f.expires_at,
  owner_token: f.owner_token
})) : null,
```
to:
```js
files: this.data.attachedFiles.length > 0 ? this.data.attachedFiles.map(f => ({
  fileId: f.fileId,
  filename: f.filename,
  file_size: f.file_size,
  human_size: f.human_size,
  mime_type: f.mime_type,
  expires_at: f.expires_at
})) : null,
```

- [ ] **Step 11: Remove storage.to deleteFile calls from goBack**

Replace the `goBack` method's file cleanup (lines 1113-1115):
```js
if (!this.data.editMode) {
  const { attachedFiles: goBackFiles } = this.data;
  if (goBackFiles && goBackFiles.length > 0) {
    for (const f of goBackFiles) {
      if (f.fileId) {
        const token = wx.getStorageSync('authToken');
        wx.request({
          url: 'https://api.yzjtiantian.cn/api/files/' + f.fileId,
          method: 'DELETE',
          header: { 'Authorization': 'Bearer ' + token },
          fail: () => {}
        });
      }
    }
  }
}
```

---

### Task 9: 前端 — post-edit.wxml 更新

**Files:**
- Modify: `packageCommunity/post-edit/post-edit.wxml`

- [ ] **Step 1: Update wx:key for files**

In the file listing loop (line 104), change:
```html
wx:for="{{attachedFiles}}" wx:key="id"
```
to:
```html
wx:for="{{attachedFiles}}" wx:key="fileId"
```

- [ ] **Step 2: Add rename button to file items**

In the file item (around line 104-115), add the rename icon before the remove button and update references from `content_type`/`size` to `mime_type`/`file_size`:

```html
<view class="file-mini-item {{isFileExpired(item.expires_at) ? 'expired' : ''}}" wx:for="{{attachedFiles}}" wx:key="fileId">
  <t-icon name="{{item._icon}}" size="28rpx" color="#666" />
  <text class="file-mini-name {{isFileExpired(item.expires_at) ? 'expired' : ''}}">{{item.filename}}</text>
  <text class="file-mini-size">{{item.human_size}}</text>
  <view class="file-mini-expiry">
    <text wx:if="{{isFileExpired(item.expires_at)}}" class="expiry-badge expired">已过期</text>
    <text wx:else class="expiry-badge">{{getFileRemainingDays(item.expires_at)}}天后过期</text>
  </view>
  <view class="file-mini-rename" catch:tap="handleFileRename" data-index="{{index}}">
    <t-icon name="edit-1" size="24rpx" color="#00b26a" />
  </view>
  <view class="file-mini-remove" catch:tap="handleFileRemove" data-index="{{index}}">
    <t-icon name="close" size="24rpx" color="#999" />
  </view>
</view>
```

- [ ] **Step 3: Remove storage.to hint text**

Remove the `<view class="file-storage-hint">` block (lines 121-123):
```html
<view wx:if="{{attachedFiles.length > 0}}" class="file-storage-hint">
  <text class="hint-text">文件托管至第三方平台 storage.to，三天后将过期清理</text>
</view>
```

---

### Task 10: 前端 — post-edit.wxss 添加重命名按钮样式

**Files:**
- Modify: `packageCommunity/post-edit/post-edit.wxss`

- [ ] **Step 1: Add file-mini-rename style**

Add before the `.file-mini-remove` selector (around line 551):
```css
.file-mini-rename {
  padding: 8rpx;
}
```

---

### Task 11: 前端 — post-detail.js 简化

**Files:**
- Modify: `packageCommunity/post-detail/post-detail.js`

- [ ] **Step 1: Simplify isFileExpired**

Replace lines 608-611:
```js
isFileExpired(expiresAt) {
  if (!expiresAt) return false;
  const date = new Date(expiresAt.replace(/-/g, '/'));
  if (isNaN(date.getTime())) return false;
  return date < new Date();
},
```

- [ ] **Step 2: Simplify getFileRemainingDays**

Replace lines 613-617:
```js
getFileRemainingDays(expiresAt) {
  if (!expiresAt) return null;
  const date = new Date(expiresAt.replace(/-/g, '/'));
  if (isNaN(date.getTime())) return null;
  const remaining = (date - new Date()) / (1000 * 60 * 60 * 24);
  return Math.ceil(remaining);
},
```

- [ ] **Step 3: Rewrite _openFile** — use self-hosted download

Replace lines 629-675:
```js
_openFile(file) {
  const ext = file.filename ? file.filename.split('.').pop().toLowerCase() : '';
  const fileId = file.fileId;
  if (!fileId) { wx.showToast({ title: '文件ID无效', icon: 'none' }); return; }

  const token = wx.getStorageSync('authToken');

  wx.showLoading({ title: '下载中...' });
  wx.request({
    url: 'https://api.yzjtiantian.cn/api/files/' + fileId,
    method: 'GET',
    header: { 'Authorization': 'Bearer ' + token },
    responseType: 'arraybuffer',
    success: (res) => {
      wx.hideLoading();
      if (res.statusCode === 410) {
        wx.showToast({ title: '文件已过期', icon: 'none' });
        return;
      }
      if (res.statusCode !== 200 || !res.data) {
        wx.showToast({ title: '下载失败', icon: 'none' });
        return;
      }
      var fs = wx.getFileSystemManager();
      var tmpPath = wx.env.USER_DATA_PATH + '/' + fileId + '.' + (ext || 'dat');
      fs.writeFile({
        filePath: tmpPath, data: res.data,
        success: () => {
          wx.openDocument({
            filePath: tmpPath, fileType: getDocFileType(file.mime_type || '', ext),
            showMenu: true,
            success: () => {},
            fail: () => { wx.showToast({ title: '打开文件失败', icon: 'none' }); }
          });
        },
        fail: () => { wx.showToast({ title: '保存文件失败', icon: 'none' }); }
      });
    },
    fail: () => { wx.hideLoading(); wx.showToast({ title: '下载失败', icon: 'none' }); }
  });
},
```

- [ ] **Step 4: Update getFileIcon callers** in `loadPost`

In `loadPost` (lines 138-139), the current code:
```js
if (post.files) {
  post.files = post.files.map(f => ({ ...f, _icon: this.getFileIcon(f.content_type, f.filename) }));
}
```
Change to:
```js
if (post.files) {
  post.files = post.files.map(f => ({ ...f, _icon: this.getFileIcon(f.mime_type || f.content_type, f.filename) }));
}
```

This ensures backward compatibility with old posts still using `content_type`.

---

### Task 12: 前端 — post-card.js 简化

**Files:**
- Modify: `components/post-card/post-card.js`

- [ ] **Step 1: Simplify isFileExpired**

Replace lines 107-113:
```js
isFileExpired(expiresAt) {
  if (!expiresAt) { console.log('[pc] isFileExpired: no expiresAt'); return false; }
  const date = new Date(expiresAt.replace(/-/g, '/'));
  if (isNaN(date.getTime())) return false;
  console.log('[pc] isFileExpired:', expiresAt, '→', date);
  return date < new Date();
},
```

- [ ] **Step 2: Simplify getFileRemainingDays**

Replace lines 114-123:
```js
getFileRemainingDays(expiresAt) {
  if (!expiresAt) { console.log('[pc] getRemainingDays: no expiresAt'); return ''; }
  const date = new Date(expiresAt.replace(/-/g, '/'));
  if (!date) return '';
  const remaining = (date - new Date()) / (1000 * 60 * 60 * 24);
  const days = Math.ceil(remaining);
  if (days <= 0) return '';
  return days;
},
```

- [ ] **Step 3: Simplify _parseDate**

Since we now use MySQL DATETIME format (which can be parsed with `replace(/-/g, '/')`), the `_parseDate` method can be kept for backward compatibility but simplified. Or we can remove `_parseDate` entirely and just use `new Date(expiresAt.replace(/-/g, '/'))` inline. Since `isFileExpired` and `getFileRemainingDays` no longer call `_parseDate`, the method is unused. Remove it:

Delete the `_parseDate` method (lines 124-146).

- [ ] **Step 4: Update file icon observer**

In the `post` observer (around line 31), update to handle both old and new format:
```js
'post'(post) {
  if (post && post.files && post.files.length > 0) {
    const iconMap = {};
    post.files.forEach((f, i) => {
      const icon = this.getFileIcon(f.mime_type || f.content_type, f.filename);
      console.log('[post-card] file['+i+']:', f.filename, 'icon:', icon);
      iconMap['post.files['+i+']._icon'] = icon;
    });
    this.setData(iconMap);
  }
},
```

- [ ] **Step 5: Remove console.log from getFileIcon** (optional cleanup)

Remove the debug `console.log` lines from `getFileIcon` to reduce noise:
- Line 32: `console.log('[post-card] file['+i+']:', f.filename, 'icon:', icon);`
- Line 70: `console.log('[post-card getFileIcon] contentType:', contentType, 'ct:', ct, 'ext:', ext, 'filename:', filename);`
- Lines 94, 100, 104: individual match logs

---

### Task 13: 前端 — post-card.wxml 更新

**Files:**
- Modify: `components/post-card/post-card.wxml`

- [ ] **Step 1: Update wx:key for files**

On line 70, change:
```html
wx:for="{{post.files}}" wx:key="id"
```
to:
```html
wx:for="{{post.files}}" wx:key="fileId"
```

(Note: for old posts without `fileId`, WeChat will fall back to index-based keying, so backward compatibility is maintained.)

---

### Task 14: 验证与测试

- [ ] **Step 1: 启动后端** — `cd backend && npm start`

- [ ] **Step 2: 测试上传 API**

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -F "file=@test.pdf" \
  -F "filename=test.pdf" \
  -F "expires_in_days=7" \
  https://api.yzjtiantian.cn/upload/file
```

Expected: `{ success: true, data: { fileId: 1, filename: "test.pdf", ... } }`

- [ ] **Step 3: 测试下载 API**

```bash
curl -H "Authorization: Bearer <token>" \
  https://api.yzjtiantian.cn/api/files/1 -o downloaded.pdf
```

Expected: file downloads correctly

- [ ] **Step 4: 测试重命名 API**

```bash
curl -X PUT -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"filename": "renamed.pdf"}' \
  https://api.yzjtiantian.cn/api/files/1
```

Expected: `{ success: true, data: { filename: "renamed.pdf", ... } }`

- [ ] **Step 5: 测试删除 API**

```bash
curl -X DELETE -H "Authorization: Bearer <token>" \
  https://api.yzjtiantian.cn/api/files/1
```

Expected: `{ success: true, message: "删除成功" }`

- [ ] **Step 6: 测试列表 API**

```bash
curl -H "Authorization: Bearer <token>" \
  https://api.yzjtiantian.cn/api/files
```

Expected: `{ success: true, data: { list: [...], total: N, hasMore: false } }`

- [ ] **Step 7: 在微信开发者工具中测试完整流程** — 上传文件 → 显示在帖子编辑器中 → 重命名 → 发布帖子 → 查看帖子详情 → 下载文件 → 确认内容正确
