const share = require('../../utils/share');
const themeStore = require('../../utils/theme');
const cardService = require('../../services/card');
const theme = require('../../utils/theme');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/card/statistics'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/card/statistics'); },

  data: {
    themeCls: '',
    stat: null,
    overview: [],
    days: [],
    maxDay: 0,
    subjects: [],
    decks: [],
    hasRecords: false,
    masteryPercent: 0
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
  onShow() { this._applyTheme(); this.load(); },
  onPullDownRefresh() { this.load(); wx.stopPullDownRefresh(); },

  load() {
    const s = cardService.stats();
    const overview = [
      { key: 'today', label: '今日复习', value: s.todayCount, unit: '次' },
      { key: 'week', label: '近 7 天', value: s.weekCount, unit: '次' },
      { key: 'total', label: '累计复习', value: s.totalReviews, unit: '次' },
      { key: 'acc', label: '记得率', value: s.accuracy, unit: '%' }
    ];
    // 科目分布：把 key 映射成名称与主题色（颜色用 var()，换肤自动生效）
    const subjects = (s.bySubject || []).map((x) => {
      const meta = theme.SUBJECT_MAP[x.key] || theme.SUBJECT_MAP.other;
      return { key: x.key, name: meta.name, n: x.n, color: meta.color };
    });
    const maxSub = subjects.reduce((m, x) => Math.max(m, x.n), 0) || 1;
    const masteryPercent = s.totalCards ? Math.round((s.mastered / s.totalCards) * 100) : 0;
    this.setData({
      stat: s,
      overview: overview,
      days: s.days,
      maxDay: s.maxDay,
      subjects: subjects.map((x) => Object.assign({}, x, { percent: Math.round((x.n / maxSub) * 100) })),
      decks: s.byDeck,
      hasRecords: s.totalReviews > 0,
      masteryPercent: masteryPercent
    });
  },

  clearLogs() {
    wx.showModal({
      title: '清空复习记录',
      content: '仅清空「复习流水」用于统计，卡片与复习进度不受影响。确定清空？',
      confirmColor: themeStore.palette().danger,
      success: (res) => {
        if (!res.confirm) return;
        cardService.clearLogs();
        this.load();
        wx.showToast({ title: '已清空', icon: 'success' });
      }
    });
  },

  goCards() { wx.navigateBack(); }
});
