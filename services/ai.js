/**
 * AI 考研助手（本地规则引擎）
 * 说明：当前不依赖云大模型，全部结合用户真实数据（目标/任务/时长/掌握度）生成建议。
 * 后续可在 services 层替换为云函数 / 大模型接口，页面无需改动。
 * 严格遵守「允许 AI 读取学习数据」开关：关闭时不得读取任何学习数据。
 */
const profile = require('./profile');
const target = require('./target');
const task = require('./task');
const study = require('./study');
const subject = require('./subject');
const exam = require('./exam');
const mistake = require('./mistake');
const card = require('./card');
const resources = require('./resources');
const schoolService = require('./school');
const insight = require('./insight');
const util = require('../utils/util');
const config = require('../utils/config');
const upload = require('../utils/upload');

function aiEnabled() { return !!profile.getSettings().aiEnabled; }

/** 构造上下文（仅在开关开启时调用） */
function buildContext() {
  const today = util.dateStr();
  const weekStart = util.dateStr(util.startOfWeek(today));
  return {
    name: profile.getProfile().name,
    target: target.getTarget(),
    countdown: target.countdown(),
    phase: target.phase(),
    todayTasks: task.today(),
    pending: task.pending(10),
    todayMinutes: study.todayMinutes(),
    weekMinutes: study.minutesBetween(weekStart, today),
    subjects: subject.overview(),
    weak: subject.weakPoints(6),
    background: profile.getBackground()
  };
}

/** 生成首页「今日重点」与建议 */
function advice() {
  if (!aiEnabled()) {
    return {
      enabled: false,
      summary: '「允许 AI 读取学习数据」已关闭，无法生成个性化建议。可在「我的 → 隐私与 AI 权限」中开启。',
      priorities: [],
      tips: []
    };
  }
  const ctx = buildContext();
  const priorities = [];
  const tips = [];

  // 1) 未完成的重要任务
  const important = ctx.pending.filter((t) => t.priority === 'urgent' || t.priority === 'high' || t.overdue);
  important.slice(0, 3).forEach((t) => {
    priorities.push({
      title: t.title,
      reason: t.overdue ? '已逾期，建议优先清掉' : '优先级较高，建议今天完成'
    });
  });
  if (!priorities.length) {
    ctx.pending.slice(0, 2).forEach((t) => priorities.push({ title: t.title, reason: '待办中优先处理' }));
  }

  // 2) 时长是否达标
  if (ctx.todayMinutes < 240) {
    tips.push(`今日已学 ${util.fmtMinutes(ctx.todayMinutes)}，距离 4 小时目标还差 ${util.fmtMinutes(240 - ctx.todayMinutes)}，可安排一个番茄钟补齐。`);
  } else {
    tips.push(`今日已学 ${util.fmtMinutes(ctx.todayMinutes)}，节奏不错，注意留出休息与复盘时间。`);
  }

  // 3) 薄弱科目
  const sorted = ctx.subjects.slice().sort((a, b) => a.mastery - b.mastery);
  if (sorted.length && sorted[0].pointCount) {
    tips.push(`「${sorted[0].name}」知识掌握度最低（${sorted[0].mastery}%），建议安排一段集中突破。`);
  }

  // 4) 薄弱知识点
  if (ctx.weak.length) {
    tips.push(`有 ${ctx.weak.length} 个知识点处于「薄弱/需复习」状态，例如「${ctx.weak[0].name}」。`);
  }

  // 5) 倒计时提醒
  if (ctx.countdown) {
    tips.push(`距离初试还有 ${ctx.countdown.totalDays} 天，按当前节奏保持即可。`);
  } else {
    tips.push('尚未设置考研目标，去「我的 → 我的目标」填写后，可获得更精准的规划建议。');
  }

  const summary = priorities.length
    ? `今天还有 ${ctx.pending.length} 项任务未完成，其中 ${important.length} 项比较关键。建议按顺序先处理下面的重点。`
    : '今天没有卡住的待办，可以按计划推进或提前进入下一阶段。';

  return { enabled: true, summary, priorities, tips, ctxLen: Object.keys(ctx).length };
}

