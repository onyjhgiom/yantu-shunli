/**
 * 消息通知中心 · 本地站内通知（无后端，离线可用）
 *
 * 类型：exam 倒计时 / daily 每日一句 / task 任务 / focus 专注 / system 系统
 * 页面可点击 link 跳转；支持未读标记、全部已读、删除。
 */
const db = require('./db');
const util = require('../utils/util');
const target = require('./target');

const DAILY = [
  '今天的努力，是明天考场上的底气。',
  '不要和别人比进度，和昨天的自己比。',
  '408 选择占一半，稳住基础就是稳住下限。',
  '累了就休息，但别停下太久。',
  '一道错题搞懂，胜过十道蒙对。',
  '坚持到复试名单出来那天，你就赢了大多数人。'
];

function all() { return db.get(db.KEYS.notifies, []); }
function save(list) { db.set(db.KEYS.notifies, list.slice(0, 100)); }

function add(d) {
  const item = Object.assign({
    id: util.uid('nt'),
    type: 'system',
    title: '通知',
    content: '',
    link: '',
    read: false,
    date: util.dateStr()
  }, d);
  const list = all();
  list.unshift(item);
  save(list);
  return item;
}

function unreadCount() { return all().filter((n) => !n.read).length; }

function markRead(id) {
  const list = all();
  const i = list.findIndex((n) => n.id === id);
  if (i >= 0) { list[i].read = true; save(list); }
}
function markAll() { save(all().map((n) => Object.assign({}, n, { read: true }))); }
function remove(id) { save(all().filter((n) => n.id !== id)); }
function clear() { save([]); }

/** 保证今天有「倒计时提醒 + 每日一句」两条，不重复生成 */
function seedToday() {
  const today = util.dateStr();
  const list = all();
  const hasTodayExam = list.some((n) => n.type === 'exam' && n.date === today);
  const hasTodayDaily = list.some((n) => n.type === 'daily' && n.date === today);

  if (!hasTodayExam) {
    const c = target.countdown();
    if (c && c.totalDays >= 0) {
      add({
        type: 'exam', title: '考研倒计时',
        content: '距离初试还有 ' + c.totalDays + ' 天' + (c.university ? '，目标 ' + c.university : '') + '。今天也要按计划推进～',
        link: '/pages/index/index'
      });
    }
  }
  if (!hasTodayDaily) {
    add({
      type: 'daily', title: '每日一句',
      content: DAILY[Math.floor(Math.random() * DAILY.length)],
      link: ''
    });
  }
}

const TYPE_META = {
  exam: { icon: '◷', color: 'var(--danger)', name: '倒计时' },
  daily: { icon: '♡', color: 'var(--forest-deep)', name: '每日一句' },
  task: { icon: '✓', color: 'var(--forest)', name: '任务' },
  focus: { icon: '◷', color: 'var(--c-english)', name: '专注' },
  system: { icon: 'ⓘ', color: 'var(--sub)', name: '系统' }
};

module.exports = {
  all, add, unreadCount, markRead, markAll, remove, clear, seedToday, TYPE_META
};
