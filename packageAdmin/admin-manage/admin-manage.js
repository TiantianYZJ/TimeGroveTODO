const { adminApi } = require('../../utils/api');
const logger = getApp().globalData?.logger || { error: () => {}, debug: () => {}, warn: () => {} };

Page({
  data: {
    adminList: [],
    loading: false,
    refreshing: false,
    addPopupVisible: false,
    currentUserId: 0,
    searchKeyword: '',
    searchResults: [],
    searchLoading: false
  },

  onShow() {
    const userInfo = getApp().globalData.userInfo;
    if (userInfo) this.setData({ currentUserId: userInfo.id });
    this.loadAdminList();
  },

  onRefresh() {
    this.loadAdminList();
  },

  async loadAdminList() {
    this.setData({ loading: true });
    try {
      const result = await adminApi.getAdminList();
      if (result.success) {
        const list = (result.data || []).map(item => ({
          ...item,
          created_at: item.created_at ? item.created_at.split('.')[0].replace('T', ' ') : ''
        }));
        this.setData({ adminList: list });
      }
    } catch (err) {
      logger.error('ADMIN', 'ADMIN-LIST', '加载管理员列表失败', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, refreshing: false });
    }
  },

  showAddPopup() {
    this.setData({ addPopupVisible: true, searchKeyword: '', searchResults: [] });
  },

  hideAddPopup() {
    this.setData({ addPopupVisible: false });
  },

  onAddPopupClose(e) {
    if (!e.detail.visible) {
      this.setData({ addPopupVisible: false });
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  async searchUser() {
    const keyword = this.data.searchKeyword.trim();
    if (!keyword) return;
    this.setData({ searchLoading: true });
    try {
      const { userApi } = require('../../utils/api');
      const result = await userApi.search(keyword);
      if (result.success) {
        // 过滤掉已是管理员和当前用户
        const adminIds = this.data.adminList.map(a => a.user_id);
        const filtered = (result.data || []).filter(u =>
          !adminIds.includes(u.id) && u.id !== wx.getStorageSync('userId')
        );
        this.setData({ searchResults: filtered });
      }
    } catch (err) {
      logger.error('ADMIN', 'SEARCH', '搜索用户失败', err);
    } finally {
      this.setData({ searchLoading: false });
    }
  },

  async addAdmin(e) {
    const userId = parseInt(e.currentTarget.dataset.id);
    try {
      const result = await adminApi.addAdmin(userId);
      if (result.success) {
        wx.showToast({ title: '已添加为管理员', icon: 'success' });
        this.setData({ addPopupVisible: false });
        this.loadAdminList();
      } else {
        wx.showToast({ title: result.message || '添加失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: err.message || '添加失败', icon: 'none' });
    }
  },

  async removeAdmin(e) {
    const userId = parseInt(e.currentTarget.dataset.id);
    const nickname = e.currentTarget.dataset.name || '该用户';
    const res = await wx.showModal({
      title: '确认移除',
      content: `确定移除 ${nickname} 的管理员权限吗？`
    });
    if (!res.confirm) return;
    try {
      const result = await adminApi.removeAdmin(userId);
      if (result.success) {
        wx.showToast({ title: '已移除管理员权限', icon: 'success' });
        this.loadAdminList();
      }
    } catch (err) {
      wx.showToast({ title: err.message || '移除失败', icon: 'none' });
    }
  },

  goToUserDetail(e) {
    const userId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/packageAdmin/user-detail/user-detail?id=${userId}` });
  }
});
