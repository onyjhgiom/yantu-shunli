/**
 * 行为快照工具：在「优化前/后」各跑一次，对产物 JSON 做 diff。
 * 若 diff 为空，则证明对外功能/接口/行为未变。
 * 仅用于本地质量验证，不参与小程序运行。
 */
const fs = require('fs');
const path = require('path');

// ---- 内存存储 mock（替代 wx.storage） ----
const store = {};
global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: (k) => { delete store[k]; },
  getStorageInfoSync: () => ({ keys: Object.keys(store) }),
  showToast: () => {},
  showModal: () => {},
  cloud: { callFunction: () => Promise.reject(new Error('no-cloud-in-snapshot')) }
};
global.getApp = () => ({ globalData: {} });

// 冻结“今天”为固定日期，保证日期相关输出可复现
const FIXED = new Date('2026-10-19T09:30:00');
const _Date = Date;
global.Date = class extends _Date {
  constructor(...a) { if (a.length === 0) { super(FIXED.getTime()); } else { super(...a); } }
};
global.Date.now = () => FIXED.getTime();

const root = path.join(__dirname, '..');
const S = (p) => require(path.join(root, p));

function safe(label, fn) {
  try { return { ok: true, v: fn() }; }
  catch (e) { return { ok: false, err: String(e && e.message || e) }; }
}

const snap = {};
const util = S('utils/util');
const fresh = S('services/school-fresh');
const sync = S('services/school-sync');
const school = S('services/school');
const calendar = S('services/calendar');

// ---- util ----
snap.util = safe('util', () => ({
  dateStr: util.dateStr('2026-10-19'),
  parseDate: util.parseDate('2026-10-19').getTime(),
  addDays: util.addDays('2026-10-19', 5),
  daysBetween: util.daysBetween('2026-10-19', '2026-11-01'),
  fmtMinutes: util.fmtMinutes(95),
  fmtHours: util.fmtHours(150),
  weekdayCN: util.weekdayCN('2026-10-19'),
  startOfWeek: util.startOfWeek('2026-10-19'),
  clamp: util.clamp(5, 0, 10),
  defaultExamDate: util.defaultExamDate(2026),
  nextExamYear: util.nextExamYear(),
  relativeDay: util.relativeDay('2026-10-19'),
  fmtDateTime: util.fmtDateTime(FIXED.getTime()),
  dayLabel: util.dayLabel(FIXED.getTime())
}));

// ---- school-fresh ----
snap.fresh = safe('fresh', () => ({
  DATA_SEASON: fresh.DATA_SEASON,
  SYNC_AT: fresh.SYNC_AT,
  VERSION: fresh.VERSION,
  changeCount: fresh.changes().length,
  matchTsinghua: fresh.matchOf('清华大学').length,
  calendarLen: fresh.calendar().length,
  currentPhase: !!fresh.currentPhase(),
  officialLinksLen: fresh.officialLinks({}, {}).length
}));

// ---- school-sync ----
snap.sync = safe('sync', () => ({
  state: sync.syncState(),
  newCount: sync.newCount(),
  newCountAfterSeen: (sync.markSeen(), sync.newCount())
}));

// ---- school ----
snap.school = safe('school', () => {
  const schools = school.allSchools();
  const progs = school.allPrograms();
  const searchR = school.search({ keyword: '计算机' });
  const stats = school.stats();
  const si = school.seasonInfo();
  const fs2 = school.freshnessSummary();
  const rec = school.recommend({});
  return {
    schoolsLen: schools.length,
    programsLen: progs.length,
    searchLen: searchR.length,
    statsKeys: Object.keys(stats).sort(),
    statsChangeCount: stats.changeCount,
    season: si.season,
    syncAt: si.syncAt,
    freshSeason: fs2.season,
    freshTotal: fs2.total,
    recommendLen: rec.length,
    officialLinksLen: school.officialLinks('清华大学', progs[0] || {}).length
  };
});

// ---- calendar ----
snap.calendar = safe('calendar', () => {
  const c = calendar.currentPhaseInfo ? calendar.currentPhaseInfo() : null;
  return { phasesLen: (calendar.PHASES || []).length, current: c };
});

// ---- 接口清单（导出函数名）：证明「接口不变」----
const surface = {};
const mods = [
  'utils/util', 'utils/md', 'utils/store', 'utils/theme', 'utils/share',
  'services/db', 'services/school', 'services/school-fresh', 'services/school-sync',
  'services/calendar', 'services/insight', 'services/statistics', 'services/study',
  'services/planStore', 'services/task', 'services/resources', 'services/ai',
  'services/word', 'services/quiz', 'services/card', 'services/mistake', 'services/exam',
  'services/mood', 'services/news', 'services/note', 'services/books', 'services/focus',
  'services/achievement', 'services/chat', 'services/notify', 'services/profile',
  'services/target', 'services/research', 'services/holiday', 'services/seed'
];
mods.forEach((m) => {
  try {
    const mod = S(m);
    surface[m] = Object.keys(mod).sort();
  } catch (e) {
    surface[m] = { __error: String(e && e.message || e) };
  }
});
snap.exports = surface;

const out = JSON.stringify(snap, null, 2);
const tag = process.argv[2] || 'before';
fs.writeFileSync(path.join(__dirname, 'snapshot.' + tag + '.json'), out);
console.log('snapshot.' + tag + '.json written, bytes=' + out.length);
