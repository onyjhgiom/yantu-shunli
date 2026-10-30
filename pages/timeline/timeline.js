const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const targetService = require('../../services/target');
const calendarService = require('../../services/calendar');
const statisticsService = require('../../services/statistics');
const taskService = require('../../services/task');
const holidayService = require('../../services/holiday');
const util = require('../../utils/util');

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

const WEEK_HEAD = ['日', '一', '二', '三', '四', '五', '六'];

/* 我的节点定义：保持原有四项，一项都没删 */
const MINE_DEFS = [
  { key: 'signDate', label: '网上报名', desc: '中国研究生招生信息网', kind: 'sign' },
  { key: 'confirmDate', label: '网上确认', desc: '各省确认时间不同', kind: 'sign' },
  { key: 'examDate', label: '初试', desc: '全国笔试', kind: 'exam' },
  { key: 'retestDate', label: '复试', desc: '院校自定', kind: 'retest' }
];

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/timeline/timeline'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/timeline/timeline'); },

  data: {
    themeCls: '',
    configured: false,
    examDate: '',
    examYear: '',
    mine: [],

    weekHead: WEEK_HEAD,
    year: 0,
    month: 0,
    monthLabel: '',
    weeks: [],
    todayStr: '',
    atThisMonth: false,

    phase: null,
    season: [],

    selected: '',
    detail: null,
    /* 节假日：holidayKnown=false 表示该年官方安排尚未公布，不做推算 */
    holidayKnown: true,
    holidayYears: [],
    monthStat: { days: 0, totalText: '' }
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
    const today = util.dateStr();
    const t = targetService.getTarget();

    /* 1) 我的节点 —— 沿用原逻辑，四项全保留 */
    const mine = MINE_DEFS
      .filter((d) => t && t[d.key])
      .map((d) => {
        const days = util.daysBetween(today, t[d.key]);
        return {
          key: d.key, label: d.label, desc: d.desc, kind: d.kind,
          date: t[d.key], days,
          past: days < 0,
          soon: days >= 0 && days <= 30
        };
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    this._mine = mine;

    /* 2) 当前阶段 + 全国招生季节点 */
    const phase = calendarService.phaseAt(today);
    const season = calendarService.seasonNodes(today).map((s) => Object.assign({}, s, { open: false }));

    /* 3) 月历 —— 我的节点落到具体日，全国节点落到当月 */
    const now = new Date();
    const seed = {
      year: Number(this.data.year) || now.getFullYear(),
      month: Number(this.data.month) || now.getMonth() + 1,
      head: { year: now.getFullYear(), month: now.getMonth() + 1 }
    };
    this._mineMap = {};
    mine.forEach((n) => {
      (this._mineMap[n.date] = this._mineMap[n.date] || []).push({ label: n.label, kind: n.kind });
    });

    this.setData({
      configured: !!(t && t.examDate),
      examDate: (t && t.examDate) || '',
      examYear: (t && t.examYear) || '',
      mine,
      phase,
      season,
      todayStr: today
    }, () => {
      this.setData({ year: seed.year, month: seed.month, monthLabel: seed.year + ' 年 ' + seed.month + ' 月' });
      this.buildMonth();
      this.buildDetail();
    });

    /* 距初试天数（原有信息，保留在 data 供 hero 用） */
    const days = t && t.examDate ? util.daysBetween(today, t.examDate) : null;
    this.setData({ daysToExam: days, holidayYears: holidayService.years() });
  },

  /** 重算月历 */
  buildMonth() {
    const { year, month } = this.data;
    this.setData({ holidayKnown: holidayService.hasYear(year) });
    const monthMarks = {};
    this.data.season.forEach((s) => {
      if (s.state !== 'now') return;
      const key = year + '-' + pad2(month);
      (monthMarks[key] = monthMarks[key] || []).push({ title: s.title, key: s.key });
    });

    const weeks = calendarService.monthMatrix(year, month, {
      marks: this._mineMap || {},
      monthMarks,
      // 法定节假日与调休（精确到日），数据来自 services/holiday.js
      holidays: holidayService.monthMap(year, month)
    });

    /* 本月学习轨迹：直接铺在日历上，日历既是节点也是努力痕迹 */
    const map = statisticsService.dateMap();
    let days = 0;
    let total = 0;
    weeks.forEach((row) => row.forEach((c) => {
      if (!c) return;
      const m = map[c.date] || 0;
      c.level = statisticsService.levelOf(m);
      c.minutes = m;
      c.studyText = m > 0 ? util.fmtMinutes(m) : '';
      if (m > 0) { days += 1; total += m; }
    }));
    // 逐格 setData 会刷很多帧，改由 matrix 直接产出（见下）
    this.setData({
      weeks,
      monthStat: { days, totalText: total > 0 ? util.fmtMinutes(total) : '' }
    });
  },

  /** 重算选中日的详情 */
  buildDetail() {
    const sel = this.data.selected || this.data.todayStr;
    const tasks = (taskService.all() || [])
      .filter((t) => !t.parentId && (t.date === sel || t.planDate === sel))
      .map((t) => ({ title: t.title || t.name || '待办' }));
    const detail = calendarService.dayDetail(sel, { mine: this._mine || [], tasks });
    // 节假日/调休说明置顶，避免"点开只看到任务、看不到今天休不休"
    const hd = holidayService.get(sel);
    if (hd) {
      detail.lines = [hd.name + (hd.type === 'holiday' ? '（法定假日放假）' : '（调休上班）')].concat(detail.lines || []);
      if (detail.kind === 'empty') detail.title = hd.type === 'holiday' ? '法定假日' : '调休上班';
    }
    this.setData({ selected: sel, detail });
  },

  prevMonth() { this.shiftMonth(-1); },
  nextMonth() { this.shiftMonth(1); },

  shiftMonth(delta) {
    const { year, month } = this.data;
    let y = year;
    let m = month + delta;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    this.setData({ year: y, month: m, monthLabel: y + ' 年 ' + m + ' 月' }, () => this.buildMonth());
  },

  goToday() {
    const n = new Date();
    this.setData({
      year: n.getFullYear(),
      month: n.getMonth() + 1,
      monthLabel: n.getFullYear() + ' 年 ' + (n.getMonth() + 1) + ' 月',
      selected: util.dateStr(n)
    }, () => { this.buildMonth(); this.buildDetail(); });
  },

  onDayTap(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    // 点今天以外的日期，日历自动翻到那天所在月
    const d = util.parseDate(date);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const patch = {};
    let needMonth = false;
    if (y !== this.data.year || m !== this.data.month) {
      Object.assign(patch, { year: y, month: m, monthLabel: y + ' 年 ' + m + ' 月' });
      needMonth = true;
    }
    Object.assign(patch, { selected: date });
    this.setData(patch, () => {
      if (needMonth) this.buildMonth();
      this.buildDetail();
    });
  },

  goTarget() { wx.navigateTo({ url: '/pages/welcome/welcome?mode=edit' }); },

  /* 展开/收起全国招生季详情 */
  toggleSeason(e) {
    const i = e.currentTarget.dataset.index;
    const season = this.data.season.slice();
    if (!season[i]) return;
    season[i] = Object.assign({}, season[i], { open: !season[i].open });
    this.setData({ season });
  }
});
