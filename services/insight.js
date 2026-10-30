/**
 * 智能分析引擎
 * 从用户真实数据里挖出「人眼看不出来」的结论：
 *   学习节律（黄金时段） / 效率趋势 / 科目投入失衡 / 风险预警 / 智能推荐 / 周报
 *
 * 全部为本地计算，不依赖网络。所有结论带 confidence（样本量）说明，
 * 样本不足时明确告知，避免用 3 天数据下结论误导用户。
 */
const util = require('../utils/util');
const theme = require('../utils/theme');
const study = require('./study');
const focus = require('./focus');
const task = require('./task');
const subject = require('./subject');
const statistics = require('./statistics');
const targetService = require('./target');
const mistakeService = require('./mistake');
const cardService = require('./card');
const examService = require('./exam');
const resources = require('./resources');
const store = require('../utils/store');

/**
 * 目标投入权重（408 考生）：按分值与提分难度综合
 * 408 权重最高——150 分且内容量最大，是最该投入的科目
 */
const TARGET_WEIGHT = { major: 35, math: 30, english: 20, politics: 15 };

/** 每日目标分钟（按阶段） */
function dailyGoalMinutes() {
  const phase = targetService.phase();
  if (phase === 'sprint') return 480;  // 冲刺 8h
  if (phase === 'retest') return 240;
  return 360;                           // 平时 6h
}

/* ==================== 1. 学习节律 ==================== */

const SLOT_DEFS = [
  { key: 'morning', label: '早晨', range: '06:00-09:00', hours: [6, 7, 8] },
  { key: 'noon', label: '上午', range: '09:00-12:00', hours: [9, 10, 11] },
  { key: 'midday', label: '午间', range: '12:00-14:00', hours: [12, 13] },
  { key: 'afternoon', label: '下午', range: '14:00-18:00', hours: [14, 15, 16, 17] },
  { key: 'evening', label: '晚间', range: '18:00-22:00', hours: [18, 19, 20, 21] },
  { key: 'night', label: '深夜', range: '22:00-06:00', hours: [22, 23, 0, 1, 2, 3, 4, 5] }
];

/**
 * 学习节律：按 startAt 把学习时长归入时段，找出黄金时段
 * 返回每个时段的累计分钟、占比、样本天数
 */
function rhythmImpl() {
  const recs = study.all().filter((r) => r.startAt && r.startAt > 0);
  const slots = {};
  SLOT_DEFS.forEach((s) => { slots[s.key] = { key: s.key, label: s.label, range: s.range, minutes: 0, count: 0, days: {} }; });

  recs.forEach((r) => {
    const h = new Date(r.startAt).getHours();
    const def = SLOT_DEFS.find((s) => s.hours.indexOf(h) >= 0);
    if (!def) return;
    const s = slots[def.key];
    s.minutes += r.minutes;
    s.count += 1;
    s.days[r.date] = true;
  });

  const list = SLOT_DEFS.map((d) => {
    const s = slots[d.key];
    return {
      key: s.key, label: s.label, range: s.range,
      minutes: s.minutes,
      count: s.count,
      dayCount: Object.keys(s.days).length,
      text: util.fmtMinutes(s.minutes)
    };
  });

  const total = list.reduce((m, s) => m + s.minutes, 0);
  list.forEach((s) => { s.percent = total ? Math.round((s.minutes / total) * 100) : 0; });

  const ranked = list.slice().sort((a, b) => b.minutes - a.minutes);
  const best = ranked[0] && ranked[0].minutes > 0 ? ranked[0] : null;
  const sampleDays = Object.keys(recs.reduce((m, r) => { m[r.date] = true; return m; }, {})).length;

  return {
    slots: list,
    best,
    bestText: best ? `${best.label}（${best.range}）` : '',
    totalMinutes: total,
    sampleDays,
    enough: sampleDays >= 7 && total >= 600,
    // 深夜学习占比过高是风险信号
    nightPercent: total ? Math.round((slots.night.minutes / total) * 100) : 0
  };
}

/* ==================== 2. 效率趋势 ==================== */

/**
 * 近 7 天 vs 前 7 天
 */
