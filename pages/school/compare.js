const share = require('../../utils/share');
const schoolService = require('../../services/school');
const targetService = require('../../services/target');
const theme = require('../../utils/theme');

const themeStore = require('../../utils/theme');
Page({
  onShareAppMessage: function () { return share.build(this, 'pages/school/compare'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/school/compare'); },

  data: {
    themeCls: '',
    targets: [],
    selected: [],
    rows: [],
    hasTarget: false
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


  onShow() { this._applyTheme(); this.load(); },

  load() {
    const targets = schoolService.userTargets();
    // selected 存的一律是 programId（toggle 传入的就是 programId），
    // 这里曾误用 t.id 过滤，导致每次进入页面选中项都被清空
    const sel = this.data.selected.filter((id) => targets.some((t) => t.programId === id));
    const t = targetService.getTarget();
    // 勾选态在 JS 侧算好（WXML 不支持 indexOf）
    const rows = targets.map((x) => Object.assign({}, x, { sel: sel.indexOf(x.programId) >= 0 }));
    this.setData({ targets: rows, selected: sel, hasTarget: !!(t && t.totalScore) }, () => this.render());
  },

  toggle(e) {
    const id = e.currentTarget.dataset.id;
    let sel = this.data.selected.slice();
    const i = sel.indexOf(id);
    if (i >= 0) sel.splice(i, 1);
    else {
      if (sel.length >= 3) { wx.showToast({ title: '最多对比 3 所', icon: 'none' }); return; }
      sel.push(id);
    }
    this.setData({ selected: sel }, () => this.render());
  },

  goSchool() { wx.navigateTo({ url: '/pages/school/school' }); },

  render() {
    const ps = schoolService.compare(this.data.selected);
    this.setData({
      rows: ps.map((p) => ({
        id: p.id,
        name: p.schoolName + '·' + p.majorName,
        tierText: (this.data.targets.find((t) => t.programId === p.id) || {}).tier || '',
        latestTotal: (p.latest && p.latest.total) || '-',
        diff: p.diff == null ? '—' : (p.diff >= 0 ? '+' + p.diff : String(p.diff)),
        diffColor: p.diff == null ? 'var(--sub)' : (p.diff >= 0 ? 'var(--ok)' : 'var(--danger)'),
        planCount: p.planCount
      }))
    });
    this._initCanvas(() => this.draw(ps));
  },

  _initCanvas(done) {
    const q = wx.createSelectorQuery().in(this);
    q.select('#cmp').fields({ node: true, size: true });
    q.exec((res) => {
      const r = res[0];
      if (!r || !r.node) { done && done(); return; }
      const canvas = r.node;
      const ctx = canvas.getContext('2d');
      let dpr = 2;
      try { const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); dpr = info.pixelRatio || 2; } catch (e) { dpr = 2; }
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.scale(dpr, dpr);
      this.tctx = ctx; this.tw = r.width; this.th = r.height;
      done && done();
    });
  },

  draw(ps) {
    const ctx = this.tctx;
    if (!ctx) return;
    const w = this.tw, h = this.th;
    ctx.clearRect(0, 0, w, h);
    if (!ps || ps.length < 1) return;
    const T = theme.theme;
    const colors = [T.forest, T.terracotta, (T.subjectColors && T.subjectColors[1]) || T.forest];
    const pad = { l: 44, r: 16, t: 16, b: 28 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    let all = [];
    ps.forEach((p) => (p.lines || []).forEach((l) => all.push(l.total)));
    if (!all.length) return;
    const niceMax = Math.ceil(Math.max(320, ...all) / 20) * 20;
    const niceMin = Math.floor(Math.min(280, ...all) / 20) * 20;
    ctx.strokeStyle = T.grid; ctx.fillStyle = T.sub; ctx.font = '10px sans-serif'; ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = pad.t + (ph / 3) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(String(Math.round(niceMax - (niceMax - niceMin) / 3 * i)), 4, y + 3);
    }
    const years = (ps[0].lines || []).map((l) => l.year);
    const n = years.length;
    const xAt = (i) => pad.l + (n === 1 ? pw / 2 : (pw / (n - 1)) * i);
    const yAt = (v) => pad.t + ph * (1 - (v - niceMin) / (niceMax - niceMin));
    ps.forEach((p, pi) => {
      ctx.strokeStyle = colors[pi % colors.length];
      ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      (p.lines || []).forEach((l, i) => { const x = xAt(i), y = yAt(l.total); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();
      (p.lines || []).forEach((l, i) => {
        const x = xAt(i), y = yAt(l.total);
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fillStyle = colors[pi % colors.length]; ctx.fill();
        if (pi === 0) { ctx.fillStyle = T.sub; ctx.fillText(String(l.year), x - 12, h - 8); }
      });
    });
  }
});
