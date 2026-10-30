/**
 * 背单词（英语）：本地种子词书 + 艾宾浩斯记忆调度
 * 复用于背诵卡片同一套 SRS 引擎（utils/srs），保证「考前压缩」一致性。
 * 纯本地、零后端、零外部依赖；英语为 11408/22408 公共课，完全契合 408 路径。
 */
const db = require('./db');
const util = require('../utils/util');
const srs = require('../utils/srs');
const targetService = require('./target');

/* ---------------- 种子词书（精选高频，可继续扩充） ---------------- */
const SEED_BOOKS = [
  {
    id: 'core',
    name: '考研核心词汇',
    desc: '考研大纲高频核心词精选，覆盖阅读与写作常见词',
    words: [
      { id: 'c001', w: 'abstract', phonetic: '/ˈæbstrækt/', pos: 'a./n./v.', meaning: '抽象的；摘要；提取', example: 'We need an abstract of the paper.', roots: 'ab-(away) + tract(draw) 抽出→摘要', deriv: 'abstraction n. 抽象' },
      { id: 'c002', w: 'accommodate', phonetic: '/əˈkɒmədeɪt/', pos: 'v.', meaning: '容纳；适应；提供住宿', example: 'The hotel can accommodate 300 guests.', roots: 'ac- + commod(便利)', deriv: 'accommodation n. 住宿' },
      { id: 'c003', w: 'accumulate', phonetic: '/əˈkjuːmjəleɪt/', pos: 'v.', meaning: '积累；累积', example: 'He accumulated great wealth.', roots: 'ac- + cumul(堆积)', deriv: 'accumulation n. 积累' },
      { id: 'c004', w: 'acknowledge', phonetic: '/əkˈnɒlɪdʒ/', pos: 'v.', meaning: '承认；致谢', example: 'She acknowledged her mistake.', roots: 'ac- + know', deriv: 'acknowledgement n. 承认' },
      { id: 'c005', w: 'acquire', phonetic: '/əˈkwaɪə(r)/', pos: 'v.', meaning: '获得；习得', example: 'Children acquire language quickly.', roots: 'ac- + quir(寻求)', deriv: 'acquisition n. 获得' },
      { id: 'c006', w: 'adapt', phonetic: '/əˈdæpt/', pos: 'v.', meaning: '适应；改编', example: 'Plants adapt to the climate.', roots: 'ad- + apt(适应)', deriv: 'adaptation n. 适应' },
      { id: 'c007', w: 'adequate', phonetic: '/ˈædɪkwət/', pos: 'a.', meaning: '足够的；恰当的', example: 'The food was adequate for us.', roots: 'ad- + equ(相等)', deriv: 'adequacy n. 足够' },
      { id: 'c008', w: 'advocate', phonetic: '/ˈædvəkeɪt/', pos: 'v./n.', meaning: '提倡；拥护者', example: 'He advocates free trade.', roots: 'ad- + voc(声音)', deriv: 'advocacy n. 拥护' },
      { id: 'c009', w: 'alleviate', phonetic: '/əˈliːvieɪt/', pos: 'v.', meaning: '减轻；缓解', example: 'The drug alleviates pain.', roots: 'al- + lev(轻)', deriv: 'alleviation n. 缓解' },
      { id: 'c010', w: 'ambiguous', phonetic: '/æmˈbɪɡjuəs/', pos: 'a.', meaning: '模棱两可的', example: 'His reply was ambiguous.', roots: 'ambi-(两) + ag(驱动)', deriv: 'ambiguity n. 模糊' },
      { id: 'c011', w: 'ambitious', phonetic: '/æmˈbɪʃəs/', pos: 'a.', meaning: '有雄心的；野心勃勃的', example: 'She has an ambitious plan.', roots: 'amb(环绕) + it(走)', deriv: 'ambition n. 抱负' },
      { id: 'c012', w: 'analyze', phonetic: '/ˈænəlaɪz/', pos: 'v.', meaning: '分析；解析', example: 'We analyzed the data.', roots: 'ana-(贯穿) + lyz(分解)', deriv: 'analysis n. 分析' },
      { id: 'c013', w: 'anticipate', phonetic: '/ænˈtɪsɪpeɪt/', pos: 'v.', meaning: '预期；预料', example: 'We anticipate a rise in price.', roots: 'anti- + cip(取)', deriv: 'anticipation n. 预期' },
      { id: 'c014', w: 'apparent', phonetic: '/əˈpærənt/', pos: 'a.', meaning: '明显的；表面的', example: 'It was apparent to all.', roots: 'ap- + par(出现)', deriv: 'apparently ad. 显然' },
      { id: 'c015', w: 'arbitrary', phonetic: '/ˈɑːbɪtrəri/', pos: 'a.', meaning: '任意的；武断的', example: 'An arbitrary decision.', roots: 'arbiter 仲裁者', deriv: 'arbitrarily ad. 武断地' },
      { id: 'c016', w: 'articulate', phonetic: '/ɑːˈtɪkjuleɪt/', pos: 'v./a.', meaning: '清晰表达；善于表达的', example: 'He articulated his view.', roots: 'artic(关节)', deriv: 'articulation n. 表达' },
      { id: 'c017', w: 'assess', phonetic: '/əˈses/', pos: 'v.', meaning: '评估；评定', example: 'Assess the risk first.', roots: 'as- + sess(坐)', deriv: 'assessment n. 评估' },
      { id: 'c018', w: 'assume', phonetic: '/əˈsjuːm/', pos: 'v.', meaning: '假设；承担', example: 'Assume it is true.', roots: 'as- + sum(拿)', deriv: 'assumption n. 假定' },
      { id: 'c019', w: 'attribute', phonetic: '/əˈtrɪbjuːt/', pos: 'v./n.', meaning: '归因于；属性', example: 'He attributed it to luck.', roots: 'at- + tribute(给予)', deriv: 'attribution n. 归因' },
      { id: 'c020', w: 'authority', phonetic: '/ɔːˈθɒrəti/', pos: 'n.', meaning: '权威；当局', example: 'The authority banned it.', roots: 'author 作者', deriv: 'authoritative a. 权威的' },
      { id: 'c021', w: 'autonomous', phonetic: '/ɔːˈtɒnəməs/', pos: 'a.', meaning: '自治的；自主的', example: 'An autonomous region.', roots: 'auto-(自我) + nom(法则)', deriv: 'autonomy n. 自治' },
      { id: 'c022', w: 'beneficial', phonetic: '/ˌbenɪˈfɪʃl/', pos: 'a.', meaning: '有益的', example: 'A beneficial effect.', roots: 'bene-(好) + fic(做)', deriv: 'benefit n./v. 益处' },
      { id: 'c023', w: 'bias', phonetic: '/ˈbaɪəs/', pos: 'n.', meaning: '偏见；偏向', example: 'A cultural bias.', roots: '古法语 biais', deriv: 'biased a. 有偏见的' },
      { id: 'c024', w: 'capacity', phonetic: '/kəˈpæsəti/', pos: 'n.', meaning: '能力；容量', example: 'Capacity for work.', roots: 'cap(抓/容纳)', deriv: 'capable a. 有能力的' },
      { id: 'c025', w: 'circumvent', phonetic: '/ˌsɜːkəmˈvent/', pos: 'v.', meaning: '规避；绕开', example: 'Circumvent the law.', roots: 'circum-(环绕) + vent(来)', deriv: 'circumvention n. 规避' },
      { id: 'c026', w: 'coherent', phonetic: '/kəʊˈhɪərənt/', pos: 'a.', meaning: '连贯的；一致的', example: 'A coherent argument.', roots: 'co- + her(粘)', deriv: 'coherence n. 连贯' },
      { id: 'c027', w: 'compensate', phonetic: '/ˈkɒmpenseɪt/', pos: 'v.', meaning: '补偿；赔偿', example: 'Compensate for the loss.', roots: 'com- + pens(称量)', deriv: 'compensation n. 补偿' },
      { id: 'c028', w: 'compile', phonetic: '/kəmˈpaɪl/', pos: 'v.', meaning: '编纂；编译', example: 'Compile a dictionary.', roots: 'com- + pil(堆积)', deriv: 'compilation n. 汇编' },
      { id: 'c029', w: 'complicate', phonetic: '/ˈkɒmplɪkeɪt/', pos: 'v.', meaning: '使复杂', example: 'It complicates matters.', roots: 'com- + plic(折叠)', deriv: 'complicated a. 复杂的' },
      { id: 'c030', w: 'comprehend', phonetic: '/ˌkɒmprɪˈhend/', pos: 'v.', meaning: '理解；包含', example: 'I cannot comprehend it.', roots: 'com- + prehend(抓)', deriv: 'comprehension n. 理解' },
      { id: 'c031', w: 'conceal', phonetic: '/kənˈsiːl/', pos: 'v.', meaning: '隐藏；隐瞒', example: 'Conceal the truth.', roots: 'con- + ceal(隐藏)', deriv: 'concealment n. 隐藏' },
      { id: 'c032', w: 'conclusive', phonetic: '/kənˈkluːsɪv/', pos: 'a.', meaning: '决定性的；确凿的', example: 'Conclusive evidence.', roots: 'con- + clus(关闭)', deriv: 'conclude v. 结论' },
      { id: 'c033', w: 'concrete', phonetic: '/ˈkɒŋkriːt/', pos: 'a./n.', meaning: '具体的；混凝土', example: 'Concrete examples.', roots: 'con- + cret(生长)', deriv: 'concretely ad. 具体地' },
      { id: 'c034', w: 'conduct', phonetic: '/kənˈdʌkt/', pos: 'v./n.', meaning: '进行；传导；行为', example: 'Conduct an experiment.', roots: 'con- + duct(引导)', deriv: 'conductor n. 导体' },
      { id: 'c035', w: 'consequently', phonetic: '/ˈkɒnsɪkwəntli/', pos: 'ad.', meaning: '因此；结果', example: 'Consequently, he left.', roots: 'con- + sequ(跟随)', deriv: 'consequence n. 后果' },
      { id: 'c036', w: 'considerable', phonetic: '/kənˈsɪdərəbl/', pos: 'a.', meaning: '相当大的；可观的', example: 'A considerable sum.', roots: 'consider 考虑', deriv: 'considerably ad. 相当地' },
      { id: 'c037', w: 'consolidate', phonetic: '/kənˈsɒlɪdeɪt/', pos: 'v.', meaning: '巩固；合并', example: 'Consolidate power.', roots: 'con- + solid(坚固)', deriv: 'consolidation n. 巩固' },
      { id: 'c038', w: 'constitute', phonetic: '/ˈkɒnstɪtjuːt/', pos: 'v.', meaning: '构成；组成', example: 'Women constitute 50%.', roots: 'con- + stitut(建立)', deriv: 'constitution n. 宪法' },
      { id: 'c039', w: 'contemporary', phonetic: '/kənˈtemprəri/', pos: 'a.', meaning: '当代的；同时代的', example: 'Contemporary art.', roots: 'con- + tempor(时间)', deriv: 'contemporarily ad. 当代地' },
      { id: 'c040', w: 'contradict', phonetic: '/ˌkɒntrəˈdɪkt/', pos: 'v.', meaning: '反驳；与…矛盾', example: 'Facts contradict him.', roots: 'contra-(反对) + dict(说)', deriv: 'contradiction n. 矛盾' },
      { id: 'c041', w: 'crucial', phonetic: '/ˈkruːʃl/', pos: 'a.', meaning: '关键的；至关重要的', example: 'A crucial moment.', roots: 'cruc(十字)', deriv: 'crucially ad. 关键地' },
      { id: 'c042', w: 'cultivate', phonetic: '/ˈkʌltɪveɪt/', pos: 'v.', meaning: '培养；耕作', example: 'Cultivate good habits.', roots: 'cult(耕作)', deriv: 'cultivation n. 培养' },
      { id: 'c043', w: 'cumulative', phonetic: '/ˈkjuːmjələtɪv/', pos: 'a.', meaning: '累积的；渐增的', example: 'Cumulative effect.', roots: 'cumul(堆积)', deriv: 'cumulatively ad. 累积地' },
      { id: 'c044', w: 'deliberate', phonetic: '/dɪˈlɪbərət/', pos: 'a.', meaning: '故意的；深思熟虑的', example: 'A deliberate act.', roots: 'de- + liber(称量)', deriv: 'deliberately ad. 故意地' },
      { id: 'c045', w: 'demonstrate', phonetic: '/ˈdemənstreɪt/', pos: 'v.', meaning: '证明；演示', example: 'Demonstrate the theory.', roots: 'de- + monstr(展示)', deriv: 'demonstration n. 演示' }
    ]
  },
  {
    id: 'freq',
    name: '真题高频词',
    desc: '历年真题中反复出现的实词与连接词，提分利器',
    words: [
      { id: 'f001', w: 'phenomenon', phonetic: '/fəˈnɒmɪnən/', pos: 'n.', meaning: '现象', example: 'A natural phenomenon.', roots: 'pheno-(显) + men(出现)', deriv: 'phenomenal a. 非凡的' },
      { id: 'f002', w: 'significant', phonetic: '/sɪɡˈnɪfɪkənt/', pos: 'a.', meaning: '重要的；显著的', example: 'A significant change.', roots: 'sign(标记) + fic', deriv: 'significance n. 重要性' },
      { id: 'f003', w: 'fundamental', phonetic: '/ˌfʌndəˈmentl/', pos: 'a.', meaning: '基本的；根本的', example: 'Fundamental rights.', roots: 'fund(基础)', deriv: 'fundamentally ad. 根本上' },
      { id: 'f004', w: 'illustrate', phonetic: '/ˈɪləstreɪt/', pos: 'v.', meaning: '阐明；举例说明', example: 'Illustrate with examples.', roots: 'il- + lustr(光)', deriv: 'illustration n. 插图' },
      { id: 'f005', w: 'maintain', phonetic: '/meɪnˈteɪn/', pos: 'v.', meaning: '维持；主张', example: 'Maintain a balance.', roots: 'main(手) + ten(握)', deriv: 'maintenance n. 维持' },
      { id: 'f006', w: 'occur', phonetic: '/əˈkɜː(r)/', pos: 'v.', meaning: '发生；出现', example: 'It occurred to me.', roots: 'oc- + cur(跑)', deriv: 'occurrence n. 发生' },
      { id: 'f007', w: 'potential', phonetic: '/pəˈtenʃl/', pos: 'a./n.', meaning: '潜在的；潜力', example: 'A potential risk.', roots: 'pot(能)', deriv: 'potentially ad. 潜在地' },
      { id: 'f008', w: 'principle', phonetic: '/ˈprɪnsəpl/', pos: 'n.', meaning: '原则；原理', example: 'Basic principles.', roots: 'prin(第一) + cip(取)', deriv: 'principal a. 主要的' },
      { id: 'f009', w: 'reflect', phonetic: '/rɪˈflekt/', pos: 'v.', meaning: '反映；反思', example: 'Reflect on the past.', roots: 're- + flect(弯)', deriv: 'reflection n. 反思' },
      { id: 'f010', w: 'reveal', phonetic: '/rɪˈviːl/', pos: 'v.', meaning: '揭示；显露', example: 'The report reveals it.', roots: 're- + veal(面纱)', deriv: 'revelation n. 揭示' },
      { id: 'f011', w: 'substantial', phonetic: '/səbˈstænʃl/', pos: 'a.', meaning: '大量的；实质的', example: 'A substantial amount.', roots: 'substance 物质', deriv: 'substantially ad. 大量地' },
      { id: 'f012', w: 'theory', phonetic: '/ˈθɪəri/', pos: 'n.', meaning: '理论；学说', example: 'In theory.', roots: 'theo(神/看)', deriv: 'theoretical a. 理论的' },
      { id: 'f013', w: 'whereas', phonetic: '/ˌweərˈæz/', pos: 'conj.', meaning: '然而；鉴于', example: 'He is poor, whereas she is rich.', roots: 'where + as', deriv: '' },
      { id: 'f014', w: 'achieve', phonetic: '/əˈtʃiːv/', pos: 'v.', meaning: '实现；达到', example: 'Achieve a goal.', roots: 'a- + chief(头)', deriv: 'achievement n. 成就' },
      { id: 'f015', w: 'conclusion', phonetic: '/kənˈkluːʒn/', pos: 'n.', meaning: '结论；结局', example: 'Draw a conclusion.', roots: 'con- + clus(关闭)', deriv: 'conclude v. 总结' },
      { id: 'f016', w: 'define', phonetic: '/dɪˈfaɪn/', pos: 'v.', meaning: '定义；界定', example: 'Define the term.', roots: 'de- + fin(边界)', deriv: 'definition n. 定义' },
      { id: 'f017', w: 'evidence', phonetic: '/ˈevɪdəns/', pos: 'n.', meaning: '证据；迹象', example: 'Hard evidence.', roots: 'e- + vid(看)', deriv: 'evident a. 明显的' },
      { id: 'f018', w: 'indicate', phonetic: '/ˈɪndɪkeɪt/', pos: 'v.', meaning: '表明；指示', example: 'Data indicates a trend.', roots: 'in- + dic(说)', deriv: 'indication n. 指示' },
      { id: 'f019', w: 'interpret', phonetic: '/ɪnˈtɜːprɪt/', pos: 'v.', meaning: '解释；口译', example: 'Interpret the result.', roots: 'inter- + pret(价值)', deriv: 'interpretation n. 解释' },
      { id: 'f020', w: 'moreover', phonetic: '/mɔːrˈəʊvə(r)/', pos: 'ad.', meaning: '此外；而且', example: 'Moreover, it is cheap.', roots: 'more + over', deriv: '' },
      { id: 'f021', w: 'obtain', phonetic: '/əbˈteɪn/', pos: 'v.', meaning: '获得；得到', example: 'Obtain a degree.', roots: 'ob- + tain(拿)', deriv: 'obtainable a. 可获得的' },
      { id: 'f022', w: 'perspective', phonetic: '/pəˈspektɪv/', pos: 'n.', meaning: '视角；观点', example: 'From my perspective.', roots: 'per- + spect(看)', deriv: 'perspectively ad. 客观地' },
      { id: 'f023', w: 'primary', phonetic: '/ˈpraɪməri/', pos: 'a.', meaning: '主要的；初级的', example: 'Primary goal.', roots: 'prim(第一)', deriv: 'primarily ad. 主要地' },
      { id: 'f024', w: 'resource', phonetic: '/rɪˈsɔːs/', pos: 'n.', meaning: '资源；财力', example: 'Natural resources.', roots: 're- + sourc(源头)', deriv: 'resourceful a. 足智多谋的' },
      { id: 'f025', w: 'structure', phonetic: '/ˈstrʌktʃə(r)/', pos: 'n./v.', meaning: '结构；构建', example: 'The structure of DNA.', roots: 'struct(建造)', deriv: 'structural a. 结构的' }
    ]
  }
];

