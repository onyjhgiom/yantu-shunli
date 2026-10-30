const share = require('../../utils/share');
const bookService = require('../../services/books');
const profileService = require('../../services/profile');
const themeStore = require('../../utils/theme');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/books/books'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/books/books'); },

  data: {
    themeCls: '',
    subjects: [],
    types: [],
    activeSubject: 'math',
    activeGrades: [],
    activeGrade: 'math2',
    activeType: 'all',
    groups: [],          // 非搜索态：按类型归类的书目（已 enrich）
    flatList: [],        // 搜索态：扁平结果
    searched: false,
    keyword: '',
    trackHint: '',
    trackOk: false
  },

  _applyTheme() {
    this.setData({ themeCls: themeStore.activeClass(), themeKey: themeStore.active().key });
    themeStore.applyChrome();
  },

  onLoad() {
    const bg = profileService.getBackground();
    const track = bookService.recommendTrack(bg.examPath);
    const subjects = bookService.subjects();
    const types = bookService.TYPES.map((t) => ({ key: t, name: bookService.TYPE_META[t].name }));
    const firstSubj = subjects[0];
    const defGrade = track.math;
    this.setData({
      subjects,
      types,
      activeSubject: firstSubj.id,
      activeGrades: bookService.gradesOf(firstSubj.id),
      activeGrade: defGrade,
      trackHint: `已按你的 ${bg.examPath || '22408'} 路径默认：数学${track.math === 'math2' ? '二' : '一'} / 英语${track.english === 'eng2' ? '二' : '一'} / ${track.cs === '22408' ? '专硕' : '学硕'}`,
      trackOk: true
    }, () => this.reload());
  },

  onShow() { this._applyTheme(); },

  // 把书目 list 里的 level 键转换为可渲染的 name/color
  _enrich(groups) {
    const LM = bookService.LEVEL_META;
    return groups.map((g) => ({
      type: g.type,
      typeName: g.typeName,
      list: g.list.map((book) => ({
        name: book.name,
        version: book.version,
        feature: book.feature,
        hot: book.hot,
        levelName: (LM[book.level] || LM.mid).name,
        levelColor: (LM[book.level] || LM.mid).color
      }))
    }));
  },

  reload() {
    if (this.data.searched) { this.renderSearch(this.data.keyword); return; }
    const groups = this._enrich(bookService.booksOf(this.data.activeSubject, this.data.activeGrade, this.data.activeType === 'all' ? null : this.data.activeType));
    this.setData({ groups, flatList: [], searched: false });
  },

  selectSubject(e) {
    const id = e.currentTarget.dataset.id;
    const subj = bookService.getSubject(id);
    if (!subj) return;
    const bg = profileService.getBackground();
    const track = bookService.recommendTrack(bg.examPath);
    const gradeMap = { math: track.math, cs: track.cs, english: track.english, politics: 'all' };
    const defGrade = (gradeMap[id] && subj.grades.some((g) => g.id === gradeMap[id])) ? gradeMap[id] : subj.grades[0].id;
    this.setData({
      activeSubject: id,
      activeGrades: bookService.gradesOf(id),
      activeGrade: defGrade,
      activeType: 'all'
    }, () => this.reload());
  },

  selectGrade(e) {
    this.setData({ activeGrade: e.currentTarget.dataset.id, activeType: 'all' }, () => this.reload());
  },

  selectType(e) {
    this.setData({ activeType: e.currentTarget.dataset.key }, () => this.reload());
  },

  onKeyword(e) { this.setData({ keyword: e.detail.value }); },

  doSearch() {
    const kw = (this.data.keyword || '').trim();
    if (!kw) { wx.showToast({ title: '请输入书名/关键词', icon: 'none' }); return; }
    this.renderSearch(kw);
  },

  clearSearch() {
    this.setData({ keyword: '', searched: false, flatList: [] }, () => this.reload());
  },

  renderSearch(kw) {
    const raw = bookService.searchBooks(kw);
    const LM = bookService.LEVEL_META;
    const flatList = raw.map((r) => ({
      subjectName: r.subjectName,
      gradeName: r.gradeName,
      typeName: r.typeName,
      name: r.book.name,
      version: r.book.version,
      levelName: (LM[r.book.level] || LM.mid).name,
      levelColor: (LM[r.book.level] || LM.mid).color,
      feature: r.book.feature,
      hot: r.book.hot
    }));
    this.setData({ flatList, searched: true, groups: [] });
  },

  goBack() { wx.navigateBack(); }
});
