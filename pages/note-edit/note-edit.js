const share = require('../../utils/share');
const noteService = require('../../services/note');
const theme = require('../../utils/theme');

const themeStore = require('../../utils/theme');
Page({
  onShareAppMessage: function () { return share.build(this, 'pages/note-edit/note-edit'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/note-edit/note-edit'); },

  data: {
    themeCls: '',
    id: '',
    isEdit: false,
    title: '',
    content: '',
    tagsText: '',
    attachments: [],
    subjects: [],
    subjectLabels: [],
    subjectIndex: 3
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
  onShow() { this._applyTheme(); },



  onLoad(options) {
    const subjects = theme.SUBJECTS.concat([theme.SUBJECT_MAP.other]);
    this.setData({ subjects, subjectLabels: subjects.map((s) => s.name) });

    if (options.id) {
      const n = noteService.notes().find((x) => x.id === options.id);
      if (n) {
        this.setData({
          id: n.id,
          isEdit: true,
          title: n.title,
          content: n.content,
          tagsText: (n.tags || []).join(','),
          subjectIndex: Math.max(0, subjects.findIndex((s) => s.key === n.subject)),
          attachments: n.attachments || []
        });
        wx.setNavigationBarTitle({ title: '编辑笔记' });
      }
    }
  },

  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },

  /* ===== 附件（图片/文件/语音）与语音转文字 ===== */
  onAttachChange(e) { this.setData({ attachments: e.detail.list }); },
  onAsr(e) { this.setData({ content: (this.data.content ? this.data.content + '\n' : '') + e.detail.text }); },
  onSubject(e) { this.setData({ subjectIndex: Number(e.detail.value) }); },

  save() {
    if (this._saving) return;            // 防连点重复保存
    this._saving = true;
    const title = (this.data.title || '').trim();
    if (!title) { this._saving = false; wx.showToast({ title: '请填写标题', icon: 'none' }); return; }
    const payload = {
      title,
      content: (this.data.content || '').trim(),
      subject: this.data.subjects[this.data.subjectIndex].key,
      tags: (this.data.tagsText || '').split(/[,，\s]+/).filter(Boolean)
    };
    if (this.data.isEdit) noteService.updateNote(this.data.id, payload);
    else noteService.addNote(payload);
    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 500);
  },

  remove() {
    wx.showModal({
      title: '删除笔记',
      content: '删除后不可恢复。',
      confirmColor: themeStore.palette().danger,
      success: (res) => {
        if (res.confirm) { noteService.removeNote(this.data.id); wx.navigateBack(); }
      }
    });
  }
});
