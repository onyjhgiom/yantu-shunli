const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const news = require('../../services/news');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/news/news'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/news/news'); },

  data: {
    themeCls: '',
    tabs: [{ key: 'all', name: '全部' }],
    cat: 'all',
    keyword: '',
    favOnly: false,
    list: [],
    favCount: 0
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
    const cats = news.categories();
    this.setData({ tabs: [{ key: 'all', name: '全部' }].concat(cats) });
    this.load();
  },
  onShow() { this._applyTheme(); this.load(); },
  onPullDownRefresh() { this.load(); wx.stopPullDownRefresh(); },

  load() {
    const favIds = news.favs();
    let list = this.data.keyword ? news.search(this.data.keyword) : news.byCat(this.data.cat);
    if (this.data.favOnly) list = list.filter((x) => favIds.indexOf(x.id) >= 0);
    this.setData({
      list: list.map((x) => {
        const cat = news.categories().find((c) => c.key === x.cat) || {};
        return {
          id: x.id,
          title: x.title,
          sub: x.sub,
          catName: cat.name || '',
          catIcon: cat.icon || '',
          date: x.date,
          hot: !!x.hot,
          fav: favIds.indexOf(x.id) >= 0,
          read: news.isRead(x.id)
        };
      }),
      favCount: favIds.length
    });
  },

  onCat(e) { this.setData({ cat: e.currentTarget.dataset.key, favOnly: false }, () => this.load()); },
  onSearch(e) { this.setData({ keyword: e.detail.value }, () => this.load()); },
  toggleFavOnly() { this.setData({ favOnly: !this.data.favOnly, keyword: '' }, () => this.load()); },
  onFav(e) {
    const id = e.currentTarget.dataset.id;
    news.toggleFav(id);
    this.load();
  },
  onItem(e) { wx.navigateTo({ url: '/pages/news/detail?id=' + e.currentTarget.dataset.id }); }
});
