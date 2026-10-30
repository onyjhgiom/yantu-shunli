/**
 * 院校库「实时同步引擎」
 *
 * 解决的问题：院校库的结构性事实（招生季 / 同步日期 / 科目调整动态 / 时间轴）原先写死在
 * school-fresh.js 常量里，无法在不发版的情况下更新。本模块把这些「时效数据」抽成一层
 * 可远端拉取的数据源：
 *
 *   · 云端已拉取到补丁（school_fresh 本地缓存） → 展示云端最新数据（带版本号）
 *   · 云端不可用 / 尚未拉取               → 回退 school-fresh.js 内置 RAW 种子（保证无网也能用）
 *
 * 数据诚信约定（与 school-fresh 一致，绝不推测分数线/招生人数、动态必须可溯源）由上层的
 * 数据源（云库 school_changes / 函数内置 data.json）负责保证，本引擎只做「版本比对 + 合并 + 缓存」。
 *
 * 更新方式（运营侧）：
 *   1. 想实时改：在云开发控制台给 school_meta 文档改 version 字段并保存，school_changes 增删条目；
 *      用户端下次打开/点刷新即生效，无需发版。
 *   2. 没建云库：直接改 cloudfunctions/school-sync/data.json 后「上传并部署」，同样生效。
 */

const db = require('./db');
const config = require('../utils/config');
const util = require('../utils/util');

const KEYS = db.KEYS;

/** 云端可用：配了环境 ID + 基础库支持 callFunction */
function isCloud() {
  return !!(config.CLOUD_ENV_ID && config.CLOUD_ENV_ID !== '' && typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.callFunction === 'function');
}

/** 本地已拉取的云端补丁 */
function localPatch() { return db.get(KEYS.schoolFresh, null); }

/**
 * 当前应展示的时效数据：云端补丁优先，否则回退打包种子。
 * 返回字段：{ version, syncAt, season, syncNote, calendar, chsi, changes, source, _live }
 */
function data() {
  const l = localPatch();
  const seed = require('./school-fresh').RAW;
  if (l && l.version) {
    return Object.assign({}, seed, l, { _live: true, source: l.source || 'cloud' });
  }
  return Object.assign({}, seed, { _live: false, source: 'builtin' });
}

function version() { return data().version; }

/** 首次进入时把当前动态标记为「已读」，避免一上来就提示「N 条新动态」 */
function ensureSeen() {
  if (db.get(KEYS.schoolFreshSeen, null) === null) markSeen();
}

function markSeen() {
  const d = data();
  db.set(KEYS.schoolFreshSeen, {
    version: d.version,
    ids: (d.changes || []).map((c) => c.id)
  });
}

/** 自上次「已读」以来新增的改考/调整动态条数（用于红点） */
function newCount() {
  ensureSeen();
  const seen = db.get(KEYS.schoolFreshSeen, null) || { ids: [] };
  const ids = seen.ids || [];
  return (data().changes || []).filter((c) => ids.indexOf(c.id) < 0).length;
}

/**
 * 拉取云端时效数据并与本地比对。
 * force=true 时忽略版本号强制刷新（手动刷新按钮用）。
 * 返回 { ok, newer, version, source, reason }
 */
function checkUpdate(force) {
  return new Promise((resolve) => {
    if (!isCloud()) { resolve({ ok: false, reason: 'cloud-off' }); return; }
    wx.cloud.callFunction({ name: 'school-sync', data: {} })
      .then((res) => {
        const r = res && res.result;
        if (!r || !r.ok) { resolve({ ok: false, reason: 'bad-result' }); return; }
        const l = localPatch();
        const newer = force || !l || l.version !== r.version;
        if (newer) {
          db.set(KEYS.schoolFresh, {
            version: r.version,
            syncAt: r.syncAt || require('./school-fresh').RAW.syncAt,
            season: r.season || require('./school-fresh').RAW.season,
            syncNote: r.syncNote || require('./school-fresh').RAW.syncNote,
            calendar: r.calendar || require('./school-fresh').RAW.calendar,
            chsi: r.chsi || require('./school-fresh').RAW.chsi,
            changes: r.changes || [],
            source: r.source || 'cloud',
            fetchedAt: util.dateStr()
          });
          // 让 school.js 的院校缓存失效，下一次 allSchools() 重建为最新数据
          db.set(KEYS.schoolFreshDirty, true);
        }
        resolve({ ok: true, newer, version: r.version, source: r.source });
      })
      .catch((e) => { resolve({ ok: false, reason: 'call-failed', err: String((e && e.message) || e) }); });
  });
}

/** 手动刷新封装（页面按钮调用） */
function refreshFresh(force) { return checkUpdate(force !== false); }

/**
 * 静默拉取：进入页面/启动时被调用。有更新时回调 cb（通常是页面 reload）。
 * 不打断用户、不弹错误（失败静默走本地）。
 */
function checkFreshSilent(cb) {
  return checkUpdate(false).then((r) => {
    if (r.ok && r.newer && typeof cb === 'function') cb(r);
    return r;
  }).catch(() => ({ ok: false, reason: 'silent-fail' }));
}

/** 给页面用的整体状态 */
function syncState() {
  const d = data();
  const l = localPatch();
  return {
    version: d.version,
    syncAt: d.syncAt,
    season: d.season,
    hasLive: !!d._live,
    source: d.source || 'builtin',
    newCount: newCount(),
    fetchedAt: (l && l.fetchedAt) || ''
  };
}

module.exports = {
  data, version, markSeen, newCount,
  checkUpdate, refreshFresh, checkFreshSilent, syncState, isCloud
};
