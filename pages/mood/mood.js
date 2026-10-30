const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const moodService = require('../../services/mood');
const util = require('../../utils/util');
const store = require('../../utils/store');

const EMOJI = ['😣', '😟', '😐', '🙂', '😄'];
/* 情绪 1→5 的柱色。喂 Canvas，必须取主题真值，故做成函数在绘制时求值 */
function levelColors() {
  const T = themeStore.palette();
  return [T.danger, T.warn, T.forestDeep, T.ok, T.forest];
}

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/mood/mood'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/mood/mood'); },

  data: {
    themeCls: '',
    level: 3,
    text: '',
    today: '',
    history: [],
    curve: [],
    emoji: EMOJI,
    risk: false
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
    this._unsub = store.subscribe(store.TOPICS.MOOD_CHANGED, () => this.load());
    this.setData({ today: util.dateStr() });
  },
  onShow() { this._applyTheme(); this.load(); },
  onReady() { this._initCanvas(() => this.draw()); },
  onUnload() { this._unsub && this._unsub(); },

  load() {
    const today = util.dateStr();
    const rec = moodService.get(today);
    const month = today.slice(0, 7);
    const curve = moodService.monthCurve(month);
    const history = moodService.all().slice().sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-8).reverse();
    this.setData({
      level: rec ? rec.level : 3,
      text: rec ? rec.text : '',
      today,
      curve,
      history: history.map((m) => ({
        date: m.date, level: m.level,
        levelText: moodService.LEVELS[m.level - 1],
        text: m.text, emoji: EMOJI[m.level - 1]
      })),
      risk: rec ? moodService.riskOf(rec.text) : false
    });
    this.draw();
  },

  setLevel(e) { this.setData({ level: Number(e.currentTarget.dataset.v) }); },
  onText(e) { const t = e.detail.value; this.setData({ text: t, risk: moodService.riskOf(t) }); },

  save() {
    try {
      moodService.add({ level: this.data.level, text: this.data.text, date: this.data.today });
      wx.showToast({ title: '已记录', icon: 'success' });
      if (this.data.risk) {
        setTimeout(() => wx.showModal({
          title: '温柔提醒',
          content: '如果最近压力很大，可以拨打心理援助热线 12356 聊聊。你不是一个人在努力，研途顺利也在。',
          showCancel: false
        }), 700);
      }
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  },

  _initCanvas(done) {
    const q = wx.createSelectorQuery().in(this);
    q.select('#curve').fields({ node: true, size: true });
    q.exec((res) => {
      const r = res[0];
      if (!r || !r.node) { done && done(); return; }
      const canvas = r.node;
      const ctx = canvas.getContext('2d');
      let dpr = 2;
      try { const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); dpr = info.pixelRatio || 2; } catch (e) { dpr = 2; }
      canvas.width = r.width * dpr; canvas.height = r.height * dpr; ctx.scale(dpr, dpr);
      this.tctx = ctx; this.tw = r.width; this.th = r.height;
      done && done();
    });
  },

  draw() {
    const ctx = this.tctx;
    if (!ctx) return;
    const w = this.tw, h = this.th;
    ctx.clearRect(0, 0, w, h);
    const curve = this.data.curve;
    if (!curve || !curve.length) return;
    const pad = { l: 8, r: 8, t: 10, b: 10 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    const bw = pw / curve.length;
    curve.forEach((d, i) => {
      const cx = pad.l + bw * i + bw / 2;
      if (!d.level) {
        ctx.fillStyle = themeStore.palette().grid;
        ctx.beginPath(); ctx.arc(cx, pad.t + ph - 3, 2, 0, Math.PI * 2); ctx.fill();
        return;
      }
      const bh = Math.max(4, ph * (d.level / 5));
      const y0 = pad.t + ph - bh;
      ctx.fillStyle = levelColors()[d.level - 1];
      ctx.fillRect(cx - bw * 0.28, y0, bw * 0.56, bh);
    });
  }
});
