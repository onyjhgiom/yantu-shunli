/**
 * 院校与专业库（计算机类 408 统考 · 11408 / 22408）
 *
 * 覆盖范围：仅收录考试科目含 408 的计算机类专业。
 *   11408 = 学硕：政治 + 英语一 + 数学一 + 408
 *   22408 = 专硕：政治 + 英语二 + 数学二 + 408
 *
 * ⚠️ 数据性质（务必在 UI 上向用户明示）：
 *   · 院校 / 专业 / 学院 / 学位类型 / 考试科目 —— 公开信息整理，属结构性事实。
 *   · 招生计划 planCount 与复试线区间 bandLow~bandHigh —— 【按院校层次估算的参考值】，
 *     非官方数据，年际波动可达 ±20 分。择校前必须以院校研究生院当年公告为准。
 *   · 系统提供 u（官方研究生招生网站）用于一键跳转核实。
 *   · 用户可用 setUserLine() 录入自己查到的真实分数线，本地覆盖后优先展示并高亮。
 */
const db = require('./db');
const util = require('../utils/util');
const store = require('../utils/store');
const targetService = require('./target');
const profileService = require('./profile');
const DATA = require('./schools-data');
const FRESH = require('./school-fresh');
const sync = require('./school-sync');
const enrichService = require('./schools-enrich');
const researchService = require('./research');

const EXAM_CODES = ['11408', '22408'];
const EXAM_CODE_LABELS = {
  '11408': '11408（数一 + 英一 + 408 · 学硕）',
  '22408': '22408（数二 + 英二 + 408 · 专硕）'
};

const CS_BOOKS = ['数据结构(C语言版)', '计算机组成原理', '操作系统', '计算机网络'];

/**
 * 学费参考（按学位类型 + 院校层次估算，非官方）。
 * 学硕：国家公办高校统标约 8000 元/年；专硕：因校而异，按层次给典型区间。
 * 真实学费以院校研究生院收费公示为准。
 */
function tuitionOf(degreeType, level) {
  if (degreeType === '学硕') {
    return { value: 8000, text: '约 8000 元/年', note: '学硕国家统标（多数公办高校）', estimated: true };
  }
  const ranges = { 1: [12000, 30000], 2: [10000, 24000], 3: [9000, 18000], 4: [8000, 15000], 5: [8000, 12000] };
  const r = ranges[level] || [8000, 15000];
  return { value: r[0], text: `${r[0]}–${r[1]} 元/年`, note: '专硕学费因校而异，区间供参考', estimated: true };
}

const LEVELS = DATA.LEVELS;

const DATA_NOTE = '参考区间（按院校层次估算·非官方）';
const OVERRIDE_NOTE = '你录入的真实数据';

/* ---------------- 构造专业对象 ---------------- */

