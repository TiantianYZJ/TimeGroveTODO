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