/** 本地规则对话（关键词 + 真实数据），无网络时兜底 */
function localChat(text) {
  const q = (text || '').trim();
  if (!q) return { text: '可以直接问我：怎么安排复习、哪科最薄弱、今天学得怎么样。' };
  if (/^\[(图片|附件文件|语音转写)/.test(q) && !/[?？]/.test(q)) {
    return { text: '我收到了你发来的附件（图片 / 文件 / 语音）。当前是本地规则模式，还不能解析附件内容。\n配置云函数后可由云端模型处理图片；文字类的问题我现在就能回答。' };
  }
  if (!aiEnabled()) {
    return { text: '「允许 AI 读取学习数据」当前为关闭状态。开启后我才能结合你的真实数据回答（我的 → 隐私与 AI 权限）。' };
  }
  const ctx = buildContext();
  const has = (arr) => arr.some((k) => q.indexOf(k) >= 0);
  const code = resources.myCode();

  /* ---- 择校 / 分数线 ---- */
  if (has(['择校', '选学校', '推荐学校', '分数线', '复试线', '院校', '报哪个', '考得上吗', '录取概率', '冲稳保'])) {
    return { text: schoolAnswer(ctx, q) };
  }

  /* ---- 调剂 ---- */
  if (has(['调剂', '没考上怎么办', '调档'])) {
    return { text: resourceAnswer(q, ['adjust'], code, '调剂') };
  }

  /* ---- 复试 / 机试 ---- */
  if (has(['复试', '面试', '机试', '上机', '自我介绍'])) {
    return { text: resourceAnswer(q, ['retest'], code, '复试') };
  }

  /* ---- 明确要「资料」类内容：模板 / 公式 / 套路 / 速查 ---- */
  if (has(['模板', '公式', '速查', '套路', '框架', '怎么写', '怎么算', '怎么做', '步骤', '技巧', '方法论'])) {
    const hit = resources.searchSmart(q, code);
    if (hit.length) return { text: resourceHitText(hit, q), resourceId: hit[0].id };
  }

  if (has(['数学', '高数', '线代', '概率'])) return { text: subjectAnswer(ctx, 'math') };
  if (has(['英语', '单词', '阅读', '作文'])) return { text: subjectAnswer(ctx, 'english') };
  if (has(['政治', '马原', '毛中特', '史纲'])) return { text: subjectAnswer(ctx, 'politics') };
  if (has(['专业课', '408', '数据结构'])) return { text: subjectAnswer(ctx, 'major') };

  if (has(['计划', '安排', '怎么复', '复习'] )) {
    return {
      text: [
        `结合你的数据：本周已学 ${util.fmtMinutes(ctx.weekMinutes)}，今日 ${util.fmtMinutes(ctx.todayMinutes)}。`,
        `建议的今日推进顺序：${ctx.pending.slice(0, 3).map((t) => t.title).join(' → ') || '暂无待办，去做一次限时训练' }。`,
        `薄弱科目优先照顾「${weakestName(ctx)}」。`,
        '节奏上建议：上午攻数学/专业课，下午英语，晚上政治 + 复盘，睡前背单词。'
      ].join('\n')
    };
  }

  if (has(['今天', '学得怎么样', '进度'])) {
    return {
      text: `今日已学 ${util.fmtMinutes(ctx.todayMinutes)}，本周累计 ${util.fmtMinutes(ctx.weekMinutes)}，共 ${ctx.pending.length} 项待办未完成。${ctx.countdown ? `距离初试还有 ${ctx.countdown.totalDays} 天。` : ''}`
    };
  }

  if (has(['薄弱', '不好', '没掌握', '错题'])) {
    if (!ctx.weak.length) return { text: '目前没有标记为「薄弱/需复习」的知识点。可以在「学习 → 科目详情」里给知识点打标，我会据此提示你。' };
    return { text: `薄弱知识点共 ${ctx.weak.length} 个：${ctx.weak.slice(0, 5).map((w) => `${w.subject}·${w.name}`).join('、')}。建议今天安排 1 小时专门回顾。` };
  }

  if (has(['时间', '多久', '时长'])) {
    return { text: `今日 ${util.fmtMinutes(ctx.todayMinutes)}，本周 ${util.fmtMinutes(ctx.weekMinutes)}。目标型建议：冲刺期每日有效学习 6–8 小时为宜。` };
  }

  /* ---- 学习节律 / 效率分析 ---- */
  if (has(['效率', '节律', '黄金时段', '什么时候学', '周报', '总结'])) {
    return { text: insightAnswer(ctx) };
  }

  /* ---- 兜底一：先查内置资源库（40+ 篇 408 专用速查） ---- */
  const hits = resources.searchSmart(q, code);
  if (hits.length) return { text: resourceHitText(hits, q), resourceId: hits[0].id };

  // 兜底二：给出整体画像
  return {
    text: [
      `我是本地考研助手，会结合你的真实数据回答。`,
      `当前：${ctx.countdown ? `距初试 ${ctx.countdown.totalDays} 天` : '未设置考试日期'}，今日 ${util.fmtMinutes(ctx.todayMinutes)}，待办 ${ctx.pending.length} 项。`,
      `可以问我：数学怎么提分？408 怎么复习？帮我择校？这周计划怎么排？我哪科最薄弱？今天该先做什么？`,
      '',
      `也可以直接搜资源库：Cache 计算、快排、作文模板、马原方法论、调剂流程……`
    ].join('\n')
  };
}

/* ==================== 新增：择校 / 资源 / 洞察 回答 ==================== */

/** 择校：结合目标分给出冲/稳/保 */
function schoolAnswer(ctx, q) {
  const t = ctx.target || {};
  const bg = ctx.background || {};
  const score = t.totalScore || 0;
  const opt = { score, limit: 3 };
  if (q.indexOf('专硕') >= 0 || q.indexOf('22408') >= 0) opt.examCode = '22408';
  else if (q.indexOf('学硕') >= 0 || q.indexOf('11408') >= 0) opt.examCode = '11408';
  else if (t.examCode) opt.examCode = t.examCode;
  else if (bg.examPath) opt.examCode = bg.examPath;   // 未明说学硕/专硕时，按用户设定方向筛选

  const r = schoolService.recommend(opt);
  const lines = [];
  if (!score) {
    lines.push('还没有设置目标总分，我先按院校层次给你一个大致分布。');
  } else {
    lines.push(`按你的目标 ${score} 分，在 ${schoolService.stats().programCount} 个 408 专业里匹配到以下结果：`);
  }
  if (bg.undergradTier || bg.examPath) {
    lines.push(`（已结合你的背景：${[bg.undergradTier, bg.targetDegree, bg.settleCity && bg.settleCity + '定居', bg.examPath].filter(Boolean).join(' · ')}）`);
  }
  lines.push('');
  r.tiers.forEach((tier) => {
    lines.push(`【${tier.name}】${tier.desc}`);
    if (!tier.list.length) { lines.push('  （暂无匹配，可放宽省份或层次筛选）'); }
    tier.list.forEach((x) => {
      lines.push(`  · ${x.schoolName} ${x.majorName}（${x.examCode}）参考线 ${x.bandText}，${x.probText}`);
    });
    lines.push('');
  });
  lines.push('⚠️ 这里的复试线是按院校层次估算的参考区间，不是官方数据。请到「院校库」点开具体专业，用官方研招网核实后把真实分数线录进去，之后的判断会以你的数据为准。');
  return lines.join('\n');
}

/** 资源库命中后的统一排版 */
function resourceHitText(hits, q) {
  const best = hits[0];
  const d = resources.detail(best.id);
  const lines = [`在资源库里找到了《${best.title}》（${best.catName}）：`, ''];
  // 优先展示命中片段所在位置附近的内容，再补开头
  const body = d.body || [];
  const shown = body.slice(0, 7);
  shown.forEach((b) => lines.push(b));
  if (body.length > shown.length) {
    lines.push('');
    lines.push(`…… 完整共 ${body.length} 段，可到「资料 → 备考资源库」查看全文，或一键存入笔记。`);
  }
  if (hits.length > 1) {
    lines.push('');
    lines.push(`相关：${hits.slice(1, 4).map((h) => h.title).join('、')}`);
  }
  return lines.join('\n');
}

/** 资源库检索回答 */
function resourceAnswer(q, cats, code, label) {
  const inCats = [];
  cats.forEach((c) => inCats.push.apply(inCats, resources.byCategory(c, '', code)));
  let list = inCats;
  // 若问题里还有更具体的词，在分类内再筛
  const extra = q.replace(/调剂|复试|面试|机试|上机|自我介绍|没考上怎么办|调档/g, '').trim();
  if (extra && extra.length >= 2) {
    const narrowed = inCats.filter((i) => resources.search(extra, code).some((h) => h.id === i.id));
    if (narrowed.length) list = narrowed;
  }
  if (!list.length) list = inCats;
  if (!list.length) return { text: `资源库里暂无「${label}」相关内容，可到「资料 → 备考资源库」查看全部分类。` };

  const top = list.slice(0, 2);
  const lines = [`关于${label}，资源库里有这些内容：`];
  top.forEach((item) => {
    const d = resources.detail(item.id);
    lines.push('');
    lines.push(`《${d.title}》`);
    (d.body || []).slice(0, 5).forEach((b) => lines.push(b));
  });
  lines.push('');
  lines.push(`共 ${list.length} 篇${label}资源，完整内容在「资料 → 备考资源库 · ${label}」。`);
  return lines.join('\n');
}

/** 学习洞察回答 */
function insightAnswer(ctx) {
  const rh = insight.rhythm();
  const tr = insight.trend();
  const bal = insight.balance();
  const rk = insight.risks();
  const lines = [];

  if (rh.enough) {
    lines.push(`【学习节律】你的黄金时段是${rh.bestText}，占全部学习时长的 ${rh.best.percent}%。把数学和 408 放这个时段，性价比最高。`);
    if (rh.nightPercent >= 25) lines.push(`注意：深夜（22 点后）学习占 ${rh.nightPercent}%，长期会拖垮第二天上午的效率。`);
  } else {
    lines.push('【学习节律】目前样本还不够（需要至少 7 天、累计 10 小时），暂时判断不出你的黄金时段。先保持固定作息，两周后我再给你分析。');
  }

  lines.push('');
  lines.push(`【效率趋势】本周 ${tr.curText}，上周 ${tr.prevText}，${tr.up ? '提升' : '下降'} ${Math.abs(tr.delta)} 分钟（${tr.rateText}）；活跃 ${tr.curDays} 天，日均 ${tr.avgText}。`);

  if (bal.enough) {
    lines.push('');
    lines.push(`【科目投入】${bal.items.map((i) => `${i.name} ${i.actual}%(目标${i.want}%)`).join('，')}。`);
    lines.push(bal.advice);
  }

  if (rk.length) {
    lines.push('');
    lines.push('【需要留意】');
    rk.slice(0, 3).forEach((r) => lines.push(`· ${r.title} —— ${r.action}`));
  } else {
    lines.push('');
    lines.push('【需要留意】暂时没有明显风险，保持当前节奏。');
  }
  return lines.join('\n');
}

/** 统一人格设定 */
const SYSTEM_PROMPT = '你是「研途顺利」考研助手的 AI，面向中国考研学生，用简洁、可执行、中文回答复习相关问题。';

/**
 * 输出格式约束。
 * 客户端只渲染「### 标题 / - 列表 / 1. 有序 / > 引用 / **加粗** / `行内代码`」这几种写法，
 * 表格、图片、HTML、链接会被原样显示成符号，所以要明确禁止 —— 否则用户看到的就是一堆 ### 和 **。
 */
const FORMAT_PROMPT = [
  '输出格式（客户端只渲染下列轻量 Markdown，其它写法会原样显示成符号）：',
  '1. 分层用「### 小标题」，最多 4 个，不要用 # 或 ##；',
  '2. 要点用「- 」无序列表，一条一行，每条不超过 40 字；',
  '3. 关键结论、术语用 **加粗**；',
  '4. 禁止输出表格、图片、HTML 标签、Markdown 链接；代码片段最多 8 行；',
  '5. 全文控制在 500 字内：先给结论，再给可执行的做法，不要客套话和免责声明。'
].join('\n');

/**
 * 组装发往模型的 messages
 * @param {string} text 本次提问
 * @param {Array<{role,content}>} history 最近若干轮对话，提供多轮上下文
 */
function buildMessages(text, history, parts) {
  const msgs = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: FORMAT_PROMPT }
  ];
  (history || []).forEach((h) => {
    if (!h || !h.content) return;
    const role = h.role === 'user' ? 'user' : 'assistant';
    // 连续同角色会被部分模型拒绝，去重合并
    const prev = msgs[msgs.length - 1];
    if (prev && prev.role === role) prev.content += '\n' + h.content;
    else msgs.push({ role, content: String(h.content).slice(0, 1500) });
  });
  // 带图片等多模态附件时，末条消息用 content 数组（text + image_url），OpenAI 兼容
  const finalMsg = (parts && parts.length)
    ? [{ type: 'text', text: text }].concat(parts)
    : text;
  msgs.push({ role: 'user', content: finalMsg });
  return msgs;
}

