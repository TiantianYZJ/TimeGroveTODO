const { reportTemplateApi, combosApi } = require('../../utils/api.js');
const logger = require('../../utils/logger.js');

const PRESET_DAILY = [
  { mode: 'text', title: '今日完成', sort_order: 1, max_lines: 20 },
  { mode: 'text', title: '进行中', sort_order: 2, max_lines: 20 },
  { mode: 'text', title: '遇到的问题', sort_order: 3, max_lines: 20 },
  { mode: 'text', title: '明日计划', sort_order: 4, max_lines: 20 },
  { mode: 'text', title: '总结与思考', sort_order: 5, max_lines: 20 },
];

const PRESET_WEEKLY = [
  { mode: 'text', title: '本周完成', sort_order: 1, max_lines: 20 },
  { mode: 'text', title: '进行中', sort_order: 2, max_lines: 20 },
  { mode: 'text', title: '遇到的问题', sort_order: 3, max_lines: 20 },
  { mode: 'text', title: '下周计划', sort_order: 4, max_lines: 20 },
  { mode: 'text', title: '总结与思考', sort_order: 5, max_lines: 20 },
];

const app = getApp();

Page({
  data: {
    comboId: 0,
    comboName: '',
    currentType: 'daily',
    dailySections: [],
    weeklySections: [],

    showComboPicker: false,
    sharedCombos: [],
    manageableCombos: [],
  },

  onLoad(options) {
    const { combo_id } = options;
    const initType = (options.type === 'daily' || options.type === 'weekly') ? options.type : 'daily';
    const cid = parseInt(combo_id || 0);
    const initialComboName = cid > 0 ? (this._resolveComboName(cid) || `组合 #${cid}`) : '私人';
    this.setData({
      comboId: cid,
      comboName: initialComboName,
      currentType: initType,
      dailySections: JSON.parse(JSON.stringify(PRESET_DAILY)),
      weeklySections: JSON.parse(JSON.stringify(PRESET_WEEKLY)),
      sharedCombos: app.globalData.sharedCombos || [],
      manageableCombos: this._getManageableCombos(),
    });
    this.loadData();
  },

  _resolveComboName(comboId) {
    const combo = (app.globalData.sharedCombos || []).find(c => String(c.id) === String(comboId));
    return combo ? combo.name : null;
  },

  _getManageableCombos() {
    return (app.globalData.sharedCombos || []).filter(c => c.role === 'owner' || c.role === 'admin');
  },

  _normalizeSections(sections) {
    if (!Array.isArray(sections)) return [];
    return sections.map((s, i) => {
      if (typeof s === 'string') {
        return { mode: 'text', title: s, sort_order: i + 1, max_lines: 20 };
      }
      // Old format: has key but no mode
      if (!s.mode && s.key) {
        return { ...s, mode: 'text', title: s.title || s.key };
      }
      return { ...s, mode: s.mode || 'text', title: s.title || '' };
    });
  },

  async loadData() {
    const { comboId } = this.data;
    try {
      const [comboResult, templateResult] = await Promise.all([
        comboId > 0 ? combosApi.getById(comboId) : Promise.resolve(null),
        reportTemplateApi.getList({ combo_id: comboId }),
      ]);
      if (comboResult && comboResult.success) {
        this.setData({ comboName: comboResult.combo.name });
      }
      if (templateResult.success) {
        const templates = templateResult.data || [];
        const daily = templates.find(t => t.type === 'daily')?.sections;
        const weekly = templates.find(t => t.type === 'weekly')?.sections;
        if (daily && daily.length > 0) {
          this.setData({ dailySections: this._normalizeSections(daily) });
        }
        if (weekly && weekly.length > 0) {
          this.setData({ weeklySections: this._normalizeSections(weekly) });
        }
      }
    } catch (err) { logger.error('TEMPLATE', 'LOAD', '加载模板失败', err); }
  },

  async _switchTarget(comboId, comboName) {
    const hasEdits = this._hasUnsavedChanges();
    if (hasEdits) {
      const proceed = await new Promise(resolve => {
        wx.showModal({
          title: '切换确认',
          content: '切换目标后未保存的编辑将丢失，是否继续？',
          confirmText: '继续',
          cancelText: '取消',
          success: r => resolve(r.confirm)
        });
      });
      if (!proceed) { this.setData({ showComboPicker: false }); return; }
    }

    this.setData({
      comboId,
      comboName,
      showComboPicker: false,
      dailySections: JSON.parse(JSON.stringify(PRESET_DAILY)),
      weeklySections: JSON.parse(JSON.stringify(PRESET_WEEKLY)),
    });
    this.loadData();
  },

  _hasUnsavedChanges() {
    const { dailySections, weeklySections } = this.data;
    const isDefaultDaily = JSON.stringify(dailySections) === JSON.stringify(PRESET_DAILY);
    const isDefaultWeekly = JSON.stringify(weeklySections) === JSON.stringify(PRESET_WEEKLY);
    return !isDefaultDaily || !isDefaultWeekly;
  },

  showComboPicker() {
    this.setData({ showComboPicker: true });
  },

  hideComboPicker() {
    this.setData({ showComboPicker: false });
  },

  onComboPickerVisibleChange(e) {
    this.setData({ showComboPicker: e.detail.visible });
  },

  selectPrivateCombo() {
    this._switchTarget(0, '私人');
  },

  selectCombo(e) {
    const { id, name } = e.currentTarget.dataset;
    this._switchTarget(Number(id), name);
  },

  onTypeChange(e) { this.setData({ currentType: e.detail.value }); },

  onSectionTitleInput(e) {
    const { type, index } = e.currentTarget.dataset;
    const value = e.detail.value;
    const key = type === 'daily' ? 'dailySections' : 'weeklySections';
    const sections = [...this.data[key]];
    if (sections[index]) {
      sections[index] = { ...sections[index], title: value };
      this.setData({ [key]: sections });
    }
  },

  onModeToggle(e) {
    const { type, index } = e.currentTarget.dataset;
    const key = type === 'daily' ? 'dailySections' : 'weeklySections';
    const sections = [...this.data[key]];
    if (sections[index]) {
      sections[index] = { ...sections[index], mode: sections[index].mode === 'date' ? 'text' : 'date' };
      this.setData({ [key]: sections });
    }
  },

  addSection(e) {
    const type = e.currentTarget.dataset.type;
    const key = type === 'daily' ? 'dailySections' : 'weeklySections';
    const sections = [...this.data[key]];
    sections.push({ mode: 'text', title: '新段落', sort_order: sections.length + 1, max_lines: 20 });
    this.setData({ [key]: sections });
  },

  deleteSection(e) {
    const { type, index } = e.currentTarget.dataset;
    const key = type === 'daily' ? 'dailySections' : 'weeklySections';
    let sections = [...this.data[key]];
    wx.showModal({
      title: '删除确认',
      content: `确定删除"${sections[index]?.title || '此段落'}"吗？`,
      success: (res) => {
        if (res.confirm) {
          sections.splice(index, 1);
          sections = sections.map((s, i) => ({ ...s, sort_order: i + 1 }));
          this.setData({ [key]: sections });
        }
      }
    });
  },

  async saveTemplates() {
    const { comboId, dailySections, weeklySections } = this.data;
    try {
      await Promise.all([
        reportTemplateApi.upsert({ combo_id: comboId, type: 'daily', sections: dailySections }),
        reportTemplateApi.upsert({ combo_id: comboId, type: 'weekly', sections: weeklySections }),
      ]);
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
      logger.error('TEMPLATE', 'SAVE', '保存模板失败', err);
    }
  },

});
