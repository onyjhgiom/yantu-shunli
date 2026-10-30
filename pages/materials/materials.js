const share = require('../../utils/share');
const noteService = require('../../services/note');
const resourcesService = require('../../services/resources');
const theme = require('../../utils/theme');
const util = require('../../utils/util');
const store = require('../../utils/store');

const themeStore = require('../../utils/theme');
const EXT_COLORS = {
  pdf: 'var(--danger)', doc: 'var(--c-english)', docx: 'var(--c-english)', ppt: 'var(--forest-deep)', pptx: 'var(--forest-deep)',
  xls: 'var(--ok)', xlsx: 'var(--ok)', txt: 'var(--sub)', md: 'var(--ok)', zip: 'var(--sub)', img: 'var(--warn)'
};

function extOf(name) {
  const i = (name || '').lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : 'file';
}
function sizeText(bytes) {
  if (!bytes) return '未知大小';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/materials/materials'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/materials/materials'); },

  data: {
    themeCls: '',
    tab: 'files',
    files: [],
    notes: [],
    keyword: '',
    results: { tasks: [], notes: [], files: [], points: [] },
    searched: false,
    emptyResult: false,
    resourceCount: 0
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


  onShow() { this._applyTheme();
    const code = resourcesService.myCode();
    this.setData({ resourceCount: resourcesService.countOf('all', code) });
    this.load();
  },

  load() {
    const files = noteService.files().map((f) => {
      const ext = f.ext || extOf(f.name);
      return {
        id: f.id,
        name: f.name,
        ext: ext.slice(0, 4),
        color: EXT_COLORS[ext] || 'var(--sub)',
        category: f.category,
        sizeText: sizeText(f.size),
        dateText: util.dateStr(f.createdAt)
      };
    });
    const notes = noteService.notes().map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      excerpt: (n.content || '').slice(0, 60),
      tags: n.tags || [],
      subjectName: (theme.SUBJECT_MAP[n.subject] || theme.SUBJECT_MAP.other).name,
      color: (theme.SUBJECT_MAP[n.subject] || theme.SUBJECT_MAP.other).color
    }));
    this.setData({ files, notes });
  },

  onTab(e) { this.setData({ tab: e.currentTarget.dataset.key }); },

  addFile() {
    wx.chooseMessageFile({
      count: 9,
      type: 'file',
      success: (res) => {
        const list = res.tempFiles || [];
        if (!list.length) return;
        wx.showLoading({ title: '保存中', mask: true });
        let pending = list.length;
        list.forEach((f) => {
          const done = (path) => {
            noteService.addFile({
              name: f.name,
              size: f.size,
              ext: extOf(f.name),
              path: path,
              category: extOf(f.name) === 'pdf' ? 'PDF' : '讲义',
              subject: 'other'
            });
            pending -= 1;
            if (pending === 0) {
              wx.hideLoading();
              this.load();
              wx.showToast({ title: `已添加 ${list.length} 个文件`, icon: 'success' });
            }
          };
          // 尽量持久化到本地用户目录，失败则退回临时路径
          try {
            wx.saveFile({
              tempFilePath: f.path,
              success: (r) => done(r.savedFilePath),
              fail: () => done(f.path)
            });
          } catch (e) { done(f.path); }
        });
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') < 0) {
          wx.showToast({ title: '选择文件失败', icon: 'none' });
        }
      }
    });
  },

  onFile(e) {
    const id = e.currentTarget.dataset.id;
    const f = noteService.files().find((x) => x.id === id);
    if (!f || !f.path) { wx.showToast({ title: '文件路径已失效', icon: 'none' }); return; }
    wx.openDocument({
      filePath: f.path,
      showMenu: true,
      fail: () => wx.showToast({ title: '该格式暂不支持预览', icon: 'none' })
    });
  },

  removeFile(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除资料',
      content: '仅移除记录，不会影响聊天记录里的原文件。',
      success: (res) => {
        if (res.confirm) { noteService.removeFile(id); this.load(); }
      }
    });
  },

  addNote() { wx.navigateTo({ url: '/pages/note-edit/note-edit' }); },
  onNote(e) { wx.navigateTo({ url: `/pages/note-edit/note-edit?id=${e.currentTarget.dataset.id}` }); },

  onKeyword(e) { this.setData({ keyword: e.detail.value }); },

  doSearch() {
    const kw = (this.data.keyword || '').trim();
    if (!kw) { wx.showToast({ title: '请输入关键词', icon: 'none' }); return; }
    const results = noteService.search(kw);
    const emptyResult = !results.tasks.length && !results.notes.length && !results.files.length && !results.points.length;
    this.setData({ results, searched: true, emptyResult });
  },

  openTask(e) { wx.navigateTo({ url: `/pages/task-edit/task-edit?id=${e.currentTarget.dataset.id}` }); },
  openSubject(e) { wx.navigateTo({ url: `/pages/subject/subject?key=${e.currentTarget.dataset.key}` }); },

  goSchool() { wx.navigateTo({ url: '/pages/school/school' }); },
  goExam() { wx.navigateTo({ url: '/pages/exam/exam' }); },
  goMistake() { wx.navigateTo({ url: '/pages/mistake/mistake' }); },
  goCard() { wx.navigateTo({ url: '/pages/card/card' }); },
  goMood() { wx.navigateTo({ url: '/pages/mood/mood' }); },
  goAchievement() { wx.navigateTo({ url: '/pages/achievement/achievement' }); },
  goTimeline() { wx.navigateTo({ url: '/pages/timeline/timeline' }); },
  goResource() { wx.navigateTo({ url: '/pages/resource/resource' }); },
  goBooks() { wx.navigateTo({ url: '/pages/books/books' }); }
});
