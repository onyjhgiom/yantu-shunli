/**
 * 用户档案与设置
 */
const db = require('./db');
const store = require('../utils/store');
const util = require('../utils/util');

const DEFAULT_NAME = '研友';

/**
 * 考研背景画像默认值 —— 纯虚构示例，仅作字段演示，与任何真实用户无关。
 * 说明：这是「考生客观条件」的结构化描述，供 AI 规划 / 院校推荐 / 风险预警读取，
 * 让建议贴合个人出身而非通用模板。所有字段都可在「我的 → 我的考研背景」里修改。
 */
const DEFAULT_BACKGROUND = {
  undergradSchool: '江汉大学',                  // 本科院校
  undergradTier: '一本',                       // 层次：985/211/双一流/一本/二本/普通本科/专科/海外
  awards: '蓝桥杯省赛二等奖',                    // 竞赛 / 科研获奖
  codingLevel: 'intermediate',                 // none / beginner / intermediate / advanced
  codingLevelText: '入门，能做小项目',
  targetDegree: '学硕',                         // 学硕 / 专硕
  settleCity: '杭州',                           // 定居 / 就业城市
  familySupport: '家人支持全职备考，经济压力不大',
  examPath: '11408',                            // 11408 / 22408 / 自命题 / 其他
  primaryChoice: '杭州电子科技大学·计算机科学与技术(学硕)',
  backupChoice: '浙江工业大学·计算机科学与技术(学硕)',
  updatedAt: 0
};

/** 背景示例版本号：变更示例内容时 +1，ensureDefaults 会把旧示例数据覆盖成新版 */
const BG_DEMO_VERSION = 2;

/**
 * 每日问候话术 —— 按时段分组，每天轮换一句。
 *
 * 背景：原来固定是「今天也要稳稳地研途顺利」，天天同一句，看久了麻木。
 * 现在用「日期 + 时段」做种子挑一句话：同一天内同一时段稳定（不会刷新一次就跳），
 * 跨天 / 跨时段自动换一句，既应景又不重复。
 *
 * 话术基调：鼓励而不制造焦虑，不说「必须」「一定」，也不重复鸡汤句式。
 */
const GREET_LINES = {
  夜深了: [
    '这个点还醒着的，都在悄悄追赶。早点睡，别把明天的额度提前透支了。',
    '你已经熬过了很多人熬不住的日子，剩下的路，再稳一点就好。',
    '熬夜抢来的时间，第二天要用两倍去还，不划算。',
    '深夜的效率骗不了人，但也撑不了太久。',
    '明天的事明天想，现在先睡着。',
    '你不是没时间了，你是需要休息才走得完剩下的路。'
  ],
  早上好: [
    '今天的进度条从零开始，起步永远不晚。',
    '先啃最难的那件事，剩下的自然会顺。',
    '背到嘴里发苦的时候，说明你正在长本事。',
    '不必今天满分，只要比昨天多会一道题。',
    '起来第一件事别刷手机，先给自己定今天的三件事。',
    '刚出发的人最容易高估一天，也最容易低估一个月。',
    '状态是做出来的，不是等出来的，先学十分钟再说。',
    '今天执行不完也没事，你还有明天兜底。'
  ],
  中午好: [
    '午休一小时，下午的效率能翻倍。',
    '吃饭就专心吃饭，大脑也需要喘口气。',
    '中午不用做决定，下午那两小时才是你的。',
    '吃完饭去走十分钟，比硬撑着多刷一道题管用。',
    '上午状态好不好都不重要，下午还有机会翻盘。',
    '别把「休息一下」当成逃避的借口，也别硬撑着不歇。'
  ],
  下午好: [
    '状态不佳时先别硬扛，换个形式学反而更快。',
    '进度慢一点不要紧，只要方向没偏。',
    '做不完是常态，考研本来就没有「全部完成」这回事。',
    '下午犯困很正常，站起来接杯水再回来。',
    '你已经比昨天的自己多坚持了一天，这值得记一笔。',
    '别拿别人的进度衡量自己，你的节奏刚刚好。'
  ],
  晚上好: [
    '今天学习的时间不算少，收个尾就去休息。',
    '花三分钟复盘，比多刷两套卷子更值。',
    '今天不想学也没关系，明天重新开始就好。',
    '睡前把明天的三件事写下来，明早会轻松很多。',
    '今天没做完的部分排到明天最前面，别的先放放。',
    '慢一点没关系，只要一直在走。'
  ]
};

