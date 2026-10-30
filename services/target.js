/**
 * 考研目标系统：目标院校 / 专业 / 各科目标分 / 考试日期与倒计时
 */
const db = require('./db');
const util = require('../utils/util');
const store = require('../utils/store');

const DEFAULT_SCORES = { politics: 70, english: 75, math: 125, major: 125 };

function getTarget() { return db.get(db.KEYS.target, null); }

function isSet() { const t = getTarget(); return !!(t && t.university && t.major); }

function setTarget(data) {
  const prev = getTarget() || {};
  const scores = Object.assign({}, DEFAULT_SCORES, prev.scores || {}, data.scores || {});
  const sum = scores.politics + scores.english + scores.math + scores.major;
  const t = Object.assign({}, prev, data, {
    scores,
    totalScore: data.totalScore != null ? data.totalScore : sum,
    createdAt: prev.createdAt || Date.now(),
    updatedAt: Date.now()
  });
  db.set(db.KEYS.target, t);
  store.emit(store.TOPICS.TARGET_CHANGED, t);
  return t;
}

function clearTarget() {
  db.remove(db.KEYS.target);
  store.emit(store.TOPICS.TARGET_CHANGED, null);
}

/** 倒计时 + 关键节点 */
function countdown() {
  const t = getTarget();
  if (!t || !t.examDate) return null;
  const today = util.dateStr();
  const defs = [
    { key: 'signDate', label: '网上报名' },
    { key: 'confirmDate', label: '现场确认' },
    { key: 'examDate', label: '初试' },
    { key: 'retestDate', label: '复试' }
  ];
  const milestones = defs
    .filter((d) => t[d.key])
    .map((d) => ({ label: d.label, date: t[d.key], days: util.daysBetween(today, t[d.key]) }));
  return {
    totalDays: util.daysBetween(today, t.examDate),
    examYear: t.examYear,
    examDate: t.examDate,
    milestones
  };
}

/** 距离初试是否已过 -> 切换到复试态 */
function phase() {
  const c = countdown();
  if (!c) return 'unset';
  if (c.totalDays < 0) return 'retest';
  if (c.totalDays <= 30) return 'sprint';
  return 'prepare';
}

module.exports = { DEFAULT_SCORES, getTarget, isSet, setTarget, clearTarget, countdown, phase };