function mkProgram(school, pg) {
  const enrich = enrichService.enrichOf(school);
  const [majorCode, majorName, college, degreeType, examCode, plan, lo, hi] = pg;
  const isXS = examCode === '11408';
  const math = isXS ? '数学一' : '数学二';
  const eng = isXS ? '英语一' : '英语二';
  const id = `${school.c}-${majorCode}`;
  const ov = (userLines()[id] || {});
  return {
    id,
    schoolCode: school.c,
    schoolName: school.n,
    province: school.p,
    city: school.city,
    tags: school.tg || [],
    level: school.lv,
    levelName: (LEVELS[school.lv] || {}).name || '重点',
    levelColor: (LEVELS[school.lv] || {}).color || 'var(--c-english)',
    officialUrl: school.u || '',
    majorCode,
    majorName,
    college,
    degreeType,
    studyMode: '全日制',
    category: '计算机',
    examCode,
    math,
    eng,
    majorExam: '408',
    majorExamName: '计算机学科专业基础综合',
    examSubjects: [
      { code: '101', name: '思想政治理论' },
      { code: isXS ? '201' : '204', name: eng },
      { code: isXS ? '301' : '302', name: math },
      { code: '408', name: '计算机学科专业基础综合' }
    ],
    planCount: plan,
    // 参考区间（估算）与用户覆盖值
    bandLow: lo,
    bandHigh: hi,
    userLine: ov.line || 0,
    userPlan: ov.plan || 0,
    refBooks: CS_BOOKS,
    // 研究方向：通用明细 + 学校特色方向（带说明/就业/学校标记）
    directions: researchService.mkDirections(school, { majorCode }),
    directionsText: researchService.mkDirections(school, { majorCode }).map((d) => d.name).join('、'),
    // 院校画像（学科评估/简介/优势/复试特点/二本友好度/重点平台）
    assess: enrich.assess,
    assessRound: enrich.assessRound,
    assessFields: enrich.assessFields,
    assessSource: enrich.source,
    intro: enrich.intro,
    strengths: enrich.strengths,
    retest: enrich.retest,
    friendly: enrich.friendly,
    friendlyNote: enrich.friendlyNote,
    platform: enrich.platform,
    tuition: tuitionOf(degreeType, school.lv),
    remark: `${examCode} · ${degreeType}`,
    source: ov.line ? OVERRIDE_NOTE : DATA_NOTE,
    updatedAt: ov.line ? (ov.at || '') : '',
    // ---- 信息时效字段（见 services/school-fresh.js）----
    season: FRESH.DATA_SEASON,          // 本条对应的招生季
    checkedAt: FRESH.SYNC_AT,           // 结构性事实（科目/代码/学院）的同步日期
    // 该专业命中的官方科目调整公告（若有）
    changeList: FRESH.matchOf(school.n, majorCode).map((c) => ({
      id: c.id, kind: c.kind, kindName: (FRESH.KIND_META[c.kind] || {}).name || '调整',
      from: c.from, to: c.to, date: c.date, source: c.source, url: c.url, note: c.note || '',
      college: c.college, major: c.major, code: c.code
    })),
    hasChange: FRESH.matchOf(school.n, majorCode).length > 0,
    sourceUrl: (ov.url) || '',          // 用户录入的公告链接
    sourceDate: (ov.date) || '',        // 用户录入的公告日期
    sourceName: (ov.source) || '',      // 用户录入的来源
    freshness: FRESH.freshnessOf({ userLine: ov.line }),
    // 兼容旧页面：由区间生成的参考趋势
    scoreLines: mkLines(id, lo, hi, ov),
    latest: mkLines(id, lo, hi, ov).slice(-1)[0] || null
  };
}

/** 由参考区间生成近 4 年的参考趋势（明确标注为估算） */
function mkLines(id, lo, hi, ov) {
  const drift = [0, -5, 8, 4]; // 相对基准的波动示意
  return [2022, 2023, 2024, 2025].map((year, i) => {
    const base = ov && ov.line ? ov.line : Math.round((lo + hi) / 2);
    const total = base + drift[i];
    return {
      year,
      total,
      retestLine: total,
      subjectLines: {
        politics: 55,
        english: Math.round(total * 0.145),
        math: Math.round(total * 0.20),
        major: Math.round(total * 0.19)
      },
      estimated: !ov || !ov.line,
      source: ov && ov.line ? OVERRIDE_NOTE : DATA_NOTE
    };
  });
}

let _cache = null;
let _programsCache = null;   // 随 _cache 失效而重建（见 allPrograms）
let _programsOwner = null;
function allSchools() {
  // 云端时效数据更新后，school-sync 会置 dirty 标记，这里据此失效院校缓存并重建
  if (_cache && !db.get(db.KEYS.schoolFreshDirty, false)) return _cache;
  db.set(db.KEYS.schoolFreshDirty, false);
  _cache = DATA.SCHOOLS.map((s) => {
    const en = enrichService.enrichOf(s);
    return {
      code: s.c,
      name: s.n,
      province: s.p,
      city: s.city,
      tags: s.tg || [],
      type: s.tp,
      level: s.lv,
      levelName: (LEVELS[s.lv] || {}).name || '重点',
      levelColor: (LEVELS[s.lv] || {}).color || 'var(--c-english)',
      website: '',
      gradWebsite: s.u || '',
      programCount: s.pg.length,
      // 院校画像（列表/详情共用）
      assess: en.assess,
      assessRound: en.assessRound,
      assessFields: en.assessFields,
      assessSource: en.source,
      intro: en.intro,
      strengths: en.strengths,
      retest: en.retest,
      friendly: en.friendly,
      friendlyNote: en.friendlyNote,
      platform: en.platform,
      programs: s.pg.map((pg) => mkProgram(s, pg))
    };
  });
  return _cache;
}