/** 用「日期 + 时段」做种子在话术组里挑一句 */
function dailyLine(period) {
  const pool = GREET_LINES[period] || GREET_LINES['晚上好'];
  const seed = util.dateStr() + '|' + period;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

function ensureDefaults() {
  let profile = db.get(db.KEYS.profile, null);
  if (profile === null) {
    profile = {
      name: DEFAULT_NAME,
      avatar: '',
      setup: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    db.set(db.KEYS.profile, profile);
  }
  // 迁移：写入考研背景画像。带 bgV 版本标记 —— 示例数据（bgV 不等于当前版本）会被
  // 覆盖成新版示例；用户在编辑页保存过之后 bgV 随之更新，之后不再覆盖其真实数据。
  if (!profile.background || profile.background.bgV !== BG_DEMO_VERSION) {
    profile.background = Object.assign({}, DEFAULT_BACKGROUND, { bgV: BG_DEMO_VERSION, updatedAt: Date.now() });
    db.set(db.KEYS.profile, profile);
  }
  if (db.get(db.KEYS.settings, null) === null) {
    db.set(db.KEYS.settings, {
      notifications: true,
      aiEnabled: true,
      quiet: true,            // 智能免打扰
      fontSize: 'normal'
    });
  }
  // 数组类数据结构初始化
  ['tasks', 'studyRecords', 'focusRecords', 'notes', 'files', 'reviews', 'wrongQuestions', 'aiMessages']
    .forEach((k) => {
      if (db.get(db.KEYS[k], null) === null) db.set(db.KEYS[k], []);
    });
  if (db.get(db.KEYS.kpStatus, null) === null) db.set(db.KEYS.kpStatus, {});
  if (db.get(db.KEYS.subjectStages, null) === null) db.set(db.KEYS.subjectStages, {});
}

function getProfile() {
  return db.get(db.KEYS.profile, { name: DEFAULT_NAME, avatar: '', setup: false });
}

/** 读取考研背景画像（与默认值合并，保证旧档案也能拿到完整字段） */
function getBackground() {
  const p = getProfile();
  return Object.assign({}, DEFAULT_BACKGROUND, p.background || {});
}

/** 更新考研背景画像并通知订阅者（「我的 → 我的考研背景」编辑页调用） */
function setBackground(patch) {
  const p = getProfile();
  const bg = Object.assign({}, p.background || DEFAULT_BACKGROUND, patch, { updatedAt: Date.now() });
  const np = Object.assign({}, p, { background: bg, updatedAt: Date.now() });
  db.set(db.KEYS.profile, np);
  store.emit(store.TOPICS.PROFILE_CHANGED, np);
  return bg;
}

/**
 * 根据当前名字生成首页 / 欢迎页问候语。
 *
 * 为什么抽到这里：此前问候只在 App.onLaunch 用「当时的名字」算一次，
 * 缓存进 app.globalData.greeting；首页 load() 优先读这个陈旧缓存，
 * 于是「我的目标」里改了称呼，首页称呼却纹丝不动。
 * 现在首页每次 load 都调本函数用最新名字实时重建，改名即可秒跟随。
 */
function greeting(name) {
  const h = new Date().getHours();
  let part = '晚上好';
  if (h < 5) part = '夜深了';
  else if (h < 11) part = '早上好';
  else if (h < 13) part = '中午好';
  else if (h < 18) part = '下午好';
  const who = (name && String(name).trim()) ? `，${String(name).trim()}` : '';
  return `${part}${who}。${dailyLine(part)}`;
}

/** 同步刷新 App 全局问候缓存，保证任何读 globalData.greeting 的地方也拿到新称呼 */
function syncAppGreeting(name) {
  try {
    const app = (typeof getApp === 'function') ? getApp() : null;
    if (app && app.globalData) app.globalData.greeting = greeting(name);
  } catch (e) { /* 非小程序运行时（单测 / 体检）忽略 */ }
}

function setProfile(patch) {
  const p = Object.assign({}, getProfile(), patch, { updatedAt: Date.now() });
  db.set(db.KEYS.profile, p);
  store.emit(store.TOPICS.PROFILE_CHANGED, p);
  // 改名后让 App 全局问候缓存同步刷新，首页即使读 globalData 也拿得到新值
  syncAppGreeting(p.name);
  return p;
}

function getSettings() {
  return db.get(db.KEYS.settings, { notifications: true, aiEnabled: true, quiet: true });
}

function setSettings(patch) {
  const s = Object.assign({}, getSettings(), patch);
  db.set(db.KEYS.settings, s);
  store.emit(store.TOPICS.PROFILE_CHANGED, getProfile());
  return s;
}

/** 完成引导 = 已填写目标院校与专业 */
function isSetup() {
  const t = db.get(db.KEYS.target, null);
  return !!(t && t.university && t.major);
}

module.exports = { DEFAULT_NAME, DEFAULT_BACKGROUND, GREET_LINES, ensureDefaults, getProfile, getBackground, setBackground, setProfile, getSettings, setSettings, isSetup, greeting, dailyLine };