function books() { return SEED_BOOKS; }
function book(id) { return SEED_BOOKS.find((b) => b.id === id) || null; }
function allWords(bookId) {
  if (!bookId || bookId === 'all') return SEED_BOOKS.reduce((a, b) => a.concat(b.words.map((w) => Object.assign({ bookId: b.id }, w))), []);
  const b = book(bookId);
  return b ? b.words.map((w) => Object.assign({ bookId: b.id }, w)) : [];
}

/* ---------------- 记忆状态 ---------------- */
function loadState() { return db.get(db.KEYS.wordState, {}); }
function saveState(map) { db.set(db.KEYS.wordState, map); }

function stateOf(id) {
  const map = loadState();
  return map[id] || { status: 0, familiar: 0, reviewCount: 0, learnedAt: 0, updatedAt: 0, srs: { ef: 2.5, interval: 0, reps: 0, lapses: 0, dueDate: util.dateStr() } };
}

function ensure(id) {
  const map = loadState();
  if (!map[id]) {
    map[id] = { status: 0, familiar: 0, reviewCount: 0, learnedAt: 0, updatedAt: 0, srs: { ef: 2.5, interval: 0, reps: 0, lapses: 0, dueDate: util.dateStr() } };
  }
  return map[id];
}

function upsert(id, patch, touchStreak) {
  const map = loadState();
  const prev = map[id] || { status: 0, familiar: 0, reviewCount: 0, learnedAt: 0, updatedAt: 0, srs: { ef: 2.5, interval: 0, reps: 0, lapses: 0, dueDate: util.dateStr() } };
  const next = Object.assign({}, prev, patch, { updatedAt: Date.now() });
  map[id] = next;
  saveState(map);
  if (touchStreak) bumpStreak();
  return next;
}

