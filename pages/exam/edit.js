const share = require('../../utils/share');
const examService = require('../../services/exam');
const theme = require('../../utils/theme');
const util = require('../../utils/util');

const themeStore = require('../../utils/theme');
Page({
  onShareAppMessage: function () { return share.build(this, 'pages/exam/edit'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/exam/edit'); },

  data: {
    themeCls: '',
    id: '',
    isEdit: false,
    name: '',
    type: 'mock',
    date: util.dateStr(),
    durationMin: '',
    scores: { politics: 0, english: 0, math: 0, major: 0 },
    subjects: theme.SUBJECTS,
    note: '',
    attachments: []
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



  onLoad(opt) {
    if (opt.id) {
      const e = examService.get(opt.id);
      if (e) {
        this.setData({
          id: e.id, name: e.name, type: e.type, date: e.date,
          durationMin: String(e.durationMin || ''), scores: e.scores, note: e.note || '', isEdit: true,
          attachments: e.attachments || []
        });
      }
    }
  },

  /* ===== 附件（图片/文件/语音）与语音转文字 ===== */
  onAttachChange(e) { this.setData({ attachments: e.detail.list }); },
  onAsr(e) { this.setData({ note: (this.data.note ? this.data.note + '\n' : '') + e.detail.text }); },

  onType(e) { this.setData({ type: e.currentTarget.dataset.v }); },
  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },
  onScore(e) {
    const k = e.currentTarget.dataset.k;
    const scores = Object.assign({}, this.data.scores);
    scores[k] = Number(e.detail.value) || 0;
    this.setData({ scores });
  },

  save() {
    if (this._saving) return;            // 防连点重复保存
    this._saving = true;
    const d = this.data;
    const payload = { name: d.name, type: d.type, date: d.date, durationMin: Number(d.durationMin) || 0, scores: d.scores, note: d.note, attachments: d.attachments || [] };
    try {
      if (d.id) examService.update(d.id, payload);
      else examService.add(payload);
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (err) {
      this._saving = false;
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  },

  remove() {
    if (!this.data.id) return;
    wx.showModal({
      title: '删除模考', content: '确定删除这份记录？',
      success: (r) => { if (r.confirm) { examService.remove(this.data.id); wx.navigateBack(); } }
    });
  }
});
