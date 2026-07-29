const { workReportApi, combosApi } = require('../../utils/api.js');
const logger = require('../../utils/logger.js');

function contentLineInfo(raw) {
  let firstLine = '';
  let lineCount = 0;
  if (!raw) return { firstLine, lineCount };
  const content = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
  function countLine(text) {
    const t = typeof text === 'object' && text !== null ? text.text : text;
    if (t && String(t).trim()) { lineCount++; if (!firstLine) firstLine = String(t).trim(); }
  }
  if (Array.isArray(content)) {
    content.forEach(s => { if (s && Array.isArray(s.lines)) s.lines.forEach(countLine); });
  } else if (content && typeof content === 'object') {
    Object.values(content).forEach(lines => { if (Array.isArray(lines)) lines.forEach(countLine); });
  }
  return { firstLine, lineCount };
}

Page({
  data: {
    comboId: 0,
    comboName: '',
    isAdmin: false,
    currentUserId: null,
    members: [],
    minDate: new Date(2020, 0, 1).getTime(),
    maxDate: new Date(new Date().getFullYear() + 5, 11, 31).getTime(),
    today: new Date().getTime(),
    marks: [],
    calendarView: 'month',
    currentTab: 'daily',
    selectedDate: '',
    reports: [],
    showFilterPopup: false,
    selectedMemberId: '0',
    boardTitle: '',
  },

  onLoad(options) {
    const { combo_id } = options;
    const userInfo = getApp().globalData.userInfo || {};
    this.setData({
      comboId: parseInt(combo_id || 0),
      currentUserId: userInfo.id || null
    });
    this.loadComboInfo();
  },

  async loadComboInfo() {
    wx.showLoading({ title: '加载中...' });
    try {
      const result = await combosApi.getById(this.data.comboId);
      if (result.success) {
        const members = result.combo.members || [];
        // 判断当前用户是否为 owner/admin
        const me = members.find(m => String(m.id) === String(this.data.currentUserId));
        const isAdmin = me && (me.role === 'owner' || me.role === 'admin');
        this.setData({
          comboName: result.combo.name,
          members,
          isAdmin: !!isAdmin,
        });
      }
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      logger.error('REPORT', 'BOARD_LOAD', '加载组合信息失败', err);
    }
  },

  handleLoad() {
    const today = new Date();
    const dateStr = this.formatDate(today);
    this.setData({ selectedDate: dateStr });
    this.loadReports();
    this.updateBoardTitle();
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  getWeekStart(dateStr) {
    const d = new Date(dateStr.replace(/-/g, '/'));
    const day = d.getDay();
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - day);
    return this.formatDate(sunday);
  },

  getReportDateTitle(dateStr) {
    if (!dateStr) return '';
    const month = dateStr.substring(5, 7);
    const day = dateStr.substring(8, 10);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const date = new Date(dateStr.replace(/-/g, '/'));
    const weekday = weekdays[date.getDay()] || '';
    return `${parseInt(month)}月${parseInt(day)}日 ${weekday}`;
  },

  getWeekNumber(dateStr) {
    // 以周日为周起始，计算当前是第几周
    const d = new Date(dateStr.replace(/-/g, '/'));
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    // 计算年初第一个周日
    const firstSunday = new Date(startOfYear);
    firstSunday.setDate(1 - startOfYear.getDay());
    const diff = d - firstSunday + (startOfYear.getTimezoneOffset() - firstSunday.getTimezoneOffset()) * 60000;
    const oneWeek = 604800000;
    const weekNum = Math.floor(diff / oneWeek) + 1;
    return weekNum > 0 ? weekNum : 1;
  },

  getWeekTitle(dateStr) {
    if (!dateStr) return '';
    const weekNum = this.getWeekNumber(dateStr);
    return `${this.getReportDateTitle(dateStr)} · 第${weekNum}周`;
  },

  updateBoardTitle() {
    const { selectedDate, currentTab, comboName } = this.data;
    if (!selectedDate) return;
    const dateTitle = currentTab === 'weekly'
      ? this.getWeekTitle(selectedDate)
      : this.getReportDateTitle(selectedDate);
    this.setData({ boardTitle: dateTitle });
  },

  handleDateChange(e) {
    const { checked } = e.detail || {};
    if (!checked) return;
    const d = new Date(checked.year, checked.month - 1, checked.day);
    this.setData({ selectedDate: this.formatDate(d) });
    this.loadReports();
    this.updateBoardTitle();
  },

  handleViewChange(e) {
    const detail = e.detail;
    if (detail && typeof detail.year === 'number' && typeof detail.month === 'number') {
      const d = new Date(detail.year, detail.month - 1, 1);
      const firstDay = this.formatDate(d);
      const lastDay = this.formatDate(new Date(detail.year, detail.month, 0));
      this.loadMarksForRange(firstDay, lastDay);
    }
  },

  onTabChange(e) {
    const tab = e.detail.value;
    this.setData({ currentTab: tab });
    // 不能额外调用 toggleView — 见 calendar.js onTabChange 注释
    if (tab === 'daily') {
      this.setData({ calendarView: 'month' });
    } else {
      this.setData({ calendarView: 'week' });
    }
    this.loadReports();
    this.updateBoardTitle();
  },

  async loadReports() {
    const { comboId, currentTab, selectedDate, selectedMemberId } = this.data;
    if (!selectedDate) return;
    const params = { combo_id: comboId, type: currentTab };
    params.period_date = currentTab === 'daily' ? selectedDate : this.getWeekStart(selectedDate);
    if (selectedMemberId !== '0') params.user_id = parseInt(selectedMemberId);
    try {
      wx.showLoading({ title: '加载中...' });
      const result = await workReportApi.getBoard(params);
      wx.hideLoading();
      if (result.success) {
        const boardData = result.data || {};
        const members = boardData.members || [];
        const reports = [];
        members.forEach(m => {
          (m.reports || []).forEach(r => {
            const lineInfo = contentLineInfo(r.content);
            reports.push({ ...r, userId: m.userId, nickname: m.nickname, avatarUrl: m.avatarUrl, summary: lineInfo.firstLine || '暂无记录', lineCount: lineInfo.lineCount, isOwnReport: String(m.userId) === String(this.data.currentUserId) });
          });
        });
        this.setData({ reports });
      }
    } catch (err) { logger.error('REPORT', 'BOARD', '加载看板数据失败', err); wx.hideLoading(); }
    this.loadCalendarMarks();
  },

  async loadCalendarMarks() {
    const { selectedDate } = this.data;
    if (!selectedDate) return;
    const d = new Date(selectedDate.replace(/-/g, '/'));
    const firstDay = this.formatDate(new Date(d.getFullYear(), d.getMonth(), 1));
    const lastDay = this.formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    this.loadMarksForRange(firstDay, lastDay);
  },

  async loadMarksForRange(firstDay, lastDay) {
    const { comboId } = this.data;
    if (!comboId) return;
    try {
      const result = await workReportApi.getBoard({
        combo_id: comboId,
        date_from: firstDay,
        date_to: lastDay,
      });
      if (result.success) {
        const marks = [];
        (result.data?.members || []).forEach(m => {
          (m.reports || []).forEach(r => {
            if (r.periodDate) {
              marks.push({ date: r.periodDate, type: 'dot', color: '#ff8800' });
            }
          });
        });
        // Deduplicate dates
        const seen = new Set();
        const uniqueMarks = marks.filter(m => {
          if (seen.has(m.date)) return false;
          seen.add(m.date);
          return true;
        });
        this.setData({ marks: uniqueMarks });
      }
    } catch (err) { logger.error('REPORT', 'BOARD', '加载日历标记失败', err); }
  },

  navigateToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/packagePages/report-detail/report-detail?id=${id}` });
  },

  showMemberFilter() { this.setData({ showFilterPopup: true }); },
  hideMemberFilter() { this.setData({ showFilterPopup: false }); },
  onFilterPopupVisibleChange(e) { if (!e.detail.visible) this.setData({ showFilterPopup: false }); },
  onMemberFilterChange(e) { this.setData({ selectedMemberId: e.detail.value, showFilterPopup: false }); this.loadReports(); },

  async onFabTap() {
    const { comboId, currentTab, selectedDate, currentUserId } = this.data;
    const date = selectedDate || this.formatDate(new Date());
    const target = currentTab === 'daily' ? date : this.getWeekStart(date);
    const label = currentTab === 'daily' ? '日报' : '周报';

    // 检测当前用户在此时段是否已有报告
    try {
      const res = await workReportApi.getList({ type: currentTab, period_date: target, combo_id: comboId, page_size: 1 });
      const list = (res.data && res.data.list) || res.list || [];
      const mine = list.find(r => String(r.userId || r.user_id) === String(currentUserId));
      if (mine) {
        wx.showModal({
          title: `${label}已存在`,
          content: `你在该时段已有${label}，是否前往编辑？`,
          confirmText: '去编辑',
          cancelText: '取消',
          success: (r) => {
            if (r.confirm) {
              wx.navigateTo({
                url: `/packagePages/report-edit/report-edit?id=${mine.id}`
              });
            }
          }
        });
        return;
      }
    } catch { /* 失败则继续进入创建页 */ }

    wx.navigateTo({ url: `/packagePages/report-edit/report-edit?type=${currentTab}&date=${target}&combo_id=${comboId}` });
  },

  navigateToReportTemplates() {
    const type = (this.data.currentTab === 'daily' || this.data.currentTab === 'weekly')
      ? this.data.currentTab : 'daily';
    wx.navigateTo({
      url: `/packageCombo/report-templates/report-templates?combo_id=${this.data.comboId}&type=${type}`
    });
  },

  handleReportSwipe(e) {
    const { type, id } = e.currentTarget.dataset;
    if (type === 'edit') {
      wx.navigateTo({
        url: `/packagePages/report-edit/report-edit?id=${encodeURIComponent(id)}`
      });
    } else if (type === 'delete') {
      wx.showModal({
        title: '删除确认',
        content: '确定删除该报告吗？删除后不可恢复。',
        confirmText: '删除',
        confirmColor: '#ff4d4f',
        success: async (res) => {
          if (res.confirm) {
            try {
              await workReportApi.delete(id);
              wx.showToast({ title: '已删除', icon: 'success' });
              this.loadReports();
            } catch (err) {
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          }
        }
      });
    }
  },

  goBack() { wx.navigateBack(); },
});