function trendImpl() {
  const today = util.dateStr();
  const cur = study.minutesBetween(util.dateStr(util.addDays(today, -6)), today);
  const prev = study.minutesBetween(util.dateStr(util.addDays(today, -13)), util.dateStr(util.addDays(today, -7)));
  const delta = cur - prev;
  const rate = prev ? Math.round((delta / prev) * 100) : null;
  const curDays = countActiveDays(util.dateStr(util.addDays(today, -6)), today);
  const prevDays = countActiveDays(util.dateStr(util.addDays(today, -13)), util.dateStr(util.addDays(today, -7)));
  return {
    current: cur,
    previous: prev,
    delta,
    rateText: rate == null ? '—' : (rate >= 0 ? '+' + rate + '%' : rate + '%'),
    up: delta >= 0,
    curDays,
    prevDays,
    curText: util.fmtMinutes(cur),
    prevText: util.fmtMinutes(prev),
    avgText: util.fmtMinutes(curDays ? Math.round(cur / curDays) : 0)
  };
}

function countActiveDays(start, end) {
  const map = {};
  study.all().forEach((r) => { if (r.date >= start && r.date <= end) map[r.date] = (map[r.date] || 0) + r.minutes; });
  return Object.keys(map).filter((d) => map[d] > 0).length;
}

/* ==================== 3. 科目投入失衡 ==================== */

/**
 * 对比「实际投入占比」与「目标权重」，找出投入不足/过度的科目
 */
function balanceImpl() {
  const totals = study.subjectTotals();
  const total = theme.SUBJECTS.reduce((s, k) => s + (totals[k.key] || 0), 0);
  if (!total) return { enough: false, items: [], worst: null, best: null };

  const items = theme.SUBJECTS.map((s) => {
    const m = totals[s.key] || 0;
    const actual = Math.round((m / total) * 100);
    const want = TARGET_WEIGHT[s.key];
    return {
      key: s.key, name: s.name, color: s.color,
      minutes: m,
      text: util.fmtMinutes(m),
      actual,
      want,
      gap: actual - want,
      gapText: (actual - want >= 0 ? '+' : '') + (actual - want) + '%'
    };
  });

  const sorted = items.slice().sort((a, b) => a.gap - b.gap);
  const worst = sorted[0].gap < -10 ? sorted[0] : null;   // 投入最不足
  const over = sorted[sorted.length - 1].gap > 10 ? sorted[sorted.length - 1] : null;

  return {
    enough: total >= 600,
    total,
    items,
    worst,
    over,
    advice: balanceAdvice(worst, over)
  };
}

function balanceAdvice(worst, over) {
  if (!worst && !over) return '各科投入与目标权重基本匹配，保持现状即可。';
  const bits = [];
  if (worst) bits.push(`「${worst.name}」投入仅 ${worst.actual}%（目标 ${worst.want}%），建议每天增加约 ${suggestMinutes(worst)} 分钟`);
  if (over) bits.push(`「${over.name}」投入 ${over.actual}% 偏高（目标 ${over.want}%），可适当压缩`);
  return bits.join('；') + '。';
}

function suggestMinutes(item) {
  // 按 6 小时/天的总盘算，补到目标权重需要的分钟
  const daily = dailyGoalMinutes();
  const need = Math.round(daily * (item.want - item.actual) / 100);
  return Math.max(15, Math.min(120, need));
}

/* ==================== 4. 风险预警 ==================== */

