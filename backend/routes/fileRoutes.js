const express = require('express');
const router = express.Router();
const { list, download, rename, remove } = require('../controllers/fileController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, list);
router.get('/:id', authMiddleware, download);
router.put('/:id', authMiddleware, rename);
router.delete('/:id', authMiddleware, remove);

module.exports = router;
