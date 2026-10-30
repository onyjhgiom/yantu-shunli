/**
 * 本地存储底层封装
 * 统一 key 前缀，统一空值处理。
 * 说明：当前实现以本地存储为唯一真相源，保证无后端即可运行；
 * 后续接 CloudBase / HTTP 时，仅需替换各 service 的读写实现，页面无需改动。
 */
const PREFIX = 'yt_';

const KEYS = {
  profile: PREFIX + 'profile',
  target: PREFIX + 'target',
  tasks: PREFIX + 'tasks',
  studyRecords: PREFIX + 'study_records',
  focusRecords: PREFIX + 'focus_records',
  kpStatus: PREFIX + 'kp_status',
  subjectStages: PREFIX + 'subject_stages',
  majorTree: PREFIX + 'major_tree',
  wrongQuestions: PREFIX + 'wrong_questions',
  notes: PREFIX + 'notes',
  files: PREFIX + 'files',
  reviews: PREFIX + 'reviews',
  settings: PREFIX + 'settings',
  aiMessages: PREFIX + 'ai_messages',
  cardReviews: PREFIX + 'card_reviews',  // 卡片复习流水（与复盘的 yt_reviews 分开）
  decks: PREFIX + 'decks',
  cards: PREFIX + 'cards',
  exams: PREFIX + 'exams',
  moodLogs: PREFIX + 'mood_logs',
  userTargets: PREFIX + 'user_targets',
  checkins: PREFIX + 'checkins',
  makeup: PREFIX + 'makeup',
  resFavs: PREFIX + 'res_favs',
  userLines: PREFIX + 'user_lines',
  /* AI 相关：会话索引（消息本体按 yt_ai_session_<id> 分片存放）、当前会话、规划快照 */
  aiSessions: PREFIX + 'ai_sessions',
  aiCurrent: PREFIX + 'ai_current',
  planSnapshots: PREFIX + 'plan_snapshots',
  /* 新增模块：资讯 / 刷题 / 通知 */
  news: PREFIX + 'news_read',     // 已读资讯标记
  newsFavs: PREFIX + 'news_favs',
  quizRecords: PREFIX + 'quiz_records',
  notifies: PREFIX + 'notifies',
  /* 背单词（英语）：记忆状态 / 生词本 / 设置 */
  wordState: PREFIX + 'word_state',
  wordExtra: PREFIX + 'word_extra',
  wordSettings: PREFIX + 'word_settings',
  /* 院校库时效数据实时同步（school-sync） */
  schoolFresh: PREFIX + 'school_fresh',        // 云端拉取的时效补丁 { version, syncAt, season, syncNote, calendar, chsi, changes, source, fetchedAt }
  schoolFreshSeen: PREFIX + 'school_fresh_seen', // 已读动态 id 集合 + version（用于「N 条新动态」红点）
  schoolFreshDirty: PREFIX + 'school_fresh_dirty'  // 标记：云端数据已更新，需让 school.js 院校缓存失效重建
};

/** 分片 key 前缀：这类 key 不在 KEYS 白名单里，需按前缀单独处理 */
const SHARD_PREFIXES = [PREFIX + 'ai_session_'];

/**
 * 读缓存（write-through）
 *
 * 背景：本项目以本地存储为唯一真相源，每次 db.get 都会触发一次 wx.getStorageSync 同步 IO。
 * 首页/统计/AI 等聚合页一次渲染往往要读十几个 key，且同一 key 在多个 service 里重复读，
 * 这部分开销在低端机上会直接反映为「点开页面要卡一下」。
 *
 * 实现要点：
 *   1. 所有写入都必须经过 db.set / db.remove，缓存才会在同一进程内保持正确（write-through）；
 *   2. **只缓存命中的值，不缓存 miss 的默认值** —— 若把 get(key, []) 的默认 [] 也缓存下来，
 *      多个页面会共享同一个可变数组，A 页误改会污染 B 页；同时 get(def) 每次返回新对象语义不变；
 *   3. 缓存仅存活于本次小程序生命周期，冷启动自然重建，不会读到脏数据。
 */
const READ_CACHE = Object.create(null);

function get(key, def) {
  if (Object.prototype.hasOwnProperty.call(READ_CACHE, key)) return READ_CACHE[key];
  try {
    const v = wx.getStorageSync(key);
    if (v === '' || v === undefined || v === null) return def; // 未命中不写缓存，避免共享默认值
    READ_CACHE[key] = v;
    return v;
  } catch (e) {
    return def;
  }
}

function set(key, value) {
  try {
    wx.setStorageSync(key, value);
    READ_CACHE[key] = value; // 写成功才更新缓存
    return true;
  } catch (e) {
    delete READ_CACHE[key];  // 写失败则缓存不可信，下次强制回源
    wx.showToast({ title: '本地存储写入失败', icon: 'none' });
    return false;
  }
}

function remove(key) {
  delete READ_CACHE[key];
  try { wx.removeStorageSync(key); } catch (e) { /* noop */ }
}

/** 手动失效（一般不需要；跨小程序实例、外部改存储时用） */
function invalidate(key) {
  if (key) delete READ_CACHE[key];
  else Object.keys(READ_CACHE).forEach((k) => delete READ_CACHE[k]);
}

/** 列出实际占用存储的分片 key（如 yt_ai_session_xxx） */
function shardKeys() {
  try {
    const info = wx.getStorageInfoSync();
    return (info && info.keys ? info.keys : []).filter((k) => SHARD_PREFIXES.some((p) => k.indexOf(p) === 0));
  } catch (e) {
    return [];
  }
}

/** 列出本应用占用的存储（用于「数据导出/清理」） */
function dumpAll() {
  const out = {};
  Object.keys(KEYS).forEach((k) => { out[k] = get(KEYS[k], null); });
  shardKeys().forEach((k) => { out[k] = get(k, null); });
  return out;
}

function clearApp() {
  Object.keys(KEYS).forEach((k) => remove(KEYS[k]));
  shardKeys().forEach((k) => remove(k));
}

module.exports = { KEYS, get, set, remove, invalidate, dumpAll, clearApp, shardKeys };
