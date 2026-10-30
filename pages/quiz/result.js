const db = require('../../services/db');

const themeStore = require('../../utils/theme');

Page({
  data: {
    themeCls: '',
    result: null,
    added: 0,
    open: {}
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
    const result = db.get('yt_quiz_last', null);
    if (!result) {
      wx.showToast({ title: '暂无结果', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    const L = ['A','B','C','D','E','F'];
    const fmt = (v) => {
      if (v == null) return '未作答';
      if (Array.isArray(v)) return v.map((i) => L[i]).join('');
      return L[v];
    };
    this.setData({
      result: Object.assign({}, result, {
        detail: (result.detail || []).map((d) => {
          const ans = d.answer == null ? [] : (Array.isArray(d.answer) ? d.answer : [d.answer]);
          const usr = d.userAnswer == null ? [] : (Array.isArray(d.userAnswer) ? d.userAnswer : [d.userAnswer]);
          return {
            id: d.id, ok: d.ok, subjectName: d.subjectName, chapter: d.chapter,
            stem: d.stem, type: d.type,
            answerText: fmt(d.answer), userText: fmt(d.userAnswer), analysis: d.analysis,
            /* 完整选项视图：预先标出「正确答案」与「我的选择」。
               WXML 表达式不能调数组方法（indexOf），必须在这里算好再渲染。 */
            optView: (d.options || []).map((t, i) => ({
              text: t,
              letter: L[i] || String(i + 1),
              correct: ans.indexOf(i) >= 0,
              picked: usr.indexOf(i) >= 0
            }))
          };
        })
      }),
      added: parseInt(options.added, 10) || 0
    });
    if (wx.setNavigationBarTitle) wx.setNavigationBarTitle({ title: '正确率 ' + result.accuracy + '%' });
  },

  toggle(e) {
    const id = e.currentTarget.dataset.id;
    const open = Object.assign({}, this.data.open);
    open[id] = !open[id];
    this.setData({ open });
  },

  goConfig() { wx.navigateBack(); },
  goMistake() { wx.redirectTo({ url: '/pages/mistake/mistake' }); }
});
