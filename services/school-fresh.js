/**
 * 院校库「信息时效层」
 *
 * 解决的问题：院校库一旦写死，就会随时间变旧。本模块把「信息新不新、从哪来、怎么跟上」
 * 做成一等公民，而不是让用户在过期的数字上做择校决策。
 *
 * 三条设计原则（与既有数据诚信约定一致）：
 *   1. 只记录有据可查的事实：院校 / 学院 / 专业代码 / 初试科目变化 / 公告发布日期 / 官方原文链接。
 *      **绝不推测分数线与招生人数** —— 那两类仍然由 school.js 按层次估算并明确标注。
 *   2. 每条动态必须能落到一条官方链接（公告页或该校研究生院），没有确切 URL 的宁可留空，
 *      也绝不编造一个看起来很像的地址。
 *   3. 数据批次显式化：DATA_SEASON 标明这批数据对应的招生季，页面同步展示「同步日期」，
 *      超过一个招生季即在 UI 上提示需要重新核实。
 *
 * 当前批次：2027 招生季（2027 年 12 月初试即「27 考研」）
 */

/** 本批数据的招生季与同步日期（打包内置种子；云端可覆盖更新，见 services/school-sync.js） */
const DATA_SEASON = '2027';
const SYNC_AT = '2026-10-19';
/** 数据版本号：云端 version 变化即视为有新数据（手动刷新/启动静默拉取都会比对） */
const VERSION = 'v2026.10.19.1';

/** 全口径背景（公开统计口径，非本库数据） */
const SYNC_NOTE = {
  season: '2027',
  summary: '截至 2026 年 7 月，全国已有 110 所以上的高校发布 2027 研考初试科目调整公告，其中六成以上是把自命题改为全国统考科目。',
  policy: '计算机类是本轮统考化的前沿：408 计算机学科专业基础被越来越多的院校采用，仍坚持自命题的院校已不足三成。',
  caution: '准确地说：不少院校当前发布的是「预公告」，正式方案以 9 月中旬前后发布的《招生简章》与《招生专业目录》为准。'
};

/** 研招网官方入口（供一键直达核实） */
const CHSI = {
  name: '中国研究生招生信息网（研招网）',
  host: 'https://yz.chsi.com.cn/',
  school: 'https://yz.chsi.com.cn/sch/',           // 招生单位名录
  news: 'https://yz.chsi.com.cn/z/ckxz/',          // 政策资讯
  tiaoji: 'https://yz.chsi.com.cn/tiaoji/'         // 调剂服务
};

/**
 * 2027 招生季关键时间轴（公开惯例节点，用于提示「现在该看什么」）。
 * month 为 1-12；state: done / now / next
 */
const CALENDAR = [
  { month: 6,  title: '科目调整预公告期', desc: '各校陆续公布初试科目调整（含改考 408），此时就要开始按新科目复习', state: 'done' },
  { month: 9,  title: '招生简章 + 专业目录发布', desc: '【当前阶段】正式方案落地，专业代码、考试科目、招生计划以这一版为准', state: 'now' },
  { month: 9,  title: '预报名', desc: '通常在 9 月下旬开放，蹲一个心仪的报考点', state: 'now' },
  { month: 10, title: '正式报名', desc: '10 月中下旬开通，确认报考院校与专业', state: 'next' },
  { month: 11, title: '网上确认 / 准考证', desc: '核对学籍学历信息，下载打印准考证', state: 'next' },
  { month: 12, title: '初试', desc: '12 月第三个周末，政治 + 英语 + 数学 + 专业课', state: 'next' },
  { month: 2,  title: '成绩公布', desc: '次年 2 月中下旬，第一时间对比目标院校复试线', state: 'next' },
  { month: 3,  title: '国家线 + 复试', desc: '3 月国家线发布，随后院校组织复试（注意部分院校有机试）', state: 'next' },
  { month: 4,  title: '调剂系统', desc: '4 月调剂服务系统开放，缺额信息以系统内为准', state: 'next' }
];

/**
 * 计算机类初试科目调整动态（2027 招生季）
 *
 * kind:
 *   to408 —— 自命题改为 408 全国统考（改考）
 *   back  —— 反向调整，统考改回自命题（极少，但确实存在，择校最容易踩的坑）
 *   new   —— 新增专业 / 专业代码调整（含学科门类变更）
 *
 * url 为公告原文地址；确无确切地址时留空，页面会退回到院校研究生院官网。
 */
