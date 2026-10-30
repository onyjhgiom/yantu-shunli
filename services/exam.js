/**
 * 模考与成绩分析（PRD F14）
 * 录入真题/模拟卷各科得分；雷达（完成度）、趋势、规则引擎诊断
 */
const db = require('./db');
const util = require('../utils/util');
const store = require('../utils/store');
const targetService = require('./target');
const mistakeService = require('./mistake');

const SUBJECT_KEYS = ['politics', 'english', 'math', 'major'];
const SUBJECT_NAMES = { politics: '政治', english: '英语', math: '数学', major: '专业课' };

function all() { return db.get(db.KEYS.exams, []); }
function save(list) { db.set(db.KEYS.exams, list); store.emit(store.TOPICS.EXAM_CHANGED, list); }

/** 附件清洗：与笔记一致，只存元信息与可播放地址 */
function cleanAtt(a) {
  return {
    id: a.id || '', kind: a.kind || 'image', name: a.name || '', sizeText: a.sizeText || '',
    ext: a.ext || '', url: a.url || '', fileID: a.fileID || '', tempPath: a.tempPath || '',
    localOnly: !!a.localOnly, duration: a.duration || 0
  };
}

function add(data) {
  const scores = Object.assign({ politics: 0, english: 0, math: 0, major: 0 }, data.scores || {});
  const total = scores.politics + scores.english + scores.math + scores.major;
  const item = Object.assign({
    id: util.uid('ex'),
    name: '',
    type: 'mock',
    date: util.dateStr(),
    durationMin: 0,
    scores, total, note: '', createdAt: Date.now()
  }, data, { scores, total });
  // 附件清洗要等 item 建好之后（此前写在 Object.assign 里会踩暂时性死区）
  item.attachments = (item.attachments || []).map(cleanAtt);
  if (!item.name) throw new Error('请填写卷名');
  const list = all();
  list.unshift(item);
  save(list);
  return item;
}

function get(id) { return all().find((e) => e.id === id) || null; }
function remove(id) { save(all().filter((e) => e.id !== id)); }

function update(id, patch) {
  const list = all();
  const i = list.findIndex((e) => e.id === id)
  if (i < 0) return null
  const e = Object.assign({}, list[i], patch)
  if (patch && patch.scores) {
    const scores = Object.assign({}, e.scores, patch.scores)
    e.scores = scores
    e.total = scores.politics + scores.english + scores.math + scores.major
  }
  if (patch && patch.date) e.date = patch.date
  list[i] = e
  save(list)
  return e
}

/** 按时间排序的序列，供趋势图 */
function trend() {
  return all().slice().sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((e) => ({ id: e.id, date: e.date, name: e.name, type: e.type, total: e.total, scores: e.scores }));
}

/** 雷达数据：各科当前分 vs 目标分 */
function radar(examId) {
  const e = get(examId);
  const target = targetService.getTarget();
  const cur = e ? e.scores : null;
  const tgt = target ? target.scores : null;
  return SUBJECT_KEYS.map((k) => ({
    key: k, name: SUBJECT_NAMES[k],
    current: cur ? cur[k] : 0,
    target: tgt ? tgt[k] : 0
  }));
}

/** 规则引擎诊断（非 AI）：低于目标线 15 分以上给出专项建议 */
function diagnose(examId) {
  const e = get(examId);
  if (!e) return [];
  const target = targetService.getTarget();
  const out = [];
  SUBJECT_KEYS.forEach((k) => {
    const t = target && target.scores ? target.scores[k] : 0;
    const v = e.scores[k] || 0;
    if (t && v < t - 15) out.push({ subject: SUBJECT_NAMES[k], text: `${SUBJECT_NAMES[k]}低于目标线 15 分以上（${v}/${t}），建议加强专项练习` });
    else if (t && v >= t) out.push({ subject: SUBJECT_NAMES[k], text: `${SUBJECT_NAMES[k]}已达目标线（${v}/${t}）` });
    else if (t) out.push({ subject: SUBJECT_NAMES[k], text: `${SUBJECT_NAMES[k]}距目标线还差 ${t - v} 分` });
  });
  return out;
}

/** 一键把这份卷子的失分科目导入错题本 */
function importToMistakes(examId) {
  const e = get(examId);
  if (!e) return 0;
  const target = targetService.getTarget();
  let n = 0;
  SUBJECT_KEYS.forEach((k) => {
    const t = (target && target.scores) ? target.scores[k] : 0;
    if (e.scores[k] < (t || 0)) {
      mistakeService.add({
        subject: k, source: e.name,
        questionText: `${e.name} · ${SUBJECT_NAMES[k]}失分题`,
        rightAnswer: '', analysis: '由模考录入自动生成，待补充解析',
        reasons: ['idea']
      });
      n += 1;
    }
  });
  return n;
}

module.exports = { SUBJECT_KEYS, SUBJECT_NAMES, add, get, remove, update, all, trend, radar, diagnose, importToMistakes };
