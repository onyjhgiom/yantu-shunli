const share = require('../../utils/share');
const mistakeService = require('../../services/mistake');
const theme = require('../../utils/theme');
const store = require('../../utils/store');

const themeStore = require('../../utils/theme');
Page({
  onShareAppMessage: function () { return share.build(this, 'pages/mistake/mistake'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/mistake/mistake'); },

  data: {
    themeCls: '',
    list: [],
    filterSubject: 'all',
    subjects: [{ key: 'all', name: '全部' }].concat(theme.SUBJECTS),
    dueCount: 0,
    total: 0
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


  onLoad() { this._unsub = store.subscribe(store.TOPICS.MISTAKE_CHANGED, () => this.load()); },
  onShow() { this._applyTheme(); this.load(); },
  onUnload() { this._unsub && this._unsub(); },

  load() {
    const all = mistakeService.all();
    const fs = this.data.filterSubject;
    const list = fs === 'all' ? all : all.filter((m) => m.subject === fs);
    this.setData({
      list: list.map((m) => {
        const sm = theme.SUBJECT_MAP[m.subject] || theme.SUBJECT_MAP.other;
        return {
          id: m.id,
          subjectName: sm.name,
          color: sm.color,
          questionText: m.questionText,
          source: m.source,
          difficulty: m.difficulty,
          reasonLabels: (m.reasons || []).map((r) => (mistakeService.REASONS.find((x) => x.key === r) || {}).label).filter(Boolean),
          mastered: !!m.masteredAt,
          dueDate: (m.srs && m.srs.dueDate) || ''
        };
      }),
      dueCount: mistakeService.dueCount(),
      total: all.length
    });
  },

  onFilter(e) { this.setData({ filterSubject: e.currentTarget.dataset.key }, () => this.load()); },
  goAdd() { wx.navigateTo({ url: '/pages/mistake/edit' }); },
  onItem(e) { wx.navigateTo({ url: '/pages/mistake/edit?id=' + e.currentTarget.dataset.id }); },
  goReview() { wx.navigateTo({ url: '/pages/mistake/review' }); }
});
