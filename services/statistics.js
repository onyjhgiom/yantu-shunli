/**
 * 学习统计：概览、连续学习、热力图、序列
 */
const util = require('../utils/util');
const study = require('./study');
const task = require('./task');
const focus = require('./focus');

function levelOf(m) {
  if (!m) return 0;
  if (m < 60) return 1;
  if (m < 180) return 2;
  if (m < 300) return 3;
  return 4;
}

function dateMap() {
  const map = {};
  study.all().forEach((r) => { map[r.date] = (map[r.date] || 0) + r.minutes; });
  return map;
}

function streak() {
  const map = dateMap();
  let d = util.dateStr();
  if (!map[d]) d = util.dateStr(util.addDays(d, -1)); // 今天还没学，从昨天算
  let s = 0;
  while (map[d] && map[d] > 0) {
    s += 1;
    d = util.dateStr(util.addDays(d, -1));
  }
  return s;
}

/** GitHub 式热力图：按周列返回 */
function heatmap(weeks) {
  const w = weeks || 14;
  const map = dateMap();
  const start = util.startOfWeek(util.addDays(util.dateStr(), -(w - 1) * 7));
  const cols = [];
  for (let i = 0; i < w; i++) {
    const col = [];
    for (let j = 0; j < 7; j++) {
      const d = util.dateStr(util.addDays(start, i * 7 + j));
      const m = map[d] || 0;
      col.push({ date: d, minutes: m, level: levelOf(m) });
    }
    cols.push(col);
  }
  return { cols, startDate: util.dateStr(start) };
}

function overview() {
  const today = util.dateStr();
  const weekStart = util.dateStr(util.startOfWeek(today));
  const monthStart = today.slice(0, 8) + '01';
  const totals = study.subjectTotals();
  const totalMinutes = Object.keys(totals).reduce((s, k) => s + totals[k], 0);
  const dayMap = dateMap();
  const studyDays = Object.keys(dayMap).length;
  const c = task.completion();
  return {
    today: study.todayMinutes(),
    week: study.minutesBetween(weekStart, today),
    month: study.minutesBetween(monthStart, today),
    total: totalMinutes,
    avgDaily: studyDays ? Math.round(totalMinutes / studyDays) : 0,
    studyDays,
    completionRate: c.rate,
    completionTotal: c.total,
    completionDone: c.done,
    focusCount: focus.records().length,
    todayFocusCount: focus.todayCount(),
    streak: streak(),
    subjectTotals: totals
  };
}

/** 指定区间统计（用于周报） */
function range(startDate, endDate) {
  const minutes = study.minutesBetween(startDate, endDate);
  const perSubject = {};
  study.all().filter((r) => r.date >= startDate && r.date <= endDate)
    .forEach((r) => { perSubject[r.subject] = (perSubject[r.subject] || 0) + r.minutes; });
  const c = task.completion(startDate, endDate);
  return { startDate, endDate, minutes, perSubject, completion: c };
}

module.exports = { levelOf, streak, heatmap, overview, range, dateMap };
