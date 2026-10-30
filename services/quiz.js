/**
 * 刷题系统 · 计算机 408 离线题库（纯本地，无网络）
 *
 * 适用：11408 / 22408 共用同一张 408 卷，本库只收 408 专业课题目。
 * 题型：single 单选 / multiple 多选 / judge 判断
 * 来源：real 历年真题 / sim 模拟题 / special 专项训练
 *
 * 字段：id / subject / type / chapter / stem / options[] / answer(索引或索引数组) / analysis / difficulty / kind
 */
const db = require('./db');
const util = require('../utils/util');
const mistake = require('./mistake');

const SUBJECTS = [
  { key: 'ds', name: '数据结构', color: 'var(--ok)' },
  { key: 'co', name: '计算机组成', color: 'var(--danger)' },
  { key: 'os', name: '操作系统', color: 'var(--c-english)' },
  { key: 'cn', name: '计算机网络', color: 'var(--forest-deep)' }
];
const SUBJECT_MAP = SUBJECTS.reduce((m, s) => { m[s.key] = s; return m; }, {});

const QUESTIONS = [
  /* ============ 数据结构 ============ */
  { id: 'q-ds1', subject: 'ds', type: 'single', chapter: '线性表', kind: 'real',
    stem: '对于一个长度为 n 的顺序表，在第 i（1≤i≤n+1）个位置插入一个元素，平均需要移动的元素个数是？',
    options: ['n/2', '(n-1)/2', 'n', 'n+1'], answer: 0, difficulty: 2,
    analysis: '插入位置等概率时，移动个数为 (n + (n-1) + … + 0)/(n+1) = n/2。顺序表插入/删除平均移动 n/2 个元素。' },
  { id: 'q-ds2', subject: 'ds', type: 'single', chapter: '树与二叉树', kind: 'real',
    stem: '一棵有 n 个结点的完全二叉树，其高度（深度，根结点为第 1 层）为？',
    options: ['⌊log₂n⌋', '⌊log₂n⌋+1', '⌈log₂n⌉', 'n'], answer: 1, difficulty: 2,
    analysis: '完全二叉树高度 h 满足 2^(h-1) ≤ n < 2^h，故 h = ⌊log₂n⌋ + 1。' },
  { id: 'q-ds3', subject: 'ds', type: 'multiple', chapter: '排序', kind: 'special',
    stem: '下列哪些排序算法在最坏情况下的时间复杂度是 O(n log n)？',
    options: ['快速排序', '堆排序', '归并排序', '冒泡排序'], answer: [1, 2], difficulty: 3,
    analysis: '堆排序与归并排序最坏均为 O(n log n)；快排最坏 O(n²)，冒泡 O(n²)。' },
  { id: 'q-ds4', subject: 'ds', type: 'judge', chapter: '图', kind: 'sim',
    stem: '在有 n 个顶点、e 条边的无向图中，邻接表存储所需的空间复杂度为 O(n + e)。',
    options: ['正确', '错误'], answer: 0, difficulty: 2,
    analysis: '邻接表：n 个表头 + 2e 个边结点（无向边存两次），总空间 O(n + e)。' },
  { id: 'q-ds5', subject: 'ds', type: 'single', chapter: '查找', kind: 'real',
    stem: '在长度为 n 的有序顺序表中进行折半查找，其最坏比较次数为？',
    options: ['⌊log₂n⌋', '⌈log₂(n+1)⌉', 'n', 'n/2'], answer: 1, difficulty: 2,
    analysis: '折半查找判定树高度为 ⌈log₂(n+1)⌉，最坏比较次数即树高。' },
  { id: 'q-ds6', subject: 'ds', type: 'single', chapter: '散列', kind: 'sim',
    stem: '采用线性探测法处理冲突的开放定址散列表中，装填因子 α 越大，则？',
    options: ['查找成功期望长度越小', '聚集现象越严重', '所需空间越小', '冲突越少'], answer: 1, difficulty: 3,
    analysis: '线性探测在 α 增大时极易产生一次聚集（primary clustering），导致探查序列成片。' },

  /* ============ 计算机组成 ============ */
  { id: 'q-co1', subject: 'co', type: 'single', chapter: '数据的表示', kind: 'real',
    stem: '在 IEEE 754 单精度浮点数（32 位）中，阶码采用的编码方式是？',
    options: ['原码', '补码', '移码（偏置 127）', '反码'], answer: 2, difficulty: 3,
    analysis: 'IEEE 754 单精度阶码 8 位采用移码，偏置值 127；尾数采用隐含最高位的原码。' },
  { id: 'q-co2', subject: 'co', type: 'single', chapter: 'Cache', kind: 'real',
    stem: '在直接映射 Cache 中，主存地址通常被划分为？',
    options: ['标记 + 字块内地址', '标记 + 组索引 + 字块内地址', '标记 + 行索引', '仅字块内地址'], answer: 0, difficulty: 3,
    analysis: '直接映射：主存地址 = 标记(tag) + 行索引(行号) + 块内地址。组相联才需要"组索引"。' },
  { id: 'q-co3', subject: 'co', type: 'multiple', chapter: '指令系统', kind: 'special',
    stem: '关于 RISC 指令集的特点，下列说法正确的有？',
    options: ['指令条数少', '指令长度固定', '寻址方式少', '倾向于复杂微程序控制'], answer: [0, 1, 2], difficulty: 3,
    analysis: 'RISC 特征：精简指令条数、定长指令格式、少量寻址方式、硬布线控制为主；复杂控制是 CISC 倾向。' },
  { id: 'q-co4', subject: 'co', type: 'judge', chapter: 'CPU', kind: 'sim',
    stem: '在流水线中，数据相关（RAW）可以通过增加流水线级数来彻底消除。',
    options: ['正确', '错误'], answer: 1, difficulty: 3,
    analysis: 'RAW 是真相关，无法通过增加级数消除，需用旁路（forwarding）或停顿（stall）处理。' },
  { id: 'q-co5', subject: 'co', type: 'single', chapter: '存储器', kind: 'real',
    stem: '某机字长 32 位，主存按字节编址。若采用 4 体低位交叉存储器，连续访问 n 个字（n≥4），理想加速比约为？',
    options: ['1', '4', '4n', 'n'], answer: 1, difficulty: 4,
    analysis: '低位交叉存储可流水启动各体，连续访问时每个存储周期送出一个字，相当于 4 体的吞吐 ≈ 单体的 4 倍（理想）。' },
  { id: 'q-co6', subject: 'co', type: 'single', chapter: '总线', kind: 'sim',
    stem: '总线仲裁方式中，集中式仲裁不包括以下哪种？',
    options: ['链式查询（菊花链）', '计数器定时查询', '独立请求', '分布式自举'], answer: 3, difficulty: 2,
    analysis: '集中式仲裁：链式查询、计数器定时查询、独立请求；分布式（自举）属于分布式仲裁。' },

  /* ============ 操作系统 ============ */
  { id: 'q-os1', subject: 'os', type: 'single', chapter: '进程管理', kind: 'real',
    stem: '用信号量 S 实现对某临界资源的互斥访问，初值应设为？',
    options: ['0', '1', '大于 1 的整数', '-1'], answer: 1, difficulty: 2,
    analysis: '互斥信号量初值为 1，P(S) 进入临界区、V(S) 退出；保证同时仅一个进程进入。' },
  { id: 'q-os2', subject: 'os', type: 'multiple', chapter: '内存管理', kind: 'special',
    stem: '下列哪些内存管理方式会产生内部碎片？',
    options: ['固定分区分配', '分页存储管理', '分段存储管理', '伙伴系统（按 2^k 分配）'], answer: [0, 1, 3], difficulty: 3,
    analysis: '固定分区、分页、伙伴系统按固定大小分配都会产生内部碎片；分段按逻辑段分配，产生外部碎片。' },
  { id: 'q-os3', subject: 'os', type: 'single', chapter: '文件管理', kind: 'real',
    stem: '在 UNIX 文件系统中，文件名通常存放在？',
    options: ['i 结点（索引结点）', '目录项', '超级块', '空闲块表'], answer: 1, difficulty: 2,
    analysis: 'UNIX 中 i 结点存文件属性与盘块指针，文件名与 i 结点号一起存放在目录项中。' },
  { id: 'q-os4', subject: 'os', type: 'judge', chapter: '死锁', kind: 'sim',
    stem: '系统采用银行家算法可以避免死锁的发生，是一种死锁预防策略。',
    options: ['正确', '错误'], answer: 1, difficulty: 3,
    analysis: '银行家算法是"死锁避免"（动态检查安全状态），不是"预防"（破坏四个必要条件）。' },
  { id: 'q-os5', subject: 'os', type: 'single', chapter: '进程调度', kind: 'sim',
    stem: '时间片轮转（RR）调度算法的主要缺点是？',
    options: ['不利于短作业', '平均周转时间可能偏大', '不能响应交互', '不支持多进程'], answer: 1, difficulty: 2,
    analysis: 'RR 公平性高、响应好，但频繁上下文切换且对短作业而言平均周转时间往往偏大。' },
  { id: 'q-os6', subject: 'os', type: 'single', chapter: '虚拟内存', kind: 'real',
    stem: '页面置换算法中，理论上缺页率最低的是？',
    options: ['FIFO', 'LRU', 'OPT（最佳置换）', 'Clock'], answer: 2, difficulty: 2,
    analysis: 'OPT 置换"未来最久不被访问"的页，是理论下界，实际无法实现，用作评价基准。' },

  /* ============ 计算机网络 ============ */
  { id: 'q-cn1', subject: 'cn', type: 'single', chapter: '传输层', kind: 'real',
    stem: 'TCP 使用三次握手建立连接，主要目的是？',
    options: ['加密数据', '确认双方的收发能力并同步初始序号', '减少延迟', '分配 IP 地址'], answer: 1, difficulty: 2,
    analysis: '三次握手使双方确认彼此的发送/接收能力，并同步初始序列号 ISN，防止已失效连接请求突然又传到。' },
  { id: 'q-cn2', subject: 'cn', type: 'multiple', chapter: '网络层', kind: 'special',
    stem: '关于 IPv4 地址，下列说法正确的有？',
    options: ['A 类地址首位为 0', '子网掩码用于区分网络号与主机号', '私有地址可在公网路由', 'CIDR 支持变长子网掩码'], answer: [0, 1, 3], difficulty: 3,
    analysis: '私有地址（10/172.16/192.168）不能在公网路由；其余正确。' },
  { id: 'q-cn3', subject: 'cn', type: 'single', chapter: '应用层', kind: 'real',
    stem: 'HTTP 协议默认使用的传输层协议与端口是？',
    options: ['TCP 80', 'UDP 53', 'TCP 443', 'UDP 67'], answer: 0, difficulty: 1,
    analysis: 'HTTP 基于 TCP，默认端口 80；HTTPS 为 TCP 443。' },
  { id: 'q-cn4', subject: 'cn', type: 'judge', chapter: '数据链路层', kind: 'sim',
    stem: 'CSMA/CD 主要用于无线局域网（WLAN）的介质访问控制。',
    options: ['正确', '错误'], answer: 1, difficulty: 2,
    analysis: 'CSMA/CD 是以太网（有线）协议；WLAN 用 CSMA/CA（冲突避免），因无线难以检测冲突。' },
  { id: 'q-cn5', subject: 'cn', type: 'single', chapter: '物理层', kind: 'sim',
    stem: '在香农定理 C = B log₂(1 + S/N) 中，C 的单位通常是？',
    options: ['Hz', 'bps', '字节/秒', 'dB'], answer: 1, difficulty: 2,
    analysis: 'C 为信道极限信息传输速率，单位是 bit/s（bps）。' },
  { id: 'q-cn6', subject: 'cn', type: 'single', chapter: '网络层', kind: 'real',
    stem: 'ARP 协议的功能是？',
    options: ['将 IP 地址解析为 MAC 地址', '将域名解析为 IP', '路由选择', '差错控制'], answer: 0, difficulty: 1,
    analysis: 'ARP（地址解析协议）完成 IP→MAC 的映射；DNS 完成域名→IP。' }
];

