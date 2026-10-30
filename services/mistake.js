/**
 * 错题本：录入、错因标签、SRS 复习队列、统计
 * 本地存储为真源；与 PRD F10 对齐（图片走可选，本版仅文字/解析）
 */
const db = require('./db');
const util = require('../utils/util');
const store = require('../utils/store');
const srs = require('../utils/srs');
const targetService = require('./target');

const REASONS = [
  { key: 'concept', label: '概念不清' },
  { key: 'formula', label: '公式遗忘' },
  { key: 'calc', label: '计算失误' },
  { key: 'misread', label: '审题错误' },
  { key: 'idea', label: '思路不会' },
  { key: 'time', label: '时间不足' },
  { key: 'careless', label: '粗心' }
];

function daysToExam() {
  const c = targetService.countdown();
  return c ? Math.max(0, c.totalDays) : 999;
}

function all() { return db.get(db.KEYS.wrongQuestions, []); }
function save(list) { db.set(db.KEYS.wrongQuestions, list); store.emit(store.TOPICS.MISTAKE_CHANGED, list); }

function add(data) {
  const item = Object.assign({
    id: util.uid('wq'),
    subject: 'other',
    chapterId: '',
    chapterName: '',
    source: '',
    questionText: '',
    options: [],        // 拍照识题或刷题同步带来的选项数组
    images: [],         // 原题图片（fileID/临时路径）
    myAnswer: '',
    rightAnswer: '',
    analysis: '',
    reasons: [],
    difficulty: 3,
    srs: { ef: 2.5, interval: 0, reps: 0, lapses: 0, dueDate: util.dateStr() },
    createdAtDate: util.dateStr(),
    createdAt: Date.now(),
    masteredAt: 0
  }, data);
  if (!item.questionText && !item.rightAnswer) throw new Error('请至少填写题目或正确答案');
  const list = all();
  list.unshift(item);
  save(list);
  return item;
}

function get(id) { return all().find((m) => m.id === id) || null; }

function update(id, patch) {
  const list = all();
  const i = list.findIndex((m) => m.id === id);
  if (i < 0) return null;
  list[i] = Object.assign({}, list[i], patch, { updatedAt: Date.now() });
  save(list);
  return list[i];
}

function remove(id) { save(all().filter((m) => m.id !== id)); }

/** 复习提交：评分 -> 更新 SRS（含考前压缩）；连续达标标记掌握 */
function reviewSubmit(id, q) {
  const m = get(id);
  if (!m) return null;
  const r = srs.review(m, q, util.dateStr(), daysToExam());
  const patch = { srs: r };
  if (q >= 3 && r.interval >= 21 && (m.srs.reps || 0) >= 2) patch.masteredAt = Date.now();
  return update(id, patch);
}

/** 今日待复习队列：优先 lapses 高、到期最久 */
function dueQueue(limit) {
  const today = util.dateStr();
  const list = all().filter((m) => srs.isDue(m, today))
    .sort((a, b) => {
      const la = (a.srs && a.srs.lapses) || 0;
      const lb = (b.srs && b.srs.lapses) || 0;
      if (lb !== la) return lb - la;
      const da = (a.srs && a.srs.dueDate) || '';
      const db2 = (b.srs && b.srs.dueDate) || '';
      return da < db2 ? -1 : 1;
    });
  return limit ? list.slice(0, limit) : list;
}

function count() { return all().length; }
function dueCount() { return dueQueue().length; }

function stats() {
  const list = all();
  const bySubject = {};
  const byReason = {};
  let mastered = 0;
  list.forEach((m) => {
    bySubject[m.subject] = (bySubject[m.subject] || 0) + 1;
    if (m.masteredAt) mastered += 1;
    (m.reasons || []).forEach((r) => { byReason[r] = (byReason[r] || 0) + 1; });
  });
  return { total: list.length, mastered, bySubject, byReason };
}

module.exports = { REASONS, all, add, get, update, remove, reviewSubmit, dueQueue, dueCount, count, stats };