/**
 * 附件 → 模型可用的多模态 parts。
 *  - 图片：转 base64 data URL（云 fileID 外部模型无法直接拉取）
 *  - 文件 / 语音：转成一行文本说明，保证信息不丢、任何模型都能降级处理
 * 返回 { parts, noteText }：noteText 追加到用户文本尾部。
 */
async function toModelParts(attach) {
  const list = (attach || []).slice(0, 9);
  const parts = [];
  const notes = [];
  for (const a of list) {
    if (a.kind === 'image') {
      const url = await upload.toDataUrl(a);
      if (url) parts.push({ type: 'image_url', image_url: { url } });
      else notes.push('[图片：' + (a.name || '未命名') + '（读取失败，未能送达模型）]');
    } else if (a.kind === 'audio') {
      notes.push('[语音转写：' + (a.asrText || '（无转写文本）') + ']');
    } else {
      notes.push('[附件文件：' + (a.name || '未命名') + ']');
    }
  }
  return { parts, noteText: notes.length ? '\n' + notes.join('\n') : '' };
}

/** 云函数可用性：必须同时满足「配了环境 ID」+「配了云函数名」+「基础库支持 wx.cloud」 */
function canCloudFn() {
  return !!(
    config.CLOUD_ENV_ID &&
    config.AI_CLOUD_FUNCTION &&
    typeof wx !== 'undefined' &&
    wx.cloud &&
    typeof wx.cloud.callFunction === 'function'
  );
}

