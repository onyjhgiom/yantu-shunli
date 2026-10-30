/*
 * 首页 —— 长滚动版（改版前的结构）
 *
 * 结构从上到下：问候 → 目标引导 → 倒计时 → 今日学习 → 今日任务
 *              → 今日学习分布 → 今日重点（AI）→ 下一步做什么（智能分析）
 *              → 本周学习 → 今日复盘 → 备考工具（22 项分组宫格）
 *
 * 两条硬约束：
 *   1. 22 项备考工具一个不少（TOOL_GROUPS），新加入口只改这个数组一行
 *   2. 同一界面内不出现重复入口：22 项各自独立，上面的卡片里不再重复摆同一工具的入口
 */
const share = require('../../utils/share');
const profileService = require('../../services/profile');
const targetService = require('../../services/target');
const taskService = require('../../services/task');
const studyService = require('../../services/study');
const statisticsService = require('../../services/statistics');
const aiService = require('../../services/ai');
const examService = require('../../services/exam');
const mistakeService = require('../../services/mistake');
const cardService = require('../../services/card');
const insightService = require('../../services/insight');
const notifyService = require('../../services/notify');
const wordService = require('../../services/word');
const noteService = require('../../services/note');
const quizService = require('../../services/quiz');
const theme = require('../../utils/theme');
const util = require('../../utils/util');
const store = require('../../utils/store');
const voice = require('../../utils/voice');

const themeStore = require('../../utils/theme');
const GOAL_MINUTES = 240; // 每日目标 4 小时

/*
 * 头部下方的快捷动作：把「开始做某件事」压到一次点击。
 * 与备考工具宫格的分工 —— 这里放「动作」，宫格放「翻阅/管理」。
 * 硬约束：**动作的目标页不能和 22 项工具重复**，否则同一界面出现两个入口
 * （校验脚本 mp-duplicate-entry-lint.js 会把这类重复标成 ❌）。
 * 因此这里只放工具宫格里没有的 4 个：专注页 / 学习记录（tab）/ 新建任务 / 知识点树。
 */
const ACTIONS = [
  { key: 'focus', icon: '◔', name: '开始专注', url: '/pages/focus/focus' },
  { key: 'log', icon: '＋', name: '记一笔', url: '/pages/study/study', tab: true },
  { key: 'add', icon: '✓', name: '加任务', url: '/pages/task-edit/task-edit' },
  { key: 'kp', icon: '◈', name: '知识点', url: '/pages/subject/subject' }
];

/*
 * 备考工具 22 项 —— 数据驱动分组宫格。
 * badgeKey 对应 load() 里算好的角标，取不到就是 0（_safe 兜底），不显示。
 * tab 为 true 的走 switchTab（tabBar 页用 navigateTo 会静默失败）。
 */
const TOOL_GROUPS = [
  {
    title: '学习工具',
    items: [
      { icon: '✕', label: '错题本', url: '/pages/mistake/mistake', badgeKey: 'mistakeDue' },
      { icon: '▦', label: '卡片复习', url: '/pages/card/card', badgeKey: 'cardDue' },
      { icon: 'A', label: '背单词', url: '/pages/word/word', badgeKey: 'wordDue' },
      { icon: '✎', label: '刷题', url: '/pages/quiz/quiz', badgeKey: 'quizCount' },
      { icon: '✍️', label: '笔记', url: '/pages/notes/notes', badgeKey: 'noteCount' },
      { icon: '◫', label: '模考分析', url: '/pages/exam/exam', badgeKey: 'examCount' },
      { icon: '▨', label: '学习统计', url: '/pages/statistics/statistics' },
      { icon: '🧰', label: '工具中心', url: '/pages/tools/tools' }
    ]
  },
  {
    title: '目标与规划',
    items: [
      { icon: '◎', label: '我的目标', url: '/pages/welcome/welcome?mode=edit' },
      { icon: '☰', label: '我的计划', url: '/pages/plan/plan', tab: true },
      { icon: '✎', label: '每日复盘', url: '/pages/review/review' },
      { icon: '✺', label: 'AI 规划', url: '/pages/plan-ai/plan-ai' },
      { icon: '✦', label: 'AI 助手', url: '/pages/ai/ai' },
      { icon: '◷', label: '考研日历', url: '/pages/timeline/timeline' }
    ]
  },
  {
    title: '资源与资讯',
    items: [
      { icon: '◈', label: '备考资源', url: '/pages/resource/resource' },
      { icon: '▤', label: '资料笔记', url: '/pages/materials/materials', tab: true },
      { icon: '📰', label: '考研资讯', url: '/pages/news/news' },
      { icon: '⊞', label: '院校库', url: '/pages/school/school' }
    ]
  },
  {
    title: '状态与设置',
    items: [
      { icon: '♡', label: '心态记录', url: '/pages/mood/mood' },
      { icon: '★', label: '打卡成就', url: '/pages/achievement/achievement' },
      { icon: '🔔', label: '消息通知', url: '/pages/notify/notify', badgeKey: 'notifyUnread' },
      { icon: '⚙', label: '偏好设置', url: '/pages/settings/settings' }
    ]
  }
];

