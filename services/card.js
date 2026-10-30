/**
 * 背诵卡片：牌组 + 卡片，共用 SRS 引擎
 * 用于政治简答、专业课名词解释、英语作文模板等背诵类内容（PRD F11）
 */
const db = require('./db');
const util = require('../utils/util');
const store = require('../utils/store');
const srs = require('../utils/srs');
const targetService = require('./target');

function daysToExam() {
  const c = targetService.countdown();
  return c ? Math.max(0, c.totalDays) : 999;
}

function decks() { return db.get(db.KEYS.decks, []); }
function saveDecks(list) { db.set(db.KEYS.decks, list); store.emit(store.TOPICS.CARD_CHANGED, list); }
function cards() { return db.get(db.KEYS.cards, []); }
function saveCards(list) { db.set(db.KEYS.cards, list); store.emit(store.TOPICS.CARD_CHANGED, list); }

function addDeck(data) {
  const deck = Object.assign({ id: util.uid('dk'), name: '未命名牌组', subject: 'other', createdAt: Date.now() }, data);
  if (!deck.name) throw new Error('牌组名不能为空');
  const list = decks();
  list.unshift(deck);
  saveDecks(list);
  return deck;
}

function removeDeck(id) {
  saveDecks(decks().filter((d) => d.id !== id));
  saveCards(cards().filter((c) => c.deckId !== id));
}

function addCard(data) {
  const card = Object.assign({
    id: util.uid('cd'),
    deckId: '',
    subject: 'other',
    chapterId: '',
    front: '',
    back: '',
    cloze: '',
    srs: { ef: 2.5, interval: 0, reps: 0, lapses: 0, dueDate: util.dateStr() },
    createdAtDate: util.dateStr(),
    createdAt: Date.now(),
    masteredAt: 0
  }, data);
  if (!card.front && !card.back) throw new Error('请填写卡片正反面');
  const list = cards();
  list.unshift(card);
  saveCards(list);
  return card;
}

function updateCard(id, patch) {
  const list = cards();
  const i = list.findIndex((c) => c.id === id);
  if (i < 0) return null;
  list[i] = Object.assign({}, list[i], patch, { updatedAt: Date.now() });
  saveCards(list);
  return list[i];
}

function removeCard(id) { saveCards(cards().filter((c) => c.id !== id)); }

function cardsOf(deckId) { return cards().filter((c) => c.deckId === deckId); }

function reviewSubmit(id, q) {
  const c = cards().find((x) => x.id === id);
  if (!c) return null;
  const today = util.dateStr();
  const r = srs.review(c, q, today, daysToExam());
  const patch = { srs: r };
  if (q >= 3 && r.interval >= 21 && (c.srs.reps || 0) >= 2) patch.masteredAt = Date.now();
  // 记一条复习流水，供统计页使用（只存极简字段，控体积）
  logReview({ cardId: id, deckId: c.deckId, subject: c.subject, q: q, date: today });
  return updateCard(id, patch);
}

/* ---------------- 复习流水与统计 ---------------- */

const MAX_LOGS = 2000;

function logs() { return db.get(db.KEYS.cardReviews, []); }

function logReview(rec) {
  const l = logs();
  l.unshift(Object.assign({ id: util.uid('rl'), at: Date.now() }, rec));
  db.set(db.KEYS.cardReviews, l.slice(0, MAX_LOGS));
}

/** 复习流水（默认最近 limit 条） */
function records(limit) {
  const l = logs();
  return limit ? l.slice(0, limit) : l;
}

/** 清空流水（不动卡片本身） */
function clearLogs() { db.set(db.KEYS.cardReviews, []); }

/**
 * 卡片复习统计。
 * @returns 总览 + 近 14 天活跃度 + 按科目分布 + 牌组维度
 */
function stats() {
  const cs = cards();
  const lg = logs();
  const today = util.dateStr();
  const weekFrom = util.dateStr(util.addDays(today, -6));

  const rated = lg.filter((l) => l.q != null);
  const good = rated.filter((l) => l.q >= 3).length;

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = util.dateStr(util.addDays(today, -i));
    let n = 0;
    for (let k = 0; k < lg.length; k++) if (lg[k].date === d) n++;
    days.push({ date: d, label: d.slice(5).replace('-', '/'), n: n });
  }
  const maxN = days.reduce((m, d) => Math.max(m, d.n), 0) || 1;

  const bySubject = {};
  rated.forEach((l) => { const k = l.subject || 'other'; bySubject[k] = (bySubject[k] || 0) + 1; });

  const byDeck = decks().map((d) => {
    const sub = lg.filter((l) => l.deckId === d.id);
    return { id: d.id, name: d.name, total: cardsOf(d.id).length, reviews: sub.length };
  }).sort((a, b) => b.reviews - a.reviews);

  return {
    totalCards: cs.length,
    totalDecks: decks().length,
    due: dueQueue(null, 99999).length,
    mastered: cs.filter((c) => c.masteredAt).length,
    todayCount: lg.filter((l) => l.date === today).length,
    weekCount: lg.filter((l) => l.date >= weekFrom).length,
    totalReviews: lg.length,
    rated: rated.length,
    accuracy: rated.length ? Math.round((good / rated.length) * 100) : 0,
    days: days.map((d) => Object.assign({}, d, { percent: Math.round((d.n / maxN) * 100) })),
    maxDay: maxN,
    bySubject: Object.keys(bySubject).map((k) => ({ key: k, n: bySubject[k] })).sort((a, b) => b.n - a.n),
    byDeck: byDeck
  };
}

function dueQueue(deckId, limit) {
  const today = util.dateStr();
  let list = cards().filter((c) => srs.isDue(c, today));
  if (deckId) list = list.filter((c) => c.deckId === deckId);
  list.sort((a, b) => {
    const la = (a.srs && a.srs.lapses) || 0, lb = (b.srs && b.srs.lapses) || 0;
    if (lb !== la) return lb - la;
    return ((a.srs && a.srs.dueDate) || '') < ((b.srs && b.srs.dueDate) || '') ? -1 : 1;
  });
  return limit ? list.slice(0, limit) : list;
}

module.exports = {
  decks, cards, addDeck, removeDeck, addCard, updateCard, removeCard, cardsOf, reviewSubmit, dueQueue,
  records, stats, clearLogs
};