function allPrograms() {
  const schools = allSchools();
  // 懒缓存：只要 allSchools() 返回的是同一份缓存引用就直接复用，避免每次搜索/统计都重新拉平 1000+ 专业
  if (_programsCache && _programsOwner === schools) return _programsCache;
  const out = [];
  schools.forEach((s) => s.programs.forEach((p) => out.push(p)));
  _programsCache = out;
  _programsOwner = schools;
  return out;
}

function program(id) {
  return allPrograms().find((p) => p.id === id) || null;
}

function get(code) { return allSchools().find((s) => s.code === code) || null; }

/** 由院校名反查院校代码（改考动态页跳转用） */
function codeOfSchoolName(name) {
  const s = allSchools().find((x) => x.name === name);
  return s ? s.code : '';
}

/** 该校有多少个专业命中了科目调整 */
function changeCountOfSchool(code) {
  const s = get(code);
  if (!s) return 0;
  return s.programs.filter((p) => p.hasChange).length;
}

/**
 * 院校「学院 → 专业」结构树（专业挂研究方向 / 学费 / 复试线区间）。
 * 用于详情页精确展示「某校有哪些学院、各学院下有哪些专业、每个专业的研究方向与参考分数/学费」。
 * 说明：分数线只发到专业级，研究方向共享所在专业的参考区间；细分「系」层级在数据中以招生学院(college)体现。
 */
function structure(schoolCode) {
  const s = get(schoolCode);
  if (!s) return null;
  const groups = {};
  s.programs.forEach((p) => {
    const g = p.college || '其他';
    if (!groups[g]) groups[g] = { college: g, majors: [] };
    groups[g].majors.push(p);
  });
  return {
    schoolCode: s.code,
    schoolName: s.name,
    colleges: Object.keys(groups).map((k) => groups[k])
  };
}

/**
 * 搜索 / 筛选
 * opt: { keyword, province, tag, degreeType, examCode, level, sort }
 */
function search(opt) {
  opt = opt || {};
  let list = allSchools().slice();

  if (opt.keyword) {
    const kw = String(opt.keyword).trim();
    list = list.filter((s) =>
      s.name.indexOf(kw) >= 0 ||
      s.city.indexOf(kw) >= 0 ||
      s.province.indexOf(kw) >= 0 ||
      s.programs.some((p) => p.majorName.indexOf(kw) >= 0 || (p.college || '').indexOf(kw) >= 0 || p.majorCode.indexOf(kw) >= 0));
  }
  if (opt.province) list = list.filter((s) => s.province === opt.province);
  if (opt.tag) list = list.filter((s) => (s.tags || []).indexOf(opt.tag) >= 0);
  if (opt.level) list = list.filter((s) => String(s.level) === String(opt.level));
  if (opt.degreeType || opt.examCode) {
    list = list.filter((s) => s.programs.some((p) =>
      (!opt.degreeType || p.degreeType === opt.degreeType) &&
      (!opt.examCode || p.examCode === opt.examCode)));
  }

  // 排序
  const sort = opt.sort || 'level';
  if (sort === 'level') list.sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));
  else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  else if (sort === 'plan') {
    const planOf = (s) => s.programs.reduce((m, p) => m + p.planCount, 0);
    list.sort((a, b) => planOf(b) - planOf(a));
  } else if (sort === 'line') {
    const lineOf = (s) => Math.min.apply(null, s.programs.map((p) => p.bandHigh));
    list.sort((a, b) => lineOf(b) - lineOf(a));
  }
  return list;
}