function risksImpl() {
  const out = [];
  const today = util.dateStr();
  const phase = targetService.phase();
  const goal = dailyGoalMinutes();

  // (1) 连续低产：近 3 天均低于目标的 60%
  const last3 = [0, 1, 2].map((i) => study.minutesOn(util.dateStr(util.addDays(today, -i))));
  const lowDays = last3.filter((m) => m < goal * 0.6).length;
  if (lowDays >= 3) {
    out.push({
      key: 'low', level: 'high', title: '连续三天未达节奏',
      detail: `近三天分别 ${last3.map((m) => util.fmtMinutes(m)).join(' / ')}，均低于目标 ${util.fmtMinutes(goal)} 的六成。`,
      action: '先把今天的目标砍到 2 个番茄钟，重新开始，别硬补。'
    });
  } else if (lowDays === 2) {
    out.push({
      key: 'low', level: 'mid', title: '节奏有下滑',
      detail: `近三天有 2 天低于目标六成（${util.fmtMinutes(goal)}）。`,
      action: '检查是不是任务排太满，或睡眠不足。'
    });
  }

  // (2) 薄弱知识点堆积
  const weak = subject.weakPoints();
  if (weak.length >= 15) {
    out.push({
      key: 'weak', level: 'high', title: `薄弱知识点堆积 ${weak.length} 个`,
      detail: `其中 ${weak.filter((w) => w.status === 'weak').length} 个标记为「薄弱」，${weak.length - weak.filter((w) => w.status === 'weak').length} 个「需复习」。`,
      action: '每天固定拿出 30 分钟专门清薄弱点，比刷新内容更有效。'
    });
  } else if (weak.length >= 8) {
    out.push({
      key: 'weak', level: 'mid', title: `${weak.length} 个薄弱点待清`,
      detail: '数量还在可控范围，及时清掉避免滚雪球。',
      action: '安排一个「薄弱点专项」番茄钟。'
    });
  }

  // (3) 错题到期堆积
  const dueM = mistakeService.dueCount();
  if (dueM >= 25) {
    out.push({
      key: 'mistake', level: 'high', title: `错题到期 ${dueM} 道`,
      detail: '到期的错题太多会让复习队列崩溃，很多人因此直接放弃错题本。',
      action: '今天优先清掉 lapses 最多的 10 道，剩下的允许跳过。'
    });
  } else if (dueM >= 12) {
    out.push({
      key: 'mistake', level: 'mid', title: `${dueM} 道错题到期`,
      detail: '趁数量不多赶紧清。',
      action: '开一个 25 分钟番茄钟专门做错题。'
    });
  }

  // (4) 卡片到期
  const dueC = cardService.dueQueue(null).length;
  if (dueC >= 30) {
    out.push({
      key: 'card', level: 'mid', title: `卡片到期 ${dueC} 张`,
      detail: '卡片到期积压会影响记忆曲线的连续性。',
      action: '利用碎片时间刷 20 张。'
    });
  }

  // (5) 任务逾期
  const overdue = task.today().filter((t) => t.overdue).length;
  if (overdue >= 5) {
    out.push({
      key: 'overdue', level: 'mid', title: `${overdue} 项任务逾期`,
      detail: '逾期任务越多，计划越失真。',
      action: '把逾期任务重新排到未来三天，或直接删掉不再需要的。'
    });
  }

  // (6) 408 投入不足（本项目核心）
  const bal = balance();
  if (bal.enough && bal.worst && bal.worst.key === 'major') {
    out.push({
      key: 'major', level: 'high', title: '408 专业课投入不足',
      detail: `408 是最该投入的科目（150 分、四门课、内容量最大），目前只占 ${bal.worst.actual}%，目标 ${bal.worst.want}%。`,
      action: `每天至少给 408 ${suggestMinutes(bal.worst)} 分钟，优先数据结构与组成原理（合计 90 分）。`
    });
  }

  // (7) 模考分差
  const exams = examService.all();
  if (exams.length) {
    const last = exams.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const t = targetService.getTarget();
    if (t && t.totalScore && last && last.total) {
      const diff = last.total - t.totalScore;
      if (diff <= -20) {
        out.push({
          key: 'exam', level: 'high', title: `最近模考差目标 ${-diff} 分`,
          detail: `最近一次模考 ${last.total} 分，目标 ${t.totalScore} 分。`,
          action: '差距在 20 分以上时，优先补提分最快的科目（政治 > 英语 > 408 > 数学）。'
        });
      }
    }
  }

  // (8) 深夜学习
  const rh = rhythm();
  if (rh.enough && rh.nightPercent >= 30) {
    out.push({
      key: 'night', level: 'mid', title: `深夜学习占 ${rh.nightPercent}%`,
      detail: '22 点后学习占比过高，长期会拖垮第二天上午的效率（而数学/408 最需要上午的脑力）。',
      action: '把睡前那一段换成早晨，同样时长效率更高。'
    });
  }

  // (9) 冲刺期政治投入
  if (phase === 'sprint') {
    const totals = study.subjectTotals();
    const all = theme.SUBJECTS.reduce((s, k) => s + (totals[k.key] || 0), 0);
    const pol = all ? Math.round(((totals.politics || 0) / all) * 100) : 0;
    if (pol < 15) {
      out.push({
        key: 'politics', level: 'mid', title: '冲刺期政治投入偏低',
        detail: `目前政治只占 ${pol}%，冲刺期建议提到 20%-25%，这是四科里提分最快的。`,
        action: '每天给政治 1.5-2 小时，性价比远超数学刷难题。'
      });
    }
  }

  const levelRank = { high: 3, mid: 2, low: 1 };
  out.sort((a, b) => levelRank[b.level] - levelRank[a.level]);
  return out;
}

/* ==================== 5. 智能推荐卡 ==================== */

/**
 * 首页智能推荐：结合数据状态 + 阶段 + 薄弱科目，推荐「下一步做什么」
 */