function daysToExam() {
  const c = targetService.countdown();
  return c ? Math.max(0, c.totalDays) : 999;
}

/** 提交一次学习结果：q 评分 0=忘了 / 3=模糊 / 5=记得；自动推进 SRS 与掌握状态 */
function studySubmit(id, q) {
  const cur = ensure(id);
  const r = srs.review({ srs: cur.srs }, q, util.dateStr(), daysToExam());
  let status = cur.status;
  if (q >= 3) {
    if (status === 0) status = 1; // 新词 -> 学习中
    if (q >= 3 && r.interval >= 21 && (cur.srs.reps || 0) + 1 >= 2) status = 2; // 掌握
  }
  return upsert(id, {
    srs: r,
    status,
    familiar: q >= 3 ? Math.min(5, cur.familiar + 1) : Math.max(0, cur.familiar - 1),
    reviewCount: cur.reviewCount + 1,
    learnedAt: cur.learnedAt || Date.now()
  }, true);
}

/* ---------------- 连续学习天数 ---------------- */
function settings() {
  return Object.assign({ dailyNew: 20, dailyReview: 40, mode: 'recognize' }, db.get(db.KEYS.wordSettings, {}));
}
function saveSettings(patch) { const s = Object.assign(settings(), patch); db.set(db.KEYS.wordSettings, s); return s; }

