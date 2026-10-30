/**
 * 备考资源中心
 * 分类浏览 / 全文搜索 / 收藏 / 按报考方向(11408|22408)过滤 / 转存为笔记
 */
const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const resources = require('../../services/resources');
const noteService = require('../../services/note');
const targetService = require('../../services/target');

Page({
  onShareTimeline: function () { return share.timeline(this, 'pages/resource/resource'); },

  data: {
    themeCls: '',
    cats: [],
    cat: 'all',
    keyword: '',
    list: [],
    hotList: [],
    searched: false,
    searchMode: false,
    // 报考方向过滤
    myCode: '',
    codeText: '',
    filterMine: true,
    // 详情弹层
    showDetail: false,
    detail: null,
    favCount: 0,
    totalCount: 0
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
    const t = targetService.getTarget() || {};
    const myCode = t.examCode === '22408' ? '22408' : (t.examCode === '11408' ? '11408' : '');
    this.setData({
      myCode,
      codeText: myCode === '11408' ? '数一/英一 · 学硕' : (myCode === '22408' ? '数二/英二 · 专硕' : '未设置'),
      filterMine: !!myCode,
      cats: resources.categories(),
      totalCount: resources.countOf('all'),
      favCount: resources.favs().length
    });
    this.refresh();
  },

  onShow() { this._applyTheme();
    this.setData({ favCount: resources.favs().length });
  },

  code() { return this.data.filterMine ? this.data.myCode : ''; },

  refresh() {
    const kw = (this.data.keyword || '').trim();
    const code = this.code();
    if (kw) {
      this.setData({ list: resources.search(kw, code), searchMode: true, searched: true });
    } else if (this.data.cat === 'fav') {
      this.setData({ list: resources.favList(), searchMode: false });
    } else {
      this.setData({
        list: resources.byCategory(this.data.cat, '', code),
        searchMode: false,
        hotList: this.data.cat === 'all' ? resources.hot(4, code) : []
      });
    }
  },

  onCat(e) {
    this.setData({ cat: e.currentTarget.dataset.key, keyword: '' }, () => this.refresh());
  },

  onKeyword(e) { this.setData({ keyword: e.detail.value }); },

  doSearch() { this.refresh(); },

  clearKeyword() { this.setData({ keyword: '' }, () => this.refresh()); },

  toggleFilter() {
    this.setData({ filterMine: !this.data.filterMine }, () => this.refresh());
  },

  onItem(e) {
    const id = e.currentTarget.dataset.id;
    const d = resources.detail(id);
    if (!d) return;
    this.setData({ showDetail: true, detail: d });
  },

  closeDetail() { this.setData({ showDetail: false }); },

  noop() { /* 阻止冒泡 */ },

  toggleFav(e) {
    const id = e.currentTarget.dataset.id;
    const now = resources.toggleFav(id);
    wx.showToast({ title: now ? '已收藏' : '已取消', icon: 'none' });
    const d = this.data.detail;
    if (d && d.id === id) this.setData({ 'detail.fav': now });
    this.setData({ favCount: resources.favs().length });
    this.refresh();
  },

  saveAsNote() {
    const d = this.data.detail;
    if (!d) return;
    const text = resources.toNoteText(d.id);
    wx.showModal({
      title: '存入笔记',
      content: `将「${d.title}」保存为一篇笔记，可在资料 → 笔记中查看和编辑。`,
      success: (r) => {
        if (!r.confirm) return;
        try {
          noteService.addNote({ title: d.title, content: text, subject: this.subjectOf(d.cat), tags: [d.catName].concat(d.tags || []).slice(0, 5) });
          wx.showToast({ title: '已存入笔记', icon: 'success' });
        } catch (err) {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  },

  subjectOf(cat) {
    const map = { cs408: 'major', math: 'math', english: 'english', politics: 'politics' };
    return map[cat] || 'other';
  },

  copyText() {
    const d = this.data.detail;
    if (!d) return;
    wx.setClipboardData({ data: resources.toNoteText(d.id) });
  },

  goTarget() {
    wx.navigateTo({ url: '/pages/welcome/welcome?mode=edit' });
  },

  onShareAppMessage() {
    const d = this.data.detail;
    return {
      title: d ? `研途顺利 · ${d.title}` : '研途顺利 · 计算机 408 备考资源库',
      path: '/pages/resource/resource'
    };
  }
});
