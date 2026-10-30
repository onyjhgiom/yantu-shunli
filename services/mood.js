/**
 * 每日心情（PRD F19 心态与健康）
 * 5 档表情 + 一句话；本地风险关键词温和提示，不向他人推送
 */
const db = require('./db');
const util = require('../utils/util');
const store = require('../utils/store');

const LEVELS = ['很差', '较差', '一般', '不错', '很好'];
const RISK_WORDS = ['不想活', '活不下去', '轻生', '自杀', '结束生命', '没有意义', '绝望'];

function all() { return db.get(db.KEYS.moodLogs, []); }
function save(list) { db.set(db.KEYS.moodLogs, list); store.emit(store.TOPICS.MOOD_CHANGED, list); }

function add(data) {
  const item = Object.assign({ id: util.uid('md'), level: 3, text: '', date: util.dateStr(), createdAt: Date.now() }, data);
  if (item.level < 1 || item.level > 5) throw new Error('心情等级需 1-5');
  // 同一天覆盖
  const list = all().filter((m) => m.date !== item.date);
  list.unshift(item);
  save(list);
  return item;
}

function get(date) { return all().find((m) => m.date === date) || null; }

/** 某月心情曲线（按日，0 表示未记录） */
function monthCurve(monthPrefix) {
  const prefix = monthPrefix || util.dateStr().slice(0, 7);
  const map = {};
  all().filter((m) => m.date.indexOf(prefix) === 0).forEach((m) => { map[Number(m.date.slice(8, 10))] = m.level; });
  const days = new Date(Number(prefix.slice(0, 4)), Number(prefix.slice(5, 7)), 0).getDate();
  const arr = [];
  for (let d = 1; d <= days; d++) arr.push({ day: d, level: map[d] || 0 });
  return arr;
}

/** 风险检测：命中则返回 true（仅本地提示） */
function riskOf(text) {
  const t = (text || '').toLowerCase();
  return RISK_WORDS.some((w) => t.indexOf(w) >= 0);
}

module.exports = { LEVELS, RISK_WORDS, add, get, monthCurve, riskOf, all };
