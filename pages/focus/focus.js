const share = require('../../utils/share');
const focusService = require('../../services/focus');
const taskService = require('../../services/task');
const studyService = require('../../services/study');
const theme = require('../../utils/theme');
const util = require('../../utils/util');
const themeStore = require('../../utils/theme');
const T = require('../../utils/theme').theme;

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/focus/focus'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/focus/focus'); },

  data: {
    themeCls: '',
    presets: focusService.PRESETS,
    presetIndex: 1,
    subjects: [],
    subjectLabels: [],
    subjectIndex: 3,
    taskLabels: ['不关联任务'],
    taskPickIds: [''],
    taskIndex: 0,
    taskTitle: '',
    phase: 'focus',
    phaseLabel: '专 注',
    running: false,
    remain: 1500,
    total: 1500,
    timeText: '25:00',
    subjectName: '专业课',
    todayFocus: 0,
    todayText: '0m'
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
    const subjects = theme.SUBJECTS.concat([theme.SUBJECT_MAP.other]);
    const pending = taskService.pending(20);
    const taskLabels = ['不关联任务'].concat(pending.map((t) => t.title.slice(0, 16)));
    this.setData({
      subjects,
      subjectLabels: subjects.map((s) => s.name),
      taskLabels,
      taskPickIds: [''].concat(pending.map((t) => t.id))
    });
    this._syncFromPreset();
    this._refreshToday();
  },

  onReady() { this._initCanvas(); },

  onHide() { /* 保持计时，不清理 */ },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  _initCanvas() {
    wx.createSelectorQuery().in(this).select('#ring').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      let dpr = 2;
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        dpr = info.pixelRatio || 2;
      } catch (e) { dpr = 2; }
      canvas.width = res[0].width * dpr;
      canvas.height = res[0].height * dpr;
      ctx.scale(dpr, dpr);
      this.canvas = canvas;
      this.ctx = ctx;
      this.cw = res[0].width;
      this.ch = res[0].height;
      this.drawRing(0);
    });
  },

  drawRing(progress) {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.cw, h = this.ch;
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) / 2 - 16;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 14;
    ctx.strokeStyle = T.paperDeep;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const color = this.data.phase === 'focus' ? T.forest : T.terracotta;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * Math.max(0.0001, Math.min(1, progress));
    ctx.arc(cx, cy, r, start, end);
    ctx.stroke();
  },

  _syncFromPreset() {
    const p = this.data.presets[this.data.presetIndex];
    const total = p.focus * 60;
    this.setData({ phase: 'focus', phaseLabel: '专 注', total, remain: total, timeText: this._fmt(total), running: false });
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.drawRing(0);
  },

  _fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${util.pad(m)}:${util.pad(s)}`;
  },

  _refreshToday() {
    this.setData({
      todayFocus: focusService.todayCount(),
      todayText: util.fmtMinutes(studyService.todayMinutes())
    });
  },

  onPreset(e) {
    if (this.data.running) { wx.showToast({ title: '请先暂停或结束', icon: 'none' }); return; }
    this.setData({ presetIndex: Number(e.currentTarget.dataset.index) }, () => this._syncFromPreset());
  },

  onSubject(e) {
    const i = Number(e.detail.value);
    this.setData({ subjectIndex: i, subjectName: this.data.subjects[i].name });
  },

  onTask(e) {
    const i = Number(e.detail.value);
    this.setData({
      taskIndex: i,
      taskTitle: i === 0 ? '' : this.data.taskLabels[i]
    });
  },

  toggle() {
    if (this.data.running) { this._pause(); } else { this._start(); }
  },

  _start() {
    if (this._timer) return;
    this._startAt = Date.now();
    this.setData({ running: true });
    this._timer = setInterval(() => this._tick(), 1000);
  },

  _pause() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.setData({ running: false });
  },

  _tick() {
    const remain = this.data.remain - 1;
    if (remain <= 0) {
      this.setData({ remain: 0, timeText: this._fmt(0) });
      this.drawRing(1);
      this._phaseEnd();
      return;
    }
    this.setData({ remain, timeText: this._fmt(remain) });
    this.drawRing((this.data.total - remain) / this.data.total);
  },

  _record(minutes) {
    if (minutes <= 0) return;
    const subject = this.data.subjects[this.data.subjectIndex].key;
    focusService.add({
      subject,
      minutes,
      preset: this.data.presets[this.data.presetIndex].label,
      taskId: this.data.taskPickIds[this.data.taskIndex] || '',
      taskTitle: this.data.taskTitle,
      startAt: this._startAt || 0,
      endAt: Date.now()
    });
    this._refreshToday();
  },

  _phaseEnd() {
    this._pause();
    wx.vibrateLong && wx.vibrateLong();
    if (this.data.phase === 'focus') {
      const minutes = this.data.presets[this.data.presetIndex].focus;
      this._record(minutes);
      wx.showToast({ title: `完成 ${minutes} 分钟专注`, icon: 'success' });
      const restSec = this.data.presets[this.data.presetIndex].rest * 60;
      this.setData({ phase: 'rest', phaseLabel: '休 息', total: restSec, remain: restSec, timeText: this._fmt(restSec) });
      this.drawRing(0);
      this._start(); // 自动开始休息
    } else {
      const focusSec = this.data.presets[this.data.presetIndex].focus * 60;
      this.setData({ phase: 'focus', phaseLabel: '专 注', total: focusSec, remain: focusSec, timeText: this._fmt(focusSec), running: false });
      this.drawRing(0);
      wx.showToast({ title: '休息结束，回来继续', icon: 'none' });
    }
  },

  reset() {
    this._pause();
    this._syncFromPreset();
  },

  skip() {
    this._pause();
    const focusSec = this.data.presets[this.data.presetIndex].focus * 60;
    this.setData({ phase: 'focus', phaseLabel: '专 注', total: focusSec, remain: focusSec, timeText: this._fmt(focusSec) });
    this.drawRing(0);
  },

  /** 结束并记录已专注的时长 */
  finish() {
    const elapsed = Math.round((this.data.total - this.data.remain) / 60);
    this._pause();
    if (elapsed <= 0) {
      wx.showToast({ title: '还没有专注时长', icon: 'none' });
      return;
    }
    this._record(elapsed);
    wx.showToast({ title: `已记录 ${elapsed} 分钟`, icon: 'success' });
    this._syncFromPreset();
  }
});