const CHANGE_LOG = [
  {
    id: 'tsinghua-cs-085400',
    school: '清华大学', college: '计算机系', major: '电子信息', code: '085400', degreeType: '专硕',
    kind: 'to408', from: '826 计算机专业基础综合', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-06-23',
    source: '清华大学计算机系官网公告',
    url: ''
  },
  {
    id: 'sigs-085400-408',
    school: '清华大学', college: '深圳国际研究生院', major: '电子信息', code: '085400', degreeType: '专硕',
    kind: 'to408', from: '826 / 827 电路原理等自命题', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-06-30',
    source: '清华大学深圳国际研究生院《2027 年硕士初试科目调整公告》',
    url: 'https://www.sigs.tsinghua.edu.cn/2026/0630/c7770a291822/page.htm'
  },
  {
    id: 'sigs-085404-408',
    school: '清华大学', college: '深圳国际研究生院', major: '计算机技术', code: '085404', degreeType: '专硕',
    kind: 'to408', from: '826 计算机专业基础综合', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-06-30',
    source: '清华大学深圳国际研究生院《2027 年硕士初试科目调整公告》',
    url: 'https://www.sigs.tsinghua.edu.cn/2026/0630/c7770a291822/page.htm'
  },
  {
    id: 'sigs-085411-408',
    school: '清华大学', college: '深圳国际研究生院', major: '大数据技术与工程', code: '085411', degreeType: '专硕',
    kind: 'to408', from: '827 电路原理', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-06-30',
    source: '清华大学深圳国际研究生院《2027 年硕士初试科目调整公告》',
    url: 'https://www.sigs.tsinghua.edu.cn/2026/0630/c7770a291822/page.htm'
  },
  {
    id: 'buaa-083900-408',
    school: '北京航空航天大学', college: '网络空间安全学院', major: '网络空间安全', code: '083900', degreeType: '学硕',
    kind: 'to408', from: '第四单元自命题', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-06',
    source: '北京航空航天大学网络空间安全学院公告（全院 27 级硕士）',
    url: 'https://cst.buaa.edu.cn/info/1102/5379.htm'
  },
  {
    id: 'bjtu-085410-408',
    school: '北京交通大学', college: '人工智能学院', major: '人工智能', code: '085410', degreeType: '专硕',
    kind: 'to408', from: '自命题科目', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-06',
    source: '北京交通大学人工智能学院《人才培育通知》',
    url: 'https://ai.bjtu.edu.cn/tzgg/rcpytzgg/08ed06172a044d4599d1294586bb56d1.htm'
  },
  {
    id: 'ustb-085405-408',
    school: '北京科技大学', college: '数理学院', major: '软件工程', code: '085405', degreeType: '专硕',
    kind: 'to408', from: '879 数据结构', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-06',
    source: '北京科技大学研究生院《统考科目调整通知》',
    url: 'https://yzxc.ustb.edu.cn/sssbkzn/sstzgg/04ade75bf29f4592804d1310c2e961cd.htm'
  },
  {
    id: 'bupt-085410-408',
    school: '北京邮电大学', college: '人工智能学院', major: '人工智能', code: '085410', degreeType: '专硕',
    kind: 'to408', from: '809 数据结构', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-06',
    source: '北京邮电大学研究生院《初试科目调整公告》',
    url: 'https://yzb.bupt.edu.cn/info/1031/1412.htm'
  },
  {
    id: 'bupt-140500-408',
    school: '北京邮电大学', college: '人工智能学院', major: '智能科学与技术', code: '140500', degreeType: '学硕',
    kind: 'to408', from: '809 数据结构', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-06',
    source: '北京邮电大学研究生院《初试科目调整公告》',
    url: 'https://yzb.bupt.edu.cn/info/1031/1412.htm'
  },
  {
    id: 'hnu-085400-408',
    school: '湖南大学', college: '计算机学院', major: '电子信息', code: '085400', degreeType: '专硕',
    kind: 'to408', from: '866 数据结构', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-06',
    source: '湖南大学计算机学院公告',
    url: 'https://csee.hnu.edu.cn/info/1062/14057.htm'
  },
  {
    id: 'ccut-081200-408',
    school: '长春工业大学', college: '计算机科学与工程学院', major: '计算机科学与技术', code: '081200', degreeType: '学硕',
    kind: 'to408', from: '808 数据结构', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-06',
    source: '长春工业大学研究生院公告',
    url: 'https://yjsy.ccut.edu.cn/info/1015/3385.htm'
  },
  {
    id: 'ccut-085404-408',
    school: '长春工业大学', college: '计算机科学与工程学院', major: '计算机技术', code: '085404', degreeType: '专硕',
    kind: 'to408', from: '808 数据结构', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-06',
    source: '长春工业大学研究生院公告',
    url: 'https://yjsy.ccut.edu.cn/info/1015/3385.htm'
  },
  {
    id: 'zuel-085400-408',
    school: '中南财经政法大学', college: '信息工程学院', major: '电子信息', code: '085400', degreeType: '专硕',
    kind: 'to408', from: '自命题业务课', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-07-17',
    source: '中南财经政法大学信息工程学院《2027 年招生专业及初试科目调整公告》',
    url: 'https://xagx.zuel.edu.cn/2026/0717/c3402a436272/page.htm'
  },
  {
    id: 'qhnu-0775-0812',
    school: '青海师范大学', college: '计算机学院', major: '计算机科学与技术', code: '0775', degreeType: '学硕',
    kind: 'new', from: '计算机科学与技术（理学，专业代码 0775，自命题）', to: '计算机科学与技术（工学，专业代码 0812，改考 201/301/408 全国统考）',
    season: '2027', date: '2026-06-30',
    source: '青海师范大学研究生院《计算机科学与技术专业学科门类及考试科目调整的通知》',
    url: 'https://jsj.qhnu.edu.cn/info/1070/4218.htm'
  },
  {
    id: 'njuit-back-817',
    school: '南京信息工程大学', college: '人工智能学院', major: '人工智能', code: '085410', degreeType: '专硕',
    kind: 'back', from: '408 计算机学科专业基础（2026 年）', to: '817 信号与系统（校内自命题）',
    season: '2027', date: '2026-07',
    source: '南京信息工程大学 2027 招生科目调整（统考改回自命题，本年度少数反向调整案例）',
    url: '',
    note: '反向调整：2026 年考 408，2027 年退回自命题。按旧信息准备的同学最容易踩坑。'
  },
  {
    id: 'bit-085405-408',
    school: '北京理工大学', college: '软件学院', major: '软件工程', code: '085405', degreeType: '专硕',
    kind: 'to408', from: '885 单科自命题', to: '408 计算机学科专业基础',
    season: '2027', date: '2026-07',
    source: '北京理工大学软件工程专业科目调整公告',
    url: ''
  },
  {
    id: 'dlut-081200-408',
    school: '大连理工大学', college: '计算机科学与工程学院', major: '计算机科学与技术', code: '081200', degreeType: '学硕',
    kind: 'to408', from: '校内自命题', to: '408 计算机学科专业基础',
    season: '2026', date: '2025',
    source: '大连理工大学 2026 年计算机学硕首次改考 408（已进入 2026 招生季执行）',
    url: '',
    note: '该校为上一轮改考的代表案例，可作为「新改考院校分数线上涨」的参照。'
  }
];

