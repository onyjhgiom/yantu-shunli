const share = require('../../utils/share');
const schoolService = require('../../services/school');
const freshService = require('../../services/school-fresh');
const targetService = require('../../services/target');
const theme = require('../../utils/theme');

const themeStore = require('../../utils/theme');
Page({
  onShareAppMessage: function () { return share.build(this, 'pages/school/detail'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/school/detail'); },

  data: {
    themeCls: '',
    code: '',
    school: null,
    structure: null,
    programs: [],
    programId: '',
    program: null,
    notFound: false,
    targetTotal: 0,
    diffText: '',
    diffColor: 'var(--sub)',
    // 信息时效
    season: freshService.DATA_SEASON,
    syncAt: freshService.SYNC_AT,
    version: freshService.VERSION,
    hasLive: false,
    phase: null,
    links: [],
    // 录入弹层
    showForm: false,
    formLine: '',
    formPlan: '',
    formUrl: '',
    formDate: ''
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


  onLoad(opt) { this.setData({ code: opt.code }); this.load(); },
  onShow() {
    this._applyTheme();
    this.loadTargets();
    // 静默拉取最新时效数据（如改考动态命中本专业），有更新则刷新页头
    schoolService.checkFreshSilent(() => {
      const fs = schoolService.syncState();
      this.setData({ season: freshService.DATA_SEASON, syncAt: freshService.SYNC_AT, version: fs.version, hasLive: fs.hasLive });
    });
  },
  onReady() { this._initCanvas(() => this.draw()); },

  load() {
    const raw = schoolService.get(this.data.code);
    if (!raw) { this.setData({ notFound: true }); return; }
    const friendlyMap = { '高': 'high', '中': 'mid', '低': 'low' };
    const s = Object.assign({}, raw, { friendlyClass: friendlyMap[raw.friendly] || 'mid' });
    // 学科评估等级（A+ / A- 等）含 + - 字符，直接拼进 class 会被 WXSS 当作选择器符号。
    // 先映射成纯 ASCII 后缀，避免编译失败。
    const assessClassOf = { 'A+': 'g-a-plus', 'A': 'g-a', 'A-': 'g-a-minus', 'B+': 'g-b-plus', 'B': 'g-b', 'B-': 'g-b-minus', 'C+': 'g-c-plus', 'C': 'g-c', 'C-': 'g-c-minus' };
    s.assessList = (['cs', 'se', 'nse']).filter((k) => raw.assess && raw.assess[k] && raw.assess[k] !== '—')
      .map((k) => ({ field: (raw.assessFields || {})[k], value: raw.assess[k], cls: assessClassOf[raw.assess[k]] || 'g-c' }));
    const programs = (s.programs || []).map((p) => Object.assign({ schoolCode: s.code, schoolName: s.name }, p));
    let programId = this.data.programId;
    if (!programId && programs.length) programId = programs[0].id;
    this.setData({
      school: s,
      structure: schoolService.structure(s.code),
      programs,
      programId,
      phase: freshService.currentPhase()
    }, () => this.selectProgram(programId));
  },

  goBack() { wx.navigateBack(); },

  loadTargets() {
    const t = targetService.getTarget();
    this.setData({ targetTotal: t ? (t.totalScore || 0) : 0 });
  },

  selectProgram(id) {
    const p = this.data.programs.find((x) => x.id === id);
    if (!p) return;
    const lines = (p.scoreLines || []).slice().sort((a, b) => a.year - b.year);
    const latest = lines[lines.length - 1] || null;
    const diff = (latest && this.data.targetTotal) ? (this.data.targetTotal - latest.retestLine) : null;
    this.setData({
      programId: id,
      program: Object.assign({}, p, { lines, latest }),
      diffText: diff == null ? '' : (diff >= 0 ? '高 ' + diff + ' 分' : '差 ' + (-diff) + ' 分'),
      diffColor: diff == null ? 'var(--sub)' : (diff >= 0 ? 'var(--ok)' : 'var(--danger)'),
      // 官方直达：研招网 + 院校研究生院 + 公告原文
      links: schoolService.officialLinks(this.data.school, p)
    });
    this.draw();
  },

  onProgram(e) { this.selectProgram(e.currentTarget.dataset.id); },

  addToTarget() {
    const p = this.data.program;
    if (!p) return;
    wx.showActionSheet({
      itemList: ['冲', '稳', '保'],
      success: (r) => {
        const tier = ['冲', '稳', '保'][r.tapIndex];
        schoolService.addTarget({
          programId: p.id, schoolName: p.schoolName, majorName: p.majorName,
          tier, targetScore: (p.latest && p.latest.retestLine) || 0
        });
        wx.showToast({ title: '已加入目标（' + tier + '）', icon: 'success' });
        this.loadTargets();
      }
    });
  },

  setMain() {
    const p = this.data.program;
    if (!p) return;
    const existing = schoolService.userTargets().find((t) => t.programId === p.id);
    const id = existing ? existing.id : schoolService.addTarget({
      programId: p.id, schoolName: p.schoolName, majorName: p.majorName,
      tier: '稳', targetScore: (p.latest && p.latest.retestLine) || 0
    }).id;
    schoolService.setMainTarget(id);
    wx.showToast({ title: '已设为主目标', icon: 'success' });
  },

  /* ---- 官方真实数据录入（分数线 + 招生计划 + 公告链接 + 日期） ---- */

  openForm() {
    const p = this.data.program;
    if (!p) return;
    this.setData({
      showForm: true,
      formLine: p.userLine ? String(p.userLine) : '',
      formPlan: p.userPlan ? String(p.userPlan) : '',
      formUrl: p.sourceUrl || '',
      formDate: p.sourceDate || ''
    });
  },

  closeForm() { this.setData({ showForm: false }); },

  onFormField(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['form' + k]: e.detail.value });
  },

  saveForm() {
    const p = this.data.program;
    if (!p) return;
    const line = parseInt(this.data.formLine, 10);
    if (this.data.formLine && (!line || line < 200 || line > 500)) {
      wx.showToast({ title: '分数线请填 200-500', icon: 'none' });
      return;
    }
    if (!line && !this.data.formUrl) {
      wx.showToast({ title: '至少填分数线或公告链接', icon: 'none' });
      return;
    }
    schoolService.setUserLine(p.id, {
      line: this.data.formLine ? line : 0,
      plan: this.data.formPlan ? parseInt(this.data.formPlan, 10) : 0,
      url: this.data.formUrl,
      date: this.data.formDate,
      source: '我录入的真实数据'
    });
    this.setData({ showForm: false });
    wx.showToast({ title: '已保存，以你的数据为准', icon: 'success' });
    this.load();
  },

  clearRealLine() {
    const p = this.data.program;
    if (!p) return;
    wx.showModal({
      title: '清除录入数据',
      content: '清除后将恢复使用系统参考区间。',
      success: (r) => {
        if (!r.confirm) return;
        schoolService.setUserLine(p.id, null);
        wx.showToast({ title: '已清除', icon: 'none' });
        this.load();
      }
    });
  },

  /** 复制外链到剪贴板（小程序不能直接跳外链） */
  copyUrl(e) {
    const url = e.currentTarget.dataset.url || '';
    const label = e.currentTarget.dataset.label || '链接';
    if (!url) { wx.showToast({ title: '该处暂无链接', icon: 'none' }); return; }
    wx.setClipboardData({
      data: url,
      success: () => wx.showModal({
        title: '已复制「' + label + '」',
        content: url + '\n\n微信小程序无法直接跳转外链，请粘贴到浏览器打开核实。',
        showCancel: false
      })
    });
  },

  /** 复制院校招生代码（研招网报名填写用） */
  copyCode() {
    const code = this.data.school && this.data.school.code;
    if (!code) { wx.showToast({ title: '暂无院校代码', icon: 'none' }); return; }
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '已复制院校代码 ' + code, icon: 'none' })
    });
  },

  _initCanvas(done) {
    const q = wx.createSelectorQuery().in(this);
    q.select('#trend').fields({ node: true, size: true });
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

  draw() {
    const ctx = this.tctx;
    if (!ctx) return;
    const w = this.tw, h = this.th;
    const p = this.data.program;
    ctx.clearRect(0, 0, w, h);
    if (!p || !p.lines || !p.lines.length) return;
    const pad = { l: 44, r: 16, t: 16, b: 28 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    const lines = p.lines;
    const totals = lines.map((l) => l.total);
    const maxV = Math.max(300, ...totals);
    const minV = Math.min(300, ...totals) - 30;
    const niceMax = Math.ceil(maxV / 20) * 20;
    const niceMin = Math.floor(minV / 20) * 20;
    const T = theme.theme;
    ctx.strokeStyle = T.grid; ctx.fillStyle = T.sub; ctx.font = '10px sans-serif'; ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = pad.t + (ph / 3) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(String(Math.round(niceMax - (niceMax - niceMin) / 3 * i)), 4, y + 3);
    }
    const n = lines.length;
    const xAt = (i) => pad.l + (n === 1 ? pw / 2 : (pw / (n - 1)) * i);
    const yAt = (v) => pad.t + ph * (1 - (v - niceMin) / (niceMax - niceMin));
    ctx.strokeStyle = T.forest; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    lines.forEach((l, i) => { const x = xAt(i), y = yAt(l.total); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
    lines.forEach((l, i) => {
      const x = xAt(i), y = yAt(l.total);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = T.terracotta; ctx.fill();
      ctx.fillStyle = T.inkSoft; ctx.font = '10px sans-serif';
      ctx.fillText(String(l.total), x - 12, y - 8);
      ctx.fillStyle = T.sub;
      ctx.fillText(String(l.year), x - 12, h - 8);
    });
  }
});
