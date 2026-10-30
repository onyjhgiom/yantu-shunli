const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const news = require('../../services/news');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/news/detail'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/news/detail'); },

  data: {
    themeCls: '', item: null, fav: false, body: [] },
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



  onLoad(options) {
    const it = news.get(options.id);
    if (!it) {
      wx.showToast({ title: '资讯不存在或已下架', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    news.markRead(it.id);
    const cat = news.categories().find((c) => c.key === it.cat) || {};
    this.setData({
      item: {
        id: it.id, title: it.title, sub: it.sub,
        catName: cat.name || '', catIcon: cat.icon || '',
        source: it.source, date: it.date, tags: it.tags || []
      },
      body: it.body,
      fav: news.isFav(it.id)
    });
    if (wx.setNavigationBarTitle) wx.setNavigationBarTitle({ title: it.title });
  },

  onFav() {
    news.toggleFav(this.data.item.id);
    this.setData({ fav: news.isFav(this.data.item.id) });
  },
  copy() {
    const text = (this.data.item.title + '\n\n' + this.data.body.join('\n'));
    wx.setClipboardData({ data: text });
  }
});
