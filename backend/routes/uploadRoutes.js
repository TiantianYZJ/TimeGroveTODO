const express = require('express');
const router = express.Router();
const { upload, imageUpload, uploadAvatar, uploadTodoImage, proxyUploader, proxyUpload, fileUploader, uploadFile } = require('../controllers/uploadController');
const { authMiddleware } = require('../middleware/auth');

router.post('/avatar', authMiddleware, upload.single('avatar'), uploadAvatar);
router.post('/image', authMiddleware, imageUpload.single('image'), uploadTodoImage);
router.post('/proxy', authMiddleware, proxyUploader.single('file'), proxyUpload);
router.post('/file', authMiddleware, fileUploader.single('file'), uploadFile);

module.exports = router;
