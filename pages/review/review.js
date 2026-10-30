const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const db = require('../../services/db');
const studyService = require('../../services/study');
const targetService = require('../../services/target');
const mistakeService = require('../../services/mistake');
const cardService = require('../../services/card');
const util = require('../../utils/util');
const voice = require('../../utils/voice');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/review/review'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/review/review'); },

  data: {
    themeCls: '',
    date: '',
    dateLabel: '',
    done: '',
    minutes: 0,
    undone: '',
    reason: '',
    gain: '',
    tomorrow: ['', '', ''],
    aiText: '',
    mistakeDue: 0,
    cardDue: 0,
    /* 语音输入：recField 记录正在录音的字段 */
    recField: '',
    recSec: 0
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

  onUnload() {
    if (this._recTimer) clearInterval(this._recTimer);
    if (voice.isRecording()) voice.cancel();
  },

  /* ===== 语音输入复盘：录音 → 转文字 → 追加到对应字段（之后仍可手动编辑） ===== */
  onMic(e) {
    const f = e.currentTarget.dataset.f;
    if (this.data.recField) {
      if (this.data.recField === f) voice.stop();   // 再点一次结束并转写
      return;
    }
    this.setData({ recField: f, recSec: 0 });
    voice.capture({
      onStart: () => {
        if (this._recTimer) clearInterval(this._recTimer);
        this._recTimer = setInterval(() => {
          const sec = Math.floor(voice.elapsed() / 1000);
          if (sec >= 60) { voice.stop(); return; }
          this.setData({ recSec: sec });
        }, 200);
      },
      onText: (t) => { const p = {}; p[f] = (this.data[f] ? this.data[f] + ' ' : '') + t; this.setData(p); },
      onError: (m) => wx.showToast({ title: String(m).split('\n')[0], icon: 'none', duration: 2500 }),
      onEnd: () => {
        if (this._recTimer) clearInterval(this._recTimer);
        this._recTimer = null;
        this.setData({ recField: '', recSec: 0 });
      }
    });
  },



  onLoad() {
    const date = util.dateStr();
    const existing = this._all().find((r) => r.date === date);
    this.setData({
      date,
      dateLabel: `${util.parseDate(date).getMonth() + 1}月${util.parseDate(date).getDate()}日 周${util.weekdayCN(date)}`,
      minutes: existing ? existing.minutes : studyService.todayMinutes(),
      mistakeDue: mistakeService.dueCount(),
      cardDue: cardService.dueQueue(null).length
    });
    if (existing) {
      this.setData({
        done: existing.done || '',
        undone: existing.undone || '',
        reason: existing.reason || '',
        gain: existing.gain || '',
        tomorrow: (existing.tomorrow && existing.tomorrow.length === 3) ? existing.tomorrow : ['', '', ''],
        aiText: existing.aiText || ''
      });
    }
  },

  _all() {
    try { return wx.getStorageSync(db.KEYS.reviews) || []; } catch (e) { return []; }
  },

  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },

  onTomorrow(e) {
    const i = Number(e.currentTarget.dataset.idx);
    const arr = this.data.tomorrow.slice();
    arr[i] = e.detail.value;
    this.setData({ tomorrow: arr });
  },

  save() {
    if (!this.data.done.trim() && !this.data.gain.trim()) {
      wx.showToast({ title: '至少写写今天的收获吧', icon: 'none' });
      return;
    }
    const aiText = this._compose();
    const review = {
      date: this.data.date,
      done: this.data.done.trim(),
      minutes: Math.max(0, Number(this.data.minutes) || 0),
      undone: this.data.undone.trim(),
      reason: this.data.reason.trim(),
      gain: this.data.gain.trim(),
      tomorrow: this.data.tomorrow.map((s) => s.trim()),
      aiText,
      updatedAt: Date.now()
    };
    const list = this._all().filter((r) => r.date !== review.date);
    list.unshift(review);
    db.set(db.KEYS.reviews, list);
    this.setData({ aiText });
    wx.showToast({ title: '复盘已保存', icon: 'success' });
  },

  _compose() {
    const d = this.data;
    const countdown = targetService.countdown();
    const lines = [];
    lines.push(`【${d.date} 学习日报】`);
    lines.push(`今日学习 ${util.fmtMinutes(Number(d.minutes) || 0)}。`);
    if (d.done.trim()) lines.push(`完成：${d.done.trim()}`);
    if (d.undone.trim()) lines.push(`未完成：${d.undone.trim()}`);
    if (d.reason.trim()) lines.push(`原因：${d.reason.trim()}`);
    if (d.gain.trim()) lines.push(`收获：${d.gain.trim()}`);
    const tmr = d.tomorrow.map((s) => s.trim()).filter(Boolean);
    if (tmr.length) lines.push(`明日三件事：${tmr.map((t, i) => `${i + 1}) ${t}`).join('；')}`);
    if (countdown) lines.push(`距初试还有 ${countdown.totalDays} 天，继续保持。`);
    return lines.join('\n');
  },

  copy() {
    wx.setClipboardData({
      data: this.data.aiText,
      success: () => wx.showToast({ title: '已复制', icon: 'none' })
    });
  },

  goMistake() { wx.navigateTo({ url: '/pages/mistake/mistake' }); },
  goCard() { wx.navigateTo({ url: '/pages/card/card' }); }
});
