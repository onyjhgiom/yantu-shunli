const share = require('../../utils/share');
const mistakeService = require('../../services/mistake');
const theme = require('../../utils/theme');

const themeStore = require('../../utils/theme');
const upload = require('../../utils/upload');
const aiService = require('../../services/ai');

/** 已选原因 → 查找表（WXML 不能调数组方法，选中态必须在 JS 侧算好） */
function toMap(list) {
  const m = {};
  (list || []).forEach((k) => { m[k] = true; });
  return m;
}
Page({
  onShareAppMessage: function () { return share.build(this, 'pages/mistake/edit'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/mistake/edit'); },

  data: {
    themeCls: '',
    id: '',
    subject: 'other',
    subjectName: '其他',
    subjects: theme.SUBJECTS.concat([{ key: 'other', name: '其他', short: '他', color: 'var(--sub)' }]),
    source: '',
    questionText: '',
    myAnswer: '',
    rightAnswer: '',
    analysis: '',
    reasons: [],
    reasonMap: {},
    allReasons: mistakeService.REASONS,
    difficulty: 3,
    isEdit: false,
    /* 拍照识题 */
    images: [],
    options: [],
    optionsText: '',
    recognizing: false
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
      const m = mistakeService.get(opt.id);
      if (m) {
        const subj = this.data.subjects.find((x) => x.key === m.subject) || { name: '其他' };
        this.setData({
          id: m.id,
          subject: m.subject,
          subjectName: subj.name,
          source: m.source || '',
          questionText: m.questionText || '',
          myAnswer: m.myAnswer || '',
          rightAnswer: m.rightAnswer || '',
          analysis: m.analysis || '',
          reasons: m.reasons || [],
          reasonMap: toMap(m.reasons),
          options: m.options || [],
          optionsText: (m.options || []).join('\n'),
          images: m.images || [],
          difficulty: m.difficulty || 3,
          isEdit: true
        });
      }
    }
  },

  /* ===== 拍照识题：选图 → 上传 → 云端识别 → 回填表单（可继续手动校正） ===== */
  pickImage() {
    upload.chooseImages(1).then((list) => {
      if (!list || !list.length) return;
      const img = list[0];
      this.setData({ images: this.data.images.concat([img]) });
      wx.showToast({ title: '图片已添加', icon: 'none' });
      // 后台上传换 fileID（识别时要用可读的图片）
      upload.uploadOne(img).then((fileID) => {
        if (!fileID) return;
        this.setData({ images: this.data.images.map((x) => (x.id === img.id
          ? Object.assign({}, x, { fileID: fileID, url: fileID, tempPath: '', localOnly: false, uploading: false })
          : x)) });
      });
    });
  },
  recognize() {
    if (this.data.recognizing) return;
    if (!this.data.images.length) { wx.showToast({ title: '先添加题目图片', icon: 'none' }); return; }
    this.setData({ recognizing: true });
    wx.showLoading({ title: '识别中…', mask: true });
    aiService.extractQuestion(this.data.images)
      .then((r) => {
        wx.hideLoading();
        this.setData({ recognizing: false });
        if (!r) {
          wx.showModal({
            title: '识别未完成',
            content: '未能识别出题目内容。可能原因：未配置云端 AI，或当前模型不支持图片识别。你仍可手动填写下方各字段，并保留已添加的图片。',
            showCancel: false,
            confirmColor: themeStore.palette().forest
          });
          return;
        }
        // 回填：只填空字段，不覆盖用户已写的内容，避免误删
        const patch = { recognizing: false };
        if (r.stem && !this.data.questionText) patch.questionText = String(r.stem);
        if (Array.isArray(r.options) && r.options.length && !this.data.optionsText) {
          patch.options = r.options.map((t) => String(t));
          patch.optionsText = r.options.join('\n');
        }
        if (r.analysis && !this.data.analysis) patch.analysis = String(r.analysis);
        // 正确答案：把下标翻译成文字，填进 rightAnswer（用户可再改）
        if (r.answer != null) {
          const opts = patch.options || this.data.options;
          let ans = '';
          if (Array.isArray(r.answer)) {
            ans = r.answer.map((i) => opts[i]).filter(Boolean).join('、');
          } else if (opts[r.answer] != null) {
            ans = String(opts[r.answer]);
          }
          if (ans && !this.data.rightAnswer) patch.rightAnswer = ans;
        }
        this.setData(patch);
        wx.showToast({ title: '已填入，请核对', icon: 'none' });
      })
      .catch(() => {
        wx.hideLoading();
        this.setData({ recognizing: false });
        wx.showToast({ title: '识别失败', icon: 'none' });
      });
  },
  removeImage(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ images: this.data.images.filter((x) => x.id !== id) });
  },
  previewImage(e) { upload.previewImage(e.currentTarget.dataset.url); },
  onOptionsInput(e) {
    // 选项按行拆分，回填时保持与题干分离
    const optionsText = e.detail.value || '';
    this.setData({ optionsText: optionsText, options: optionsText.split('\n').map((s) => s.trim()).filter(Boolean) });
  },

  onSubject(e) {
    const s = this.data.subjects[e.detail.value];
    this.setData({ subject: s.key, subjectName: s.name });
  },

  onReason(e) {
    const key = e.currentTarget.dataset.key;
    const has = this.data.reasons.indexOf(key) >= 0;
    const reasons = has ? this.data.reasons.filter((r) => r !== key) : this.data.reasons.concat([key]);
    this.setData({ reasons, reasonMap: toMap(reasons) });
  },

  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },

  setDiff(e) { this.setData({ difficulty: Number(e.currentTarget.dataset.v) }); },

  save() {
    const d = this.data;
    const payload = {
      subject: d.subject, source: d.source, questionText: d.questionText,
      myAnswer: d.myAnswer, rightAnswer: d.rightAnswer, analysis: d.analysis,
      reasons: d.reasons, difficulty: d.difficulty,
      options: d.options || [],
      images: d.images || []
    };
    try {
      if (d.id) mistakeService.update(d.id, payload);
      else mistakeService.add(payload);
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  },

  remove() {
    if (!this.data.id) return;
    wx.showModal({
      title: '删除错题', content: '确定删除这条错题？',
      success: (r) => { if (r.confirm) { mistakeService.remove(this.data.id); wx.navigateBack(); } }
    });
  }
});