/*
 * 头部四个指标。点击后带 scope 跳到「学习统计」，直接落在对应范围上：
 *   今日 → 只看今天   本周 → 本周汇总   连续 → 全部（连续天数是全局口径）
 *   专注 → 本月（专注次数按区间统计，本月视角最有参照意义）
 * 四个 url 互不相同，既不和快捷动作带 / 22 项工具宫格撞车，
 * 同屏里也不出现第二个「学习统计」入口。
 */
function buildMetrics(todayMinutes, overview) {
  return [
    { key: 'today', label: '今日', value: util.fmtMinutes(todayMinutes), url: '/pages/statistics/statistics?scope=today' },
    { key: 'week', label: '本周', value: util.fmtMinutes(overview.week), url: '/pages/statistics/statistics?scope=week' },
    { key: 'streak', label: '连续', value: `${overview.streak} 天`, url: '/pages/statistics/statistics?scope=all' },
    { key: 'focus', label: '专注', value: `${overview.todayFocusCount} 次`, url: '/pages/statistics/statistics?scope=month' }
  ];
}

/** 按当前角标生成工具带数据；badges 为空时结构照样完整，只是不显示角标 */
function buildToolGroups(badges) {
  return TOOL_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.map((it) => Object.assign({}, it, { badge: badges[it.badgeKey] || 0 }))
  }));
}

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/index/index'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/index/index'); },

  data: {
    themeCls: '',
    greeting: '',
    dateText: '',
    phaseText: '',
    configured: false,
    countdown: null,
    target: null,
    /* 头部驾驶舱 */
    targetLine: '',
    scoreText: '',
    milestones: [],
    /* 快捷动作 */
    actions: ACTIONS,
    progress: { done: 0, total: 0 },
    taskPercent: 0,
    goalText: '4h',
    goalPercent: 0,
    /* 头部四指标：每项可点，直达「学习统计」的对应范围（scope 由 statistics 页消费） */
    metrics: [],
    tasks: [],
    hiddenCount: 0,
    /* 今日计划：快速添加 + 语音输入 */
    quickText: '',
    quickRec: false,
    quickRecSec: 0,
    quickAdding: false,
    subjectBars: [],
    advice: { enabled: true, summary: '', priorities: [], tips: [] },
    reviewDone: false,
    // 角标（第二段渲染补齐，取不到就是 0）
    examCount: 0,
    mistakeDue: 0,
    cardDue: 0,
    wordDue: 0,
    notifyUnread: 0,
    quizCount: 0,
    noteCount: 0,
    // 智能分析
    recommends: [],
    rhythmText: '',
    rhythmEnough: false,
    riskCount: 0,
    topRisk: null,
    // 备考工具分组宫格
    toolGroups: []
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
    this._unsubs = [];
    ['TASK_CHANGED', 'TARGET_CHANGED', 'STUDY_CHANGED', 'PROFILE_CHANGED', 'FOCUS_CHANGED']
      .forEach((k) => this._unsubs.push(store.subscribe(store.TOPICS[k], () => this.load())));
  },

  onShow() { this._applyTheme(); this.load(); },

  /* 环形进度要等布局完成才有尺寸，放 onReady */
  onReady() { this._drawRing(); },

  onUnload() {
    (this._unsubs || []).forEach((fn) => fn());
    if (this._t) clearTimeout(this._t);
    if (this._recTimer) clearInterval(this._recTimer);
    if (voice.isRecording()) voice.cancel();
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  },

  load() {
    const today = util.dateStr();
    const profile = profileService.getProfile();
    const configured = targetService.isSet();
    const countdown = targetService.countdown();
    const target = targetService.getTarget();

    const all = taskService.today();
    const withChild = all.map((t) => Object.assign({}, t, { childCount: taskService.children(t.id).length }));
    const done = withChild.filter((t) => t.status === 'done').length;

    const todayMinutes = studyService.todayMinutes();
    const bySubject = studyService.subjectMinutesOn(today);
    const maxMin = Math.max(1, ...theme.SUBJECTS.map((s) => bySubject[s.key] || 0));
    const subjectBars = theme.SUBJECTS.map((s) => {
      const m = bySubject[s.key] || 0;
      return { key: s.key, name: s.name, color: s.color, minutes: m, text: util.fmtMinutes(m), percent: m ? Math.max(6, Math.round((m / maxMin) * 100)) : 0 };
    });

    const overview = statisticsService.overview();
    const d = new Date();
    const phaseMap = { unset: '尚未设定目标', prepare: '备考中', sprint: '冲刺期', retest: '复试准备期' };

    /* ---- 第一段：先把结构刷出来（驾驶舱 / 任务 / 分布） ---- */
    this.setData({
      // 实时按当前昵称重算，避免 App 里那份一次性缓存不跟随改名
      greeting: profileService.greeting(profile.name),
      dateText: `${d.getMonth() + 1}月${d.getDate()}日 · 周${util.weekdayCN(d)}`,
      phaseText: phaseMap[targetService.phase()] || '备考中',
      configured,
      countdown,
      target,
      targetLine: target && target.university
        ? `${target.university}${target.major ? ' · ' + target.major : ''}`
        : '尚未设定目标院校',
      scoreText: target && target.totalScore ? `目标 ${target.totalScore} 分` : '',
      milestones: (countdown && countdown.milestones) || [],
      progress: { done, total: withChild.length },
      taskPercent: withChild.length ? Math.round((done / withChild.length) * 100) : 0,
      goalText: util.fmtMinutes(GOAL_MINUTES),
      goalPercent: Math.min(100, Math.round((todayMinutes / GOAL_MINUTES) * 100)),
      /* 展示今日全部任务：去掉原先 slice(0,5) 截断，避免「添加后首页看不到」 */
      tasks: withChild,
      hiddenCount: 0,
      subjectBars,
      metrics: buildMetrics(todayMinutes, overview),
      reviewDone: this._hasReview(today),
      // 工具宫格先按无角标渲染，下一帧再补数字，首屏不空
      toolGroups: buildToolGroups({})
    });

    // 数据刷新后环形进度要跟着重画（onReady 只跑一次）
    this._drawRing();

    /* ---- 第二段：智能分析与角标下一帧补，不阻塞首屏 ---- */
    const secondary = {
      advice: this._safe(() => aiService.advice(), { enabled: true, summary: '', priorities: [], tips: [] }),
      recommends: this._safe(() => insightService.recommendations(4), []),
      rhythmText: this._safe(() => {
        const rh = insightService.rhythm();
        return rh.enough ? `高效时段：${rh.bestText}` : '';
      }, ''),
      rhythmEnough: this._safe(() => insightService.rhythm().enough, false),
      riskCount: this._safe(() => insightService.risks().length, 0),
      topRisk: this._safe(() => insightService.risks()[0] || null, null),
      examCount: this._safe(() => examService.all().length, 0),
      mistakeDue: this._safe(() => mistakeService.dueCount(), 0),
      cardDue: this._safe(() => cardService.dueQueue(null).length, 0),
      wordDue: this._safe(() => {
        const p = wordService.todayPlan('all');
        return (p.newCount || 0) + (p.reviewCount || 0);
      }, 0),
      notifyUnread: this._safe(() => notifyService.unreadCount(), 0),
      quizCount: this._safe(() => quizService.records().length, 0),
      noteCount: this._safe(() => noteService.notes().length, 0)
    };
    secondary.toolGroups = buildToolGroups(secondary);
    this._setSecondary(secondary);
  },

  /* 任何一个模块取不到数都不能让整屏挂掉，统一兜底 */
  _safe(fn, def) {
    try {
      const v = fn();
      return v === undefined || v === null ? def : v;
    } catch (e) {
      return def;
    }
  },

  _setSecondary(patch) {
    if (this._t) clearTimeout(this._t);
    this._t = setTimeout(() => { this.setData(patch); }, 0);
  },

  /*
   * 头部环形进度（今日目标完成度）—— Canvas 2D 自绘，dpr 适配。
   * 关键：拿不到尺寸（还没布局 / 页面不可见）就直接 return，绝不报错。
   */
  _drawRing() {
    // 非页面环境（自检脚本等）没有这个方法，直接跳过，不影响数据渲染
    if (typeof this.createSelectorQuery !== 'function') return;
    this.createSelectorQuery()
      .select('#ring')
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node || !info.width) return;
        const dpr = (wx.getSystemInfoSync && wx.getSystemInfoSync().pixelRatio) || 2;
        const size = info.width;
        const canvas = info.node;
        // Canvas 只能吃真值：取当前主题的调色板（圆形轨道位于深色驾驶舱上，故用 onDark 系）
        const T = themeStore.palette();
        const ctx = canvas.getContext('2d');
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, size, size);

        const cx = size / 2;
        const cy = size / 2;
        const r = size / 2 - 6;
        const permille = Math.max(0, Math.min(100, this.data.goalPercent || 0)) / 100;

        // 轨道
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.strokeStyle = T.onDarkLine;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // 进度（从 12 点方向顺时针）
        if (permille > 0) {
          ctx.strokeStyle = T.forestDeep;
          ctx.beginPath();
          ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * permille);
          ctx.stroke();
        }

        // 圆心：百分比 + 今日时长
        ctx.textAlign = 'center';
        ctx.fillStyle = T.onDark;
        ctx.font = '600 15px sans-serif';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`${this.data.goalPercent || 0}%`, cx, cy + 2);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = T.onDarkDim;
        ctx.fillText('今日目标', cx, cy + 16);
      });
  },

  /** 统一跳转：tab 标记由数据决定，navigateTo 跳 tabBar 页会静默失败 */
  _nav(url, tab) {
    if (!url) return;
    if (tab) wx.switchTab({ url });
    else wx.navigateTo({ url });
  },

  /** 快捷动作带（专注 / 记一笔 / 加任务 / 问 AI） */
  onAction(e) {
    this._nav(e.currentTarget.dataset.url, e.currentTarget.dataset.tab);
  },

  /** 备考工具宫格统一跳转：新增入口只改顶部 TOOL_GROUPS，不用再写方法 */
  onToolTap(e) {
    this._nav(e.currentTarget.dataset.url, e.currentTarget.dataset.tab);
  },

  /** 头部四指标 → 学习统计（url 自带 scope，statistics 页会读它定范围） */
  onMetric(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url });
  },

  /** 智能推荐卡点击：按 action 路由 */
  onRecommend(e) {
    const action = e.currentTarget.dataset.action || '';
    if (action.indexOf('subject:') === 0) {
      wx.navigateTo({ url: `/pages/subject/subject?key=${action.slice(8)}` });
      return;
    }
    if (action.indexOf('resource') === 0) { wx.navigateTo({ url: '/pages/resource/resource' }); return; }
    const map = {
      plan: '/pages/plan/plan',
      mistake: '/pages/mistake/mistake',
      card: '/pages/card/card',
      focus: '/pages/focus/focus'
    };
    const url = map[action];
    if (!url) return;
    if (action === 'plan') wx.switchTab({ url });
    else wx.navigateTo({ url });
  },

  _hasReview(date) {
    try {
      const reviews = wx.getStorageSync('yt_reviews') || [];
      return reviews.some((r) => r.date === date);
    } catch (e) { return false; }
  },

  onTaskToggle(e) {
    const t = e.detail.task;
    taskService.toggle(t.id);
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  onTaskTap(e) {
    wx.navigateTo({ url: `/pages/task-edit/task-edit?id=${e.detail.task.id}` });
  },

  addTask() {
    wx.navigateTo({ url: '/pages/task-edit/task-edit?date=' + util.dateStr() });
  },

  /* ===== 今日计划：快速添加（支持语音输入，转写结果落到输入框后仍可编辑） ===== */
  onQuickInput(e) { this.setData({ quickText: e.detail.value }); },

  onQuickMic() {
    if (this.data.quickRec) { voice.stop(); return; }   // 再次点击 = 结束并转写
    voice.capture({
      onStart: () => {
        this.setData({ quickRec: true, quickRecSec: 0 });
        if (this._recTimer) clearInterval(this._recTimer);
        this._recTimer = setInterval(() => {
          const sec = Math.floor(voice.elapsed() / 1000);
          if (sec >= 60) { voice.stop(); return; }
          this.setData({ quickRecSec: sec });
        }, 200);
      },
      onText: (t) => this.setData({ quickText: t }),
      onError: (m) => wx.showToast({ title: String(m).split('\n')[0], icon: 'none', duration: 2500 }),
      onEnd: () => {
        if (this._recTimer) clearInterval(this._recTimer);
        this._recTimer = null;
        this.setData({ quickRec: false, quickRecSec: 0 });
      }
    });
  },

  cancelQuickVoice() { voice.cancel(); },

  addQuick() {
    if (this.data.quickAdding) return;
    const title = (this.data.quickText || '').trim();
    if (!title) { wx.showToast({ title: '先说或写一项任务', icon: 'none' }); return; }
    this.setData({ quickAdding: true });
    try {
      taskService.add({ title: title, date: util.dateStr(), subject: 'other', priority: 'mid', planType: 'day' });
      this.setData({ quickText: '', quickAdding: false });
      wx.vibrateShort && wx.vibrateShort({ type: 'light' });
      wx.showToast({ title: '已加入今日计划', icon: 'success' });
    } catch (err) {
      this.setData({ quickAdding: false });
      wx.showToast({ title: (err && err.message) || '添加失败', icon: 'none' });
    }
  },

  goPlan() { wx.switchTab({ url: '/pages/plan/plan' }); },
  goReview() { wx.navigateTo({ url: '/pages/review/review' }); },
  goAi() { wx.navigateTo({ url: '/pages/ai/ai' }); },
  goTarget() { wx.navigateTo({ url: '/pages/welcome/welcome?mode=edit' }); }

  /*
   * 以下目的地全部由 TOOL_GROUPS 统一承载（onToolTap），这里不再各写一个方法：
   *   院校库 / 模考分析 / 错题本 / 卡片复习 / 背单词 / 刷题 / 笔记 / 学习统计 /
   *   工具中心 / 我的计划 / 每日复盘 / AI 规划 / AI 助手 / 考研日历 / 备考资源 /
   *   资料笔记 / 考研资讯 / 心态记录 / 打卡成就 / 消息通知 / 偏好设置
   * 新增或修改入口请改顶部 TOOL_GROUPS，不要把方法再写回来（否则同一入口两处维护）。
   */
});