/* ---------------- 读取与筛选 ---------------- */
function all() { return QUESTIONS.slice(); }
function subjects() { return SUBJECTS.slice(); }
function subjectName(k) { return (SUBJECT_MAP[k] || {}).name || k; }
function subjectColor(k) { return (SUBJECT_MAP[k] || {}).color || 'var(--sub)'; }

function filter(opts) {
  const o = opts || {};
  return QUESTIONS.filter((q) => {
    if (o.subject && o.subject !== 'all' && q.subject !== o.subject) return false;
    if (o.kind && o.kind !== 'all' && q.kind !== o.kind) return false;
    if (o.type && o.type !== 'all' && q.type !== o.type) return false;
    return true;
  });
}

/** 抽取题目：mode = seq(顺序) / rand(随机) */
function pick(opts, count, mode) {
  let pool = filter(opts);
  if (mode === 'rand') {
    pool = pool.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
  }
  if (count && count > 0) pool = pool.slice(0, count);
  return pool;
}

/* ---------------- 判卷 ---------------- */
function isCorrect(q, userAnswer) {
  if (q.type === 'multiple') {
    const a = (q.answer || []).slice().sort();
    const u = (userAnswer || []).slice().sort();
    if (a.length !== u.length) return false;
    return a.every((x, i) => x === u[i]);
  }
  return userAnswer === q.answer;
}

