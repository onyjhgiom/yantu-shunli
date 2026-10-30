/**
 * 番茄钟：预设、专注记录，完成后自动落一条学习记录
 */
const db = require('./db');
const util = require('../utils/util');
const study = require('./study');
const store = require('../utils/store');

const PRESETS = [
  { label: '15 / 5', focus: 15, rest: 5 },
  { label: '25 / 5', focus: 25, rest: 5 },
  { label: '45 / 10', focus: 45, rest: 10 },
  { label: '50 / 10', focus: 50, rest: 10 },
  { label: '90 / 20', focus: 90, rest: 20 }
];

function records() { return db.get(db.KEYS.focusRecords, []); }

function save(list) {
  db.set(db.KEYS.focusRecords, list);
  store.emit(store.TOPICS.FOCUS_CHANGED, list);
}

function add(rec) {
  const item = {
    id: util.uid('fc'),
    date: util.dateStr(),
    subject: rec.subject || 'other',
    minutes: Math.round(rec.minutes || 0),
    taskId: rec.taskId || '',
    taskTitle: rec.taskTitle || '',
    preset: rec.preset || '',
    startAt: rec.startAt || 0,
    endAt: rec.endAt || 0,
    createdAt: Date.now()
  };
  if (item.minutes <= 0) return null;
  const list = records();
  list.unshift(item);
  save(list);
  // 同步写入学习记录（统计统一来源）
  study.add({
    subject: item.subject,
    minutes: item.minutes,
    taskId: item.taskId,
    taskTitle: item.taskTitle,
    type: 'focus',
    startAt: item.startAt,
    endAt: item.endAt
  });
  return item;
}

function todayCount() {
  const d = util.dateStr();
  return records().filter((r) => r.date === d).length;
}

function todayMinutes() {
  const d = util.dateStr();
  return records().filter((r) => r.date === d).reduce((s, r) => s + r.minutes, 0);
}

module.exports = { PRESETS, records, add, todayCount, todayMinutes };
