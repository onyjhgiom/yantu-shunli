/**
 * 研途顺利 · 院校库时效数据同步云函数
 *
 * 上传方式：微信开发者工具 → 右键 cloudfunctions/school-sync →「上传并部署：云端安装依赖」
 * 调用方式：wx.cloud.callFunction({ name: 'school-sync', data: {} })
 *
 * 数据来源（二选一，优先云数据库）：
 *   1) 云数据库（推荐，可实时更新无需发版）：
 *        - school_meta   单文档：{ version, syncAt, season, syncNote, calendar, chsi }
 *        - school_changes 集合：每条即一条改考/调整动态（结构同 data.json 的 changes[]）
 *      运营在控制台改 school_meta.version 或增删 school_changes，用户端立即可见。
 *   2) 函数内置 data.json（未建云库时回退）：改完 data.json 重新「上传并部署」即生效。
 *
 * ⚠️ 数据诚信：changes 每条必须带可溯源的官方公告 url；没有确切 url 的宁可留空，
 *    绝不编造。分数线/招生人数仍由小程序端按层次估算，本函数不提供这两类数字。
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 内置回退数据（与 data.json 一致）
let SEED = null;
function seed() {
  if (!SEED) SEED = require('./data.json');
  return SEED;
}

exports.main = async () => {
  try {
    const metaRes = await db.collection('school_meta').limit(1).get();
    const chgRes = await db.collection('school_changes').limit(2000).get();
    if (metaRes.data && metaRes.data.length) {
      const m = metaRes.data[0];
      return {
        ok: true,
        source: 'db',
        version: m.version,
        syncAt: m.syncAt,
        season: m.season,
        syncNote: m.syncNote,
        calendar: m.calendar,
        chsi: m.chsi,
        changes: chgRes.data || []
      };
    }
  } catch (e) {
    // 集合不存在 / 无权限 → 走内置 data.json
  }
  const s = seed();
  return Object.assign({ ok: true, source: 'builtin' }, s);
};
