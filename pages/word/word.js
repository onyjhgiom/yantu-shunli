const share = require('../../utils/share');
const wordService = require('../../services/word');

const themeStore = require('../../utils/theme');
const MODES = [
  { key: 'recognize', name: '看词选义' },
  { key: 'recall', name: '看义选词' },
  { key: 'spelling', name: '拼写' }
];

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/word/word'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/word/word'); },

  data: {
    themeCls: '',
    stats: { total: 0, learned: 0, mastered: 0, newCount: 0, streak: 0 },
    books: [],
    extraCount: 0,
    today: { newCount: 0, reviewCount: 0 },
    settings: { dailyNew: 20, mode: 'recognize' },
    modes: MODES,
    modeIndex: 0
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

  load() {
    const s = wordService.settings();
    const books = wordService.books().map((b) => {
      const st = wordService.stats(b.id);
      return {
        id: b.id, name: b.name, desc: b.desc,
        total: st.total, learned: st.learned, mastered: st.mastered,
        percent: st.total ? Math.round((st.learned / st.total) * 100) : 0
      };
    });
    const all = wordService.stats('all');
    const plan = wordService.todayPlan('all');
    this.setData({
      stats: all,
      books,
      extraCount: wordService.extraList().length,
      today: { newCount: plan.newCount, reviewCount: plan.reviewCount },
      settings: s,
      modeIndex: Math.max(0, MODES.findIndex((m) => m.key === s.mode))
    });
  },

  goStudy(e) {
    const scope = e.currentTarget.dataset.scope || 'new';
    const mode = this.data.settings.mode;
    wx.navigateTo({ url: `/pages/word/study?bookId=all&scope=${scope}&mode=${mode}` });
  },

  goBook(e) {
    const id = e.currentTarget.dataset.id;
    const mode = this.data.settings.mode;
    wx.navigateTo({ url: `/pages/word/study?bookId=${id}&scope=all&mode=${mode}` });
  },

  goStats() { wx.navigateTo({ url: '/pages/word/stats' }); },
  goExtra() { wx.navigateTo({ url: '/pages/word/study?bookId=extra&scope=extra&mode=recognize' }); },

  onDailyInput(e) { this.setData({ ['settings.dailyNew']: parseInt(e.detail.value, 10) || 20 }); },
  onModeChange(e) {
    const idx = parseInt(e.detail.value, 10) || 0;
    const mode = this.data.modes[idx].key;
    wordService.saveSettings({ mode });
    this.setData({ modeIndex: idx, ['settings.mode']: mode });
  },

  saveDaily() {
    const n = Math.max(5, Math.min(200, this.data.settings.dailyNew || 20));
    wordService.saveSettings({ dailyNew: n });
    this.setData({ ['settings.dailyNew']: n });
    wx.showToast({ title: '已保存', icon: 'success' });
    this.load();
  }
});
