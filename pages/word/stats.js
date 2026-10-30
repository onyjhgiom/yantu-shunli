const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const wordService = require('../../services/word');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/word/stats'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/word/stats'); },

  data: {
    themeCls: '',
    overview: { total: 0, learned: 0, mastered: 0, newCount: 0, streak: 0 },
    dist: { new: 0, learning: 0, mastered: 0 },
    books: [],
    extraCount: 0
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
    const all = wordService.stats('all');
    const books = wordService.books().map((b) => {
      const st = wordService.stats(b.id);
      const learning = st.learned - st.mastered;
      return {
        name: b.name, total: st.total, learned: st.learned, mastered: st.mastered, newCount: st.newCount,
        learning,
        pNew: st.total ? Math.round((st.newCount / st.total) * 100) : 0,
        pLearning: st.total ? Math.round((learning / st.total) * 100) : 0,
        pMastered: st.total ? Math.round((st.mastered / st.total) * 100) : 0
      };
    });
    const learningAll = all.learned - all.mastered;
    this.setData({
      overview: all,
      dist: { new: all.newCount, learning: learningAll, mastered: all.mastered },
      books,
      extraCount: wordService.extraList().length
    });
  }
});
