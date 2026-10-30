/**
 * 知识库：笔记与资料文件（元数据），以及全局搜索
 */
const db = require('./db');
const util = require('../utils/util');
const store = require('../utils/store');
const task = require('./task');
const subject = require('./subject');
const seed = require('./seed');
const theme = require('../utils/theme');

/* ---------------- 笔记 ---------------- */
function notes() { return db.get(db.KEYS.notes, []); }
function saveNotes(list) { db.set(db.KEYS.notes, list); store.emit(store.TOPICS.NOTE_CHANGED, list); }

/** 附件清洗：只留渲染与播放所需字段，不存 base64（避免撑爆本地存储） */
function cleanAtt(a) {
  return {
    id: a.id || '', kind: a.kind || 'image', name: a.name || '', sizeText: a.sizeText || '',
    ext: a.ext || '', url: a.url || '', fileID: a.fileID || '', tempPath: a.tempPath || '',
    localOnly: !!a.localOnly, duration: a.duration || 0
  };
}

function addNote(d) {
  const item = {
    id: util.uid('note'),
    title: d.title || '未命名笔记',
    content: d.content || '',
    subject: d.subject || 'other',
    tags: d.tags || [],
    attachments: (d.attachments || []).map(cleanAtt),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const l = notes();
  l.unshift(item);
  saveNotes(l);
  return item;
}

function updateNote(id, patch) {
  const l = notes();
  const i = l.findIndex((n) => n.id === id);
  if (i < 0) return null;
  l[i] = Object.assign({}, l[i], patch, { updatedAt: Date.now() });
  saveNotes(l);
  return l[i];
}

function removeNote(id) { saveNotes(notes().filter((n) => n.id !== id)); }

/* ---------------- 资料文件 ---------------- */
function files() { return db.get(db.KEYS.files, []); }
function saveFiles(list) { db.set(db.KEYS.files, list); store.emit(store.TOPICS.NOTE_CHANGED, list); }

function addFile(d) {
  const item = {
    id: util.uid('file'),
    name: d.name || '未命名文件',
    size: d.size || 0,
    ext: d.ext || '',
    path: d.path || '',
    subject: d.subject || 'other',
    category: d.category || '其他',
    createdAt: Date.now()
  };
  const l = files();
  l.unshift(item);
  saveFiles(l);
  return item;
}

function removeFile(id) { saveFiles(files().filter((f) => f.id !== id)); }

/* ---------------- 全局搜索 ---------------- */
function search(keyword) {
  const kw = (keyword || '').trim().toLowerCase();
  if (!kw) return { tasks: [], notes: [], files: [], points: [] };

  const t = task.all().filter((x) => (x.title + x.description).toLowerCase().indexOf(kw) >= 0).slice(0, 20);
  const n = notes().filter((x) => (x.title + x.content).toLowerCase().indexOf(kw) >= 0).slice(0, 20);
  const f = files().filter((x) => x.name.toLowerCase().indexOf(kw) >= 0).slice(0, 20);

  const points = [];
  theme.SUBJECTS.forEach((s) => {
    subject.flattenPoints(seed.treeOf(s.key)).forEach((p) => {
      if (p.name.toLowerCase().indexOf(kw) >= 0) {
        points.push({ id: p.id, name: p.name, subject: s.name, subjectKey: s.key, chapter: p.chapter });
      }
    });
  });

  return { tasks: t, notes: n, files: f, points: points.slice(0, 20) };
}

module.exports = {
  notes, addNote, updateNote, removeNote,
  files, addFile, removeFile, search
};
