/*
 * 考研日历 —— 月历矩阵 / 招生季节点 / 当前阶段行动指引
 *
 * 与 services/school-fresh.js 里 CALENDAR 的分工：
 *   那边是「改考动态」的附属时间轴（院校库弹窗调用），重数据；
 *   这边是日历页独立的真相源，只管「现在处于哪个阶段、这个阶段该做什么、这个月有哪些节点」。
 */

const util = require('../utils/util');

/**
 * 招生季阶段 —— 用自然月区间（from / to）定义，**不要**用线性索引。
 *
 * 坑：一个阶段可能横跨 2 个月（7–8 月暑期），阶段个数（9 个）少于自然月个数（12 个），
 * 所以「当前月」绝不能直接当索引去查表。曾经用 idx 直接映射，结果 9 月被算成「确认与准考证」。
 */
const PHASES = [
  { from: 12, to: 12, name: '初试月', short: '初试', range: '12 月',
    focus: ['最后冲刺：政治背时政 + 数学卷子手感 + 英语作文模板', '专业课按答题框架过一遍，别再开新章'],
    watch: '考试前三天打印准考证，订好交通住宿' },
  { from: 1, to: 1, name: '考后等待期', short: '等成绩', range: '1 月',
    focus: ['估分与复盘：把错题本按科目重看一遍', '提前准备复试专业课与英语自我介绍'],
    watch: '2 月中下旬成绩公布，提前比对目标院校复试线' },
  { from: 2, to: 3, name: '成绩与复试', short: '出分复试', range: '2–3 月',
    focus: ['2 月出分后立刻比对复试线，判定进面 / 调剂 / 另战', '3 月国家线发布，同步准备复试'],
    watch: '部分院校有机试，务必查清目标院系的复试细则' },
  { from: 4, to: 4, name: '调剂季', short: '调剂', range: '4 月',
    focus: ['4 月调剂系统开放，缺额以系统内实时为准', '联系导师要趁早，邮件比系统消息更有效'],
    watch: '调剂志愿锁定时间有限，别同时锁多个' },
  { from: 5, to: 6, name: '科目调整期', short: '改考期', range: '5–6 月',
    focus: ['各校公布初试科目调整（含改考 408），立刻按新科目调整复习计划', '若目标院校改考，尽快补齐新科目基础'],
    watch: '改考是最大的信息差，务必查院校研究生院官网原文' },
  { from: 7, to: 8, name: '暑期强化', short: '暑期', range: '7–8 月',
    focus: ['数学强化 + 专业课强化，全年提分最快的两个月', '英语阅读保持手感，别只背单词不做题'],
    watch: '暑期是弃考高发期，固定作息比拼时长更重要' },
  { from: 9, to: 9, name: '招生简章期', short: '简章', range: '9 月',
    focus: ['招生简章 + 专业目录发布，专业代码 / 考试科目 / 招生计划以这一版为准', '9 月下旬预报名，蹲一个心仪报考点'],
    watch: '新一版专业目录出来后，核对自己的目标专业是否还在' },
  { from: 10, to: 10, name: '正式报名', short: '报名', range: '10 月',
    focus: ['10 月中下旬正式报名，确认报考院校与专业', '报名后开始按考试时间倒排最后两个月的复习'],
    watch: '报名信息提交后要反复核对，改起来很麻烦' },
  { from: 11, to: 11, name: '确认与准考证', short: '确认', range: '11 月',
    focus: ['网上确认核对学籍学历信息，通过后才算报名成功', '下载打印准考证，多打两份'],
    watch: '有要求现场确认的省份，别错过时间' }
];

/** 阶段查表：给定自然月，返回覆盖它的阶段 */
function phaseByMonth(month) {
  return PHASES.find((p) => month >= p.from && month <= p.to) || null;
}

/**
 * 当前阶段。传 dateStr 便于测试。
 * 附带距下一阶段起始月的天数（跨年会自动进到次年）。
 */
function phaseAt(dateStr) {
  const d = util.parseDate(dateStr || util.dateStr());
  const m = d.getMonth() + 1;
  const p = phaseByMonth(m);
  if (!p) return null;

  const i = PHASES.indexOf(p);
  const next = i + 1 < PHASES.length ? PHASES[i + 1] : null;
  let daysToNext = null;
  if (next) {
    // next.from 可能不大于当前月（例如 12 月的下一阶段是次年 1 月），那就进到次年
    let y = d.getFullYear();
    if (next.from <= m) y += 1;
    daysToNext = util.daysBetween(util.dateStr(d), y + '-' + (next.from < 10 ? '0' + next.from : next.from) + '-01');
  }
  return { name: p.name, short: p.short, range: p.range, focus: p.focus, watch: p.watch, daysToNext, next: next ? { name: next.name, short: next.short, range: next.range } : null };
}

/**
 * 全国招生季节点 —— 只精确到现在是哪个自然月，不编造具体日期。
 * state: done（已过）/ now（本月）/ next（未来）
 */
