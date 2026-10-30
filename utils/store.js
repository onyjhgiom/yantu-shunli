/**
 * 极简响应式状态：事件总线
 * 页面 onLoad 订阅、onUnload 取消订阅，实现跨页数据刷新
 */
const listeners = {};

function subscribe(topic, fn) {
  if (!listeners[topic]) listeners[topic] = [];
  listeners[topic].push(fn);
  return function unsubscribe() {
    listeners[topic] = (listeners[topic] || []).filter((f) => f !== fn);
  };
}

function emit(topic, payload) {
  (listeners[topic] || []).slice().forEach((fn) => {
    try { fn(payload); } catch (e) { /* 单个订阅异常不影响其他 */ }
  });
}

const TOPICS = {
  TASK_CHANGED: 'task:changed',
  TARGET_CHANGED: 'target:changed',
  STUDY_CHANGED: 'study:changed',
  PROFILE_CHANGED: 'profile:changed',
  KP_CHANGED: 'kp:changed',
  FOCUS_CHANGED: 'focus:changed',
  NOTE_CHANGED: 'note:changed',
  MISTAKE_CHANGED: 'mistake:changed',
  CARD_CHANGED: 'card:changed',
  EXAM_CHANGED: 'exam:changed',
  MOOD_CHANGED: 'mood:changed',
  SCHOOL_TARGET_CHANGED: 'school_target:changed'
};

module.exports = { subscribe, emit, TOPICS };
