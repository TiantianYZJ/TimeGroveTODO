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