/** 多所院校/专业对比 */
function compare(ids) {
  const t = targetService.getTarget();
  const targetScore = t && t.totalScore ? t.totalScore : 0;
  return ids.map(program).filter(Boolean).map((p) => {
    const lines = (p.scoreLines || []).slice().sort((a, b) => a.year - b.year);
    const latest = lines[lines.length - 1] || null;
    const ref = p.userLine || p.bandHigh;
    const diff = targetScore ? targetScore - ref : null;
    return Object.assign({}, p, {
      lines,
      latest,
      diff,
      prob: probOf(targetScore, p)
    });
  });
}

/* ---------------- 录取概率估算 ---------------- */

/**
 * 基于用户分数与院校参考区间的粗略概率（用于分档，不是预测）
 */
function probOf(score, p) {
  if (!score) return null;
  const lo = p.bandLow, hi = p.bandHigh;
  const ref = p.userLine || Math.round((lo + hi) / 2);
  const d = score - ref;
  if (d >= 20) return 90;
  if (d >= 12) return 80;
  if (d >= 5) return 70;
  if (d >= -5) return 58;
  if (d >= -15) return 42;
  if (d >= -25) return 28;
  return 15;
}

function tierOf(prob) {
  if (prob == null) return { key: 'unknown', name: '待评估', color: 'var(--sub)' };
  if (prob >= 70) return { key: 'safe', name: '保底', color: 'var(--ok)' };
  if (prob >= 45) return { key: 'stable', name: '稳妥', color: 'var(--ok)' };
  if (prob >= 25) return { key: 'reach', name: '冲刺', color: 'var(--forest-deep)' };
  return { key: 'risk', name: '风险', color: 'var(--danger)' };
}

/* ---------------- 智能择校推荐 ---------------- */

/**
 * 智能择校：按用户分数 + 背景画像给出冲/稳/保三档
 * opt: { score, examCode, degreeType, provinces:[], tags:[], levels:[], limit, background }
 *   background 缺省时自动读取用户「考研背景」（二本出身/编程水平/定居城市/报考路径）
 *
 * 分档仍基于「分数 vs 参考线」(probOf) 保证客观；但每档内部排序与推荐理由
 * 会叠加【学科评估 / 二本友好度 / 复试机试风险 / 地域匹配 / 报考路径一致】等智能因子，
 * 让推荐更贴合考生真实情况（如二本+编程弱应优先无硬机试、二本友好、地域匹配的学校）。
 */
function gradeVal(g) {
  const m = { 'A+': 6, 'A': 5, 'A-': 4, 'B+': 3, 'B': 2, 'B-': 1 };
  return m[g] || 0;
}

/** 计算某专业对当前考生背景的「匹配度」(-10~+10) 与归因 */
function fitOf(p, bg) {
  const fit = { score: 0, regionMatch: false, friendlyMatch: null, machineRisk: false, examMatch: true, assessCs: '' };
  if (!bg) return fit;
  fit.assessCs = (p.assess && p.assess.cs) || '';

  // 地域匹配：定居城市命中该校所在城市
  if (bg.settleCity && p.city && (p.city.indexOf(bg.settleCity) >= 0 || bg.settleCity.indexOf(p.city) >= 0)) {
    fit.regionMatch = true; fit.score += 4;
  }

  // 二本友好度：二本/双非出身时权重最高
  if (bg.undergradTier === '二本' || bg.undergradTier === '专科' || bg.undergradTier === '普通本科') {
    if (p.friendly === '高') { fit.friendlyMatch = '高'; fit.score += 3; }
    else if (p.friendly === '低') { fit.friendlyMatch = '低'; fit.score -= 4; }
    else { fit.friendlyMatch = '中'; }
  } else if (p.friendly === '低') {
    fit.friendlyMatch = '低'; fit.score -= 1;
  }

  // 复试机试风险：编程弱 + 有硬机试 = 高风险
  const weakCode = !bg.codingLevel || bg.codingLevel === 'none' || bg.codingLevel === 'beginner';
  if (p.retest && p.retest.machine === true) {
    if (weakCode) { fit.machineRisk = true; fit.score -= 4; }
  } else if (p.retest && p.retest.machine === false && weakCode) {
    fit.score += 2; // 无硬机试对编程弱是利好
  }

  // 报考路径一致
  if (bg.examPath && p.examCode && bg.examPath !== p.examCode) {
    fit.examMatch = false; fit.score -= 3;
  }

  // 学科评估（计算机）强的轻微加分（价值维度）
  if (gradeVal(fit.assessCs) >= 5) fit.score += 1;

  return fit;
}

