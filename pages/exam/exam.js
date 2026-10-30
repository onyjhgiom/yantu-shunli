const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const examService = require('../../services/exam');
const store = require('../../utils/store');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/exam/exam'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/exam/exam'); },

  data: {
    themeCls: '', list: [], count: 0 },
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


  onLoad() { this._unsub = store.subscribe(store.TOPICS.EXAM_CHANGED, () => this.load()); },
  onShow() { this._applyTheme(); this.load(); },
  onUnload() { this._unsub && this._unsub(); },

  load() {
    const list = examService.all();
    this.setData({
      list: list.map((e) => ({
        id: e.id, name: e.name, date: e.date,
        typeText: e.type === 'real' ? '真题' : '模拟',
        total: e.total,
        scoreText: `政${e.scores.politics} 英${e.scores.english} 数${e.scores.math} 专${e.scores.major}`
      })),
      count: list.length
    });
  },

  goAdd() { wx.navigateTo({ url: '/pages/exam/edit' }); },
  onItem(e) { wx.navigateTo({ url: '/pages/exam/analysis?id=' + e.currentTarget.dataset.id }); }
});