/**
 * 最近一次云函数调用的真实结果：null = 尚未尝试 / true = 成功 / false = 失败。
 * 作用：配置齐了不等于调得通（环境 ID 填错、云函数没部署、ARK_API_KEY 没配都会失败）。
 * 有了它，界面才能如实显示「本地规则」而不是谎报「云函数」。
 */
let cloudFnLastOk = null;
let cloudFnLastError = '';

function markCloud(ok, errText) {
  cloudFnLastOk = ok;
  cloudFnLastError = ok ? '' : String(errText || '');
}

/** 最近一次云函数失败原因（成功或未尝试时为空串） */
function cloudError() { return cloudFnLastError; }

/** 可用则走微信云开发云函数（无需域名白名单） */
function cloudFnChat(messages) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({ name: config.AI_CLOUD_FUNCTION, data: { messages } })
      .then((res) => {
        const r = res && res.result;
        if (r && r.text) {
          markCloud(true, '');
          resolve({ text: r.text, cloud: true });
          return;
        }
        const msg = (r && r.error) ? r.error : '云函数未返回内容';
        markCloud(false, msg);
        reject(new Error(msg));
      }, (e) => {
        markCloud(false, (e && e.message) ? e.message : e);
        reject(e);
      });
  });
}

/** 走自建服务端代理（server/index.js → 火山方舟 Ark） */
function proxyChat(messages) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.AI_BACKEND_URL.replace(/\/$/, '') + '/ai/chat',
      method: 'POST',
      timeout: 20000,
      header: { 'Content-Type': 'application/json' },
      data: { messages, stream: false },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.text) resolve({ text: res.data.text, cloud: true });
        else reject(new Error('bad proxy response ' + res.statusCode));
      },
      fail: (err) => reject(err)
    });
  });
}

