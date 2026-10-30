/**
 * 主题系统（4 套皮肤） + Canvas 色板
 * ------------------------------------------------------------
 * 四套皮肤：light（暖灰·森林绿）/ dark（暗夜·金）/ ocean（暗夜·深海蓝）/ sakura（晨雾·樱粉）
 * 切换方式：页面根节点挂 .th-<key> class（见 app.wxss 中的变量定义），
 *           JS 侧只需 setData({ themeCls }) 即可。
 *
 * ★ 关键分层（换肤能全覆盖的原因）：
 *   1. 喂给 WXML 内联 style / 组件样式的颜色 → 一律输出 **'var(--x)' 字符串**。
 *      这样换肤时不需要重新跑 JS：CSS 变量在 .th-* 作用域下自动重算。
 *   2. 喂给 Canvas 2D 的颜色 → 只能用「真·色值」，取自 palette()（theme 对象），
 *      由 syncActive() 按当前主题同步；页面在 onShow 重绘即可。
 *   3. 需要「半透明 / 淡底」的颜色 → 不用色值字符串拼 alpha（var() 拼不了），
 *      改用主题里预置的 soft 变量（--*-soft / --chart-area / --heat-*）。
 *
 * 对外保持旧 API：theme（实时色板）、SUBJECTS / SUBJECT_MAP / PRIORITY / STATUS / KP_STATUS
 * 新增 API：THEMES、ORDER、list、active、activeClass、setActive、onChange、palette、applyChrome
 */

