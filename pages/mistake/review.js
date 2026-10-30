const share = require('../../utils/share');
const mistakeService = require('../../services/mistake');
const theme = require('../../utils/theme');

const themeStore = require('../../utils/theme');
Page({
  onShareAppMessage: function () { return share.build(this, 'pages/mistake/review'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/mistake/review'); },

  data: {
    themeCls: '', queue: [], idx: 0, current: null, showAnswer: false, done: 0, total: 0, emptyQueue: false },
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
  onShow() { this._applyTheme(); },



  onLoad() { this.load(); },

  load() {
    const q = mistakeService.dueQueue();
    this.setData({ queue: q, idx: 0, done: 0, total: q.length, emptyQueue: q.length === 0, showAnswer: false }, () => this._setCurrent());
  },

  _setCurrent() {
    const i = this.data.idx;
    const q = this.data.queue;
    if (i >= q.length) { this.setData({ current: null }); return; }
    const m = q[i];
    const sm = theme.SUBJECT_MAP[m.subject] || theme.SUBJECT_MAP.other;
    this.setData({
      current: {
        id: m.id,
        subjectName: sm.name,
        color: sm.color,
        questionText: m.questionText,
        myAnswer: m.myAnswer,
        rightAnswer: m.rightAnswer,
        analysis: m.analysis,
        reasonLabels: (m.reasons || []).map((r) => (mistakeService.REASONS.find((x) => x.key === r) || {}).label).filter(Boolean),
        intervalText: (m.srs && m.srs.interval) ? ('下次约 ' + m.srs.interval + ' 天') : '明天再见'
      },
      showAnswer: false
    });
  },

  flip() { this.setData({ showAnswer: true }); },

  rate(e) {
    if (this._rateLock) return;          // 防连点：重复提交会跳题
    const q = Number(e.currentTarget.dataset.q);
    const cur = this.data.current;
    if (!cur) return;
    this._rateLock = true;
    mistakeService.reviewSubmit(cur.id, q);
    const done = this.data.done + 1;
    const idx = this.data.idx + 1;
    this.setData({ done, idx }, () => {
      this._rateLock = false;
      if (idx >= this.data.queue.length) {
        this.setData({ current: null });
        wx.showToast({ title: '今日复习完成', icon: 'success' });
      } else {
        this._setCurrent();
      }
    });
  },

  exit() { wx.navigateBack(); }
});
