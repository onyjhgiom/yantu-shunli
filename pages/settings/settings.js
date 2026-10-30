const profile = require('../../services/profile');
const themeStore = require('../../utils/theme');

const target = require('../../services/target');
const util = require('../../utils/util');

Page({
  data: {
    themeCls: '',
    /* 四套皮肤的可视化预览（色值直接取自各主题自身，样式内联，故预览不被当前主题影响） */
    themes: themeStore.list().map((x) => ({
      key: x.key, name: x.name, desc: x.desc,
      paper: x.vars['--paper'], card: x.vars['--card'],
      line: x.vars['--card-line'], primary: x.vars['--forest'], ink: x.vars['--ink']
    })),
    t: { university: '', major: '', examDate: '', examYear: '', scores: { politics: 70, english: 75, math: 125, major: 125 } },
    s: { notifications: true, aiEnabled: true, quiet: true },
    scoreKeys: [
      { key: 'politics', name: '政治' },
      { key: 'english', name: '英语' },
      { key: 'math', name: '数学' },
      { key: 'major', name: '专业课' }
    ]
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



  onLoad() {
    const t = target.getTarget() || {};
    const s = profile.getSettings();
    this.setData({
      t: {
        university: t.university || '',
        major: t.major || '',
        examDate: t.examDate || '',
        examYear: t.examYear || '',
        scores: Object.assign({ politics: 70, english: 75, math: 125, major: 125 }, t.scores || {})
      },
      s: {
        notifications: s.notifications !== false,
        aiEnabled: s.aiEnabled !== false,
        quiet: s.quiet !== false
      }
    });
  },

  /* 切换皮肤：写入存储 + 立刻同步本页 class / 导航栏 / tabBar / 组件真值色 */
  pickTheme(e) {
    const key = e.currentTarget.dataset.k;
    if (!key || key === this.data.themeKey) return;
    themeStore.setActive(key);
    this._applyTheme();
    wx.showToast({ title: '已切换为「' + themeStore.active().name + '」', icon: 'none' });
  },

  onInput(e) { this.setData({ ['t.' + e.currentTarget.dataset.f]: e.detail.value }); },
  onScore(e) {
    const k = e.currentTarget.dataset.k;
    const v = parseInt(e.detail.value, 10);
    this.setData({ ['t.scores.' + k]: isNaN(v) ? 0 : v });
  },
  onDate(e) { this.setData({ 't.examDate': e.detail.value }); },

  toggle(e) {
    const f = e.currentTarget.dataset.f;
    const v = e.detail.value;
    this.setData({ ['s.' + f]: v });
    profile.setSettings({ [f]: v });
    wx.showToast({ title: v ? '已开启' : '已关闭', icon: 'none' });
  },

  saveTarget() {
    const t = this.data.t;
    if (!t.university || !t.major) {
      wx.showToast({ title: '请填写院校与专业', icon: 'none' });
      return;
    }
    const examYear = t.examDate ? parseInt(t.examDate.substr(0, 4), 10) : '';
    target.setTarget({
      university: t.university, major: t.major,
      examDate: t.examDate, examYear,
      scores: t.scores
    });
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  goAbout() {
    wx.showModal({
      title: '关于研途顺利',
      content: '一款面向计算机 11408 / 22408 考生的离线备考助手。\n\n涵盖择校、规划、学习、刷题、背诵、模考、错题、笔记、资源、资讯与 AI 建议。\n\n数据全部保存在本机，无账号、无上传，隐私优先。',
      showCancel: false, confirmText: '知道了'
    });
  }
});
