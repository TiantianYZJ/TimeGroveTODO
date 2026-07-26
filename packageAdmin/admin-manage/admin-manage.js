const { adminApi } = require('../../utils/api');
const logger = getApp().globalData?.logger || { error: () => {}, debug: () => {}, warn: () => {} };

Page({
  data: {
    adminList: [],
    filteredList: [],
    loading: false,
    refreshing: false,
    addPopupVisible: false,
    currentUserId: 0,
    // 列表搜索
    listSearchKeyword: '',
    // 添加弹窗搜索
    searchKeyword: '',
    searchResults: [],
    searchLoading: false,
    // 批量选择
    selectedIds: [],
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
        this.applyListFilter();
      }
    } catch (err) {
      logger.error('ADMIN', 'ADMIN-LIST', '加载管理员列表失败', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, refreshing: false });
    }
  },

  // ===== 列表搜索 =====
  onListSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ listSearchKeyword: keyword });
    this.applyListFilter(keyword);
  },

  onListSearchConfirm() {
    this.applyListFilter(this.data.listSearchKeyword);
  },

  onClearListSearch() {
    this.setData({ listSearchKeyword: '', filteredList: [...this.data.adminList] });
  },

  applyListFilter(keyword) {
    if (keyword === undefined) keyword = this.data.listSearchKeyword;
    keyword = (keyword || '').trim().toLowerCase();
    if (!keyword) {
      this.setData({ filteredList: [...this.data.adminList] });
      return;
    }
    const filtered = this.data.adminList.filter(item => {
      const nickname = (item.nickname || '').toLowerCase();
      const idStr = String(item.user_id);
      return nickname.includes(keyword) || idStr.includes(keyword);
    });
    this.setData({ filteredList: filtered });
  },

  // ===== 批量选择 =====
  toggleSelect(e) {
    const id = parseInt(e.currentTarget.dataset.id);
    const ids = [...this.data.selectedIds];
    const idx = ids.indexOf(id);
    if (idx > -1) {
      ids.splice(idx, 1);
    } else {
      ids.push(id);
    }
    this.setData({ selectedIds: ids });
  },

  clearSelection() {
    this.setData({ selectedIds: [] });
  },

  async batchRemove() {
    const { selectedIds, adminList } = this.data;
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const res = await wx.showModal({
      title: '批量移除',
      content: `确定移除 ${count} 位管理员的管理员权限吗？\n（不含您自己）`,
      confirmText: '批量移除',
      confirmColor: '#ff4757',
    });
    if (!res.confirm) return;
    wx.showLoading({ title: `移除中 0/${count}` });
    let success = 0;
    let fail = 0;
    for (let i = 0; i < selectedIds.length; i++) {
      try {
        await adminApi.removeAdmin(selectedIds[i]);
        success++;
      } catch (err) {
        fail++;
      }
      wx.showLoading({ title: `移除中 ${i + 1}/${count}` });
    }
    wx.hideLoading();
    const toastMsg = success > 0 ? `成功移除 ${success} 位` : '移除失败';
    if (fail > 0) {
      wx.showToast({ title: `${toastMsg}，${fail} 位失败`, icon: 'none' });
    } else {
      wx.showToast({ title: toastMsg, icon: 'success' });
    }
    this.setData({ selectedIds: [] });
    this.loadAdminList();
  },

  async removeSingle(e) {
    const userId = parseInt(e.currentTarget.dataset.id);
    const nickname = e.currentTarget.dataset.name || '该用户';
    const res = await wx.showModal({
      title: '确认移除',
      content: `确定移除 ${nickname} 的管理员权限吗？`,
      confirmText: '移除',
      confirmColor: '#ff4757',
    });
    if (!res.confirm) return;
    try {
      await adminApi.removeAdmin(userId);
      wx.showToast({ title: '已移除管理员权限', icon: 'success' });
      this.setData({ selectedIds: [] });
      this.loadAdminList();
    } catch (err) {
      wx.showToast({ title: err.message || '移除失败', icon: 'none' });
    }
  },

  // ===== 添加管理员 =====
  showAddPopup() {
    this.setData({ addPopupVisible: true, searchKeyword: '', searchResults: [] });
  },

  hideAddPopup() {
    this.setData({ addPopupVisible: false });
  },

  onAddPopupClose(e) {
    if (!e.detail.visible) this.setData({ addPopupVisible: false });
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
        const adminIds = this.data.adminList.map(a => a.user_id);
        const filtered = (result.data || []).filter(u =>
          !adminIds.includes(u.id)
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

  // 保留选中状态，点击卡片进入详情
  goToUserDetail(e) {
    const userId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/packageAdmin/user-detail/user-detail?id=${userId}` });
  },
});
