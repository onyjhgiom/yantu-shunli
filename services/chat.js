/**
 * AI 对话会话存储
 *
 * 存储结构（两个 key 分工，避免单 key 撑爆微信 1MB 上限）：
 *   yt_ai_sessions            会话索引 [{id, title, createdAt, updatedAt, count}]
 *   yt_ai_session_<id>        单个会话的消息本体 [{id, role, text, at}]
 *   yt_ai_current             当前会话 id
 *
 * 为什么拆开：一个会话几十条长回答就可能上几百 KB，全部塞进一个 key 迟早写失败；
 * 拆开后单个 key 只承载一个会话，删会话也只需删一个 key。
 */
const db = require('./db');
const util = require('../utils/util');

const IDX = db.KEYS.aiSessions;
const CUR = db.KEYS.aiCurrent;
const PREFIX = 'yt_ai_session_';

const MAX_SESSIONS = 30;   // 最多保留的会话数
const MAX_MSGS = 60;       // 单会话最多保留的消息条数
const MAX_TEXT = 4000;     // 单条消息文本上限（防单条超长撑爆存储）
const CTX_N = 6;           // 带入模型的历史条数（3 轮对话）
const MAX_ATTACH = 9;      // 单条消息最多附件数

/** 清洗附件：仅保留元信息与可访问地址（不存 base64） */
function cleanAttach(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_ATTACH).map((a) => ({
    id: a.id || '',
    kind: a.kind === 'file' ? 'file' : (a.kind === 'audio' ? 'audio' : 'image'),
    name: a.name || '',
    sizeText: a.sizeText || '',
    ext: a.ext || '',
    fileID: a.fileID || '',
    tempPath: a.tempPath || '',
    url: a.url || '',
    localOnly: !!a.localOnly,
    duration: a.duration || 0,
    asrText: a.asrText || ''
  }));
}

/** 附件的一句话描述，用于本地规则引擎与历史占位 */
function attachSummary(list) {
  if (!list || !list.length) return '';
  const img = list.filter((a) => a.kind === 'image').length;
  const doc = list.filter((a) => a.kind === 'file').length;
  const aud = list.filter((a) => a.kind === 'audio').length;
  const parts = [];
  if (img) parts.push(img + ' 张图片');
  if (doc) parts.push(doc + ' 个文件');
  if (aud) parts.push(aud + ' 段语音');
  return '（含' + parts.join('、') + '）';
}

function key(id) { return PREFIX + id; }

function list() {
  const arr = db.get(IDX, []);
  return Array.isArray(arr) ? arr : [];
}

function writeIndex(arr) {
  // 索引本身很小，但仍按上限截断，超出的会话连本体一起清掉
  const kept = arr.slice(0, MAX_SESSIONS);
  const dropped = arr.slice(MAX_SESSIONS);
  db.set(IDX, kept);
  dropped.forEach((s) => db.remove(key(s.id)));
  return kept;
}

function messagesOf(id) {
  if (!id) return [];
  const arr = db.get(key(id), []);
  return Array.isArray(arr) ? arr : [];
}

function currentId() { return db.get(CUR, ''); }

/** 新建会话并设为当前 */
function create() {
  const id = util.uid('s');
  const now = Date.now();
  const arr = list();
  arr.unshift({ id, title: '新对话', createdAt: now, updatedAt: now, count: 0 });
  writeIndex(arr);
  db.set(CUR, id);
  return id;
}

/** 确保存在可用的当前会话；索引被清过或指向已删除的会话时自动新建 */
function ensure() {
  const cur = currentId();
  if (cur && list().some((s) => s.id === cur)) return cur;
  return create();
}

function use(id) {
  if (!id) return;
  if (list().some((s) => s.id === id)) db.set(CUR, id);
}

function titleOf(text) {
  const s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!s) return '新对话';
  return s.length > 16 ? s.slice(0, 16) + '…' : s;
}

/**
 * 追加一条消息到当前会话
 * @returns {object|null} 落库后的消息
 */
function append(role, text, attach) {
  const id = ensure();
  const msgs = messagesOf(id);
  const msg = {
    id: util.uid('m'),
    role: role === 'user' ? 'user' : 'ai',
    text: String(text == null ? '' : text).slice(0, MAX_TEXT),
    attach: cleanAttach(attach),
    at: Date.now()
  };
  msgs.push(msg);
  const kept = msgs.slice(-MAX_MSGS);   // 只留最近若干条，超出的自然淘汰
  db.set(key(id), kept);

  const arr = list();
  const s = arr.find((x) => x.id === id);
  if (s) {
    s.count = kept.length;
    s.updatedAt = msg.at;
    if (s.title === '新对话' && msg.role === 'user') s.title = titleOf(msg.text) || (msg.attach[0] && msg.attach[0].name) || '新对话';
    // 最近更新的会话排最前
    writeIndex([s].concat(arr.filter((x) => x.id !== id)));
  } else {
    writeIndex([{ id, title: msg.role === 'user' ? (titleOf(msg.text) || (msg.attach[0] && msg.attach[0].name) || '新对话') : '新对话', createdAt: msg.at, updatedAt: msg.at, count: kept.length }].concat(arr));
  }
  return msg;
}

/** 最近 n 条，转成模型可用的 {role, content}（不含系统提示） */
function recent(n) {
  const id = currentId();
  if (!id) return [];
  return messagesOf(id).slice(-(n || CTX_N)).map((m) => {
    const sum = attachSummary(m.attach);
    return {
      role: m.role === 'user' ? 'user' : 'assistant',
      content: (sum ? sum + ' ' : '') + m.text
    };
  });
}

/** 会话列表（含预览与展示用时间文案），供历史页直接渲染 */
function overview() {
  const cur = currentId();
  return list().map((s) => {
    const msgs = messagesOf(s.id);
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    return {
      id: s.id,
      title: s.title || '新对话',
      count: msgs.length,
      updatedAt: s.updatedAt,
      timeText: util.fmtDateTime(s.updatedAt),
      preview: last ? (last.role === 'user' ? '我：' : 'AI：') + String(last.text).replace(/\s+/g, ' ').slice(0, 42) : '（还没有对话内容）',
      isCurrent: s.id === cur
    };
  });
}

function remove(id) {
  const arr = list().filter((s) => s.id !== id);
  db.set(IDX, arr);
  db.remove(key(id));
  if (currentId() === id) db.set(CUR, arr.length ? arr[0].id : '');
}

function clearAll() {
  list().forEach((s) => db.remove(key(s.id)));
  db.remove(IDX);
  db.remove(CUR);
}

function count() { return list().length; }

module.exports = {
  MAX_SESSIONS, MAX_MSGS, MAX_TEXT, CTX_N,
  list, overview, messagesOf, currentId, create, ensure, use,
  append, recent, remove, clearAll, count, titleOf,
  cleanAttach, attachSummary, MAX_ATTACH
};