function recommend(opt) {
  opt = opt || {};
  const score = opt.score || (targetService.getTarget() && targetService.getTarget().totalScore) || 0;
  const bg = opt.background || (profileService.getBackground ? profileService.getBackground() : null);
  let list = allPrograms();

  if (opt.examCode) list = list.filter((p) => p.examCode === opt.examCode);
  if (opt.degreeType) list = list.filter((p) => p.degreeType === opt.degreeType);
  if (opt.provinces && opt.provinces.length) list = list.filter((p) => opt.provinces.indexOf(p.province) >= 0);
  if (opt.tags && opt.tags.length) list = list.filter((p) => opt.tags.some((t) => (p.tags || []).indexOf(t) >= 0));
  if (opt.levels && opt.levels.length) list = list.filter((p) => opt.levels.indexOf(String(p.level)) >= 0);

  const scored = list.map((p) => {
    const prob = probOf(score, p);
    const fit = fitOf(p, bg);
    return { p, prob: prob || 0, tier: tierOf(prob), fit };
  });

  // 每档内排序：匹配度优先，其次名额多、参考线低（更易稳）
  const rank = (a, b) =>
    (b.fit.score - a.fit.score) ||
    (b.p.planCount - a.p.planCount) ||
    (a.p.bandHigh - b.p.bandHigh);
  const pick = (key) => scored.filter((x) => x.tier.key === key).sort(rank);

  const limit = opt.limit || 5;
  const reach = pick('reach').slice(0, limit);
  const stable = pick('stable').slice(0, limit);
  const safe = pick('safe').slice(0, limit);

  return {
    score,
    hasScore: !!score,
    background: bg ? {
      undergradTier: bg.undergradTier, codingLevel: bg.codingLevel,
      settleCity: bg.settleCity, examPath: bg.examPath
    } : null,
    tiers: [
      { key: 'reach', name: '冲刺', desc: '需要超常发挥，但值得一试', color: 'var(--forest-deep)', list: reach.map(toRecCard) },
      { key: 'stable', name: '稳妥', desc: '与你的分数和背景匹配度最高', color: 'var(--ok)', list: stable.map(toRecCard) },
      { key: 'safe', name: '保底', desc: '大概率能上，防止滑档', color: 'var(--ok)', list: safe.map(toRecCard) }
    ],
    total: list.length
  };
}

function toRecCard(x) {
  const p = x.p;
  const fit = x.fit || {};
  return {
    id: p.id,
    schoolName: p.schoolName,
    majorName: p.majorName,
    college: p.college,
    city: p.city,
    province: p.province,
    degreeType: p.degreeType,
    examCode: p.examCode,
    levelName: p.levelName,
    levelColor: p.levelColor,
    planCount: p.planCount,
    bandText: `${p.bandLow}-${p.bandHigh}`,
    userLine: p.userLine,
    assessCs: (p.assess && p.assess.cs) || '',
    assessRound: p.assessRound,
    friendly: p.friendly,
    fitScore: typeof fit.score === 'number' ? fit.score : 0,
    regionMatch: !!fit.regionMatch,
    friendlyMatch: fit.friendlyMatch,
    machineRisk: !!fit.machineRisk,
    examMatch: fit.examMatch !== false,
    prob: x.prob,
    probText: x.prob + '%',
    tierName: x.tier.name,
    tierColor: x.tier.color,
    reason: recReason(p, x.prob, fit)
  };
}

