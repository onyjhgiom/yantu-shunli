/**
 * 任务 / Todo 系统（含父子任务、优先级、计划周期、完成与延期）
 */
const db = require('./db');
const util = require('../utils/util');
const store = require('../utils/store');

const PRIORITY_WEIGHT = { urgent: 0, high: 1, mid: 2, low: 3 };

function all() { return db.get(db.KEYS.tasks, []); }

function save(list) {
  db.set(db.KEYS.tasks, list);
  store.emit(store.TOPICS.TASK_CHANGED, list);
}

function sortFn(a, b) {
  const pa = PRIORITY_WEIGHT[a.priority] != null ? PRIORITY_WEIGHT[a.priority] : 2;
  const pb = PRIORITY_WEIGHT[b.priority] != null ? PRIORITY_WEIGHT[b.priority] : 2;
  if (pa !== pb) return pa - pb;
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return b.createdAt - a.createdAt;
}

function add(data) {
  const item = Object.assign({
    id: util.uid('task'),
    title: '',
    description: '',
    subject: 'other',
    priority: 'mid',
    status: 'todo',
    planType: 'day',
    date: util.dateStr(),
    deadline: '',
    estimatedMinutes: 0,
    actualMinutes: 0,
    tags: [],
    parentId: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: 0
  }, data);
  if (!item.title) throw new Error('任务标题不能为空');
  const list = all();
  list.unshift(item);
  save(list);
  return item;
}

function get(id) { return all().find((t) => t.id === id) || null; }

function update(id, patch) {
  const list = all();
  const i = list.findIndex((t) => t.id === id);
  if (i < 0) return null;
  list[i] = Object.assign({}, list[i], patch, { updatedAt: Date.now() });
  save(list);
  return list[i];
}

function remove(id) {
  // 连同子任务一并移除
  const list = all().filter((t) => t.id !== id && t.parentId !== id);
  save(list);
}

function toggle(id) {
  const t = get(id);
  if (!t) return null;
  const willDone = t.status !== 'done';
  return update(id, {
    status: willDone ? 'done' : 'todo',
    completedAt: willDone ? Date.now() : 0
  });
}

function children(parentId) { return all().filter((t) => t.parentId === parentId).sort(sortFn); }

/** 某天任务：当天 + 逾期未完成 */
function byDate(date) {
  const today = util.dateStr();
  return all()
    .filter((t) => !t.parentId)
    .filter((t) => t.date === date || (t.status !== 'done' && t.status !== 'canceled' && t.date < today))
    .map((t) => {
      const overdue = t.status !== 'done' && t.status !== 'canceled' && t.date < today;
      return Object.assign({}, t, { overdue });
    })
    .sort(sortFn);
}

function today() { return byDate(util.dateStr()); }

function byPlan(planType) {
  return all().filter((t) => !t.parentId && t.planType === planType).sort(sortFn);
}

function byRange(start, end) {
  return all().filter((t) => !t.parentId && t.date >= start && t.date <= end).sort(sortFn);
}

/** 完成率 */
function completion(dateStart, dateEnd) {
  let list = all().filter((t) => !t.parentId);
  if (dateStart) list = list.filter((t) => t.date >= dateStart && t.date <= dateEnd);
  const total = list.length;
  const done = list.filter((t) => t.status === 'done').length;
  return { total, done, rate: total ? Math.round((done / total) * 100) : 0 };
}

/** 待办（未完成、按优先级） */
function pending(limit) {
  const today = util.dateStr();
  const list = all()
    .filter((t) => !t.parentId && t.status !== 'done' && t.status !== 'canceled' && t.date <= today)
    .sort(sortFn);
  return limit ? list.slice(0, limit) : list;
}

module.exports = {
  PRIORITY_WEIGHT, all, add, get, update, remove, toggle, children,
  byDate, today, byPlan, byRange, completion, pending
};