/**
 * 提交答卷
 * @param questions 本次抽中的题目数组
 * @param answers   { [qid]: index | index[] }
 * 返回 { total, correct, accuracy, wrong:[qids], detail:[{...}] }
 */
function grade(questions, answers) {
  const detail = [];
  const wrong = [];
  let correct = 0;
  questions.forEach((q) => {
    const ua = answers[q.id];
    const ok = isCorrect(q, ua);
    if (ok) correct++; else wrong.push(q.id);
    detail.push({
      id: q.id, subject: q.subject, subjectName: subjectName(q.subject),
      chapter: q.chapter, type: q.type, stem: q.stem, options: q.options,
      answer: q.answer, userAnswer: ua, ok: ok, analysis: q.analysis
    });
  });
  const total = questions.length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  return { total, correct, accuracy, wrong, detail };
}

/** 错题自动入错题本（去重：同一 stem 不重复录入） */
function syncWrong(detail) {
  let added = 0;
  detail.forEach((d) => {
    if (d.ok) return;
    const exists = mistake.all().some((m) => m.source === '刷题' && m.questionText === d.stem);
    if (exists) return;
    mistake.add({
      subject: 'major',
      chapterName: d.subjectName + '·' + d.chapter,
      source: '刷题',
      questionText: d.stem,
      options: d.options || [],
      rightAnswer: Array.isArray(d.answer) ? d.answer.map((i) => d.options[i]).join('、') : d.options[d.answer],
      analysis: d.analysis,
      difficulty: 3,
      reasons: ['idea']
    });
    added++;
  });
  return added;
}