/* ---------------- 四套主题的变量（与 app.wxss 中的 .th-* 完全一致） ---------------- */
const THEMES = {
  light: {
    key: 'light', name: '暖灰·森林绿', cls: 'th-light', desc: '浅色 · 暖纸 + 森林绿',
    vars: {
      '--paper': '#F4F1E9', '--paper-deep': '#EDE8DC', '--card': '#FBF9F3', '--card-line': '#E6E0D2',
      '--ink': '#2B2B28', '--ink-soft': '#57534A', '--sub': '#8C877B', '--line': '#E4DFD2',
      '--forest': '#2E4F3E', '--forest-deep': '#233E31', '--forest-soft': '#E4ECE6',
      '--terracotta': '#C2703D', '--terracotta-soft': '#F5E7DC', '--terracotta-line': '#E0CBB8',
      '--ok': '#5B8C5A', '--warn': '#A87A28', '--danger': '#B5532E', '--danger-soft': '#F2E2DA', '--warn-soft': '#F3ECDD',
      '--c-politics': '#B5532E', '--c-english': '#2E6E8E', '--c-math': '#C2703D', '--c-major': '#3E6B4F',
      '--on-primary': '#F4F1E9', '--on-fill': '#FFFFFF', '--paper-fade': 'rgba(244, 241, 233, 0)', '--primary-glow': 'rgba(46, 79, 62, 0.16)',
      '--chart-area': 'rgba(46, 79, 62, 0.08)',
      '--heat-0': '#EDE8DC', '--heat-1': '#CFE0D2', '--heat-2': '#9FC0A8', '--heat-3': '#5B8C5A', '--heat-4': '#2E4F3E',
      '--heat-line': '#E4DFD2'
    },
    nav: { backgroundColor: '#F4F1E9', textStyle: 'black' },
    tabBar: { color: '#8C877B', selectedColor: '#2E4F3E', backgroundColor: '#FBF9F3', borderStyle: 'white' }
  },
  dark: {
    key: 'dark', name: '暗夜·金', cls: 'th-dark', desc: '深色 · 近黑 + 琥珀金',
    vars: {
      '--paper': '#0B0E14', '--paper-deep': '#0E131B', '--card': '#1B222E', '--card-line': '#2A3342',
      '--ink': '#F2F0EB', '--ink-soft': '#A8A59D', '--sub': '#8A867C', '--line': '#232A35',
      '--forest': '#E0A94A', '--forest-deep': '#E8B75E', '--forest-soft': '#2A2418',
      '--terracotta': '#E8B75E', '--terracotta-soft': '#2E2619', '--terracotta-line': '#4A3C24',
      '--ok': '#5FA86B', '--warn': '#D9A441', '--danger': '#D9614A', '--danger-soft': '#2E1A16', '--warn-soft': '#2B2415',
      '--c-politics': '#D9614A', '--c-english': '#5B9BD5', '--c-math': '#E0A94A', '--c-major': '#5FA86B',
      '--on-primary': '#141008', '--on-fill': '#141008', '--paper-fade': 'rgba(11, 14, 20, 0)', '--primary-glow': 'rgba(224, 169, 74, 0.30)',
      '--chart-area': 'rgba(224, 169, 74, 0.12)',
      '--heat-0': '#232A35', '--heat-1': '#3A3527', '--heat-2': '#6B5527', '--heat-3': '#A88338', '--heat-4': '#E0A94A',
      '--heat-line': '#2A3342'
    },
    nav: { backgroundColor: '#0B0E14', textStyle: 'white' },
    tabBar: { color: '#7A776F', selectedColor: '#E0A94A', backgroundColor: '#0E131B', borderStyle: 'black' }
  },
  ocean: {
    key: 'ocean', name: '暗夜·深海蓝', cls: 'th-ocean', desc: '深色 · 近黑 + 青蓝',
    vars: {
      '--paper': '#0A1014', '--paper-deep': '#0E161B', '--card': '#16242B', '--card-line': '#24414B',
      '--ink': '#EAF2F4', '--ink-soft': '#9FB8BE', '--sub': '#7E9AA1', '--line': '#1E3038',
      '--forest': '#3FB6C9', '--forest-deep': '#5FD0E0', '--forest-soft': '#16323A',
      '--terracotta': '#54C7B8', '--terracotta-soft': '#163A33', '--terracotta-line': '#2C5A50',
      '--ok': '#5FBF8A', '--warn': '#E0B85C', '--danger': '#E5705B', '--danger-soft': '#2E1A16', '--warn-soft': '#2B2415',
      '--c-politics': '#E5705B', '--c-english': '#5B9BD5', '--c-math': '#3FB6C9', '--c-major': '#5FBF8A',
      '--on-primary': '#04161A', '--on-fill': '#04161A', '--paper-fade': 'rgba(10, 16, 20, 0)', '--primary-glow': 'rgba(63, 182, 201, 0.30)',
      '--chart-area': 'rgba(63, 182, 201, 0.14)',
      '--heat-0': '#1E3038', '--heat-1': '#1D3C42', '--heat-2': '#2A6067', '--heat-3': '#3A8E9C', '--heat-4': '#3FB6C9',
      '--heat-line': '#24414B'
    },
    nav: { backgroundColor: '#0A1014', textStyle: 'white' },
    tabBar: { color: '#7E9AA1', selectedColor: '#3FB6C9', backgroundColor: '#0E161B', borderStyle: 'black' }
  },
  sakura: {
    key: 'sakura', name: '晨雾·樱粉', cls: 'th-sakura', desc: '浅色 · 雾白 + 玫瑰粉',
    vars: {
      '--paper': '#FBF2F5', '--paper-deep': '#F4E6EC', '--card': '#FFFFFF', '--card-line': '#F0DDE5',
      '--ink': '#33282C', '--ink-soft': '#6E5B62', '--sub': '#9A8590', '--line': '#EFDCE4',
      '--forest': '#B8557C', '--forest-deep': '#9E4569', '--forest-soft': '#F7E6EC',
      '--terracotta': '#D98BA8', '--terracotta-soft': '#FBEAEF', '--terracotta-line': '#EAC6D4',
      '--ok': '#6FAE72', '--warn': '#D6A24B', '--danger': '#C75A6B', '--danger-soft': '#F7E2E6', '--warn-soft': '#F6ECDC',
      '--c-politics': '#C75A6B', '--c-english': '#5B8FBF', '--c-math': '#C45B86', '--c-major': '#6FAE72',
      '--on-primary': '#FBF2F5', '--on-fill': '#33282C', '--paper-fade': 'rgba(251, 242, 245, 0)', '--primary-glow': 'rgba(184, 85, 124, 0.20)',
      '--chart-area': 'rgba(196, 91, 134, 0.10)',
      '--heat-0': '#F4E6EC', '--heat-1': '#F0D2DE', '--heat-2': '#DEA6BC', '--heat-3': '#C45B86', '--heat-4': '#A8466F',
      '--heat-line': '#F0DDE5'
    },
    nav: { backgroundColor: '#FBF2F5', textStyle: 'black' },
    tabBar: { color: '#9A8590', selectedColor: '#C45B86', backgroundColor: '#FFFFFF', borderStyle: 'white' }
  }
};

