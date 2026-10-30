const quiz = require('../../services/quiz');
const themeStore = require('../../utils/theme');

const db = require('../../services/db');

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * 把「题目选项 + 选中态」组装成视图数组。
 * 关键：WXML 数据绑定表达式不支持调用数组方法（如 sel.indexOf(...)），
 * 写在模板里不会生效（点击选项将毫无视觉反馈），所以一律在 JS 侧算好再渲染。
 */
function buildOptions(q, sel) {
  const opts = (q && q.options) || [];
  const picked = sel || [];
  return opts.map((text, i) => ({
    text: text,
    mark: LETTERS[i] || String(i + 1),
    on: picked.indexOf(i) >= 0
  }));
}

Page({
  data: {
    themeCls: '',
    list: [],
    index: 0,
    total: 0,
    sel: [],
    optView: [],
    q: null,
    progress: '1/1'
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
    const subject = options.subject || 'all';
    const kind = options.kind || 'all';
    const type = options.type || 'all';
    const mode = options.mode || 'seq';
    const count = parseInt(options.count, 10) || 10;

    const questions = quiz.pick({ subject, kind, type }, count, mode).map((q) => ({
      id: q.id, type: q.type, chapter: q.chapter,
      stem: q.stem, options: q.options,
      subjectName: quiz.subjectName(q.subject), color: quiz.subjectColor(q.subject)
    }));

    if (!questions.length) {
      wx.showToast({ title: '暂无题目', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.answers = {};
    this.setData({ list: questions, total: questions.length }, () => this.loadQ(0));
  },

  loadQ(i) {
    const q = this.data.list[i];
    const sel = this.answers[q.id] != null ? (Array.isArray(this.answers[q.id]) ? this.answers[q.id] : [this.answers[q.id]]) : [];
    this.setData({ index: i, q, sel, optView: buildOptions(q, sel), progress: (i + 1) + '/' + this.data.total });
  },

  toggle(e) {
    // dataset 可能是字符串，统一转数字，避免与数组下标严格不等导致选不中
    const i = Number(e.currentTarget.dataset.i);
    const q = this.data.q;
    if (!q || isNaN(i)) return;
    let sel = this.data.sel.slice();
    if (q.type === 'multiple') {
      const p = sel.indexOf(i);
      if (p >= 0) sel.splice(p, 1); else sel.push(i);
    } else {
      sel = [i];
    }
    this.setData({ sel, optView: buildOptions(q, sel) });
  },

  prev() {
    if (this.data.index === 0) return;
    this.commitSel();
    this.loadQ(this.data.index - 1);
  },

  next() {
    this.commitSel();
    if (this.data.index < this.data.total - 1) {
      this.loadQ(this.data.index + 1);
    } else {
      this.submit();
    }
  },

  commitSel() {
    const q = this.data.q;
    if (!q) return;
    // 单选题以数组首元素存储，便于判卷统一处理
    this.answers[q.id] = this.data.sel.slice();
  },

  submit() {
    if (this._submitLock) return;        // 防连点重复提交/重复跳转
    this._submitLock = true;
    this.commitSel();
    const result = quiz.grade(this.data.list, this.answers);
    const added = quiz.syncWrong(result.detail);
    quiz.saveRecord({
      subject: this.data.list[0] ? this.data.list[0].subjectName : '408',
      kind: '', total: result.total, correct: result.correct, accuracy: result.accuracy
    });
    db.set('yt_quiz_last', result);
    wx.redirectTo({ url: '/pages/quiz/result?added=' + added });
  }
});
