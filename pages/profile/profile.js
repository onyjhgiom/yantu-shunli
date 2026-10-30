const share = require('../../utils/share');
const profileService = require('../../services/profile');
const targetService = require('../../services/target');
const statisticsService = require('../../services/statistics');
const subjectService = require('../../services/subject');
const studyService = require('../../services/study');
const noteService = require('../../services/note');
const mistakeService = require('../../services/mistake');
const cardService = require('../../services/card');
const examService = require('../../services/exam');
const quizService = require('../../services/quiz');
const wordService = require('../../services/word');
const resources = require('../../services/resources');
/* news 是大模块，改由 buildFavRows 内惰性 require：即使它加载失败也只少一个角标，不会整页白屏 */
const notifyService = require('../../services/notify');
const db = require('../../services/db');
const util = require('../../utils/util');
const theme = require('../../utils/theme');

const themeStore = require('../../utils/theme');
/**
 * 「我的」= 个人中心：身份 / 目标 / 数据 / 我的学习 / 收藏 / 通用设置。
 * 与首页「备考工具」宫格、工具中心做分层，不再重复罗列同一批工具入口。
 */

/* 任何一项统计取不到都不能让页面白屏，统一兜底为 0 */
function safe(fn, def) {
  try {
    const v = fn();
    return v === undefined || v === null ? def : v;
  } catch (e) {
    return def;
  }
}

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/profile/profile'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/profile/profile'); },

  data: {
    themeCls: '',
    name: '',
    avatarChar: '',
    targetLine: '',
    countdown: null,
    countdownText: '',
    settings: {},
    stats: { totalText: '0m', studyDays: 0, streak: 0 },
    weekText: '0m',
    goal: { school: '', major: '', codeText: '', score: 0 },
    subjects: [],
    learnRows: [],
    favRows: [],
    moreRows: [],
    version: '1.0.0'
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
    const app = getApp();
    const p = profileService.getProfile();
    const t = targetService.getTarget() || {};
    const o = statisticsService.overview();

    const targetLine = t.university
      ? `${t.examYear || ''} 考研 · ${t.university} · ${t.major || ''}`.replace(/^\s*·\s*/, '')
      : '尚未设定目标院校与专业';

    /* 目标卡 */
    const goal = {
      school: t.university || '',
      major: t.major || '',
      codeText: t.code ? t.code + '（' + (t.code === '11408' ? '数一英一 408' : '数二英二 408') + '）' : '未设置',
      score: Number(t.totalScore || 0)
    };

    /* 科目进度 */
    const subjects = safe(() => subjectService.overview(), []).map((s) => ({
      key: s.key,
      name: s.name,
      color: s.color,
      mastery: s.mastery || 0,
      timeText: util.fmtMinutes(s.totalMinutes || 0)
    }));

    /* 本周累计时长 */
    const weekMinutes = safe(() => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return studyService.all()
        .filter((r) => r.startAt && r.startAt >= start.getTime())
        .reduce((sum, r) => sum + (r.minutes || 0), 0);
    }, 0);

    const countdown = safe(() => targetService.countdown(), null);

    this.setData({
      name: p.name,
      avatarChar: (p.name || '研').slice(0, 1),
      background: profileService.getBackground(),
      targetLine,
      countdown,
      countdownText: countdown && countdown.totalDays != null
        ? `距初试还有 ${countdown.totalDays} 天` : '',
      goal,
      settings: profileService.getSettings(),
      weekText: util.fmtMinutes(weekMinutes),
      stats: { totalText: util.fmtMinutes(o.total), studyDays: o.studyDays, streak: o.streak },
      subjects,
      learnRows: this.buildLearnRows(),
      favRows: this.buildFavRows(),
      moreRows: this.buildMoreRows(),
      version: (app && app.globalData && app.globalData.version) || '1.0.0'
    });
  },

  buildLearnRows() {
    /* 学习计划 / 每日复盘 / 资料笔记 已在顶部宫格，这里不重复罗列 */
    return [
      {
        icon: '✎', name: '错题本', desc: '待复习错题', url: '/pages/mistake/mistake',
        badge: safe(() => mistakeService.dueCount(), 0)
      },
      {
        icon: '▦', name: '卡片复习', desc: '到期记忆卡', url: '/pages/card/card',
        badge: safe(() => cardService.dueQueue(null).length, 0)
      },
      {
        icon: 'A', name: '背单词', desc: '今日待学新词 + 复习', url: '/pages/word/word',
        badge: safe(() => {
          const p = wordService.todayPlan('all');
          return (p.newCount || 0) + (p.reviewCount || 0);
        }, 0)
      },
      {
        icon: '✍️', name: '笔记', desc: '我的全部笔记', url: '/pages/notes/notes',
        badge: safe(() => noteService.notes().length, 0)
      },
      {
        icon: '◫', name: '模考分析', desc: '历史模考与趋势', url: '/pages/exam/exam',
        badge: safe(() => examService.all().length, 0)
      },
      {
        icon: '✎', name: '刷题记录', desc: '答题场次与正确率', url: '/pages/quiz/quiz',
        badge: safe(() => quizService.records().length, 0)
      }
    ];
  },

  buildFavRows() {
    return [
      {
        icon: '◈', name: '备考资源', desc: '收藏的长文资料', url: '/pages/resource/resource',
        badge: safe(() => resources.favs().length, 0)
      },
      {
        icon: '📰', name: '考研资讯', desc: '收藏的政策与经验', url: '/pages/news/news',
        badge: safe(() => require('../../services/news').favs().length, 0)
      },
      { icon: '⊞', name: '院校收藏', desc: '对比与关注院校', url: '/pages/school/school', badge: 0 }
    ];
  },

  buildMoreRows() {
    const unread = safe(() => notifyService.unreadCount(), 0);
    return [
      { icon: '✦', name: 'AI 助手', desc: '随时提问与查看历史', url: '/pages/ai/ai', badge: 0 },
      { icon: '✺', name: 'AI 规划', desc: '生成 / 查看备考方案快照', url: '/pages/plan-ai/plan-ai', badge: 0 },
      { icon: '◷', name: '考研日历', desc: '报名 / 初试 / 出分节点', url: '/pages/timeline/timeline', badge: 0 },
      { icon: '♡', name: '心态记录', desc: '情绪曲线与调节建议', url: '/pages/mood/mood', badge: 0 },
      { icon: '▨', name: '学习统计', desc: '时长 / 分布 / 趋势', url: '/pages/statistics/statistics', badge: 0 },
      { icon: '★', name: '打卡成就', desc: '连续天数与徽章', url: '/pages/achievement/achievement', badge: 0 },
      { icon: '🧰', name: '工具中心', desc: '番茄钟 / 卡片 / 各类工具', url: '/pages/tools/tools', badge: 0 },
      { icon: '🔔', name: '消息通知', desc: unread ? `${unread} 条未读` : '提醒与每日一句', url: '/pages/notify/notify', badge: unread },
      { icon: '⚙', name: '偏好设置', desc: '提醒 / AI / 关于', url: '/pages/settings/settings', badge: 0 }
    ];
  },

  onEntry(e) {
    const url = e.currentTarget.dataset.url;
    const tab = e.currentTarget.dataset.tab;
    if (!url) return;
    if (tab) wx.switchTab({ url });
    else wx.navigateTo({ url });
  },

  onSwitch(e) {
    const key = e.currentTarget.dataset.key;
    profileService.setSettings({ [key]: e.detail.value });
    this.setData({ settings: profileService.getSettings() });
  },

  goTarget() { wx.navigateTo({ url: '/pages/welcome/welcome?mode=edit' }); },
  goBackground() { wx.navigateTo({ url: '/pages/bg-edit/bg-edit' }); },
  goStatistics() { wx.navigateTo({ url: '/pages/statistics/statistics' }); },
  goPlan() { wx.switchTab({ url: '/pages/plan/plan' }); },
  goReview() { wx.navigateTo({ url: '/pages/review/review' }); },
  goMaterials() { wx.switchTab({ url: '/pages/materials/materials' }); },
  goAi() { wx.navigateTo({ url: '/pages/ai/ai' }); },

  exportData() {
    const data = db.dumpAll();
    const json = JSON.stringify({ app: '研途顺利', exportedAt: new Date().toISOString(), data }, null, 2);
    const filePath = `${wx.env.USER_DATA_PATH}/yantu-backup-${util.dateStr()}.json`;
    try {
      wx.getFileSystemManager().writeFileSync(filePath, json, 'utf8');
      wx.shareFileMessage({
        filePath,
        fileName: `研途顺利备份-${util.dateStr()}.json`,
        success: () => {},
        fail: () => {
          wx.setClipboardData({ data: json, success: () => wx.showToast({ title: '已复制到剪贴板', icon: 'none' }) });
        }
      });
    } catch (e) {
      wx.setClipboardData({ data: json, success: () => wx.showToast({ title: '已复制到剪贴板', icon: 'none' }) });
    }
  },

  clearData() {
    wx.showModal({
      title: '清空本地数据',
      content: '将删除全部任务、学习记录、笔记与目标，且不可恢复。建议先导出备份。',
      confirmColor: themeStore.palette().danger,
      success: (res) => {
        if (!res.confirm) return;
        db.clearApp();
        profileService.ensureDefaults();
        wx.showToast({ title: '已重置', icon: 'success' });
        setTimeout(() => wx.reLaunch({ url: '/pages/welcome/welcome' }), 600);
      }
    });
  }
});