function bumpStreak() {
  const s = settings();
  const today = util.dateStr();
  if (s.lastStudyDate === today) return;
  if (s.lastStudyDate === util.dateStr(util.addDays(today, -1))) s.streak = (s.streak || 0) + 1;
  else s.streak = 1;
  s.lastStudyDate = today;
  db.set(db.KEYS.wordSettings, s);
}

/* ---------------- 每日计划 ---------------- */
function todayPlan(bookId) {
  const s = settings();
  const words = allWords(bookId);
  const map = loadState();
  const today = util.dateStr();
  const news = [];
  const reviews = [];
  for (const w of words) {
    const st = map[w.id];
    if (!st || st.status === 0) {
      if (news.length < s.dailyNew) news.push(w);
    } else if (srs.isDue({ srs: st.srs, masteredAt: st.status === 2 ? st.updatedAt : 0 }, today) && st.status !== 2) {
      if (reviews.length < s.dailyReview) reviews.push(w);
    }
  }
  return { news, reviews, newCount: news.length, reviewCount: reviews.length, dailyNew: s.dailyNew, dailyReview: s.dailyReview };
}

/* ---------------- 统计 ---------------- */
function stats(bookId) {
  const words = allWords(bookId);
  const map = loadState();
  let learned = 0, mastered = 0, reviewing = 0;
  words.forEach((w) => {
    const st = map[w.id];
    if (st && st.status === 2) mastered++;
    else if (st && st.status >= 1) { learned++; reviewing++; }
  });
  return {
    total: words.length,
    learned: learned + mastered,
    reviewing,
    mastered,
    newCount: words.length - learned - mastered,
    streak: settings().streak || 0
  };
}

/* ---------------- 生词本（用户从刷题/阅读中手动加入） ---------------- */
function extraList() { return db.get(db.KEYS.wordExtra, []); }
function addExtra(word) {
  const list = extraList();
  if (list.some((x) => x.w && word.w && x.w.toLowerCase() === word.w.toLowerCase())) return list;
  list.unshift(Object.assign({ id: util.uid('wx'), createdAt: Date.now() }, word));
  db.set(db.KEYS.wordExtra, list);
  return list;
}
function removeExtra(id) { const list = extraList().filter((x) => x.id !== id); db.set(db.KEYS.wordExtra, list); return list; }

/** 抽题：为某词生成干扰项（同词书其他词的释义/词形） */
function distractors(word, pool, count) {
  const same = pool.filter((x) => x.id !== word.id);
  const picked = [];
  const used = {};
  let i = 0;
  while (picked.length < count && i < same.length * 2) {
    const cand = same[Math.floor(Math.random() * same.length)];
    if (cand && !used[cand.id]) { used[cand.id] = 1; picked.push(cand); }
    i++;
  }
  return picked;
}

module.exports = {
  books, book, allWords, stateOf, studySubmit,
  todayPlan, stats, settings, saveSettings,
  extraList, addExtra, removeExtra, distractors
};
