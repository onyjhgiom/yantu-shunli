const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const profileService = require('../../services/profile');
const targetService = require('../../services/target');
const util = require('../../utils/util');

const CURRENT_YEAR = new Date().getFullYear();

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/welcome/welcome'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/welcome/welcome'); },

  data: {
    themeCls: '',
    greeting: '',
    name: '',
    years: [],
    yearValues: [],
    examYearIndex: 0,
    examDate: '',
    dateStart: '',
    university: '',
    major: '',
    majorCode: '',
    region: '',
    scores: { politics: 70, english: 75, math: 125, major: 125 },
    scoreFields: [
      { key: 'politics', label: '政治', color: 'var(--danger)' },
      { key: 'english', label: '英语', color: 'var(--c-english)' },
      { key: 'math', label: '数学', color: 'var(--forest-deep)' },
      { key: 'major', label: '专业课', color: 'var(--ok)' }
    ],
    total: 395,
    submitting: false,
    isEdit: false
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
    const p = profileService.getProfile();
    const t = targetService.getTarget();
    // 年份选择器：展示用「届」标签（考生直觉），底层存真实考试日历年份
    const yearValues = [];
    const years = [];
    for (let i = 0; i <= 3; i++) {
      const y = CURRENT_YEAR + i;
      yearValues.push(y);
      years.push(`${y}年（${y + 1}考研）`);
    }

    // 默认选中「下一个即将到来的 12 月考试年」，而非盲目指向下一年
    let idx = yearValues.indexOf(util.nextExamYear());
    if (idx < 0) idx = 0;
    // 若已保存过目标，则以已存年份为准
    if (t && t.examYear) {
      const found = yearValues.indexOf(t.examYear);
      if (found >= 0) idx = found;
    }
    const scores = Object.assign({}, targetService.DEFAULT_SCORES, (t && t.scores) || {});

    this.setData({
      greeting: profileService.greeting(p.name),
      name: p.name || profileService.DEFAULT_NAME,
      years,
      yearValues,
      examYearIndex: idx,
      examDate: (t && t.examDate) || util.defaultExamDate(yearValues[idx]),
      dateStart: util.dateStr(),
      university: (t && t.university) || '',
      major: (t && t.major) || '',
      majorCode: (t && t.majorCode) || '',
      region: (t && t.region) || '',
      scores,
      isEdit: !!(options && options.mode === 'edit')
    });
    this._recalc();
  },

  onField(e) {
    const f = e.currentTarget.dataset.field;
    this.setData({ [f]: e.detail.value });
  },

  onScore(e) {
    const k = e.currentTarget.dataset.key;
    const v = Math.max(0, Math.min(200, Number(e.detail.value) || 0));
    this.setData({ [`scores.${k}`]: v });
    this._recalc();
  },

  onYear(e) {
    const idx = Number(e.detail.value);
    const year = this.data.yearValues[idx];
    this.setData({ examYearIndex: idx, examDate: util.defaultExamDate(year) });
  },

  onDate(e) { this.setData({ examDate: e.detail.value }); },

  _recalc() {
    const s = this.data.scores;
    this.setData({ total: s.politics + s.english + s.math + s.major });
  },

  submit() {
    const d = this.data;
    if (!d.university.trim() || !d.major.trim()) {
      wx.showToast({ title: '请填写目标院校与专业', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      profileService.setProfile({ name: (d.name || profileService.DEFAULT_NAME).trim(), setup: true });
      targetService.setTarget({
        examYear: this.data.yearValues[d.examYearIndex],
        examDate: d.examDate,
        region: d.region.trim(),
        university: d.university.trim(),
        major: d.major.trim(),
        majorCode: d.majorCode.trim(),
        scores: d.scores,
        totalScore: d.total
      });
      wx.showToast({ title: '目标已立好', icon: 'success' });
      setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 600);
    } catch (err) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  skip() {
    const name = (this.data.name || profileService.DEFAULT_NAME).trim();
    profileService.setProfile({ name });
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
