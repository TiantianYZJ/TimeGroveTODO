const { workReportApi, reportTemplateApi, combosApi } = require('../../utils/api.js');
const { getLocalTodos } = require('../../utils/sync.js');
const logger = require('../../utils/logger.js');

const COLORS = ['#00b26a', '#2196F3', '#ff9800', '#7c4dff', '#e91e63', '#1abc9c'];

const DEFAULT_DAILY_SECTIONS = [
  { mode: 'text', title: '今日完成' },
  { mode: 'text', title: '进行中' },
  { mode: 'text', title: '遇到的问题' },
  { mode: 'text', title: '明日计划' },
  { mode: 'text', title: '总结与思考' },
];

const DEFAULT_WEEKLY_SECTIONS = [
  { mode: 'text', title: '本周完成' },
  { mode: 'text', title: '进行中' },
  { mode: 'text', title: '遇到的问题' },
  { mode: 'text', title: '下周计划' },
  { mode: 'text', title: '总结与思考' },
];

// Key→title mapping for old-format content normalization only
const OLD_LABELS = {
  completed: '今日完成', in_progress: '进行中', blocked: '遇到的问题',
  tomorrow_plan: '明日计划', summary: '总结与思考',
  next_plan: '下周计划', work_done: '工作完成', weekly_summary: '本周总结',
};

// 行对象生成器（稳定 ID 用于 wx:key）
let _lineSeq = Date.now();
function _makeLine(text, date) {
  return { id: _lineSeq++, text: String(text || ''), date: String(date || '') };
}
function _makeLines(texts) {
  return (texts || ['']).map(t => _makeLine(t));
}

const app = getApp();

