const share = require('../../utils/share');
const subjectService = require('../../services/subject');
const seed = require('../../services/seed');
const theme = require('../../utils/theme');
const studyService = require('../../services/study');
const util = require('../../utils/util');
const store = require('../../utils/store');

const themeStore = require('../../utils/theme');
const STATUS_KEYS = ['none', 'learning', 'mastered', 'weak', 'review'];
const STAGE_PRESETS = ['0%', '25%', '50%', '75%', '100%'];

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/subject/subject'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/subject/subject'); },

  data: {
    themeCls: '',
    key: 'math',
    color: 'var(--c-english)',
    detail: null,
    groups: [],
    timeText: '0m',
    pointCount: 0,
    isMajor: false,
    isCustom: false,
    statusLabels: [],
    legend: []
  },
  /* 主题：同步皮肤 class + 导航栏 / tabBar + 需要真实色值的组件属性。
   * 注意：switch 等原生组件的 color 是「属性值」而非样式，吃不了 var()，必须传真值。 */
  _applyTheme() {
    const p = themeStore.palette();
    this.setData({
      themeCls: themeStore.activeClass(),
      themeKey: themeStore.active().key,
      swColor: p.forest,
      barColor: p.forest
    });
    themeStore.applyChrome();
  },


  onLoad(options) {
    const key = options.key || 'math';
    const meta = theme.SUBJECT_MAP[key] || theme.SUBJECTS[0];
    this.setData({
      key,
      color: meta.color,
      isMajor: key === 'major',
      statusLabels: STATUS_KEYS.map((k) => theme.KP_STATUS[k].label),
      legend: STATUS_KEYS.map((k) => ({ label: theme.KP_STATUS[k].label, color: theme.KP_STATUS[k].color }))
    });
    this._unsubs = [store.subscribe(store.TOPICS.KP_CHANGED, () => this.load())];
  },

  onShow() { this._applyTheme(); this.load(); },

  onUnload() { (this._unsubs || []).forEach((fn) => fn()); },

  load() {
    const detail = subjectService.detail(this.data.key);
    const groups = detail.groups.map((g) => ({
      name: g.name,
      chapters: g.chapters.map((c) => ({
        name: c.name,
        mastered: c.mastered,
        points: c.points.map((p) => ({
          id: p.id,
          name: p.name,
          statusColor: theme.KP_STATUS[p.status].color,
          statusBg: theme.KP_STATUS[p.status].bg
        }))
      }))
    }));
    const pointCount = subjectService.flattenPoints(seed.treeOf(this.data.key)).length;
    this.setData({
      detail,
      groups,
      pointCount,
      isCustom: !!detail.isCustom,
      timeText: util.fmtMinutes(studyService.subjectTotals()[this.data.key] || 0)
    });
    wx.setNavigationBarTitle({ title: detail.name });
  },

  onPoint(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showActionSheet({
      itemList: this.data.statusLabels,
      success: (res) => {
        subjectService.setKpStatus(id, STATUS_KEYS[res.tapIndex]);
        wx.showToast({ title: `已标记「${name}」`, icon: 'none' });
      },
      fail: () => {}
    });
  },

  onStage(e) {
    const name = e.currentTarget.dataset.name;
    wx.showActionSheet({
      itemList: STAGE_PRESETS,
      success: (res) => {
        subjectService.setStage(this.data.key, name, Number(STAGE_PRESETS[res.tapIndex].replace('%', '')));
        this.load();
      },
      fail: () => {}
    });
  },

  addChapter() {
    const groupNames = this.data.detail.groups.map((g) => g.name);
    wx.showActionSheet({
      itemList: groupNames.concat(['＋ 新建分组']),
      success: (res) => {
        let group = groupNames[res.tapIndex];
        if (!group) {
          this._promptChapter('新分组');
          return;
        }
        this._promptChapter(group);
      },
      fail: () => {}
    });
  },

  _promptChapter(group) {
    wx.showModal({
      title: `在「${group}」下添加章节`,
      editable: true,
      placeholderText: '章节名称，如：图论基础',
      success: (res) => {
        if (!res.confirm) return;
        const name = (res.content || '').trim();
        if (!name) { wx.showToast({ title: '名称不能为空', icon: 'none' }); return; }
        seed.addChapterToMajor(group, name, []);
        this.load();
        wx.showToast({ title: '已添加', icon: 'success' });
      }
    });
  },

  resetMajor() {
    wx.showModal({
      title: '恢复内置结构',
      content: '将清空你自定义的专业课章节，恢复为内置 408 参考结构。',
      success: (res) => {
        if (res.confirm) { seed.resetMajor(); this.load(); }
      }
    });
  }
});