const KIND_META = {
  to408: { name: '改考 408', color: 'var(--forest-deep)', desc: '自命题改为全国统考 408' },
  back:  { name: '回退自命题', color: 'var(--danger)', desc: '统考改回校内自命题（反向调整）' },
  new:   { name: '专业调整', color: 'var(--ok)', desc: '新增专业 / 专业代码或门类调整' }
};

/* ---------------- 实时数据接入（school-sync） ---------------- */
/**
 * RAW 是「打包内置种子」：云不可用时回退到这里，保证无网也能用。
 * 外部访问的 DATA_SEASON / SYNC_AT / CHANGE_LOG 等已改成「实时取值」——
 * 云端拉取到补丁则展示云端最新；否则回退 RAW。详见 services/school-sync.js。
 */
const RAW = {
  version: VERSION, syncAt: SYNC_AT, season: DATA_SEASON,
  syncNote: SYNC_NOTE, calendar: CALENDAR, chsi: CHSI,
  kindMeta: KIND_META, changes: CHANGE_LOG
};

const sync = require('./school-sync');
function live() { return sync.data(); }

/* ---------------- 查询 ---------------- */

function changes(opt) {
  opt = opt || {};
  let list = live().changes.slice();
  if (opt.school) list = list.filter((c) => c.school.indexOf(opt.school) >= 0);
  if (opt.kind) list = list.filter((c) => c.kind === opt.kind);
  if (opt.season) list = list.filter((c) => String(c.season) === String(opt.season));
  if (opt.majorCode) list = list.filter((c) => c.code === opt.majorCode);
  if (opt.keyword) {
    const kw = String(opt.keyword);
    list = list.filter((c) =>
      c.school.indexOf(kw) >= 0 || c.major.indexOf(kw) >= 0 || c.college.indexOf(kw) >= 0 || String(c.code).indexOf(kw) >= 0);
  }
  // 按日期倒序，无日期的排最后
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return list.map((c) => Object.assign({}, c, { kindName: (KIND_META[c.kind] || {}).name || '调整' }));
}

