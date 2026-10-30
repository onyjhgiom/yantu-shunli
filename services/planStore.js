/**
 * AI 规划快照存储
 *
 * 每次生成规划存一份快照，便于回看「当时给出的方案」以及阶段推进带来的变化。
 * 去重策略：数值骨架（阶段 / 距考天数 / 各科学时 / 重点科目）未变则不新增，
 * 只把最新的云端策略建议挂到最近一条上 —— 避免每次 onShow 都刷出一条重复记录。
 *
 * 只存「结果快照」，不存原始 ctx：历史页要展示的正是当时那份方案本身。
 */
const db = require('./db');
const util = require('../utils/util');

const KEY = db.KEYS.planSnapshots;
const MAX = 20;

function list() {
  const arr = db.get(KEY, []);
  return Array.isArray(arr) ? arr : [];
}

function write(arr) { db.set(KEY, arr.slice(0, MAX)); }

/** 数值骨架签名：只要这些没变，就认为是同一份规划 */
function sig(p) {
  return [
    p.phase,
    p.daysToExam,
    p.weeklyHours,
    (p.subjects || []).map((s) => `${s.name}${s.weeklyHours}`).join(','),
    (p.priorities || []).map((x) => `${x.subject}${x.gap}`).join(',')
  ].join('#');
}

/**
 * 保存一份规划快照
 * @returns {string} 快照 id（未启用/不可用时返回空串）
 */
function save(p, insight) {
  if (!p || !p.enabled) return '';
  const arr = list();
  const today = util.dateStr();
  const s = sig(p);

  // 今天已经存过同一份骨架 → 就地更新策略文字，不新增
  const head = arr[0];
  if (head && head.date === today && head.sig === s) {
    head.insight = insight || head.insight || [];
    head.at = Date.now();
    write(arr);
    return head.id;
  }

  const id = util.uid('p');
  const now = Date.now();
  arr.unshift({
    id,
    at: now,
    date: today,
    sig: s,
    phase: p.phase,
    daysToExam: p.daysToExam == null ? null : p.daysToExam,
    weeklyHours: p.weeklyHours,
    summary: p.summary,
    subjects: (p.subjects || []).map((x) => ({
      name: x.name, target: x.target, current: x.current, gap: x.gap, weeklyHours: x.weeklyHours
    })),
    priorities: (p.priorities || []).map((x) => ({ subject: x.subject, gap: x.gap, reason: x.reason })),
    weeks: (p.weeks || []).map((w) => ({
      week: w.week, theme: w.theme,
      subjects: (w.subjects || []).map((s2) => ({ name: s2.name, hours: s2.hours }))
    })),
    daily: (p.daily || []).map((d) => ({ period: d.period, focus: d.focus, detail: d.detail, hours: d.hours })),
    tips: (p.tips || []).slice(0, 8),
    insight: insight || []
  });
  write(arr);
  return id;
}

/** 云端策略异步返回后，挂到已保存的那条快照上 */
function setInsight(id, items) {
  if (!id) return;
  const arr = list();
  const s = arr.find((x) => x.id === id);
  if (!s) return;
  s.insight = items || [];
  write(arr);
}

/** 历史页渲染用：补上展示文案与展开态 */
function overview() {
  return list().map((s) => ({
    id: s.id,
    timeText: util.fmtDateTime(s.at),
    date: s.date,
    phase: s.phase,
    daysToExam: s.daysToExam,
    daysText: s.daysToExam == null ? '未设考试日期' : (s.daysToExam >= 0 ? `剩 ${s.daysToExam} 天` : `已过 ${-s.daysToExam} 天`),
    weeklyHours: s.weeklyHours,
    summary: s.summary || '',
    subjects: (s.subjects || []).map((x) => ({
      name: x.name, weeklyHours: x.weeklyHours,
      gapText: x.gap == null ? '无模考数据' : (x.gap > 0 ? `差 ${x.gap} 分` : '已达标')
    })),
    priorities: s.priorities || [],
    weeks: s.weeks || [],
    daily: s.daily || [],
    tips: s.tips || [],
    insight: s.insight || [],
    open: false
  }));
}

function latest() { return list()[0] || null; }
function get(id) { return list().find((x) => x.id === id) || null; }
function remove(id) { write(list().filter((x) => x.id !== id)); }
function clearAll() { db.remove(KEY); }
function count() { return list().length; }

module.exports = { MAX, list, save, setInsight, overview, latest, get, remove, clearAll, count, sig };