const ORDER = ['light', 'dark', 'ocean', 'sakura'];
const STORAGE_KEY = 'yt_theme';

/* ---------------- 实时色板（**仅供 Canvas 2D 自绘**，随主题更新） ---------------- */
const theme = {
  paper: '#F4F1E9', paperDeep: '#EDE8DC', card: '#FBF9F3', cardLine: '#E6E0D2',
  ink: '#2B2B28', inkSoft: '#57534A', sub: '#8C877B', line: '#E4DFD2',
  forest: '#2E4F3E', forestDeep: '#233E31', forestSoft: '#E4ECE6',
  terracotta: '#C2703D', terracottaSoft: '#F5E7DC',
  ok: '#5B8C5A', warn: '#A87A28', danger: '#B5532E', grid: '#E4DFD2',
  /* 折线图面积填充（浅淡主色） */
  areaSoft: 'rgba(46, 79, 62, 0.08)',
  /* 热力日历 5 档（浅 → 深） */
  heat: ['#EDE8DC', '#CFE0D2', '#9FC0A8', '#5B8C5A', '#2E4F3E'],
  /* 学科色（真值数组，Canvas 柱状图等按序取用） */
  subjectColors: ['#B5532E', '#2E6E8E', '#C2703D', '#3E6B4F'],
  /* 重色块（驾驶舱 / 倒计时 / 专注环）上的文字与线条：
   * 这些表面在四套皮肤里都是深色，故文字恒为浅色，不随主题变化。 */
  onDark: '#F2F0EB',
  onDarkDim: 'rgba(242, 240, 235, 0.66)',
  onDarkLine: 'rgba(242, 240, 235, 0.18)'
};

/* ============================================================
 * UI 语义色（喂 WXML 内联 style 的，一律输出 var() 字符串）
 *   color → 主色（文字 / 图标 / 实心块）
 *   bg    → 同色系的淡底（替代过去的 色值+'1A' 拼 alpha 写法）
 * ============================================================ */
const SUBJECTS = [
  { key: 'politics', name: '政治', short: '政', color: 'var(--c-politics)', bg: 'var(--danger-soft)' },
  { key: 'english', name: '英语', short: '英', color: 'var(--c-english)', bg: 'var(--forest-soft)' },
  { key: 'math', name: '数学', short: '数', color: 'var(--c-math)', bg: 'var(--warn-soft)' },
  { key: 'major', name: '专业课', short: '专', color: 'var(--c-major)', bg: 'var(--forest-soft)' }
];
const SUBJECT_MAP = SUBJECTS.reduce((m, s) => { m[s.key] = s; return m; }, {});
SUBJECT_MAP.other = { key: 'other', name: '其他', short: '他', color: 'var(--sub)', bg: 'var(--paper-deep)' };

const PRIORITY = {
  urgent: { label: '紧急', color: 'var(--danger)', bg: 'var(--danger-soft)' },
  high: { label: '高', color: 'var(--forest)', bg: 'var(--forest-soft)' },
  mid: { label: '中', color: 'var(--warn)', bg: 'var(--warn-soft)' },
  low: { label: '低', color: 'var(--sub)', bg: 'var(--paper-deep)' }
};

const STATUS = {
  todo: { label: '待开始', color: 'var(--sub)', bg: 'var(--paper-deep)' },
  doing: { label: '进行中', color: 'var(--c-english)', bg: 'var(--forest-soft)' },
  done: { label: '已完成', color: 'var(--ok)', bg: 'var(--forest-soft)' },
  delayed: { label: '已延期', color: 'var(--danger)', bg: 'var(--danger-soft)' },
  canceled: { label: '已取消', color: 'var(--sub)', bg: 'var(--paper-deep)' }
};

