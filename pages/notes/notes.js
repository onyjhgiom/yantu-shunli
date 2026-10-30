const share = require('../../utils/share');
const note = require('../../services/note');
const theme = require('../../utils/theme');
const util = require('../../utils/util');
const store = require('../../utils/store');

const themeStore = require('../../utils/theme');
Page({
  onShareAppMessage: function () { return share.build(this, 'pages/notes/notes'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/notes/notes'); },

  data: {
    themeCls: '',
    list: [],
    filterSubject: 'all',
    subjects: [{ key: 'all', name: '全部' }],
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


  onLoad() {
    this.setData({ subjects: [{ key: 'all', name: '全部' }].concat(theme.SUBJECTS) });
    this._unsub = store.subscribe(store.TOPICS.NOTE_CHANGED, () => this.load());
  },
  onShow() { this._applyTheme(); this.load(); },
  onUnload() { this._unsub && this._unsub(); },

  load() {
    const fs = this.data.filterSubject;
    const all = note.notes();
    const list = fs === 'all' ? all : all.filter((n) => n.subject === fs);
    this.setData({
      list: list.map((n) => {
        const sm = theme.SUBJECT_MAP[n.subject] || theme.SUBJECT_MAP.other;
        return {
          id: n.id,
          title: n.title,
          subjectName: sm.name,
          color: sm.color,
          preview: (n.content || '').replace(/\n/g, ' ').slice(0, 50),
          tags: n.tags || [],
          updatedAt: util.fmtDateTime(n.updatedAt)
        };
      }),
      total: all.length
    });
  },

  onFilter(e) { this.setData({ filterSubject: e.currentTarget.dataset.key }, () => this.load()); },
  goAdd() { wx.navigateTo({ url: '/pages/note-edit/note-edit' }); },
  onItem(e) { wx.navigateTo({ url: '/pages/note-edit/note-edit?id=' + e.currentTarget.dataset.id }); },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除笔记', content: '确定删除这条笔记？', confirmColor: themeStore.palette().danger,
      success: (r) => { if (r.confirm) { note.removeNote(id); this.load(); } }
    });
  }
});
