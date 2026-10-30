/**
 * 科目与知识点：四科概览、知识点状态、阶段进度
 */
const db = require('./db');
const theme = require('../utils/theme');
const seed = require('./seed');
const study = require('./study');
const store = require('../utils/store');

function kpStatus() { return db.get(db.KEYS.kpStatus, {}); }

function setKpStatus(id, status) {
  const m = Object.assign({}, kpStatus(), { [id]: status });
  db.set(db.KEYS.kpStatus, m);
  store.emit(store.TOPICS.KP_CHANGED, m);
  return m;
}

function flattenPoints(tree) {
  const out = [];
  (tree.groups || []).forEach((g) => (g.chapters || []).forEach((c) => (c.points || []).forEach((p) => {
    out.push({ id: p.id, name: p.name, group: g.name, chapter: c.name });
  })));
  return out;
}

function masteryOf(key) {
  const pts = flattenPoints(seed.treeOf(key));
  if (!pts.length) return 0;
  const m = kpStatus();
  const mastered = pts.filter((p) => m[p.id] === 'mastered').length;
  return Math.round((mastered / pts.length) * 100);
}

/** 掌握度分布，用于薄弱分析 */
function distributionOf(key) {
  const pts = flattenPoints(seed.treeOf(key));
  const m = kpStatus();
  const d = { none: 0, learning: 0, mastered: 0, weak: 0, review: 0 };
  pts.forEach((p) => { d[m[p.id] || 'none'] += 1; });
  return d;
}

function overview() {
  const totals = study.subjectTotals();
  return theme.SUBJECTS.map((s) => ({
    key: s.key,
    name: s.name,
    short: s.short,
    color: s.color,
    totalMinutes: totals[s.key] || 0,
    mastery: masteryOf(s.key),
    pointCount: flattenPoints(seed.treeOf(s.key)).length,
    dist: distributionOf(s.key)
  }));
}

function stages() { return db.get(db.KEYS.subjectStages, {}); }

function setStage(key, stageName, percent) {
  const s = Object.assign({}, stages());
  s[key] = Object.assign({}, s[key] || {}, { [stageName]: Math.max(0, Math.min(100, percent)) });
  db.set(db.KEYS.subjectStages, s);
  store.emit(store.TOPICS.KP_CHANGED, s);
  return s;
}

function stageProgress(key) {
  const st = stages()[key] || {};
  const tree = seed.treeOf(key);
  return (tree.stages || []).map((name) => ({ name, percent: st[name] != null ? st[name] : 0 }));
}

function detail(key) {
  const tree = seed.treeOf(key);
  const m = kpStatus();
  const groups = (tree.groups || []).map((g) => ({
    name: g.name,
    chapters: (g.chapters || []).map((c) => {
      const points = (c.points || []).map((p) => ({ id: p.id, name: p.name, status: m[p.id] || 'none' }));
      const mastered = points.filter((p) => p.status === 'mastered').length;
      return {
        name: c.name,
        points,
        mastered,
        progress: points.length ? Math.round((mastered / points.length) * 100) : 0
      };
    })
  }));
  return {
    key,
    name: tree.name,
    isCustom: !!tree.custom && key === 'major',
    stages: tree.stages,
    stageProgress: stageProgress(key),
    groups,
    mastery: masteryOf(key),
    dist: distributionOf(key),
    totalMinutes: study.subjectTotals()[key] || 0
  };
}

/** 薄弱知识点（weak / review 状态） */
function weakPoints(limit) {
  const m = kpStatus();
  const out = [];
  theme.SUBJECTS.forEach((s) => {
    flattenPoints(seed.treeOf(s.key)).forEach((p) => {
      const st = m[p.id];
      if (st === 'weak' || st === 'review') out.push({ ...p, subject: s.name, subjectKey: s.key, status: st });
    });
  });
  return limit ? out.slice(0, limit) : out;
}

module.exports = {
  kpStatus, setKpStatus, flattenPoints, masteryOf, distributionOf,
  overview, stages, setStage, stageProgress, detail, weakPoints
};