function recReason(p, prob, fit) {
  const bits = [];
  bits.push(`${p.levelName}院校`);
  if (p.assess && p.assess.cs) bits.push(`计科评估 ${p.assess.cs}`);
  if (p.planCount >= 80) bits.push(`招生 ${p.planCount} 人（名额较多）`);
  else if (p.planCount <= 20) bits.push(`仅招 ${p.planCount} 人（名额少，注意风险）`);
  if (prob >= 70) bits.push('分数高于参考线较多');
  else if (prob >= 45) bits.push('分数与参考线接近');
  else bits.push('需要提分才能更稳');
  // 背景匹配归因
  if (fit) {
    if (fit.regionMatch) bits.push('地域匹配定居城市');
    if (fit.friendlyMatch === '高') bits.push('二本友好');
    else if (fit.friendlyMatch === '低') bits.push('二本需谨慎');
    if (fit.machineRisk) bits.push('⚠️有硬机试·编程弱有风险');
    if (fit.examMatch === false) bits.push('⚠️报考路径不符');
  }
  if (p.userLine) bits.push('已录入真实分数线');
  return bits.join(' · ');
}

/* ---------------- 用户录入的真实分数线（本地覆盖） ---------------- */

function userLines() { return db.get(db.KEYS.userLines, {}); }

/**
 * 录入/清除「官方真实数据」
 * data: { line, plan, url, date, source }
 *   line    真实复试线（必填，有它才会覆盖系统估算）
 *   plan    真实招生计划
 *   url     你查到那份公告/专业目录的链接
 *   date    公告发布日期
 *   source  来源名称（如「XX大学研究生院 2027 专业目录」）
 * 保存后该条在页面上标记为「你已核实」，并给出公告原文一键直达。
 */
function setUserLine(programId, data) {
  const map = Object.assign({}, userLines());
  if (!data || !data.line) delete map[programId];
  else {
    map[programId] = {
      line: Number(data.line),
      plan: Number(data.plan) || 0,
      url: data.url || '',
      date: data.date || '',
      source: data.source || '',
      at: util.dateStr()
    };
  }
  db.set(db.KEYS.userLines, map);
  _cache = null; // 清缓存，重新构造
  db.set(db.KEYS.schoolFreshDirty, true); // 用户覆盖线也会改变专业 freshness，一并失效
  store.emit(store.TOPICS.SCHOOL_TARGET_CHANGED, map);
  return map;
}

function getUserLine(programId) { return userLines()[programId] || null; }

function userLineCount() { return Object.keys(userLines()).length; }

/* ---------------- 用户目标院校（冲/稳/保） ---------------- */

function userTargets() { return db.get(db.KEYS.userTargets, []); }
function saveTargets(list) { db.set(db.KEYS.userTargets, list); store.emit(store.TOPICS.SCHOOL_TARGET_CHANGED, list); }
function addTarget(data) {
  const item = Object.assign({ id: util.uid('ut'), tier: '稳', note: '', createdAt: Date.now() }, data);
  if (!item.programId) throw new Error('请选择院校专业');
  const list = userTargets();
  // 已加入过同一专业则不再重复写入（防连点/多次点击产生重复目标）
  const dup = list.find((t) => t.programId === item.programId);
  if (dup) return dup;
  list.unshift(item);
  saveTargets(list);
  return item;
}
function removeTarget(id) { saveTargets(userTargets().filter((t) => t.id !== id)); }

/** 设为主目标：同步到 F1 档案 */
function setMainTarget(id) {
  const t = userTargets().find((x) => x.id === id);
  if (!t) return null;
  const p = program(t.programId);
  const totalScore = t.targetScore || (p && (p.userLine || p.bandHigh)) || (targetService.getTarget() && targetService.getTarget().totalScore) || 0;
  targetService.setTarget({
    university: t.schoolName,
    major: t.majorName,
    totalScore,
    examCode: p ? p.examCode : undefined
  });
  return t;
}