/* ---------------- 记录与统计 ---------------- */
function saveRecord(rec) {
  const list = db.get(db.KEYS.quizRecords, []);
  list.unshift(Object.assign({ id: util.uid('qr'), at: Date.now() }, rec));
  db.set(db.KEYS.quizRecords, list.slice(0, 100));
  return list[0];
}
function records() { return db.get(db.KEYS.quizRecords, []); }

function stats() {
  const list = records();
  const totalQ = list.reduce((s, r) => s + (r.total || 0), 0);
  const totalC = list.reduce((s, r) => s + (r.correct || 0), 0);
  const bySubject = {};
  list.forEach((r) => {
    if (!r.subject) return;
    bySubject[r.subject] = bySubject[r.subject] || { total: 0, correct: 0 };
    bySubject[r.subject].total += r.total;
    bySubject[r.subject].correct += r.correct;
  });
  return {
    sessions: list.length,
    totalQuestions: totalQ,
    totalCorrect: totalC,
    accuracy: totalQ ? Math.round((totalC / totalQ) * 100) : 0,
    bySubject
  };
}

function count() { return QUESTIONS.length; }

module.exports = {
  SUBJECTS, subjectName, subjectColor,
  all, subjects, filter, pick, isCorrect, grade, syncWrong,
  saveRecord, records, stats, count
};
