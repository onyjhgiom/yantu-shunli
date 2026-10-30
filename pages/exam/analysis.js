const share = require('../../utils/share');
const examService = require('../../services/exam');
const theme = require('../../utils/theme');

const themeStore = require('../../utils/theme');
Page({
  onShareAppMessage: function () { return share.build(this, 'pages/exam/analysis'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/exam/analysis'); },

  data: {
    themeCls: '',
    id: '',
    notFound: false,
    exam: null,
    radarData: [],
    trendData: [],
    diagnose: []
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



  onLoad(opt) { this.id = opt.id; this.load(); },
  onReady() { this._initCanvas(() => this.draw()); },

  load() {
    const e = examService.get(this.id);
    if (!e) { this.setData({ notFound: true }); return; }
    this.setData({
      exam: { name: e.name, date: e.date, typeText: e.type === 'real' ? '真题' : '模拟', total: e.total, note: e.note },
      radarData: examService.radar(this.id),
      trendData: examService.trend(),
      diagnose: examService.diagnose(this.id)
    });
    this.draw();
  },

  goBack() { wx.navigateBack(); },

  _initCanvas(done) {
    const q = wx.createSelectorQuery().in(this);
    q.select('#radar').fields({ node: true, size: true });
    q.select('#trend').fields({ node: true, size: true });
    q.exec((res) => {
      const setup = (r) => {
        if (!r || !r.node) return null;
        const canvas = r.node;
        const ctx = canvas.getContext('2d');
        let dpr = 2;
        try { const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); dpr = info.pixelRatio || 2; } catch (e) { dpr = 2; }
        canvas.width = r.width * dpr; canvas.height = r.height * dpr; ctx.scale(dpr, dpr);
        return { ctx, w: r.width, h: r.height };
      };
      const radar = setup(res[0]);
      const trend = setup(res[1]);
      if (radar) { this.radarCtx = radar.ctx; this.radarW = radar.w; this.radarH = radar.h; }
      if (trend) { this.trendCtx = trend.ctx; this.trendW = trend.w; this.trendH = trend.h; }
      done && done();
    });
  },

  draw() { if (this.radarCtx) this.drawRadar(); if (this.trendCtx) this.drawTrend(); },

  drawRadar() {
    const ctx = this.radarCtx, w = this.radarW, h = this.radarH;
    const T = theme.theme;
    ctx.clearRect(0, 0, w, h);
    const data = this.data.radarData;
    if (!data.length) return;
    const cx = w / 2, cy = h / 2 + 6, R = Math.min(w, h) / 2 - 34;
    const n = data.length;
    const maxV = Math.max(150, ...data.map((d) => Math.max(d.current, d.target)));
    const angleAt = (i) => -Math.PI / 2 + (Math.PI * 2 / n) * i;
    // 网格
    ctx.strokeStyle = T.grid; ctx.lineWidth = 1;
    for (let g = 1; g <= 4; g++) {
      const rr = R * g / 4;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = angleAt(i % n);
        const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 轴线 + 标签
    ctx.fillStyle = T.inkSoft; ctx.font = '11px sans-serif';
    for (let i = 0; i < n; i++) {
      const a = angleAt(i);
      const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.strokeStyle = T.grid; ctx.stroke();
      const lx = cx + (R + 16) * Math.cos(a), ly = cy + (R + 16) * Math.sin(a);
      ctx.textAlign = 'center';
      ctx.fillText(data[i].name, lx, ly + 4);
    }
    ctx.textAlign = 'left';
    const poly = (key, color, fill) => {
      ctx.beginPath();
      data.forEach((d, i) => {
        const v = d[key] || 0;
        const rr = (v / maxV) * R;
        const a = angleAt(i);
        const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    };
    poly('target', T.terracotta, 'rgba(194,112,61,0.10)');
    poly('current', T.forest, 'rgba(46,79,62,0.12)');
  },

  drawTrend() {
    const ctx = this.trendCtx, w = this.trendW, h = this.trendH;
    const T = theme.theme;
    ctx.clearRect(0, 0, w, h);
    const data = this.data.trendData;
    if (!data.length) return;
    const pad = { l: 44, r: 16, t: 16, b: 28 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    const totals = data.map((d) => d.total);
    const niceMax = Math.ceil(Math.max(300, ...totals) / 20) * 20;
    const niceMin = Math.floor(Math.min(200, ...totals) / 20) * 20;
    ctx.strokeStyle = T.grid; ctx.fillStyle = T.sub; ctx.font = '10px sans-serif'; ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = pad.t + (ph / 3) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(String(Math.round(niceMax - (niceMax - niceMin) / 3 * i)), 4, y + 3);
    }
    const n = data.length;
    const xAt = (i) => pad.l + (n === 1 ? pw / 2 : (pw / (n - 1)) * i);
    const yAt = (v) => pad.t + ph * (1 - (v - niceMin) / (niceMax - niceMin));
    ctx.strokeStyle = T.forest; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d, i) => { const x = xAt(i), y = yAt(d.total); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
    data.forEach((d, i) => {
      const x = xAt(i), y = yAt(d.total);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = T.terracotta; ctx.fill();
      ctx.fillStyle = T.sub; ctx.font = '10px sans-serif';
      ctx.fillText(d.date.slice(5), x - 14, h - 8);
      ctx.fillStyle = T.inkSoft; ctx.fillText(String(d.total), x - 12, y - 8);
    });
  },

  importMistakes() {
    const n = examService.importToMistakes(this.id);
    wx.showToast({ title: n > 0 ? ('已导入 ' + n + ' 题到错题本') : '各科均已达标', icon: 'none' });
  },

  remove() {
    wx.showModal({
      title: '删除模考', content: '确定删除这份记录？',
      success: (r) => { if (r.confirm) { examService.remove(this.id); wx.navigateBack(); } }
    });
  }
});
