const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const taskService = require('../../services/task');
const util = require('../../utils/util');
const store = require('../../utils/store');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/plan/plan'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/plan/plan'); },

  data: {
    themeCls: '',
    planTypes: [
      { key: 'day', label: '日' },
      { key: 'week', label: '周' },
      { key: 'month', label: '月' },
      { key: 'stage', label: '阶段' }
    ],
    activeType: 'day',
    typeLabel: '今日',
    date: '',
    dateLabel: '',
    tasks: [],
    stat: { done: 0, total: 0, rate: 0 },
    estText: '0m',
    doneText: '0m'
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


  onLoad() {
    this.setData({ date: util.dateStr() });
    this._unsubs = [store.subscribe(store.TOPICS.TASK_CHANGED, () => this.load())];
  },

  onShow() { this._applyTheme(); this.load(); },

  onUnload() { (this._unsubs || []).forEach((fn) => fn()); },

  load() {
    const { activeType, date } = this.data;
    let list = [];
    let typeLabel = '今日';
    if (activeType === 'day') {
      list = taskService.byDate(date);
      typeLabel = util.relativeDay(date);
    } else {
      list = taskService.byPlan(activeType);
      typeLabel = { week: '本周', month: '本月', stage: '阶段' }[activeType];
    }
    const withChild = list.map((t) => Object.assign({}, t, { childCount: taskService.children(t.id).length }));
    const done = withChild.filter((t) => t.status === 'done').length;
    const estMin = withChild.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);
    const actMin = withChild.reduce((s, t) => s + (t.actualMinutes || 0), 0);
    this.setData({
      tasks: withChild,
      typeLabel,
      dateLabel: util.relativeDay(date),
      stat: { done, total: withChild.length, rate: withChild.length ? Math.round((done / withChild.length) * 100) : 0 },
      estText: util.fmtMinutes(estMin),
      doneText: util.fmtMinutes(actMin)
    });
  },

  onType(e) {
    this.setData({ activeType: e.currentTarget.dataset.key }, () => this.load());
  },

  onDate(e) { this.setData({ date: e.detail.value }, () => this.load()); },

  prevDay() { this.setData({ date: util.dateStr(util.addDays(this.data.date, -1)) }, () => this.load()); },
  nextDay() { this.setData({ date: util.dateStr(util.addDays(this.data.date, 1)) }, () => this.load()); },

  onTaskToggle(e) {
    taskService.toggle(e.detail.task.id);
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  onTaskTap(e) {
    wx.navigateTo({ url: `/pages/task-edit/task-edit?id=${e.detail.task.id}` });
  },

  addTask() {
    const params = [`date=${this.data.date}`];
    if (this.data.activeType !== 'day') params.push(`planType=${this.data.activeType}`);
    wx.navigateTo({ url: `/pages/task-edit/task-edit?${params.join('&')}` });
  },

  goFocus() { wx.navigateTo({ url: '/pages/focus/focus' }); },
  goTarget() { wx.navigateTo({ url: '/pages/welcome/welcome?mode=edit' }); }
});