Page({
  data: {
    reportId: null,
    reportType: 'daily',
    reportDate: '',
    reportWeek: '',
    navTitle: '写日报',
    targetDateHint: '',

    showCalendar: false,
    calendarValue: new Date().getTime(),
    minDate: new Date(2020, 0, 1).getTime(),
    maxDate: new Date(new Date().getFullYear() + 5, 11, 31).getTime(),
    weekOptions: [],
    weekIndex: 0,

    showLineCalendar: false,
    lineCalendarValue: new Date().getTime(),
    _lineCdSection: 0,
    _lineCdLine: 0,

    sections: [],
    sharedCombos: [],
    selectedComboId: null,
    selectedComboName: '私人',
    isSharedCombo: false,

    showComboPicker: false,

    showImportPopup: false,
    importTargetSection: 0,
    importTodos: { completed: [], uncompleted: [] },
    selectedImportTodos: [],
    importSearchKeyword: '',
    importDateOpts: {},

    canEditTemplate: false,
  },

  onLoad(options) {
    _lineSeq = Date.now();

    const reportType = options.type || 'daily';
    const reportDate = options.date || this.getTodayStr();
    const comboId = options.combo_id ? Number(options.combo_id) : null;
    const reportId = options.id ? Number(options.id) : null;

    const navTitles = { daily: '写日报', weekly: '写周报' };
    wx.setNavigationBarTitle({ title: navTitles[reportType] });
    const fullDateLabel = this.formatDateWithWeekday(reportDate);
    const reportWeek = this.getWeekNumber(reportDate);
    const dateLabels = {
      daily: '日报 · ' + fullDateLabel,
      weekly: reportDate ? `周报 · 第${reportWeek}周` : ''
    };

    const isEdit = !!reportId;
    if (isEdit) {
      navTitles.daily = '编辑报告';
      navTitles.weekly = '编辑报告';
    }

    this.setData({
      reportType,
      reportDate,
      reportId,
      reportWeek,
      navTitle: isEdit ? navTitles[reportType] : navTitles[reportType],
      targetDateHint: dateLabels[reportType] || dateLabels.daily,
      selectedComboId: comboId,
      selectedComboName: comboId ? '加载中...' : '私人'
    });

    // 初始化周数选择器选项 & 日历预设值
    let computedWeek = reportWeek;
    if (reportType === 'weekly') {
      computedWeek = this.buildWeekOptions(reportDate);
    } else {
      const d = new Date(reportDate.replace(/-/g, '/'));
      this.setData({ calendarValue: d.getTime() });
    }
    if (computedWeek !== reportWeek) {
      this.setData({ reportWeek: computedWeek });
    }

    // 关键：先加载模板/报告，再检查草稿
    if (isEdit) {
      this.loadReport(reportId);
    } else {
      this.loadTemplates().then(() => this.checkDraft());
    }

    this.loadCombos();
    if (isEdit) this.checkDraft();
  },

  onUnload() {
    this.saveDraft();
  },

  // ========== 旧内容格式归一化 (object → array) ==========

  _normalizeContent(content, type) {
    if (!content) return null;
    if (Array.isArray(content)) return content;
    if (typeof content === 'object') {
      return Object.keys(content).map((key, i) => ({
        title: OLD_LABELS[key] || key,
        mode: 'text',
        lines: Array.isArray(content[key]) ? content[key] : []
      }));
    }
    return null;
  },

  // ========== Draft System ==========

  getDraftKey() {
    const { reportType, reportDate, selectedComboId } = this.data;
    return `reportDraft_${reportType}_${reportDate}_${selectedComboId || 'private'}`;
  },

  saveDraft() {
    const { sections, reportType, reportDate, selectedComboId } = this.data;
    const hasContent = sections.some(s => s.lines.some(l => l && l.text && l.text.trim()));
    if (!hasContent) return;

    try {
      const draftKey = this.getDraftKey();
      const draft = {
        sections: JSON.parse(JSON.stringify(sections)),
        updatedAt: Date.now()
      };
      wx.setStorageSync(draftKey, draft);
    } catch (e) {
      logger.warn('REPORT', 'DRAFT', '保存草稿失败', e);
    }
  },

  checkDraft() {
    if (this.data.reportId) return;
    try {
      const draftKey = this.getDraftKey();
      const draft = wx.getStorageSync(draftKey);
      if (draft && draft.sections && draft.sections.length > 0) {
        wx.showModal({
          title: '恢复草稿',
          content: '检测到上次未完成的编辑，是否恢复？',
          confirmText: '恢复',
          cancelText: '丢弃',
          success: (res) => {
            if (res.confirm) {
              const sections = (draft.sections || []).map((s, i) => ({
                ...s,
                lines: (s.lines || []).map(l => typeof l === 'string' ? _makeLine(l) : l),
                _rk: i
              }));
              this.setData({ sections });
            } else {
              this.clearDraft();
            }
          }
        });
      }
    } catch (e) {
      logger.warn('REPORT', 'DRAFT', '检查草稿失败', e);
    }
  },

  clearDraft() {
    try {
      wx.removeStorageSync(this.getDraftKey());
    } catch (e) {
      logger.warn('REPORT', 'DRAFT', '清除草稿失败', e);
    }
  },

  // ========== 日期/周数选择器 ==========

  buildWeekOptions(dateStr) {
    const d = dateStr ? new Date(dateStr.replace(/-/g, '/')) : new Date();
    const year = d.getFullYear();
    const options = [];
    const cursor = new Date(year, 0, 1);
    cursor.setDate(cursor.getDate() - cursor.getDay());
    const yearEnd = new Date(year, 11, 31);
    let weekNum = 1;
    while (cursor <= yearEnd) {
      const endDate = new Date(cursor);
      endDate.setDate(cursor.getDate() + 6);
      const sm = cursor.getMonth() + 1;
      const sd = cursor.getDate();
      const em = endDate.getMonth() + 1;
      const ed = endDate.getDate();
      options.push({
        label: `第${weekNum}周（${sm}月${sd}日 - ${em}月${ed}日）`,
        date: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
        weekNum
      });
      cursor.setDate(cursor.getDate() + 7);
      weekNum++;
      if (weekNum > 54) break;
    }
    if (options.length > 0) {
      const last = options[options.length - 1];
      const lastDate = new Date(last.date);
      lastDate.setDate(lastDate.getDate() + 7);
      if (lastDate.getFullYear() === year) {
        const endDate = new Date(lastDate);
        endDate.setDate(lastDate.getDate() + 6);
        const sm = lastDate.getMonth() + 1;
        const sd = lastDate.getDate();
        const em = endDate.getMonth() + 1;
        const ed = endDate.getDate();
        options.push({
          label: `第${weekNum}周（${sm}月${sd}日 - ${em}月${ed}日）`,
          date: `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`,
          weekNum
        });
      }
    }

    let weekIndex = 0;
    const targetStr = dateStr || this.getTodayStr();
    const targetDate = new Date(targetStr.replace(/-/g, '/'));
    const targetDay = targetDate.getDay();
    const targetSunday = new Date(targetDate);
    targetSunday.setDate(targetDate.getDate() - targetDay);
    const targetSundayStr = `${targetSunday.getFullYear()}-${String(targetSunday.getMonth() + 1).padStart(2, '0')}-${String(targetSunday.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < options.length; i++) {
      if (options[i].date === targetSundayStr) {
        weekIndex = i;
        break;
      }
    }

    this.setData({
      weekOptions: options.map(o => o.label),
      _weekData: options,
      weekIndex
    });
    return options[weekIndex] ? options[weekIndex].weekNum : 1;
  },

  onWeekChange(e) {
    const idx = e.detail.value;
    const weekData = this.data._weekData || [];
    if (!weekData[idx]) return;
    const { date, weekNum } = weekData[idx];
    this.setData({
      reportDate: date,
      reportWeek: weekNum,
      weekIndex: idx,
      targetDateHint: `周报 · 第${weekNum}周`
    });
    this.clearDraft();
  },

  showCalendar() {
    this.setData({ showCalendar: true });
  },

  handleCalendarConfirm(e) {
    const detail = e.detail;
    const date = new Date(detail.value || detail);
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const fullDateLabel = this.formatDateWithWeekday(dateStr);
    this.setData({
      reportDate: dateStr,
      showCalendar: false,
      targetDateHint: '日报 · ' + fullDateLabel
    });
    this.clearDraft();
  },

  handleCalendarClose() {
    this.setData({ showCalendar: false });
  },

  // ========== Line Date Calendar ==========

  showLineDateCalendar(e) {
    const sectionIdx = Number(e.currentTarget.dataset.section);
    const lineIdx = Number(e.currentTarget.dataset.line);
    const line = this.data.sections[sectionIdx]?.lines[lineIdx];
    this.setData({
      showLineCalendar: true,
      lineCalendarValue: line?.date ? new Date(line.date.replace(/-/g, '/')).getTime() : new Date().getTime(),
      _lineCdSection: sectionIdx,
      _lineCdLine: lineIdx,
    });
  },

  handleLineCalendarConfirm(e) {
    const date = new Date(e.detail.value);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${m}-${d}`;
    const s = this.data._lineCdSection;
    const l = this.data._lineCdLine;
    this.setData({
      [`sections[${s}].lines[${l}].date`]: dateStr,
    });
  },

  handleLineCalendarClose() {
    this.setData({ showLineCalendar: false });
  },

  // ========== Data Loading ==========

  async loadReport(id) {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await workReportApi.getById(id);
      const report = res.data || res;
      if (report && report.id) {
        const sections = this.buildSectionsFromReport(report);
        const actualDate = (report.periodDate || this.data.reportDate).substring(0, 10);
        const actualType = report.type || this.data.reportType;
        const reportWeek = this.getWeekNumber(actualDate);
        const fullDateLabel = this.formatDateWithWeekday(actualDate);
        const weeklyEnd = (() => { const d = new Date(actualDate.replace(/-/g, '/')); d.setDate(d.getDate() + 6); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; })();
        const dateLabels = {
          daily: '日报 · ' + fullDateLabel,
          weekly: actualDate ? `周报 · 第${reportWeek}周 · ${parseInt(actualDate.substring(5, 7))}月${parseInt(actualDate.substring(8, 10))}日-${weeklyEnd}` : ''
        };
        const editTitle = actualType === 'weekly' ? '编辑周报' : '编辑报告';
        wx.setNavigationBarTitle({ title: editTitle });
        this.setData({
          sections,
          reportType: actualType,
          reportDate: actualDate,
          reportWeek,
          navTitle: editTitle,
          targetDateHint: dateLabels[actualType] || dateLabels.daily,
          selectedComboId: report.comboId || null,
          isSharedCombo: !!report.comboId
        });
        if (report.comboId) {
          const combos = this.data.sharedCombos.length > 0
            ? this.data.sharedCombos
            : (getApp().globalData.sharedCombos || []);
          const selected = combos.find(c => String(c.id) === String(report.comboId));
          this.setData({ selectedComboName: selected ? selected.name : '组合' });
        } else {
          this.setData({ selectedComboName: '私人' });
        }
      }
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      logger.error('REPORT', 'LOAD', '加载报告失败', err);
      this.setData({ sections: this.copyDefaultSections() });
    }
  },

  async loadTemplates(comboIdOverride) {
    const comboId = comboIdOverride !== undefined ? comboIdOverride : this.data.selectedComboId;
    if (!comboId) {
      try {
        const res = await reportTemplateApi.getList({
          combo_id: 0,
          type: this.data.reportType
        });
        const templates = res.templates || res.data || [];
        const matched = templates.filter(t => t.type === this.data.reportType);
        const template = matched.length > 0 ? matched[0] : (templates.length > 0 ? templates[0] : null);
        if (template) {
          const sections = this.buildSectionsFromTemplate(template);
          this.setData({ sections });
          return;
        }
      } catch (err) {
        logger.warn('REPORT', 'TEMPLATE', '加载私人模板失败，使用默认', err);
      }
      this.setData({ sections: this.copyDefaultSections() });
      return;
    }

    wx.showLoading({ title: '加载模板...' });
    try {
      const res = await reportTemplateApi.getList({
        combo_id: comboId,
        type: this.data.reportType
      });
      const templates = res.templates || res.data || [];
      const matched = templates.filter(t => t.type === this.data.reportType);
      const template = matched.length > 0 ? matched[0] : (templates.length > 0 ? templates[0] : null);
      if (template) {
        const sections = this.buildSectionsFromTemplate(template);
        this.setData({ sections });
      } else {
        this.setData({ sections: this.copyDefaultSections() });
      }
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      logger.warn('REPORT', 'TEMPLATE', '加载模板失败，使用默认', err);
      this.setData({ sections: this.copyDefaultSections() });
    }
  },

  buildSectionsFromReport(report) {
    const content = report.content || {};
    const type = this.data.reportType || 'daily';

    const normalized = this._normalizeContent(content, type);
    if (!normalized) return this.copyDefaultSections();

    return normalized.map((s, i) => ({
      mode: s.mode || 'text',
      title: s.title || '',
      color: COLORS[i % COLORS.length],
      lines: Array.isArray(s.lines) ? s.lines.map(l => {
        if (typeof l === 'object' && l !== null) return _makeLine(l.text, l.date);
        return _makeLine(l);
      }) : _makeLines(['']),
      _rk: i
    }));
  },

  buildSectionsFromTemplate(template) {
    if (!template) return this.copyDefaultSections();
    const sections = Array.isArray(template.sections) ? template.sections : [];
    if (sections.length === 0) return this.copyDefaultSections();

    // Normalize old format sections that still have key instead of mode
    return sections.map((s, i) => ({
      mode: s.mode || 'text',
      title: s.title || '',
      color: COLORS[i % COLORS.length],
      lines: _makeLines(['']),
      _rk: i
    }));
  },

  copyDefaultSections() {
    const type = this.data.reportType || 'daily';
    const presets = type === 'weekly' ? DEFAULT_WEEKLY_SECTIONS : DEFAULT_DAILY_SECTIONS;
    return presets.map((s, i) => ({
      mode: s.mode,
      title: s.title,
      color: COLORS[i % COLORS.length],
      lines: _makeLines(['']),
      _rk: i
    }));
  },

  async loadCombos() {
    try {
      const sharedCombos = app.globalData.sharedCombos || [];
      this.setData({ sharedCombos });

      if (this.data.selectedComboId) {
        const selected = sharedCombos.find(c => String(c.id) === String(this.data.selectedComboId));
        if (selected) {
          this.setData({
            selectedComboName: selected.name,
            isSharedCombo: true
          });
        }
      }
      this.updateCanEditTemplate();
    } catch (err) {
      logger.error('REPORT', 'COMBOS', '加载组合失败', err);
    }
  },

  _mergeIntoTemplate(currentSections, targetSections) {
    return targetSections.map((ts, i) => {
      const cs = currentSections[i];
      if (cs) {
        const entries = cs.lines.filter(l => l && l.text && l.text.trim());
        if (entries.length > 0) {
          if (ts.mode === 'date') {
            return {
              ...ts,
              lines: entries.map(e => _makeLine(e.text, e.date)),
              _rk: i
            };
          }
          return {
            ...ts,
            lines: entries.map(e => _makeLine(e.text)),
            _rk: i
          };
        }
      }
      return { ...ts, lines: _makeLines(['']), _rk: i };
    });
  },

  updateCanEditTemplate() {
    const { selectedComboId, sharedCombos } = this.data;
    if (!selectedComboId) {
      this.setData({ canEditTemplate: true });
      return;
    }
    const combo = (sharedCombos || []).find(c => String(c.id) === String(selectedComboId));
    const role = combo ? combo.role : null;
    this.setData({ canEditTemplate: role === 'owner' || role === 'admin' });
  },

  navigateToReportTemplates() {
    const { selectedComboId, reportType } = this.data;
    const comboId = selectedComboId || 0;
    wx.navigateTo({
      url: `/packageCombo/report-templates/report-templates?combo_id=${comboId}&type=${reportType}`
    });
  },

  async _switchToCombo(newComboId, name, isShared) {
    let targetSections;
    try {
      const res = await reportTemplateApi.getList({
        combo_id: newComboId || 0,
        type: this.data.reportType
      });
      const templates = res.templates || res.data || [];
      const matched = templates.filter(t => t.type === this.data.reportType);
      const template = matched.length > 0 ? matched[0] : null;
      targetSections = template ? this.buildSectionsFromTemplate(template) : this.copyDefaultSections();
    } catch {
      targetSections = this.copyDefaultSections();
    }

    const currentSections = this.data.sections;
    const hasContent = currentSections.some(s => s.lines.some(l => l && l.text && l.text.trim()));
    const structureDiffers = targetSections.length !== currentSections.length ||
      targetSections.some((ts, i) => ts.mode !== (currentSections[i]?.mode || 'text'));
    let mergedSections = targetSections;

    if (structureDiffers && hasContent) {
      const proceed = await new Promise(resolve => {
        wx.showModal({
          title: '切换确认',
          content: '目标模板结构不同，切换后会自动保留相同位置字段的内容，无法匹配的字段将被清空。是否继续？',
          confirmText: '继续',
          cancelText: '取消',
          success: r => resolve(r.confirm)
        });
      });
      if (!proceed) return false;
      mergedSections = this._mergeIntoTemplate(currentSections, targetSections);
    }

    this.setData({
      selectedComboId: newComboId,
      selectedComboName: name || (newComboId ? '组合' : '私人'),
      isSharedCombo: isShared,
      showComboPicker: false,
      sections: mergedSections
    });
    this.clearDraft();
    this.updateCanEditTemplate();
    return true;
  },

  async selectPrivateCombo() {
    await this._switchToCombo(null, '私人', false);
  },

  // ========== Line Editing ==========

  onLineInput(e) {
    const sectionIdx = Number(e.currentTarget.dataset.section);
    const lineIdx = Number(e.currentTarget.dataset.line);
    const value = e.detail.value;
    this.setData({
      [`sections[${sectionIdx}].lines[${lineIdx}].text`]: value
    });
  },

  addLine(e) {
    const sectionIdx = Number(e.currentTarget.dataset.section);
    const sections = JSON.parse(JSON.stringify(this.data.sections));
    sections[sectionIdx].lines.push(_makeLine(''));
    this.setData({ sections });
  },

  deleteLine(e) {
    const sectionIdx = Number(e.currentTarget.dataset.section);
    const lineIdx = Number(e.currentTarget.dataset.line);
    const sections = JSON.parse(JSON.stringify(this.data.sections));
    const lines = sections[sectionIdx].lines;

    lines.splice(lineIdx, 1);
    if (lines.length === 0) {
      lines.push(_makeLine(''));
    }
    this.setData({ sections });
  },

  // ========== Combo Picker ==========

  showComboPicker() {
    this.setData({ showComboPicker: true });
  },

  hideComboPicker() {
    this.setData({ showComboPicker: false });
  },

  onComboPickerVisibleChange(e) {
    this.setData({ showComboPicker: e.detail.visible });
  },

  async selectCombo(e) {
    const { id, name, shared } = e.currentTarget.dataset;
    const newComboId = id !== undefined ? Number(id) : null;
    await this._switchToCombo(newComboId, name, shared === '1');
  },

  // ========== Todo Import ==========

  importFromTodos(e) {
    const sectionIdx = Number(e.currentTarget.dataset.section);
    const todos = getLocalTodos();

    const allTodos = todos.filter(todo => {
      if (todo.isDeleted || todo.parent_id) return false;
      return true;
    });
    this._allImportTodos = allTodos;

    const completed = allTodos.filter(t => t.completed).map(t => ({
      ...t,
      _key: 'completed_' + (t.id || t.time)
    }));
    const uncompleted = allTodos.filter(t => !t.completed).map(t => ({
      ...t,
      _key: 'uncompleted_' + (t.id || t.time)
    }));

    this._importKeyMap = {};
    [...completed, ...uncompleted].forEach(t => { this._importKeyMap[t._key] = t; });

    this.setData({
      showImportPopup: true,
      importTargetSection: sectionIdx,
      importTodos: { completed, uncompleted },
      selectedImportTodos: [],
      importSearchKeyword: '',
      importDateOpts: {},
    });
  },

  onImportSearchInput(e) {
    const keyword = (e.detail.value || '').trim().toLowerCase();
    this.setData({ importSearchKeyword: keyword });

    const allTodos = this._allImportTodos || [];
    const filtered = allTodos.filter(todo => {
      if (keyword && todo.text.toLowerCase().indexOf(keyword) === -1) return false;
      return true;
    });

    const completed = filtered.filter(t => t.completed).map(t => ({
      ...t,
      _key: 'completed_' + (t.id || t.time)
    }));
    const uncompleted = filtered.filter(t => !t.completed).map(t => ({
      ...t,
      _key: 'uncompleted_' + (t.id || t.time)
    }));

    this._importKeyMap = {};
    [...completed, ...uncompleted].forEach(t => { this._importKeyMap[t._key] = t; });

    const validKeys = new Set(Object.keys(this._importKeyMap));
    const preserved = this.data.selectedImportTodos.filter(key => validKeys.has(key));

    this.setData({
      importTodos: { completed, uncompleted },
      selectedImportTodos: preserved
    });
  },

  hideImportPopup() {
    this.setData({ showImportPopup: false });
  },

  onImportPopupVisibleChange(e) {
    this.setData({ showImportPopup: e.detail.visible });
  },

  toggleImportTodo(e) {
    const key = e.currentTarget.dataset.key;
    const selected = [...this.data.selectedImportTodos];
    const idx = selected.indexOf(key);

    if (idx > -1) {
      selected.splice(idx, 1);
    } else {
      selected.push(key);
    }

    this.setData({ selectedImportTodos: selected });
  },

  onImportDateOption(e) {
    const { key, opt } = e.currentTarget.dataset;
    const opts = { ...this.data.importDateOpts };
    if (opts[key] === opt) {
      delete opts[key];
    } else {
      opts[key] = opt;
    }
    this.setData({ importDateOpts: opts });
  },

  confirmImport() {
    const { selectedImportTodos, importTargetSection } = this.data;
    if (selectedImportTodos.length === 0) {
      wx.showToast({ title: '请选择待办', icon: 'none' });
      return;
    }

    const sections = JSON.parse(JSON.stringify(this.data.sections));
    const todoMap = this._importKeyMap || {};
    let importedCount = 0;

    const isDateMode = sections[importTargetSection]?.mode === 'date';
    const dateOpts = this.data.importDateOpts || {};

    selectedImportTodos.forEach(key => {
      const todo = todoMap[key];
      if (todo && todo.text && todo.text.trim()) {
        let dateStr = '';
        if (isDateMode) {
          const opt = dateOpts[key];
          if (opt === 'create' && todo.time) {
            const d = new Date(todo.time);
            dateStr = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
          } else if (opt === 'complete' && todo.completedAt) {
            const d = new Date(todo.completedAt);
            dateStr = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
          } else if (opt === 'due' && todo.setDate) {
            dateStr = todo.setDate;
          }
        }
        sections[importTargetSection].lines.push(_makeLine(todo.text.trim(), dateStr));
        importedCount++;
      }
    });

    const targetLines = sections[importTargetSection].lines;
    while (targetLines.length > 0 && (!targetLines[0].text || !targetLines[0].text.trim())) {
      targetLines.shift();
    }
    if (targetLines.length === 0) {
      targetLines.push(_makeLine(''));
    }

    this.setData({
      sections,
      showImportPopup: false,
      selectedImportTodos: []
    });

    wx.showToast({ title: `已导入 ${importedCount} 条`, icon: importedCount > 0 ? 'success' : 'none' });
  },

  // ========== Add Line to Todo ==========

  addLineToTodo(e) {
    const sectionIdx = Number(e.currentTarget.dataset.section);
    const lineIdx = Number(e.currentTarget.dataset.line);
    const line = this.data.sections[sectionIdx].lines[lineIdx];
    const text = line && line.text;
    if (!text || !text.trim()) {
      wx.showToast({ title: '请先输入内容', icon: 'none' });
      return;
    }

    const setDate = this.data.reportDate;
    const comboId = this.data.selectedComboId || '';
    const isShared = this.data.isSharedCombo ? '1' : '0';

    wx.navigateTo({
      url: `/packagePages/add-todo/add-todo?text=${encodeURIComponent(text.trim())}&setDate=${setDate}&comboId=${comboId}&isShared=${isShared}&fromReport=1`
    });
  },

  // ========== Save ==========

  saveReport() {
    const content = this.data.sections.map(s => {
      const entries = s.lines.filter(l => l && l.text && l.text.trim());
      if (entries.length === 0) return null;
      if (s.mode === 'date') {
        return {
          title: s.title,
          mode: 'date',
          lines: entries.map(l => ({ text: l.text, date: l.date || '' }))
        };
      }
      return {
        title: s.title,
        mode: 'text',
        lines: this.trimTrailingEmpty(entries.map(l => l.text))
      };
    }).filter(Boolean);

    const hasContent = content.length > 0;
    if (!hasContent) {
      wx.showToast({ title: '请填写报告内容', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    const reportData = {
      type: this.data.reportType,
      period_date: this.data.reportDate,
      combo_id: this.data.selectedComboId || null,
      period_label: this.data.reportType === 'weekly' ? '第' + this.data.reportWeek + '周' : undefined,
      content
    };

    const apiCall = this.data.reportId
      ? workReportApi.update(this.data.reportId, reportData)
      : workReportApi.create(reportData);

    apiCall.then(() => {
      wx.hideLoading();
      this.clearDraft();
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    }).catch(err => {
      wx.hideLoading();
      logger.error('REPORT', 'SAVE', '保存失败', err);
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    });
  },

  // ========== Date Helpers ==========

  getTodayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  getWeekday(dateStr) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const date = new Date(dateStr.replace(/-/g, '/'));
    return days[date.getDay()] || '';
  },

  formatDateWithWeekday(dateStr) {
    if (!dateStr) return '';
    const month = dateStr.substring(5, 7);
    const day = dateStr.substring(8, 10);
    const weekday = this.getWeekday(dateStr);
    return `${parseInt(month)}月${parseInt(day)}日 ${weekday}`;
  },

  formatDateStr(dateVal) {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') return dateVal.substring(0, 10);
    const d = new Date(dateVal);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  formatDateObj(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  getFriendlyDate(dateStr) {
    if (!dateStr) return '';
    const today = this.getTodayStr();
    if (dateStr === today) return '今天';

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = this.formatDateObj(yesterdayDate);
    if (dateStr === yesterday) return '昨天';

    const month = dateStr.substring(5, 7);
    const day = dateStr.substring(8, 10);
    return `${parseInt(month)}月${parseInt(day)}日`;
  },

  addDays(dateStr, days) {
    const d = new Date(dateStr.replace(/-/g, '/'));
    d.setDate(d.getDate() + days);
    return this.formatDateObj(d);
  },

  getWeekNumber(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(/-/g, '/'));
    if (isNaN(d.getTime())) return '';
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const firstSunday = new Date(startOfYear);
    firstSunday.setDate(1 - startOfYear.getDay());
    const diff = d - firstSunday + (startOfYear.getTimezoneOffset() - firstSunday.getTimezoneOffset()) * 60000;
    const oneWeek = 604800000;
    const weekNum = Math.floor(diff / oneWeek) + 1;
    return weekNum > 0 ? weekNum : 1;
  },

  trimTrailingEmpty(lines) {
    let end = lines.length;
    while (end > 0 && lines[end - 1].trim() === '') {
      end--;
    }
    return end > 0 ? lines.slice(0, end) : [];
  },

  // ========== Navigation ==========

  goBack() {
    wx.navigateBack();
  }
});