function recommendationsImpl(limit) {
  const out = [];
  const today = util.dateStr();
  const phase = targetService.phase();
  const code = resources.myCode();

  const dueM = mistakeService.dueCount();
  const dueC = cardService.dueQueue(null).length;
  const todayMin = study.todayMinutes();
  const goal = dailyGoalMinutes();
  const pending = task.pending(20);
  const overdue = pending.filter((t) => t.overdue).length;

  // 1) 最紧急：逾期任务
  if (overdue > 0) {
    out.push({
      key: 'overdue', icon: '!', color: 'var(--danger)',
      title: `先清掉 ${overdue} 项逾期任务`,
      desc: '逾期任务会持续污染你的计划视图，先处理掉。',
      action: 'plan'
    });
  }

  // 2) 错题到期
  if (dueM > 0) {
    out.push({
      key: 'mistake', icon: '✕', color: 'var(--forest-deep)',
      title: `${dueM} 道错题到期`,
      desc: '按间隔复习的错题现在正处在遗忘临界点，效果最好。',
      action: 'mistake'
    });
  }

  // 3) 卡片到期
  if (dueC > 0) {
    out.push({
      key: 'card', icon: '▦', color: 'var(--c-english)',
      title: `${dueC} 张卡片待复习`,
      desc: '碎片时间就能刷完，别让记忆曲线断掉。',
      action: 'card'
    });
  }

  // 4) 今日时长未达标
  if (todayMin < goal) {
    const lack = goal - todayMin;
    const rh = rhythm();
    const slot = rh.best ? rh.best.label : '上午';
    out.push({
      key: 'minutes', icon: '◷', color: 'var(--ok)',
      title: `今日还差 ${util.fmtMinutes(lack)}`,
      desc: rh.enough ? `你的高效时段是${rh.bestText}，把最重要的任务放这里。` : '数据还不够判断你的黄金时段，先保持固定作息。',
      action: 'focus'
    });
  }

  // 5) 薄弱科目
  const overview = subject.overview().filter((s) => s.pointCount > 0);
  if (overview.length) {
    const weakest = overview.slice().sort((a, b) => a.mastery - b.mastery)[0];
    if (weakest.mastery < 60) {
      out.push({
        key: 'weak-subject', icon: '◇', color: weakest.color,
        title: `「${weakest.name}」掌握度仅 ${weakest.mastery}%`,
        desc: `未学 ${weakest.dist.none} 个、薄弱 ${weakest.dist.weak} 个知识点。建议安排集中突破。`,
        action: 'subject:' + weakest.key
      });
    }
  }

  // 6) 资源推荐（按阶段）
  const res = resources.recommendByPhase(phase, code, 2);
  res.forEach((r) => {
    out.push({
      key: 'res-' + r.id, icon: r.catIcon, color: 'var(--forest)',
      title: r.title,
      desc: r.sub,
      action: 'resource:' + r.id
    });
  });

  // 7) 冲刺期提醒
  if (phase === 'sprint') {
    out.push({
      key: 'sprint', icon: '★', color: 'var(--forest-deep)',
      title: '冲刺期：政治与作文是提分主力',
      desc: '数学刷难题的边际收益已经很低，把时间挪给政治背诵和英语作文模板。',
      action: 'resource:po-3'
    });
  }

  return out.slice(0, limit || 5);
}

/* ==================== 6. 周报 ==================== */

function weeklyReportImpl() {
  const today = util.dateStr();
  const start = util.dateStr(util.addDays(today, -6));
  const t = statistics.range(start, today);
  const tr = trend();
  const rh = rhythm();
  const bal = balance();
  const rk = risks();
  const ov = statistics.overview();

  const perSubject = theme.SUBJECTS.map((s) => ({
    key: s.key, name: s.name, color: s.color,
    minutes: t.perSubject[s.key] || 0,
    text: util.fmtMinutes(t.perSubject[s.key] || 0)
  })).sort((a, b) => b.minutes - a.minutes);

  const goal = dailyGoalMinutes();
  const achieved = Math.round((t.minutes / (goal * 7)) * 100);

  return {
    start, end: today,
    minutes: t.minutes,
    minutesText: util.fmtMinutes(t.minutes),
    avgText: util.fmtMinutes(Math.round(t.minutes / 7)),
    activeDays: countActiveDays(start, today),
    completion: t.completion,
    focusCount: focus.records().filter((r) => r.date >= start && r.date <= today).length,
    streak: ov.streak,
    perSubject,
    trend: tr,
    rhythm: rh,
    balance: bal,
    risks: rk,
    achieved: Math.min(100, achieved),
    goalText: util.fmtMinutes(goal),
    summary: weeklySummary(t, tr, rk, bal)
  };
}

