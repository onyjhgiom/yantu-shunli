const quiz = require('../../services/quiz');
const themeStore = require('../../utils/theme');

const mistake = require('../../services/mistake');

Page({
  data: {
    themeCls: '',
    subjects: [{ key: 'all', name: '全部科目' }],
    kinds: [
      { key: 'all', name: '全部' },
      { key: 'real', name: '历年真题' },
      { key: 'sim', name: '模拟题' }
    ],
    types: [
      { key: 'all', name: '全部题型' },
      { key: 'single', name: '单选' },
      { key: 'multiple', name: '多选' },
      { key: 'judge', name: '判断' }
    ],
    modes: [
      { key: 'seq', name: '顺序' },
      { key: 'rand', name: '随机' }
    ],
    counts: [5, 10, 20],
    subject: 'all', kind: 'all', type: 'all', mode: 'seq', count: 10,
    totalCount: 0, mistakeCount: 0
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
    const subs = quiz.subjects().map((s) => ({ key: s.key, name: s.name }));
    this.setData({ subjects: [{ key: 'all', name: '全部科目' }].concat(subs) });
    this.refreshCount();
  },
  onShow() { this._applyTheme();
    this.setData({ mistakeCount: mistake.count() });
    this.refreshCount();
  },

  refreshCount() {
    const n = quiz.filter({
      subject: this.data.subject, kind: this.data.kind, type: this.data.type
    }).length;
    this.setData({ totalCount: n });
  },

  pick(e) { this.setData({ [e.currentTarget.dataset.field]: e.currentTarget.dataset.val }, () => this.refreshCount()); },

  start() {
    const pool = quiz.filter({
      subject: this.data.subject, kind: this.data.kind, type: this.data.type
    });
    if (!pool.length) { wx.showToast({ title: '该筛选暂无题目', icon: 'none' }); return; }
    const count = Math.min(this.data.count, pool.length);
    const q = `subject=${this.data.subject}&kind=${this.data.kind}&type=${this.data.type}&mode=${this.data.mode}&count=${count}`;
    wx.navigateTo({ url: '/pages/quiz/do?' + q });
  },

  goMistake() { wx.navigateTo({ url: '/pages/mistake/mistake' }); }
});
