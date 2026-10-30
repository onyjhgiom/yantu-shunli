/**
 * 学习记录：时长来源（番茄钟 / 手动 / 复盘），所有统计的基础
 */
const db = require('./db');
const util = require('../utils/util');
const store = require('../utils/store');

function all() { return db.get(db.KEYS.studyRecords, []); }

function save(list) {
  db.set(db.KEYS.studyRecords, list);
  store.emit(store.TOPICS.STUDY_CHANGED, list);
}

function add(rec) {
  const item = {
    id: util.uid('sr'),
    date: rec.date || util.dateStr(),
    subject: rec.subject || 'other',
    minutes: Math.max(0, Math.round(rec.minutes || 0)),
    taskId: rec.taskId || '',
    taskTitle: rec.taskTitle || '',
    type: rec.type || 'manual',
    startAt: rec.startAt || 0,
    endAt: rec.endAt || 0,
    createdAt: Date.now()
  };
  const list = all();
  list.unshift(item);
  save(list);
  return item;
}

function byDate(date) { return all().filter((r) => r.date === date); }

function minutesOn(date) { return byDate(date).reduce((s, r) => s + r.minutes, 0); }

function todayMinutes() { return minutesOn(util.dateStr()); }

function subjectMinutesOn(date) {
  const m = { politics: 0, english: 0, math: 0, major: 0, other: 0 };
  byDate(date).forEach((r) => { m[r.subject] = (m[r.subject] || 0) + r.minutes; });
  return m;
}

function subjectTotals() {
  const m = {};
  all().forEach((r) => { m[r.subject] = (m[r.subject] || 0) + r.minutes; });
  return m;
}

function minutesBetween(start, end) {
  return all().filter((r) => r.date >= start && r.date <= end).reduce((s, r) => s + r.minutes, 0);
}

/** 最近 n 天序列（含今天），供折线图使用 */
function recentDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = util.dateStr(util.addDays(util.dateStr(), -i));
    out.push({ date: d, minutes: minutesOn(d) });
  }
  return out;
}

module.exports = {
  all, add, byDate, minutesOn, todayMinutes,
  subjectMinutesOn, subjectTotals, minutesBetween, recentDays
};