/** 目标院校列表（带实时概率） */
function targetList() {
  const t = targetService.getTarget();
  const score = (t && t.totalScore) || 0;
  return userTargets().map((item) => {
    const p = program(item.programId);
    if (!p) return Object.assign({}, item, { missing: true });
    const prob = probOf(score, p);
    return Object.assign({}, item, {
      schoolName: p.schoolName,
      majorName: p.majorName,
      college: p.college,
      examCode: p.examCode,
      degreeType: p.degreeType,
      city: p.city,
      planCount: p.planCount,
      bandText: `${p.bandLow}-${p.bandHigh}`,
      userLine: p.userLine,
      prob,
      probText: prob == null ? '—' : prob + '%',
      tier: tierOf(prob)
    });
  });
}

/* ---------------- 统计 ---------------- */

function stats() {
  const schools = allSchools();
  const progs = allPrograms();
  return {
    schoolCount: schools.length,
    programCount: progs.length,
    xueshuo: progs.filter((p) => p.examCode === '11408').length,
    zhuanshuo: progs.filter((p) => p.examCode === '22408').length,
    provinceCount: DATA.provinces().length,
    changeCount: changeList().length,
    season: FRESH.DATA_SEASON,
    syncAt: FRESH.SYNC_AT,
    version: FRESH.VERSION,
    live: FRESH.SOURCE === 'cloud'
  };
}

/* ---------------- 信息时效 / 改考动态（对接 school-fresh） ---------------- */

/** 全国计算机类科目调整动态 */
function changeList(opt) { return FRESH.changes(opt); }

/** 当前所处招生季阶段 */
function currentPhase(nowDate) { return FRESH.currentPhase(nowDate); }

/** 数据批次说明（全口径背景） */
function seasonInfo() {
  return {
    season: FRESH.DATA_SEASON,
    syncAt: FRESH.SYNC_AT,
    version: FRESH.VERSION,
    live: FRESH.SOURCE === 'cloud',
    summary: FRESH.SYNC_NOTE.summary,
    policy: FRESH.SYNC_NOTE.policy,
    caution: FRESH.SYNC_NOTE.caution,
    chsi: FRESH.CHSI
  };
}

/** 一键直达链接：研招网 + 院校研究生院 + 公告原文 */
function officialLinks(school, program) { return FRESH.officialLinks(school, program); }

/**
 * 院校库整体新鲜度（给列表页顶部用）
 * verifiedCount: 用户已录入真实数据的专业数
 */
function freshnessSummary() {
  const progs = allPrograms();
  const verified = progs.filter((p) => p.userLine).length;
  return {
    season: FRESH.DATA_SEASON,
    syncAt: FRESH.SYNC_AT,
    version: FRESH.VERSION,
    live: FRESH.SOURCE === 'cloud',
    newCount: sync.newCount(),
    verified,
    total: progs.length,
    verifiedRate: progs.length ? Math.round(verified / progs.length * 100) : 0,
    freshnessOf: FRESH.freshnessOf
  };
}

const PROVINCES = DATA.provinces();
const TAGS = DATA.tags();

module.exports = {
  SCHOOLS: DATA.SCHOOLS, LEVELS, EXAM_CODES, EXAM_CODE_LABELS, CS_BOOKS,
  PROVINCES, TAGS,
  DATA_NOTE, OVERRIDE_NOTE,
  allSchools, allPrograms, program, get, structure, search, compare,
  codeOfSchoolName, changeCountOfSchool,
  provinces: DATA.provinces, tags: DATA.tags, stats,
  // 信息时效 / 改考动态
  changeList, currentPhase, seasonInfo, officialLinks, freshnessSummary,
  recommend, probOf, tierOf,
  userLines, setUserLine, getUserLine, userLineCount,
  userTargets, addTarget, removeTarget, setMainTarget, targetList,
  // 院校库时效数据实时同步（school-sync 委派）
  syncState: () => sync.syncState(),
  refreshFresh: (force) => sync.checkUpdate(force),
  markFreshSeen: () => sync.markSeen(),
  checkFreshSilent: (cb) => sync.checkFreshSilent(cb)
};
