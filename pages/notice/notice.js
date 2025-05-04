const app = getApp();

Page({
  data: {
    notices: [],
  },

  onShareAppMessage() {
    return {
      title: '时光绿径待办-公告',
      path: '/pages/notice/notice',
      imageUrl: 'https://pic1.imgdb.cn/item/6814180958cb8da5c8d64852.png'
    }
  },
  
  onShareTimeline() {
    return {
      title: '时光绿径待办-公告',
      path: '/pages/notice/notice',
      imageUrl: 'https://pic1.imgdb.cn/item/6814180958cb8da5c8d64852.png'
    }
  },

  onLoad() {
    // 从全局数据获取公告
    this.setData({
      notices: app.globalData.notices
    });
  },

  // 显示最新公告弹窗
  showNotice(e) {
    // 添加详细的错误日志
    console.log('点击事件参数:', e);
    
    const index = Number(e.currentTarget.dataset.index); // 转换为数字类型
    if (isNaN(index) || index < 0 || index >= this.data.notices.length) {
        console.error('无效的公告索引:', index);
        return;
    }
    
    const selectedNotice = this.data.notices[index];
    wx.showModal({
        title: selectedNotice.title,
        content: selectedNotice.content.replace(/\n/g, '\n'),
        showCancel: false,
        confirmText: "知道了"
    });
  }
});