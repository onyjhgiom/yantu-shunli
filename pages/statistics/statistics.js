const share = require('../../utils/share');
const statisticsService = require('../../services/statistics');
const studyService = require('../../services/study');
const subjectService = require('../../services/subject');
const focusService = require('../../services/focus');
const taskService = require('../../services/task');
const themeUtil = require('../../utils/theme');
const util = require('../../utils/util');
const themeStore = require('../../utils/theme');
const T = themeUtil.theme;

/* 热力日历 5 档：只用于 WXML 内联 style，故用 CSS 变量（随 .th-* 自动换肤） */
const LEGEND = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'];

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/statistics/statistics'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/statistics/statistics'); },

  data: {
    themeCls: '',
    scopes: [
      { key: 'today', label: '今日' },
      { key: 'week', label: '本周' },
      { key: 'month', label: '本月' },
      { key: 'all', label: '全部' }
    ],
    scope: 'week',
    metrics: { minutesText: '0m', avgText: '0m', completionRate: 0, completionDone: 0, completionTotal: 0, focusCount: 0 },
    subjects: [],
    overview: { streak: 0, studyDays: 0, totalText: '0m' },
    heat: { cols: [], weeks: 14 },
    legendColors: LEGEND
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


  /*
   * onLoad 支持 ?scope= 预选范围 —— 首页头部四个指标就是靠它带进来的
   * （今日 / 本周 / 全部 / 本月），点哪个指标进来就落在哪个范围上。
   * 非法的 scope 一律忽略，仍用默认的 本周。
   */
  onLoad(query) {
    this._series = [];
    this._subjectTotals = {};
    const key = query && query.scope;
    if (key && this.data.scopes.some((s) => s.key === key)) {
      this.setData({ scope: key });
    }
  },

  onReady() {
    this._initCanvases(() => {
      this.load();
      this.draw();
    });
  },

  onShow() { this._applyTheme(); if (this.lineCtx) { this.load(); this.draw(); } },

  _initCanvases(done) {
    const q = wx.createSelectorQuery().in(this);
    q.select('#line').fields({ node: true, size: true });
    q.select('#bar').fields({ node: true, size: true });
    q.exec((res) => {
      const setup = (r) => {
        if (!r || !r.node) return null;
        const canvas = r.node;
        const ctx = canvas.getContext('2d');
        let dpr = 2;
        try {
          const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
          dpr = info.pixelRatio || 2;
        } catch (e) { dpr = 2; }
        canvas.width = r.width * dpr;
        canvas.height = r.height * dpr;
        ctx.scale(dpr, dpr);
        return { ctx, w: r.width, h: r.height };
      };
      const line = setup(res[0]);
      const bar = setup(res[1]);
      if (line) { this.lineCtx = line.ctx; this.lineW = line.w; this.lineH = line.h; }
      if (bar) { this.barCtx = bar.ctx; this.barW = bar.w; this.barH = bar.h; }
      done && done();
    });
  },

  onScope(e) {
    this.setData({ scope: e.currentTarget.dataset.key }, () => this.load());
  },

  load() {
    const today = util.dateStr();
    const weekStart = util.dateStr(util.startOfWeek(today));
    const monthStart = today.slice(0, 8) + '01';
    const overview = statisticsService.overview();

    let start = today, end = today, days = 1;
    if (this.data.scope === 'week') { start = weekStart; days = util.daysBetween(weekStart, today) + 1; }
    else if (this.data.scope === 'month') { start = monthStart; days = Number(today.slice(8, 10)); }
    else if (this.data.scope === 'all') { start = '1970-01-01'; days = overview.studyDays || 1; }

    const r = statisticsService.range(start, end);
    const minutes = this.data.scope === 'all' ? overview.total : r.minutes;
    const completion = this.data.scope === 'all'
      ? { rate: overview.completionRate, done: overview.completionDone, total: overview.completionTotal }
      : { rate: r.completion.rate, done: r.completion.done, total: r.completion.total };

    const focusCount = focusService.records().filter((f) => f.date >= start && f.date <= end).length;

    const heat = statisticsService.heatmap(14);
    const cols = heat.cols.map((col) => col.map((c) => ({ date: c.date, minutes: c.minutes, bg: LEGEND[c.level] })));

    this._series = studyService.recentDays(14);
    this._subjectTotals = overview.subjectTotals;

    this.setData({
      metrics: {
        minutesText: util.fmtMinutes(minutes),
        avgText: util.fmtMinutes(Math.round(minutes / Math.max(1, days))),
        completionRate: completion.rate,
        completionDone: completion.done,
        completionTotal: completion.total,
        focusCount
      },
      subjects: subjectService.overview(),
      overview: {
        streak: overview.streak,
        studyDays: overview.studyDays,
        totalText: util.fmtMinutes(overview.total)
      },
      heat: { cols, weeks: 14 }
    });
    this.draw();
  },

  draw() {
    if (this.lineCtx) this.drawLine();
    if (this.barCtx) this.drawBar();
  },

  drawLine() {
    const ctx = this.lineCtx, w = this.lineW, h = this.lineH;
    const data = this._series || [];
    const pad = { l: 40, r: 14, t: 18, b: 28 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    ctx.clearRect(0, 0, w, h);

    const maxMin = Math.max(60, ...data.map((d) => d.minutes));
    const niceMax = Math.ceil(maxMin / 60) * 60;

    // 网格与 y 轴刻度
    ctx.strokeStyle = T.grid;
    ctx.fillStyle = T.sub;
    ctx.font = '10px sans-serif';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = pad.t + (ph / 3) * i;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      const val = Math.round(niceMax - (niceMax / 3) * i);
      ctx.fillText(util.fmtMinutes(val), 4, y + 3);
    }

    if (!data.length) return;
    const n = data.length;
    const xAt = (i) => pad.l + (n === 1 ? pw / 2 : (pw / (n - 1)) * i);
    const yAt = (m) => pad.t + ph * (1 - m / niceMax);

    // 面积
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(data[0].minutes));
    data.forEach((d, i) => ctx.lineTo(xAt(i), yAt(d.minutes)));
    ctx.lineTo(xAt(n - 1), pad.t + ph);
    ctx.lineTo(xAt(0), pad.t + ph);
    ctx.closePath();
    ctx.fillStyle = T.areaSoft;
    ctx.fill();

    // 折线
    ctx.strokeStyle = T.forest;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = xAt(i), y = yAt(d.minutes);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 数据点
    data.forEach((d, i) => {
      const x = xAt(i), y = yAt(d.minutes);
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = d.minutes ? T.terracotta : T.sub;
      ctx.fill();
    });

    // x 轴标签（每 3 天一个）
    ctx.fillStyle = T.sub;
    ctx.font = '10px sans-serif';
    data.forEach((d, i) => {
      if (i % 3 === 0 || i === n - 1) {
        const x = xAt(i);
        const label = d.date.slice(5).replace('-', '/');
        ctx.fillText(label, x - 12, h - 8);
      }
    });
  },

  drawBar() {
    const ctx = this.barCtx, w = this.barW, h = this.barH;
    const totals = this._subjectTotals || {};
    const subs = themeUtil.SUBJECTS;
    const pad = { l: 14, r: 14, t: 34, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    ctx.clearRect(0, 0, w, h);

    const vals = subs.map((s) => totals[s.key] || 0);
    const maxV = Math.max(60, ...vals);
    const niceMax = Math.ceil(maxV / 60) * 60;

    ctx.strokeStyle = T.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = pad.t + (ph / 3) * i;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    }

    const slot = pw / subs.length;
    const bw = Math.min(56, slot * 0.5);
    ctx.textAlign = 'center';
    subs.forEach((s, i) => {
      const cx = pad.l + slot * i + slot / 2;
      const v = totals[s.key] || 0;
      const bh = v ? Math.max(4, ph * (v / niceMax)) : 0;
      const y0 = pad.t + ph - bh;

      ctx.fillStyle = (T.subjectColors && T.subjectColors[i]) || T.forest;
      const r = Math.min(8, bw / 2);
      roundRect(ctx, cx - bw / 2, y0, bw, bh, r);
      ctx.fill();

      // 数值
      ctx.fillStyle = T.inkSoft;
      ctx.font = '11px sans-serif';
      ctx.fillText(v ? util.fmtMinutes(v) : '0', cx, y0 - 8);

      // 名称
      ctx.fillStyle = T.sub;
      ctx.font = '12px sans-serif';
      ctx.fillText(s.name, cx, h - 10);
    });
    ctx.textAlign = 'left';
  },

  onCell(e) {
    const { date, minutes } = e.currentTarget.dataset;
    wx.showToast({ title: `${date}　学习 ${util.fmtMinutes(Number(minutes) || 0)}`, icon: 'none' });
  }
});

function roundRect(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  const rr = Math.min(r, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}