/**
 * 容错解析模型返回的 JSON。
 * 模型常把 JSON 包在 ```json 代码块里、或前后带解释文字，这里都能剥出来。
 */
function parseJsonLoose(t) {
  if (!t) return null;
  let s = String(t).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const i = s.indexOf('{');
  const j = s.lastIndexOf('}');
  if (i >= 0 && j > i) s = s.slice(i, j + 1);
  try {
    const o = JSON.parse(s);
    return (o && typeof o === 'object') ? o : null;
  } catch (e) { return null; }
}

/**
 * 题目图片 → 结构化题目信息（错题本「拍照识题」用）。
 *
 * 与 chat() 的区别：刻意**不注入**「考研助手」人格与轻量 Markdown 格式约束
 * （那套约束会与「只输出 JSON」打架），自拟 messages 并要求纯 JSON。
 *
 * @param {Array} attach upload.makeAttach 产生的图片附件
 * @returns {Promise<object|null>} {type, stem, options, answer, analysis}；不可用或失败返回 null
 */
async function extractQuestion(attach) {
  if (!canCloudFn()) return null;
  const { parts } = await toModelParts(attach);
  if (!parts || !parts.length) return null;      // 没有图片就没意义
  const messages = [
    { role: 'system', content: '你是试题信息抽取助手。只输出一个 JSON 对象，不要输出任何解释文字，也不要用 Markdown 代码块包裹。' },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '把这张题目图片抽取成 JSON，字段如下：\n' +
                '- type: "single"（单选）| "multiple"（多选）| "judge"（判断）\n' +
                '- stem: 题干文本\n' +
                '- options: 选项数组，如 ["A项内容","B项内容"]；没有选项就填 []\n' +
                '- answer: 正确答案对应的选项下标（从 0 开始）；多选填数组；判断题填 0 或 1\n' +
                '- analysis: 解析或解答思路；没有就填 ""\n' +
                '看不清的字段留空字符串或空数组，不要编造。'
        }
      ].concat(parts)
    }
  ];
  try {
    const res = await cloudFnChat(messages);
    return parseJsonLoose(res && res.text);
  } catch (e) { return null; }
}

