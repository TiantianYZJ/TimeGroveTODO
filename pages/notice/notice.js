const app = getApp();

Page({
  data: {
    notices: [],
  },

  onLoad() {
    // 从全局数据获取公告
    this.setData({
      notices: app.globalData.notices
    });
  },

  // 显示最新公告弹窗
  showLatestNotice() {
    const latest = this.data.notices[0];
    wx.showModal({
      title: latest.title,
      content: latest.content.replace(/\n/g, '\n'), // 保持换行
      showCancel: false,
      confirmText: "知道了"
    });
  }
});