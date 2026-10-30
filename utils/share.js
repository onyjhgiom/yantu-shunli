/**
 * 分享中枢：统一为页面注入「转发给朋友」与「分享到朋友圈」能力
 *
 * 用法（页面 JS）：
 *   const share = require('../../utils/share');
 *   Page(share.install('pages/index/index', { ...原 Page 配置 }));
 *
 * 页面可选自定义钩子（全部可选，未提供则用默认标题/路径）：
 *   shareTitle()  返回分享标题（string）
 *   sharePath()   返回好友转发的打开路径，含 query（string）
 *   shareQuery()  返回朋友圈打开时的 query（string，不带 path）
 *   shareImage()  返回 Promise<tempFilePath>，作为分享卡片配图（海报）
 *
 * 说明：本模块不持有任何密钥，也不访问网络；分享卡片图由本端 Canvas 2D 绘制（见 utils/poster.js）
 */
const TARGET_MODULE = true;

const DEFAULT_TITLE = '研途顺利 · 考研陪伴助手';

/** 各页面默认分享标题（页面未提供 shareTitle 时使用） */
const TITLES = {
  'pages/index/index': '研途顺利 · 陪你稳稳上岸',
  'pages/plan/plan': '我的考研复习计划 · 研途顺利',
  'pages/study/study': '今日学习进展 · 研途顺利',
  'pages/materials/materials': '我的备考资料库 · 研途顺利',
  'pages/profile/profile': '我的考研档案 · 研途顺利',
  'pages/welcome/welcome': '立下你的考研目标 · 研途顺利',
  'pages/task-edit/task-edit': '复习任务 · 研途顺利',
  'pages/subject/subject': '我的科目学习进度 · 研途顺利',
  'pages/focus/focus': '番茄专注 · 研途顺利',
  'pages/statistics/statistics': '我的学习统计 · 研途顺利',
  'pages/review/review': '今日复盘 · 研途顺利',
  'pages/ai/ai': 'AI 备考建议 · 研途顺利',
  'pages/note-edit/note-edit': '我的笔记 · 研途顺利',
  'pages/mistake/mistake': '我的错题本 · 研途顺利',
  'pages/mistake/edit': '错题记录 · 研途顺利',
  'pages/mistake/review': '错题复习 · 研途顺利',
  'pages/card/card': '背诵卡片 · 研途顺利',
  'pages/card/review': '卡片复习 · 研途顺利',
  'pages/school/school': '计算机 408 院校库 · 研途顺利',
  'pages/school/detail': '院校专业详情 · 研途顺利',
  'pages/school/compare': '院校对比 · 研途顺利',
  'pages/exam/exam': '我的模考记录 · 研途顺利',
  'pages/exam/edit': '录入模考成绩 · 研途顺利',
  'pages/exam/analysis': '模考成绩分析 · 研途顺利',
  'pages/mood/mood': '心态记录 · 研途顺利',
  'pages/achievement/achievement': '我的打卡成就 · 研途顺利',
  'pages/timeline/timeline': '考研关键节点日历 · 研途顺利',
  'pages/resource/resource': '计算机 408 备考资源库 · 研途顺利',
  'pages/plan-ai/plan-ai': 'AI 复习规划 · 研途顺利'
};

/** 给路径追加来源标记，便于识别来自分享的访问 */
function withFrom(path, from) {
  if (!path) return path;
  const tag = from || 'share';
  return path.indexOf('?') >= 0 ? `${path}&from=${tag}` : `${path}?from=${tag}`;
}

function safeCall(inst, fn, fallback) {
  if (!inst || typeof inst[fn] !== 'function') return fallback;
  try {
    const v = inst[fn]();
    return v === undefined || v === null || v === '' ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function buildTitle(key, inst) {
  return safeCall(inst, 'shareTitle', TITLES[key] || DEFAULT_TITLE);
}

function buildPath(key, inst) {
  return safeCall(inst, 'sharePath', `/${key}`);
}

function buildTimeline(key, inst) {
  return {
    title: buildTitle(key, inst),
    query: safeCall(inst, 'shareQuery', '')
  };
}

/**
 * 若页面提供了 shareImage()，则返回 Promise 等海报生成完再分享（基础库 2.12+ 支持）；
 * 2.8s 内未完成时自动降级为「无图/页面截图」，避免用户卡在等待。
 */
function wrapImage(base, inst) {
  if (!inst || typeof inst.shareImage !== 'function') return base;
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const timer = setTimeout(() => done(base), 2800);
    Promise.resolve()
      .then(() => inst.shareImage())
      .then((file) => {
        clearTimeout(timer);
        done(file ? Object.assign({}, base, { imageUrl: file }) : base);
      })
      .catch(() => { clearTimeout(timer); done(base); });
  });
}

/**
 * 注入分享能力。保留页面已自行定义的 onShareAppMessage / onShareTimeline，
 * 方便个别页面做完全自定义（如 resource 页按当前详情动态生成）。
 */
function install(key, cfg) {
  cfg = cfg || {};
  if (!cfg.onShareAppMessage) {
    cfg.onShareAppMessage = function () {
      const base = {
        title: buildTitle(key, this),
        path: withFrom(buildPath(key, this))
      };
      return wrapImage(base, this);
    };
  }
  if (!cfg.onShareTimeline) {
    cfg.onShareTimeline = function () {
      const t = buildTimeline(key, this);
      return {
        title: t.title,
        query: t.query ? `${t.query}&from=share` : 'from=share'
      };
    };
  }
  return cfg;
}

/**
 * 行内注入用法（无需包裹 Page，最稳）：在 Page({ 之后插入这两行即可
 *   onShareAppMessage: function () { return share.build(this, 'pages/xx/xx'); },
 *   onShareTimeline:   function () { return share.timeline(this, 'pages/xx/xx'); },
 *
 * 注意：若页面已自定义 onShareAppMessage（如 resource 页按详情动态生成），
 *       因为它写在对象后面会覆盖默认实现，二者互不冲突。
 */
function build(inst, key) {
  return { title: buildTitle(key, inst), path: withFrom(buildPath(key, inst)) };
}

function timeline(inst, key) {
  const t = buildTimeline(key, inst);
  return { title: t.title, query: t.query ? `${t.query}&from=share` : 'from=share' };
}

module.exports = { install, build, timeline, TITLES, DEFAULT_TITLE, withFrom, buildTitle, buildPath, buildTimeline };
