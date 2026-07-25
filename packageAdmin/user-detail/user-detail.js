const { adminApi } = require('../../utils/api');
const logger = getApp().globalData?.logger || { error: () => {}, debug: () => {}, warn: () => {} };

const API_BASE_URL = 'https://api.yzjtiantian.cn';

function getFullAvatarUrl(avatarUrl) {
  if (!avatarUrl) return '/images/avatar.png';
  if (avatarUrl.startsWith('http')) return avatarUrl;
  return API_BASE_URL + avatarUrl;
}

function parseBadgeArray(val) {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

Page({
  data: {
    userId: null,
    user: {},
    limits: {
      todo_limit: 100,
      combo_limit: 10,
      collab_limit: 5
    },
    todos: [],
    combos: [],
    sharedCombos: [],
    assignedTodos: [],
    assignedTodosFlat: [],
    comments: [],
    stats: {
      totalTodos: 0,
      completedTodos: 0,
      assignedTodosCount: 0,
      commentsCount: 0
    },
    showAssignedMode: 'group',
    editNicknameVisible: false,
    editNicknameValue: '',
    badgeTitles: [],
    badgeColors: [],
    badgeColorPickerVisible: false,
    badgePickerIdx: null,
    badgeCustomColor: '',
    isAdmin: false
  },

  onLoad(options) {
    logger.debug('ADMIN', 'USER', '用户详情页面参数', options);
    this.setData({ userId: options.id });
    logger.debug('ADMIN', 'USER', '用户详情ID', { userId: this.data.userId });
    this.loadUserDetail();
  },

  async onPullDownRefresh() {
    await this.loadUserDetail();
    wx.stopPullDownRefresh();
  },

  async loadUserDetail() {
    try {
      const [detailResult, adminListResult] = await Promise.all([
        adminApi.getUserDetail(this.data.userId),
        adminApi.getAdminList().catch(() => ({ success: false, data: [] })),
      ]);
      const result = detailResult;
      logger.debug('ADMIN', 'DATA', '加载用户详情结果', { keys: Object.keys(result) });
      if (result.success) {
        const user = {
          ...result.user,
          avatar_url: getFullAvatarUrl(result.user.avatar_url)
        };
        const adminIds = (adminListResult.success ? adminListResult.data || [] : []).map(a => a.user_id);
        this.setData({
          user: { ...user, isAdmin: adminIds.includes(user.id) },
          isAdmin: adminIds.includes(user.id),
          limits: {
            todo_limit: result.user.todo_limit || 100,
            combo_limit: result.user.combo_limit || 10,
            collab_limit: result.user.collab_limit || 5
          },
          todos: result.todos || [],
          combos: result.combos || [],
          sharedCombos: result.sharedCombos || [],
          assignedTodos: result.assignedTodos || [],
          assignedTodosFlat: result.assignedTodosFlat || [],
          comments: result.comments || [],
          stats: result.stats || { totalTodos: 0, completedTodos: 0, assignedTodosCount: 0, commentsCount: 0 },
          badgeTitles: parseBadgeArray(result.user.badge_titles),
          badgeColors: parseBadgeArray(result.user.badge_colors)
        });
      }
    } catch (err) {
      logger.error('ADMIN', 'USER', '加载用户详情失败', err);
      wx.showToast({ title: '加载用户详情失败', icon: 'none' });
    }
  },

  decreaseLimit(e) {
    const field = e.currentTarget.dataset.field;
    const value = this.data.limits[field];
    if (value > 0) {
      this.setData({ [`limits.${field}`]: value - 1 });
    }
  },

  increaseLimit(e) {
    const field = e.currentTarget.dataset.field;
    const value = this.data.limits[field];
    this.setData({ [`limits.${field}`]: value + 1 });
  },

  async saveLimits() {
    try {
      const result = await adminApi.updateUserLimits(this.data.userId, this.data.limits);
      if (result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' });
      }
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  viewTodo(e) {
    const todo = e.currentTarget.dataset.todo;

    wx.navigateTo({
      url: `/packagePages/todo-detail/todo-detail?adminView=1&todoId=${encodeURIComponent(todo.todo_id || todo.id)}&userId=${this.data.userId}`
    });
  },

  viewCombo(e) {
    const combo = e.currentTarget.dataset.combo;
    const userId = this.data.userId;
    logger.debug('ADMIN', 'DATA', '查看组合数据', this.data);
    wx.navigateTo({
      url: `/packageCombo/combo-detail/combo-detail?adminView=1&id=${combo.id}&userId=${userId}`
    });
  },

  copyOpenid(e) {
    const value = e.currentTarget.dataset.value;
    if (value) {
      wx.setClipboardData({
        data: value,
        success: () => {
          wx.showToast({ title: '已复制OpenID', icon: 'success' });
        }
      });
    }
  },

  toggleAssignedMode() {
    const newMode = this.data.showAssignedMode === 'group' ? 'flat' : 'group';
    this.setData({ showAssignedMode: newMode });
  },

  showEditNickname() {
    this.setData({
      editNicknameVisible: true,
      editNicknameValue: this.data.user.nickname || ''
    });
  },

  onNicknameInput(e) {
    this.setData({ editNicknameValue: e.detail.value });
  },

  hideEditNickname() {
    this.setData({ editNicknameVisible: false });
  },

  async saveNickname() {
    const nickname = this.data.editNicknameValue.trim();
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    if (nickname.length > 20) {
      wx.showToast({ title: '昵称不能超过20个字符', icon: 'none' });
      return;
    }
    
    try {
      const result = await adminApi.updateUserNickname(this.data.userId, nickname);
      if (result.success) {
        this.setData({
          'user.nickname': nickname,
          editNicknameVisible: false
        });
        wx.showToast({ title: '修改成功', icon: 'success' });
      }
    } catch (err) {
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  },

  copyShareCode(e) {
    const code = e.currentTarget.dataset.code;
    if (code) {
      wx.setClipboardData({
        data: code,
        success: () => {
          wx.showToast({ title: '邀请码已复制', icon: 'success' });
        }
      });
    }
  },

  addBadge() {
    const titles = [...this.data.badgeTitles, '新称号'];
    const colors = [...this.data.badgeColors, '#00b26a'];
    this.setData({ badgeTitles: titles, badgeColors: colors });
  },

  removeBadge(e) {
    const idx = e.currentTarget.dataset.index;
    const titles = [...this.data.badgeTitles];
    const colors = [...this.data.badgeColors];
    titles.splice(idx, 1);
    colors.splice(idx, 1);
    this.setData({ badgeTitles: titles, badgeColors: colors });
  },

  onBadgeTitleInput(e) {
    const idx = e.currentTarget.dataset.index;
    const titles = [...this.data.badgeTitles];
    titles[idx] = e.detail.value;
    this.setData({ badgeTitles: titles });
  },

  onBadgeColorInput(e) {
    const idx = e.currentTarget.dataset.index;
    let val = e.detail.value;
    if (val && !val.startsWith('#')) {
      val = '#' + val;
    }
    const colors = [...this.data.badgeColors];
    colors[idx] = val;
    this.setData({ badgeColors: colors });
  },

  normalizeColor(c) {
    if (!c || typeof c !== 'string') return '#00b26a';
    let h = c.trim();
    if (!h.startsWith('#')) h = '#' + h;
    if (/^#[0-9a-fA-F]{3,8}$/.test(h)) return h;
    return '#00b26a';
  },

  async saveBadges() {
    const titles = this.data.badgeTitles;
    const colors = this.data.badgeColors.map(c => this.normalizeColor(c));
    this.setData({ badgeColors: colors });
    try {
      const result = await adminApi.updateUserBadges(this.data.userId, {
        badgeTitles: titles,
        badgeColors: colors
      });
      if (result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' });
      } else {
        wx.showToast({ title: result.message || '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  },

  async toggleAdmin() {
    const isAdmin = this.data.isAdmin;
    const userId = this.data.userId;
    const nickname = this.data.user.nickname || '该用户';
    if (isAdmin) {
      const res = await wx.showModal({
        title: '取消管理员',
        content: `确定移除 ${nickname} 的管理员权限吗？`
      });
      if (!res.confirm) return;
      try {
        const result = await adminApi.removeAdmin(userId);
        if (result.success) {
          wx.showToast({ title: '已移除管理员权限', icon: 'success' });
          this.setData({ isAdmin: false, 'user.isAdmin': false });
        } else {
          wx.showToast({ title: result.message || '操作失败', icon: 'none' });
        }
      } catch (err) {
        wx.showToast({ title: err.message || '操作失败', icon: 'none' });
      }
    } else {
      const res = await wx.showModal({
        title: '设为管理员',
        content: `确定将 ${nickname} 设为管理员吗？`
      });
      if (!res.confirm) return;
      try {
        const result = await adminApi.addAdmin(userId);
        if (result.success) {
          wx.showToast({ title: '已设为管理员', icon: 'success' });
          this.setData({ isAdmin: true, 'user.isAdmin': true });
        } else {
          wx.showToast({ title: result.message || '操作失败', icon: 'none' });
        }
      } catch (err) {
        wx.showToast({ title: err.message || '操作失败', icon: 'none' });
      }
    }
  },

    openColorPicker(e) {
    const idx = e.currentTarget.dataset.index;
    const currentColor = this.data.badgeColors[idx] || '#00B26A';
    this.setData({
      badgeColorPickerVisible: true,
      badgePickerIdx: idx,
      badgeCustomColor: currentColor
    });
  },

  closeBadgeColorPicker() {
    this.setData({ badgeColorPickerVisible: false });
  },

  onBadgeColorPickerClose(e) {
    if (!e.detail.visible) {
      this.setData({ badgeColorPickerVisible: false });
    }
  },

  onBadgeColorChange(e) {
    const detail = e.detail;
    const color = typeof detail.value === 'string' ? detail.value : (detail.value?.hex || detail.value?.HEX || detail.hex || detail.HEX || detail.value);
    if (color) {
      this.setData({ badgeCustomColor: color.toUpperCase() });
    }
  },

  onBadgePaletteBarChange(e) {
    const detail = e.detail;
    const color = typeof detail === 'string' ? detail : (detail?.hex || detail?.HEX || detail?.value);
    if (color) {
      this.setData({ badgeCustomColor: color.toUpperCase() });
    }
  },

  confirmBadgeCustomColor() {
    const { badgeCustomColor, badgePickerIdx, badgeColors } = this.data;
    if (badgeCustomColor && badgePickerIdx !== null) {
      const colors = [...badgeColors];
      colors[badgePickerIdx] = badgeCustomColor;
      this.setData({
        badgeColors: colors,
        badgeColorPickerVisible: false,
        badgePickerIdx: null
      });
    } else {
      this.setData({ badgeColorPickerVisible: false });
    }
  }
});