/**
 * 对话：云函数 → 自建代理 → 本地规则，逐级降级，任何一级失败都不会卡住界面
 * @param {string} text 本次提问
 * @param {Array<{role,content}>} history 多轮上下文（页面从 chat.recent() 取，不含本次）
 */
function chat(text, history, attach) {
  return toModelParts(attach).then(({ parts, noteText }) => {
    const finalText = (String(text == null ? '' : text).trim() || '请分析我发送的内容') + noteText;
    const messages = buildMessages(finalText, history, parts);
    const useCloudFn = canCloudFn();
    const useProxy = !!config.AI_BACKEND_URL;
    const fallback = () => localChat(finalText);

    if (useCloudFn) {
      return cloudFnChat(messages)
        .catch(() => (useProxy ? proxyChat(messages) : Promise.reject(new Error('no proxy'))))
        .catch(() => fallback());
    }
    if (useProxy) return proxyChat(messages).catch(() => fallback());
    return Promise.resolve(fallback());
  });
}

/**
 * 当前 AI 模式：cloudFn / cloudFailed / cloud / local
 * - cloudFn     云函数已配置且（尚未失败或上次成功）
 * - cloudFailed 云函数已配置，但上次调用失败 → 实际正在用本地规则，界面应如实说明
 * - cloud       自建代理
 * - local       完全本地
 */
function mode() {
  if (canCloudFn()) return cloudFnLastOk === false ? 'cloudFailed' : 'cloudFn';
  if (config.AI_BACKEND_URL) return 'cloud';
  return 'local';
}

function weakestName(ctx) {
  const sorted = ctx.subjects.slice().sort((a, b) => a.mastery - b.mastery);
  return sorted.length ? sorted[0].name : '——';
}

function subjectAnswer(ctx, key) {
  const s = ctx.subjects.find((x) => x.key === key);
  if (!s) return '暂无该科目数据。';
  const lines = [
    `${s.name}：累计学习 ${util.fmtMinutes(s.totalMinutes)}，知识点掌握度 ${s.mastery}%。`,
    `其中——未学习 ${s.dist.none} 个、学习中 ${s.dist.learning} 个、已掌握 ${s.dist.mastered} 个、薄弱 ${s.dist.weak} 个、需复习 ${s.dist.review} 个。`
  ];
  if (s.mastery < 40) lines.push('掌握度偏低，建议回到基础，先铺面再抓重点。');
  else if (s.mastery < 75) lines.push('进度中段，建议进入强化，配合真题验证。');
  else lines.push('掌握度较好，建议通过限时套题查漏补缺。');
  return lines.join('\n');
}

/**
 * AI 智能规划（本地规则引擎）
 * 结合：目标院校/专业、倒计时、最近一次模考各科成绩差、错题与卡片到期数。
 * 输出：阶段、每周建议学时、每日模板、周计划、重点科目、里程碑、建议。
 */
