const { workReportApi } = require('../../utils/api.js');
const { formatFriendlyDate, formatDateTime } = require('../../utils/util.js');

const SECTION_COLORS = ['#00b26a', '#3498db', '#e67e22', '#9b59b6', '#e74c3c', '#1abc9c'];

// 归一化新旧 content 格式
function normalizeContent(content, type) {
  if (!content) return [];
  // 新格式: [{title, mode, lines}]
  if (Array.isArray(content)) {
    return content.filter(s => s && Array.isArray(s.lines)).map(s => ({
      title: s.title || '',
      mode: s.mode || 'text',
      lines: s.lines.map(l => {
        if (typeof l === 'object' && l !== null) return { text: String(l.text || ''), date: String(l.date || '') };
        return { text: String(l || ''), date: '' };
      }).filter(l => l.text)
    }));
  }
  // 旧格式: {key: ["line"]}
  if (typeof content === 'object') {
    const labels = {
      completed: type === 'weekly' ? '本周完成' : '今日完成',
      in_progress: '进行中', blocked: '遇到的问题',
      tomorrow_plan: '明日计划', summary: '总结与思考',
      next_plan: '下周计划', work_done: '工作完成', weekly_summary: '本周总结',
    };
    return Object.keys(content).filter(k => Array.isArray(content[k])).map(key => ({
      title: labels[key] || key,
      mode: 'text',
      lines: content[key].filter(l => l && l.trim()).map(l => ({ text: l, date: '' }))
    }));
  }
  return [];
}

Page({
  data: {
    report: null,
    reportType: 'daily',
    sections: [],
    friendlyDate: '',
    sectionColors: SECTION_COLORS,
    canEdit: false,
    canDelete: false,
    loaded: false,
    refreshing: false,
    sectionLabels: { daily: {}, weekly: {} },
    creator: null,
    showCopyPopup: false,
    checkedSections: {},
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this._reportId = parseInt(id);
      this.loadReport(this._reportId);
    }
  },

  onShow() {
    if (this._reportId) this.loadReport(this._reportId);
  },

  async loadReport(id) {
    try {
      const result = await workReportApi.getById(id);
      if (result.success && result.data) {
        const report = result.data;
        report.scope = !report.comboId ? 'private' : 'shared';
        const type = report.type || 'daily';
        wx.setNavigationBarTitle({ title: type === 'weekly' ? '周报' : '日报' });
        const content = report.content || {};
        const sections = normalizeContent(content, type);
        this.setData({
          report,
          reportType: type,
          sections,
          creator: report.nickname ? { id: report.userId, nickname: report.nickname, avatar: report.avatarUrl } : null,
          comboName: report.scope === 'private' ? '' : (report.comboName || ''),
          friendlyDate: this.buildReportTitle(report.periodDate, type),
          formattedCreatedAt: formatDateTime(report.createdAt),
          formattedUpdatedAt: formatDateTime(report.updatedAt),
          canEdit: true,
          canDelete: true,
          loaded: true,
          refreshing: false,
        });
      } else {
        this.setData({ loaded: true, refreshing: false });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loaded: true, refreshing: false });
    }
  },

  onRefresh() {
    if (this.data.report && this.data.report.id) {
      this.setData({ refreshing: true });
      this.loadReport(this.data.report.id);
    }
  },

  navigateToEdit() {
    if (!this.data.report) return;
    wx.navigateTo({
      url: `/packagePages/report-edit/report-edit?id=${this.data.report.id}`
    });
  },

  deleteReport() {
    wx.showModal({
      title: '删除确认',
      content: '确定删除该报告吗？删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            await workReportApi.delete(this.data.report.id);
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 1500);
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  buildReportTitle(periodDate, type) {
    if (!periodDate) return '';
    const typeLabel = type === 'weekly' ? '周报' : '日报';
    if (type === 'weekly') {
      const range = this.getWeekRangeStr(periodDate);
      const weekNum = this.getWeekNumber(periodDate);
      return `${typeLabel} · ${range} · 第${weekNum}周`;
    }
    const friendly = formatFriendlyDate(periodDate);
    return `${typeLabel} · ${friendly}`;
  },

  getWeekRangeStr(dateStr) {
    if (!dateStr) return '';
    const start = new Date(dateStr);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sm = start.getMonth() + 1;
    const sd = start.getDate();
    const em = end.getMonth() + 1;
    const ed = end.getDate();
    return `${sm}月${sd}日 - ${em}月${ed}日`;
  },

  getWeekNumber(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    // 以周日为周起始
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const firstSunday = new Date(startOfYear);
    firstSunday.setDate(1 - startOfYear.getDay());
    const diff = d - firstSunday + (startOfYear.getTimezoneOffset() - firstSunday.getTimezoneOffset()) * 60000;
    const oneWeek = 604800000;
    const weekNum = Math.floor(diff / oneWeek) + 1;
    return weekNum > 0 ? weekNum : 1;
  },

  // ===== Copy FAB =====
  toggleCopyPopup() {
    const checked = {};
    this.data.sections.forEach((s, i) => { checked[i] = true; });
    this.setData({
      showCopyPopup: !this.data.showCopyPopup,
      checkedSections: checked,
    });
  },
  closeCopyPopup() {
    this.setData({ showCopyPopup: false });
  },
  onCopyPopupVisibleChange(e) {
    if (!e.detail.visible) this.setData({ showCopyPopup: false });
  },
  onCheckboxChange(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const checked = { ...this.data.checkedSections };
    checked[idx] = !checked[idx];
    this.setData({ checkedSections: checked });
  },
  copyCheckedContent() {
    const { sections, checkedSections, report } = this.data;
    const checked = sections.filter((s, i) => checkedSections[i]);
    if (!checked.length) {
      wx.showToast({ title: '请至少选择一项', icon: 'none' });
      return;
    }
    const parts = [];
    checked.forEach(s => {
      const lines = s.lines && s.lines.length
        ? s.lines.map((l, i) => {
            const txt = l.text || l;
            const prefix = l.date ? `[${l.date}] ` : '';
            return `${i + 1}、${prefix}${txt}`;
          }).join('\n')
        : '';
      parts.push(`${s.title}：\n${lines}`);
    });
    const text = parts.join('\n\n');
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
        this.setData({ showCopyPopup: false });
      },
      fail: () => wx.showToast({ title: '复制失败', icon: 'none' }),
    });
  },

  goBack() { wx.navigateBack(); },

  goToUserHome(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.navigateTo({ url: `/packageProfile/user-home/user-home?userId=${userId}` });
  },

  copyCreator() {
    const creator = this.data.creator;
    if (creator) {
      wx.setClipboardData({ data: creator.nickname || '未知用户' });
    }
  },
});