function weeklySummary(t, tr, rk, bal) {
  const bits = [];
  bits.push(`本周学习 ${util.fmtMinutes(t.minutes)}，活跃 ${countActiveDays(t.startDate, t.endDate)} 天`);
  if (tr.rateText !== '—') bits.push(`较上周${tr.up ? '提升' : '下降'} ${Math.abs(tr.delta)} 分钟（${tr.rateText}）`);
  bits.push(`任务完成率 ${t.completion.rate}%`);
  if (bal.worst) bits.push(`「${bal.worst.name}」投入偏低`);
  const high = rk.filter((r) => r.level === 'high');
  if (high.length) bits.push(`${high.length} 项需要优先处理`);
  return bits.join('，') + '。';
}

/* ==================== 7. 目标分达成进度 ==================== */

function goalProgressImpl() {
  const t = targetService.getTarget();
  if (!t || !t.totalScore) return null;
  const exams = examService.all();
  if (!exams.length) {
    return {
      hasExam: false,
      target: t.totalScore,
      scores: t.scores || {},
      text: '还没有模考记录，做一次模考后可以看到各科差距。'
    };
  }
  const last = exams.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const gaps = theme.SUBJECTS.map((s) => {
    const want = (t.scores || {})[s.key] || 0;
    const got = (last.scores || {})[s.key] || 0;
    return {
      key: s.key, name: s.name, color: s.color,
      want, got, gap: got - want,
      gapText: (got - want >= 0 ? '+' : '') + (got - want)
    };
  }).sort((a, b) => a.gap - b.gap);
  return {
    hasExam: true,
    target: t.totalScore,
    latest: last.total,
    diff: (last.total || 0) - t.totalScore,
    date: last.date,
    gaps,
    worst: gaps[0] && gaps[0].gap < 0 ? gaps[0] : null
  };
}


/* ==================== 结果缓存 ==================== */

/**
 * 为什么需要缓存
 *
 * 这些分析函数全都以 study.all() / task / exam 的全量遍历为底座，而且彼此嵌套调用：
 *   weeklyReport    -> trend + rhythm + balance + risks
 *   risks           -> balance + rhythm + exam.all()
 *   recommendations -> rhythm + 任务 + ...
 *
 * ai.js 一次对话就会依次调用 rhythm / trend / balance / risks 四个，
 * 等价于同一份学习记录被反复扫描十几遍；首页渲染时还要再完整走一轮。
 *
 * 做法：按「函数名 + 参数」缓存结果，数据变更时由 store 事件统一失效。
 * 缓存仅在本次小程序生命周期内有效，冷启动自动重建，不会读到趄数据。
 */
const _INSIGHT_MEMO = Object.create(null);

function dropInsightCache() {
  Object.keys(_INSIGHT_MEMO).forEach((k) => { delete _INSIGHT_MEMO[k]; });
}

/* 下列任何一处数据变化，都会让已有结论失效 */
[
  store.TOPICS.STUDY_CHANGED,
  store.TOPICS.TASK_CHANGED,
  store.TOPICS.EXAM_CHANGED,
  store.TOPICS.TARGET_CHANGED,
  store.TOPICS.CARD_CHANGED,
  store.TOPICS.MISTAKE_CHANGED
].forEach((topic) => { if (topic) store.subscribe(topic, dropInsightCache); });

function memoInsight(name, impl) {
  return function () {
    const key = name + '|' + Array.prototype.slice.call(arguments).join('\u0001');
    if (!Object.prototype.hasOwnProperty.call(_INSIGHT_MEMO, key)) {
      _INSIGHT_MEMO[key] = impl.apply(null, arguments);
    }
    return _INSIGHT_MEMO[key];
  };
}

/*
 * 包装后重新绑定同名常量。
 * 重点：内部互调（如 risks 里调 balance()）在运行时解析的是模块作用域绑定，
 * 此时 balance 已指向缓存版，所以嵌套调用会自动命中缓存，无需改动内部调用点。
 */
const rhythm = memoInsight('rhythm', rhythmImpl);
const trend = memoInsight('trend', trendImpl);
const balance = memoInsight('balance', balanceImpl);
const risks = memoInsight('risks', risksImpl);
const recommendations = memoInsight('recommendations', recommendationsImpl);
const weeklyReport = memoInsight('weeklyReport', weeklyReportImpl);
const goalProgress = memoInsight('goalProgress', goalProgressImpl);

module.exports = {
  TARGET_WEIGHT, SLOT_DEFS,
  dailyGoalMinutes,
  rhythm, trend, balance, risks, recommendations,
  weeklyReport, goalProgress,
  invalidate: dropInsightCache
};
