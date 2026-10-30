const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const subjectService = require('../../services/subject');
const focusService = require('../../services/focus');
const studyService = require('../../services/study');
const util = require('../../utils/util');
const store = require('../../utils/store');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/study/study'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/study/study'); },

  data: {
    themeCls: '',
    subjects: [],
    weak: [],
    todayFocus: 0,
    todayText: '0m'
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
    this._unsubs = [
      store.subscribe(store.TOPICS.STUDY_CHANGED, () => this.load()),
      store.subscribe(store.TOPICS.KP_CHANGED, () => this.load()),
      store.subscribe(store.TOPICS.FOCUS_CHANGED, () => this.load())
    ];
  },

  onShow() { this._applyTheme(); this.load(); },

  onUnload() { (this._unsubs || []).forEach((fn) => fn()); },

  load() {
    this.setData({
      subjects: subjectService.overview(),
      weak: subjectService.weakPoints(10),
      todayFocus: focusService.todayCount(),
      todayText: util.fmtMinutes(studyService.todayMinutes())
    });
  },

  onSelectSubject(e) { wx.navigateTo({ url: `/pages/subject/subject?key=${e.detail.key}` }); },
  onSelectSubjectKey(e) { wx.navigateTo({ url: `/pages/subject/subject?key=${e.currentTarget.dataset.key}` }); },
  goFocus() { wx.navigateTo({ url: '/pages/focus/focus' }); },
  goMistake() { wx.navigateTo({ url: '/pages/mistake/mistake' }); },
  goCard() { wx.navigateTo({ url: '/pages/card/card' }); }
});