function plan() {
  if (!aiEnabled()) {
    return {
      enabled: false,
      reason: '「允许 AI 读取学习数据」当前为关闭状态，无法生成个性化规划。可在「我的 → 隐私与 AI 权限」中开启。'
    };
  }
  const ctx = buildContext();
  const days = ctx.countdown ? ctx.countdown.totalDays : null;

  // 阶段判定
  let phase, weeklyHours;
  if (days == null) { phase = '未设目标'; weeklyHours = 0; }
  else if (days < 0) { phase = '复试'; weeklyHours = 40; }
  else if (days <= 30) { phase = '冲刺'; weeklyHours = 54; }
  else if (days <= 120) { phase = '强化'; weeklyHours = 48; }
  else { phase = '基础'; weeklyHours = 40; }

  // 最近一次模考（按日期倒序）
  const exams = exam.all();
  const latest = exams.length
    ? exams.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0]
    : null;
  const t = ctx.target;

  // 四科目标/实测/差值
  const subjects = [
    { key: 'politics', name: '政治', color: 'var(--forest-deep)', target: t ? t.scores.politics : 70, current: latest ? latest.politics : null },
    { key: 'english', name: '英语', color: 'var(--c-english)', target: t ? t.scores.english : 75, current: latest ? latest.english : null },
    { key: 'math', name: '数学', color: 'var(--forest)', target: t ? t.scores.math : 125, current: latest ? latest.math : null },
    { key: 'major', name: '专业课', color: 'var(--forest)', target: t ? t.scores.major : 125, current: latest ? latest.major : null }
  ];
  subjects.forEach((s) => { s.gap = (s.current != null && s.target != null) ? (s.target - s.current) : null; });

  // 重点科目：按差值排序，取正差前 3；无模考则按掌握度薄弱
  const ranked = subjects.slice().sort((a, b) => (b.gap == null ? -1e9 : b.gap) - (a.gap == null ? -1e9 : a.gap));
  let priorities = ranked.filter((s) => s.gap != null && s.gap > 0).slice(0, 3)
    .map((s) => ({ subject: s.name, gap: s.gap, reason: `模考差 ${s.gap} 分（目标 ${s.target} / 实测 ${s.current}）` }));
  if (!priorities.length) {
    const weak = ctx.subjects.slice().sort((a, b) => a.mastery - b.mastery).slice(0, 2);
    priorities = weak.map((s) => ({ subject: s.name, gap: null, reason: `知识点掌握度 ${s.mastery}%，建议集中突破` }));
  }

  // 每周学时按差值加权分配（无模考时均分）
  const weights = subjects.map((s) => (s.gap != null && s.gap > 0 ? s.gap : 8));
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  subjects.forEach((s, i) => { s.weeklyHours = Math.max(4, Math.round((weeklyHours * weights[i]) / wsum)); });

  // 每日模板
  const daily = [
    { period: '上午 08:30–11:30', focus: '数学 + 专业课', detail: '数学 1.5h 概念/刷题，专业课 1.5h 数据结构与组成原理', hours: 3 },
    { period: '下午 14:00–17:00', focus: '英语 + 专业课', detail: '英语阅读/真题 1.5h，专业课 操作系统/网络 1.5h', hours: 3 },
    { period: '晚上 19:30–22:00', focus: '政治 + 复盘', detail: '政治 1h，错题本/卡片复习 0.5h，当日复盘 0.5h', hours: 2.5 }
  ];

  // 周计划（按阶段推进主题）
  const weeks = buildWeeklyPlan(phase, days, subjects, weeklyHours);

  // 建议
  const tips = [];
  if (days != null) tips.push(`当前阶段【${phase}】，距初试约 ${days} 天，建议每周有效学习 ${weeklyHours} 小时。`);
  const mistakeDue = mistake.dueCount();
  const cardDue = card.dueQueue(null).length;
  if (mistakeDue > 0) tips.push(`错题本有 ${mistakeDue} 道待复习，建议每天固定 30 分钟清一轮。`);
  if (cardDue > 0) tips.push(`记忆卡片有 ${cardDue} 张到期，利用碎片时间翻看。`);
  if (latest) tips.push(`最近一次模考总分 ${latest.total}，距目标 ${t ? t.totalScore : ''} 分仍有差距，优先补「${ranked[0] ? ranked[0].name : '薄弱科'}」。`);
  tips.push('408 统考四门（数据结构/组成原理/操作系统/网络）建议按 4:3:2:1 配比复习，重基础、重真题。');

  const summary = t
    ? `目标：${t.university || '未填院校'}·${t.major || ''}，总分 ${t.totalScore}。阶段【${phase}】，已为你生成本周与每日复习方案。`
    : '尚未设置目标院校/专业，建议先到「我的目标」填写，规划会更精准。';

  return {
    enabled: true,
    phase, daysToExam: days, weeklyHours, summary,
    subjects, priorities, daily, weeks,
    milestones: ctx.countdown ? ctx.countdown.milestones : null,
    tips, hasExam: !!latest
  };
}