/** 某校某专业是否命中调整动态 */
function matchOf(schoolName, majorCode) {
  return live().changes.filter((c) => c.school === schoolName && (!majorCode || c.code === majorCode));
}

/** 该专业当前对应的「最新专业代码」（有些专业代码会因门类调整而变化，如 0775 → 0812） */
function codeOf2027(schoolName, majorName) {
  const hit = live().changes.find((c) =>
    c.school === schoolName && c.major === majorName && (c.kind === 'new' || c.kind === 'to408') && String(c.code).indexOf('0') === 0);
  if (!hit) return null;
  // 若为门类/代码调整，to 文本里会出现新代码
  const m = String(hit.to).match(/(\d{4})/);
  return m ? m[1] : null;
}

/** 招生季时间轴（按当前月标注 done / now / next） */
function calendar(nowDate) {
  const d = nowDate ? new Date(nowDate) : new Date();
  const m = d.getMonth() + 1;
  return live().calendar.map((it) => {
    if (it.state === 'done') return it;
    return Object.assign({}, it, { state: it.month === m ? 'now' : (it.month > m ? 'next' : 'done') });
  });
}

/** 当前正处的关键阶段提示 */
function currentPhase(nowDate) {
  const list = calendar(nowDate);
  return list.find((x) => x.state === 'now') || list[0] || null;
}

/**
 * 数据新鲜度分级
 * level: official（用户已录入真实数据）/ fresh（结构性事实，随批次同步）/ stale（数字为估算，需重新核实）
 */
function freshnessOf(program) {
  if (program && program.userLine) return { level: 'official', name: '你已核实', color: 'var(--ok)', tip: '以你录入的数据为准' };
  return {
    level: 'season',
    name: live().season + ' 招生季批次',
    color: 'var(--ok)',
    tip: '科目与代码已对齐官方公告；招生人数与分数线仍为估算，建议点官方链接复核'
  };
}

/** 一键直达：研招网入口 + 院校研究生院 + 公告原文 */
function officialLinks(school, program) {
  const gradeUrl = (school && school.gradWebsite) || (program && program.officialUrl) || '';
  const noticeUrl = (program && program.sourceUrl) || '';
  const out = [{ label: '研招网（全国口径）', url: live().chsi.host, primary: true }];
  if (gradeUrl) out.push({ label: (school && school.name ? school.name : '') + '研究生院', url: gradeUrl });
  if (noticeUrl) out.push({ label: '科目调整公告原文', url: noticeUrl });
  return out;
}

module.exports = {
  // 打包内置种子（供 school-sync 回退使用，不对外依赖）
  RAW,
  // 实时取值：云端补丁优先，否则回退 RAW 种子
  get DATA_SEASON() { return live().season; },
  get SYNC_AT() { return live().syncAt; },
  get SYNC_NOTE() { return live().syncNote; },
  get CHSI() { return live().chsi; },
  get CHANGE_LOG() { return live().changes; },
  get CALENDAR() { return live().calendar; },
  get VERSION() { return live().version; },
  get SOURCE() { return live().source; },
  KIND_META,
  // 实时查询函数
  changes, matchOf, codeOf2027, calendar, currentPhase, freshnessOf, officialLinks,
  // 同步层状态（给页面用）
  get state() { return sync.syncState(); }
};