const SEASON_NODES = [
  { month: 5, key: 'adjust', title: '科目调整预公告', desc: '各校陆续公布初试科目调整（含改考 408），此时就要按新科目复习' },
  { month: 9, key: 'manual', title: '招生简章 + 专业目录', desc: '正式方案落地，专业代码、考试科目、招生计划以这一版为准' },
  { month: 9, key: 'presign', title: '预报名', desc: '通常在 9 月下旬开放，蹲一个心仪报考点' },
  { month: 10, key: 'sign', title: '正式报名', desc: '10 月中下旬开通，确认报考院校与专业' },
  { month: 11, key: 'confirm', title: '网上确认 / 准考证', desc: '核对学籍学历信息，下载打印准考证' },
  { month: 12, key: 'exam', title: '初试', desc: '12 月第三个周末，政治 + 英语 + 数学 + 专业课' },
  { month: 2, key: 'score', title: '成绩公布', desc: '次年 2 月中下旬，第一时间对比目标院校复试线' },
  { month: 3, key: 'line', title: '国家线 + 复试', desc: '3 月国家线发布，随后院校组织复试' },
  { month: 4, key: 'transfer', title: '调剂系统', desc: '4 月调剂服务系统开放，缺额信息以系统内为准' }
];

/** 带状态的招生季节点（按月份升序） */
function seasonNodes(dateStr) {
  const d = util.parseDate(dateStr || util.dateStr());
  const m = d.getMonth() + 1;
  return SEASON_NODES.map((n) => {
    let state = 'next';
    if (n.month < m) state = 'done';
    else if (n.month === m) state = 'now';
    let estimate;
    if (state === 'done') estimate = '已过';
    else if (state === 'now') estimate = '本月';
    else if (n.month - m === 1) estimate = '下月';
    else estimate = (n.month - m) + ' 个月后';
    return Object.assign({}, n, {
      state,
      estimate,
      monthLabel: n.month + ' 月'
    });
  }).sort((a, b) => (a.month - b.month));
}

/**
 * 月历矩阵 —— 固定 6 行 × 7 列（周日开头，与 weekdayCN 一致）。
 * 固定 6 行是为了页面高度稳定，不会在 4 行月和 5 行月之间跳动。
 * opts.marks:      { 'YYYY-MM-DD': [ {label, kind} ] } —— 精确到日的事件（我的节点）
 * opts.monthMarks: { 'YYYY-MM': [ {title, key} ] }     —— 只精确到月的事件（全国节点），落在当月 1 号
 */
function monthMatrix(year, month, opts) {
  const o = opts || {};
  const rows = [];
  const first = new Date(year, month - 1, 1);
  const lead = first.getDay(); // 0 = 周日
  const total = new Date(year, month, 0).getDate();
  const today = util.dateStr();
  const voidAt = (i) => ({ date: 'void-' + year + '-' + month + '-' + i, day: 0, void: true });
  const cells = [];
  let i;
  for (i = 0; i < lead; i++) cells.push(voidAt(i));
  for (i = 1; i <= total; i++) {
    const ds = year + '-' + util.pad(month) + '-' + util.pad(i);
    const mkey = year + '-' + util.pad(month);
    const marks = (o.marks && o.marks[ds]) || [];
    const monthMarks = (o.monthMarks && o.monthMarks[mkey]) || [];
    /* 法定节假日/调休：由 services/holiday.js 按官方通知生成，精确到日 */
    const holiday = (o.holidays && o.holidays[ds]) || null;
    cells.push({
      date: ds,
      day: i,
      void: false,
      isToday: ds === today,
      // 周末用淡色区分，刻意不用红绿，避免和涨跌色混淆
      weekend: (first.getDay() + i - 1) % 7 === 0 || (first.getDay() + i - 1) % 7 === 6,
      markList: marks.concat(monthMarks),
      hasMark: marks.length > 0 || monthMarks.length > 0,
      // holiday: { type:'holiday'|'work', name, short:'休'|'班' } | null
      holiday: holiday,
      /* 调休上班日本质是工作日：不是周末就别再按周末淡色显示 */
      isRest: holiday ? holiday.type === 'holiday' : false,
      isWork: holiday ? holiday.type === 'work' : false
    });
  }
  /* 补足 6 行；占位格也带唯一 date，wxml 里 wx:key="date" 才稳定 */
  while (cells.length < 42) cells.push(voidAt(cells.length));
  for (i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/**
 * 某一天要做什么 —— 点击日历格子时展示。
 * 优先级：我的具体节点 > 全国节点所在月 > 那天计划里的任务
 */
function dayDetail(dateStr, ctx) {
  const c = ctx || {};
  const mine = (c.mine || []).filter((n) => n.date === dateStr);
  if (mine.length) {
    return {
      date: dateStr,
      kind: 'mine',
      title: mine.map((n) => n.label).join('、'),
      lines: mine.map((n) => n.label + '：' + n.desc),
      tip: '这是你在目标里设定的节点'
    };
  }
  const d = util.parseDate(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const inSeason = SEASON_NODES.filter((n) => n.month === m);
  if (inSeason.length) {
    return {
      date: dateStr,
      kind: 'season',
      title: inSeason.map((n) => n.title).join(' · '),
      lines: inSeason.map((n) => n.title + '：' + n.desc),
      tip: '全国口径的月份节点，具体日期以研招网公告为准'
    };
  }
  const tasks = (c.tasks || []).filter((t) => t.date === dateStr || t.planDate === dateStr);
  if (tasks.length) {
    return {
      date: dateStr,
      kind: 'task',
      title: '计划里这天有 ' + tasks.length + ' 项',
      lines: tasks.map((t) => (t.title || t.name || '待办')),
      tip: '去「我的计划」查看'
    };
  }
  return {
    date: dateStr,
    kind: 'empty',
    title: '这天没有节点',
    lines: ['当天没有关键节点，按自己的计划推进就好'],
    tip: '在「我的目标」里补一个日期，这里就会出现'
  };
}

module.exports = {
  PHASES, SEASON_NODES, phaseAt, phaseByMonth, seasonNodes, monthMatrix, dayDetail
};