function buildWeeklyPlan(phase, days, subjects, weeklyHours) {
  const n = (days != null && days >= 0) ? Math.min(8, Math.max(3, Math.round(days / 7))) : 4;
  const out = [];
  for (let w = 1; w <= n; w++) {
    const ratio = n > 1 ? (w - 1) / (n - 1) : 0;
    let theme;
    if (phase === '复试') theme = '复试准备：专业课问答 + 项目复盘 + 英语口语';
    else if (phase === '冲刺') theme = '限时套题 + 查漏补缺';
    else if (phase === '强化') theme = ratio < 0.5 ? '专题强化 + 真题' : '真题实战 + 复盘';
    else theme = ratio < 0.5 ? '基础铺面（教材 + 课后题）' : '强化过渡（真题入门）';
    out.push({
      week: w,
      theme,
      subjects: subjects.map((s) => ({ name: s.name, hours: s.weeklyHours, gap: s.gap }))
    });
  }
  return out;
}

/**
 * 云端规划策略（混合式接入）
 *
 * 设计取舍：数值骨架（阶段 / 每周学时 / 每日模板 / 周计划 / 里程碑）继续由本地 plan() 算出，
 * 保证确定性、可复现，不会因模型胡说而给出离谱数字；只把「策略建议」这类文字交给云端模型，
 * 模型说什么都不会污染数值 —— 这是混合式能安全上线的前提。
 *
 * 任何失败（未配置 / 未部署 / 超时 / 返回异常）都 resolve(null)，
 * 调用方保持本地文案，用户完全无感。
 */
function planInsight() {
  if (!aiEnabled() || !canCloudFn()) return Promise.resolve(null);

  const ctx = buildContext();
  const p = plan();
  if (!p.enabled) return Promise.resolve(null);

  const t = ctx.target || {};
  const bg = ctx.background || {};
  const mastery = (ctx.subjects || []).slice(0, 4)
    .map((s) => `${s.name}掌握度${s.mastery}%`).join('，');
  const gaps = (p.priorities || []).slice(0, 3)
    .map((x) => `${x.subject}${x.gap != null ? '差' + x.gap + '分' : ''}`).join('，');
  const daysText = p.daysToExam != null ? `距初试 ${p.daysToExam} 天` : '未设考试日期';

  const prompt = [
    '你是考研规划顾问。下面是某位学生的真实情况，请据此给出 4-6 条具体、可执行的复习策略。',
    `目标：${t.university || '未填院校'}·${t.major || '未填专业'}，目标总分 ${t.totalScore || '未填'}。`,
    `考生背景：${bg.undergradTier}（${bg.undergradSchool}），竞赛/${bg.awards}，编程${bg.codingLevelText}；目标${bg.targetDegree}、${bg.settleCity}定居，一志愿${bg.primaryChoice}，保底${bg.backupChoice}。`,
    `当前阶段：${p.phase}，${daysText}，建议每周有效学习 ${p.weeklyHours} 小时。`,
    `各科掌握情况：${mastery || '暂无数据'}。`,
    `优先补弱：${gaps || '暂无模考数据'}。`,
    `错题本待复习 ${mistake.dueCount()} 道，记忆卡片到期 ${card.dueQueue(null).length} 张。`,
    `今日已学 ${util.fmtMinutes(ctx.todayMinutes)}，本周已学 ${util.fmtMinutes(ctx.weekMinutes)}。`,
    '注意：该生为二本出身、编程基础待强化，规划须强调代码能力训练（笔试含手写代码）与复试材料（竞赛/项目）准备；家境可支撑二战，可适度冲高。',
    '要求：每条一行，不超过 40 字，中文，直接给做法不要空话，不要序号，不要 Markdown 符号。'
  ].join('\n');

  return cloudFnChat([
    { role: 'system', content: '你是「研途顺利」考研助手的 AI，面向中国考研学生，用简洁、可执行、中文回答复习相关问题。' },
    { role: 'user', content: prompt }
  ]).then((res) => {
    const items = parseInsight(res && res.text);
    return items.length ? { items, from: 'cloud' } : null;
  }).catch(() => null);
}

/** 把模型返回的纯文本切成建议条目；容错「1. / - / • / ①」等各种写法 */
function parseInsight(text) {
  if (!text) return [];
  return String(text)
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\s*[-•*·▪●]+\s*/, '')
      .replace(/^\s*\d+\s*[.、)）]\s*/, '')
      .replace(/^\s*[①-⑨]\s*/, '')
      .trim())
    .filter((s) => s.length >= 6 && s.length <= 60)
    .slice(0, 6);
}

module.exports = {
  aiEnabled, advice, chat, extractQuestion, buildContext, plan, planInsight, mode, cloudError
};
