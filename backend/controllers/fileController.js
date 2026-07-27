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
      'SELECT id, user_id, post_id, todo_id, filename, file_size, mime_type, DATE_FORMAT(created_at, \'%Y-%m-%d %H:%i:%s\') as created_at, DATE_FORMAT(expires_at, \'%Y-%m-%d %H:%i:%s\') as expires_at FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
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

    const updated = await query('SELECT id, user_id, post_id, todo_id, filename, file_size, mime_type, DATE_FORMAT(created_at, \'%Y-%m-%d %H:%i:%s\') as created_at, DATE_FORMAT(expires_at, \'%Y-%m-%d %H:%i:%s\') as expires_at FROM files WHERE id = ?', [id]);
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