const KP_STATUS = {
  none: { label: '未学习', color: 'var(--sub)', bg: 'var(--paper-deep)' },
  learning: { label: '学习中', color: 'var(--c-english)', bg: 'var(--forest-soft)' },
  mastered: { label: '已掌握', color: 'var(--ok)', bg: 'var(--forest-soft)' },
  weak: { label: '薄弱', color: 'var(--danger)', bg: 'var(--danger-soft)' },
  review: { label: '需复习', color: 'var(--warn)', bg: 'var(--warn-soft)' }
};

/* ---------------- 运行时状态 ---------------- */
let activeKey = null;
let listeners = [];

function getStored() {
  try { return wx.getStorageSync(STORAGE_KEY) || 'light'; } catch (e) { return 'light'; }
}
function getActive() {
  const k = activeKey || (activeKey = getStored());
  return THEMES[k] || THEMES.light;
}
function active() { return getActive(); }
function activeClass() { return getActive().cls; }
function list() { return ORDER.map((k) => THEMES[k]); }

/** 把当前主题的「真值」同步进 theme（Canvas 用）。
 *  注意：SUBJECTS/PRIORITY/STATUS/KP_STATUS 输出的是 var() 字符串，无需同步。 */
function syncActive() {
  const v = getActive().vars;
  theme.paper = v['--paper']; theme.paperDeep = v['--paper-deep']; theme.card = v['--card']; theme.cardLine = v['--card-line'];
  theme.ink = v['--ink']; theme.inkSoft = v['--ink-soft']; theme.sub = v['--sub']; theme.line = v['--line'];
  theme.forest = v['--forest']; theme.forestDeep = v['--forest-deep']; theme.forestSoft = v['--forest-soft'];
  theme.terracotta = v['--terracotta']; theme.terracottaSoft = v['--terracotta-soft'];
  theme.ok = v['--ok']; theme.warn = v['--warn']; theme.danger = v['--danger']; theme.grid = v['--card-line'];
  theme.areaSoft = v['--chart-area'];
  theme.heat = [v['--heat-0'], v['--heat-1'], v['--heat-2'], v['--heat-3'], v['--heat-4']];
  theme.subjectColors = [v['--c-politics'], v['--c-english'], v['--c-math'], v['--c-major']];
}

/** 应用导航栏 + 底部 tabBar 的配色（让换肤在系统栏也生效） */
function applyChrome(key) {
  const t = THEMES[key] || getActive();
  if (!t) return;
  try {
    wx.setNavigationBarColor({
      frontColor: t.nav.textStyle === 'white' ? '#ffffff' : '#000000',
      backgroundColor: t.nav.backgroundColor,
      animation: { duration: 200, timingFunc: 'ease' }
    });
  } catch (e) { /* 非页面上下文可能抛错，忽略 */ }
  try {
    wx.setTabBarStyle({
      color: t.tabBar.color,
      selectedColor: t.tabBar.selectedColor,
      backgroundColor: t.tabBar.backgroundColor,
      borderStyle: t.tabBar.borderStyle
    });
  } catch (e) { /* 同上 */ }
}

function setActive(key) {
  if (!THEMES[key]) return false;
  activeKey = key;
  try { wx.setStorageSync(STORAGE_KEY, key); } catch (e) { /* ignore */ }
  syncActive();
  applyChrome(key);
  listeners.slice().forEach((fn) => { try { fn(getActive()); } catch (e) { /* ignore */ } });
  return true;
}

/** 订阅主题变化，返回取消订阅函数 */
function onChange(fn) {
  if (typeof fn === 'function') listeners.push(fn);
  return function off() {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

function palette() { return theme; }

/* 模块加载即按存储值同步一次（默认浅色） */
syncActive();

module.exports = {
  THEMES, ORDER, STORAGE_KEY,
  list, active, activeClass, setActive, onChange, palette, applyChrome, syncActive,
  theme, SUBJECTS, SUBJECT_MAP, PRIORITY, STATUS, KP_STATUS
};
