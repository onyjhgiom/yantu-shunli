/**
 * 打卡成就 / 补签 / 请假
 *
 * 徽章由真实统计数据派生，并带**分组、阈值、图标与进度**，
 * 让页面能展示「还差多少」而不只是「有没有」——成就感来自可见的进度条。
 * 补签卡每月 2 张、请假每月最多 3 天（本地记录，仅用于自我激励）。
 */
const statisticsService = require('./statistics');
const focusService = require('./focus');
const taskService = require('./task');
const mistakeService = require('./mistake');
const examService = require('./exam');
const db = require('./db');

/* 分组定义：顺序即页面展示顺序 */
const GROUPS = [
  { key: 'streak', name: '坚持', desc: '连续学习，越久越稳' },
  { key: 'focus', name: '专注', desc: '心无旁骛的投入' },
  { key: 'task', name: '任务', desc: '一件件做出来的积累' },
  { key: 'mastery', name: '精进', desc: '把薄弱变成 strengths' }
];

/**
 * 徽章定义。
 * metric 决定 current 从哪来；target 为阈值；unit 仅用于展示。
 * icon 用无需资源的字符，保证零图片依赖、加载最快。
 */
const BADGES = [
  { key: 'streak7', group: 'streak', icon: '🔥', name: '七日不间断', desc: '连续学习 7 天', metric: 'streak', target: 7, unit: '天' },
  { key: 'streak30', group: 'streak', icon: '🌱', name: '月度坚持', desc: '连续学习 30 天', metric: 'streak', target: 30, unit: '天' },
  { key: 'streak100', group: 'streak', icon: '⛰', name: '百日筑基', desc: '连续学习 100 天', metric: 'streak', target: 100, unit: '天' },

  { key: 'focus100', group: 'focus', icon: '⏳', name: '专注百时', desc: '累计专注 100 小时', metric: 'focus', target: 100, unit: '小时' },
  { key: 'focus500', group: 'focus', icon: '⚔', name: '专注五百', desc: '累计专注 500 小时', metric: 'focus', target: 500, unit: '小时' },
  { key: 'focus1000', group: 'focus', icon: '👑', name: '千时磨剑', desc: '累计专注 1000 小时', metric: 'focus', target: 1000, unit: '小时' },

  { key: 'task100', group: 'task', icon: '✓', name: '百项达成', desc: '累计完成任务 100 项', metric: 'task', target: 100, unit: '项' },
  { key: 'task500', group: 'task', icon: '★', name: '五百项达成', desc: '累计完成任务 500 项', metric: 'task', target: 500, unit: '项' },

  { key: 'mistake0', group: 'mastery', icon: '⊘', name: '错题清零', desc: '无未掌握错题', metric: 'mistake0', target: 1, unit: '' },
  { key: 'examUp', group: 'mastery', icon: '↗', name: '模考进步', desc: '最近一次模考高于上次', metric: 'examUp', target: 1, unit: '' }
];

function focusHours() { return focusService.records().reduce((s, r) => s + r.minutes, 0) / 60; }
function taskDone() { return taskService.all().filter((t) => t.status === 'done').length; }

/** 采集所有徽章依赖的原始指标 */
function metrics() {
  const o = statisticsService.overview();
  const exams = examService.all().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const due = mistakeService.dueCount();
  return {
    streak: o.streak || 0,
    focus: Math.floor(focusHours()),
    task: taskDone(),
    mistake0: (due === 0 && mistakeService.count() > 0) ? 1 : 0,
    examUp: (exams.length >= 2 && exams[0].total > exams[1].total) ? 1 : 0
  };
}

/**
 * 徽章列表（含分组、进度）。
 * current/target/percent 供页面画进度条；percent 封顶 100。
 */
function badges() {
  const m = metrics();
  return BADGES.map((b) => {
    const current = m[b.metric] != null ? m[b.metric] : 0;
    const earned = current >= b.target;
    return Object.assign({}, b, {
      current: current,
      earned: earned,
      percent: Math.max(0, Math.min(100, Math.round((current / b.target) * 100))),
      /* 进度文案：布尔型徽章没有中间态，直接给状态 */
      progressText: b.target <= 1
        ? (earned ? '已达成' : '未达成')
        : current + ' / ' + b.target + ' ' + b.unit
    });
  });
}

/** 页面顶部总览：连续天数、累计时长、已解锁数、最近的目标 */
function overview() {
  const list = badges();
  const m = metrics();
  const earned = list.filter((b) => b.earned).length;
  // 「下一个目标」= 未解锁里完成度最高、且完成度 > 0 的那枚；没有则挑最接近的第一枚
  const pending = list.filter((b) => !b.earned);
  const next = pending.filter((b) => b.percent > 0).sort((a, b) => b.percent - a.percent)[0]
    || pending.slice().sort((a, b) => b.percent - a.percent)[0] || null;
  return {
    streak: m.streak,
    focusHours: m.focus,
    taskDone: m.task,
    total: list.length,
    earned: earned,
    next: next
  };
}

function groupBadges() {
  const list = badges();
  return GROUPS.map((g) => Object.assign({}, g, {
    items: list.filter((b) => b.group === g.key),
    earnedCount: list.filter((b) => b.group === g.key && b.earned).length
  })).filter((g) => g.items.length);
}

/** 补签卡 / 请假状态（每月重置） */
function makeupState() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const m = db.get(db.KEYS.makeup, {});
  if (m.month !== monthKey) { m.month = monthKey; m.cards = 2; m.leaveUsed = 0; db.set(db.KEYS.makeup, m); }
  return { cards: m.cards || 0, leaveUsed: m.leaveUsed || 0, leaveMax: 3 };
}

function useMakeup() {
  const s = makeupState();
  if (s.cards <= 0) return false;
  const m = db.get(db.KEYS.makeup, {});
  m.cards -= 1;
  db.set(db.KEYS.makeup, m);
  return true;
}

function useLeave() {
  const s = makeupState();
  if (s.leaveUsed >= 3) return false;
  const m = db.get(db.KEYS.makeup, {});
  m.leaveUsed += 1;
  db.set(db.KEYS.makeup, m);
  return true;
}

module.exports = {
  GROUPS, BADGES, badges, groupBadges, overview, metrics,
  makeupState, useMakeup, useLeave, focusHours, taskDone
};
