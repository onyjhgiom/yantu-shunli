/**
 * 教辅资料推荐数据层
 * 覆盖考研主流学科：数学（高数/线代/概率）、408 计算机专业基础、英语、政治。
 * 每学科按「考型/年级」(数学一·二 / 英语一·二 / 学硕·专硕 / 政治统考) 分类，
 * 每类下按教辅类型（同步练习册 / 历年试卷 / 复习指南 / 考点解析 / 培优拔高）列出书目。
 *
 * 书目均为市面上长期口碑的公开教辅；版本随年份更新，仅作选购参考，请以当年最新版为准。
 * 难度层级：base 基础 / mid 进阶 / high 拔高 / rush 冲刺。
 */

// 教辅类型
const TYPE_META = {
  guide: { key: 'guide', name: '复习指南', icon: '✚' },
  sync: { key: 'sync', name: '同步练习册', icon: '◫' },
  paper: { key: 'paper', name: '历年试卷', icon: '▤' },
  analysis: { key: 'analysis', name: '考点解析', icon: '◎' },
  advanced: { key: 'advanced', name: '培优拔高', icon: '★' }
};

const TYPES = ['guide', 'sync', 'paper', 'analysis', 'advanced'];

// 难度层级
const LEVEL_META = {
  base: { key: 'base', name: '基础', color: 'var(--ok)' },
  mid: { key: 'mid', name: '进阶', color: 'var(--c-english)' },
  high: { key: 'high', name: '拔高', color: 'var(--terracotta)' },
  rush: { key: 'rush', name: '冲刺', color: 'var(--danger)' }
};

// ---- 书目明细 ----
function b(name, version, level, feature, hot) {
  return { name, version, level, feature, hot: !!hot };
}

const MATH_BOOKS = {
  guide: [
    b('李永乐《考研数学复习全书》', '李永乐团队分册（数一/数二通用，按册选用）', 'mid', '体系完整、贴合考纲，全年主线教材，适合一轮打基础到二轮强化', true),
    b('张宇《高数 18 讲》', '配套同济七版《高等数学》', 'mid', '讲解深入、重思想方法，适合想拔高解题视野的同学', true),
    b('汤家凤《高等数学辅导讲义》', '配套同济七版《高等数学》', 'base', '例题步骤细致、重计算基本功，基础薄弱友好')
  ],
  sync: [
    b('李永乐《数学基础过关 660 题》', '选择+填空专项', 'base', '专攻选填基础概念，一轮用来查漏补缺、夯实定义', true),
    b('汤家凤《接力题典 1800》', '全题型', 'base', '题量充足、由易到难，基础→强化过渡练习首选'),
    b('张宇《题源探析经典 1000 题》', '全题型', 'high', '难度偏高、综合性强，适合强化阶段冲击高分')
  ],
  paper: [
    b('李永乐《历年真题全精解析》', '1987–近年真题', 'mid', '按年编排、解析权威，二三轮真题实战必做', true),
    b('张宇《真题大全解》', '1987–近年真题', 'mid', '套卷形式、分类讲解，适合整套计时模考'),
    b('合工大《超越 / 共创 5 套卷》', '当年模拟', 'rush', '口碑模拟卷，难度贴近或略高于真题，用于冲刺保温')
  ],
  analysis: [
    b('李永乐《线性代数辅导讲义》', '全', 'mid', '“永乐大帝”线代神书，体系清晰、方法精炼，线代必看', true),
    b('王式安《概率论与数理统计辅导讲义》', '全（数一适用）', 'mid', '原考研命题组风格，概率论思路正统，数一同学推荐')
  ],
  advanced: [
    b('张宇《闭关修炼》', '全', 'high', '专题串讲+难题，强化拔高、打通综合大题', true),
    b('武忠祥《高数辅导讲义》', '配套同济七版', 'mid', '题型归纳到位、解题套路清晰，强化阶段口碑之选'),
    b('李林《考前冲刺 6+4 套卷》', '当年', 'rush', '押题向模拟，冲刺阶段用作实战与热点补充')
  ]
};

const CS_BOOKS = {
  guide: [
    b('王道《数据结构》', '严蔚敏《数据结构（C语言版）》', 'mid', '408 四门主线教材，考点覆盖全、配套视频，必看', true),
    b('王道《计算机组成原理》', '唐朔飞《计算机组成原理》', 'mid', '计组难点集中，王道讲解+图示清晰，408 拉分科', true),
    b('王道《操作系统》', '汤子瀛《计算机操作系统》', 'mid', '概念+真题导向，进程/内存/文件系统重点突出', true),
    b('王道《计算机网络》', '谢希仁《计算机网络》', 'mid', '分层讲解、题型归纳，偏记忆但有规律', true),
    b('天勤《数据结构高分笔记》', '严蔚敏《数据结构》', 'base', '图示多、入门友好，跨考或基础薄弱可作铺垫')
  ],
  sync: [
    b('王道《课后习题 + 强化习题》', '王道单科书配套', 'mid', '每章习题+大题，吃透即覆盖绝大多数考点', true),
    b('天勤《计算机考研习题集》', '天勤系列', 'base', '基础题量大、解析细，适合首轮巩固')
  ],
  paper: [
    b('408 历年统考真题（2009–2025）', '教育部考试中心', 'mid', '唯一官方真题，至少刷两遍，摸清命题风格', true),
    b('王道《8 套模拟卷》', '王道', 'rush', '冲刺模考，难度贴近真题，查漏补缺')
  ],
  analysis: [
    b('王道《考点速记手册》', '王道', 'mid', '口袋本，二轮/冲刺速记高频考点'),
    b('咸鱼学长《408 思维导图 / 考点串讲》', '线上课程配套', 'mid', '框架化梳理，适合建立四门知识脉络')
  ],
  advanced: [
    b('王道《强化班讲义》', '王道强化班', 'high', '专题拔高、综合大题训练，目标 120+ 推荐', true),
    b('跨考《计算机专业基础综合》', '跨考教育', 'high', '难题拓展，用于突破高分瓶颈')
  ]
};

const ENGLISH_BOOKS = {
  guide: [
    b('朱伟《恋练有词》', '无特定教材（词汇书）', 'base', '词群记忆、例句来自真题，打词汇基础', true),
    b('田静《句句真研》', '无特定教材（语法长难句）', 'base', '从简单句到长难句，语法薄弱友好', true),
    b('唐迟《阅读的逻辑》', '无特定教材（阅读方法）', 'mid', '阅读解题方法论，重逻辑而非翻译，阅读提分关键', true)
  ],
  sync: [
    b('张剑《黄皮书·历年真题解析》', '英语一 / 英语二分册', 'mid', '真题逐篇精讲、语篇分析，真题即最佳练习', true),
    b('《考研真相》（英一）/《考研圣经》（英二）', '英语一 / 英语二分册', 'base', '逐句图示精解，基础弱可用来啃透真题')
  ],
  paper: [
    b('历年英语真题（张剑黄皮书）', '英语一 / 英语二分册', 'mid', '按套计时模考，至少近 10 年反复刷', true),
    b('王江涛《英语高分写作》+ 预测 20 篇', '全', 'mid', '写作模板+范文，考前背诵押题素材')
  ],
  analysis: [
    b('唐静《拆分与组合翻译法》', '全', 'mid', '翻译专项方法论，英一翻译/英二全文翻译适用', true),
    b('王江涛《高分写作》', '全', 'mid', '写作思路与语料，大小作文框架清晰')
  ],
  advanced: [
    b('何凯文《长难句解密》/ 每日一句', '全', 'high', '长难句精析+每日打卡，冲刺阅读与翻译', true),
    b('刘晓艳《考研英语保命班》', '全', 'high', '技巧向、重应试套路，时间紧可速成')
  ]
};

const POLITICS_BOOKS = {
  guide: [
    b('肖秀荣《命题人知识点精讲精练》', '当年最新版（覆盖大纲）', 'mid', '内容最全、权威主线，一轮复习核心教材', true),
    b('徐涛《核心考案》', '全', 'base', '讲解通俗、配视频课，理解马原等难点友好', true),
    b('腿姐（陆寓丰）《考点清单》', '全', 'base', '表格化、重点突出，适合理清框架')
  ],
  sync: [
    b('肖秀荣《命题人 1000 题》', '当年最新版', 'base', '选择题专项必刷，一轮二轮的题海主力', true),
    b('徐涛《优题库》', '全', 'mid', '选择题进阶，配合刷题班使用')
  ],
  paper: [
    b('肖秀荣《命题人冲刺 8 套卷（肖八）》', '当年', 'rush', '选择题必做、分析题熟读，冲刺保温核心', true),
    b('肖秀荣《命题人终极预测 4 套卷（肖四）》', '当年', 'rush', '分析题几乎必背，考前押题天花板', true),
    b('徐涛 / 腿姐《模拟卷》', '当年', 'rush', '补充选择题手感，多卷交叉练')
  ],
  analysis: [
    b('腿姐《冲刺背诵手册》', '当年', 'mid', '背诵版、keywords 清晰，分析题语料来源', true),
    b('徐涛《冲刺笔记》', '当年', 'mid', '浓缩考点，二三轮速记')
  ],
  advanced: [
    b('肖秀荣《点题班 / 押题》', '当年', 'rush', '考前点睛，分析题热点补充', true),
    b('腿姐《技巧班 / 押题班》', '当年', 'rush', '选择题技巧+分析题模板，应试提分')
  ]
};

// 学科与书目（引用上方已初始化的书目常量）
const SUBJECTS = [
  {
    id: 'math',
    name: '考研数学',
    icon: '∑',
    desc: '高数 + 线代 +（数一）概率，按数一 / 数二选书',
    grades: [
      { id: 'math1', name: '数学一', note: '高数+线代+概率，范围最广' },
      { id: 'math2', name: '数学二', note: '仅高数+线代，不考概率' }
    ],
    books: {
      math1: MATH_BOOKS,
      math2: MATH_BOOKS
    }
  },
  {
    id: 'cs',
    name: '408 计算机专业基础',
    icon: '❖',
    desc: '数据结构 + 计组 + 操作系统 + 计网，学硕专硕同卷',
    grades: [
      { id: '11408', name: '学硕 11408', note: '内容相同，按报考路径区分' },
      { id: '22408', name: '专硕 22408', note: '内容相同，按报考路径区分' }
    ],
    books: {
      11408: CS_BOOKS,
      22408: CS_BOOKS
    }
  },
  {
    id: 'english',
    name: '考研英语',
    icon: 'A',
    desc: '英语一 / 英语二，按卷种选书',
    grades: [
      { id: 'eng1', name: '英语一', note: '学硕 / 部分专硕' },
      { id: 'eng2', name: '英语二', note: '多数专硕' }
    ],
    books: {
      eng1: ENGLISH_BOOKS,
      eng2: ENGLISH_BOOKS
    }
  },
  {
    id: 'politics',
    name: '考研政治',
    icon: '卐',
    desc: '统考科目，不分学硕专硕',
    grades: [
      { id: 'all', name: '政治统考', note: '全国一张卷' }
    ],
    books: {
      all: POLITICS_BOOKS
    }
  }
];

/* ---------------- 查询接口 ---------------- */

function subjects() { return SUBJECTS; }
function getSubject(id) { return SUBJECTS.find((s) => s.id === id) || null; }

function gradesOf(subjectId) {
  const s = getSubject(subjectId);
  return s ? s.grades : [];
}

/** 取某学科某考型下某类型的书目列表 */
function booksOf(subjectId, gradeId, typeId) {
  const s = getSubject(subjectId);
  if (!s) return [];
  const gradeBooks = s.books[gradeId] || s.books[s.grades[0].id] || {};
  if (!typeId) {
    // 返回按类型归类的全部
    return TYPES.map((t) => ({ type: t, typeName: TYPE_META[t].name, list: gradeBooks[t] || [] }))
      .filter((x) => x.list.length);
  }
  return gradeBooks[typeId] || [];
}

/**
 * 根据报考路径（22408 / 11408）推断默认考型，用于个性化默认选中。
 * 22408 → 数二 / 英二 / 专硕；11408 → 数一 / 英一 / 学硕
 */
function recommendTrack(examPath) {
  const is224 = String(examPath || '').indexOf('22408') >= 0;
  return {
    math: is224 ? 'math2' : 'math1',
    english: is224 ? 'eng2' : 'eng1',
    cs: is224 ? '22408' : '11408'
  };
}

/** 智能搜索：跨学科跨类型匹配书名/特点/版本 */
function searchBooks(kw) {
  kw = String(kw || '').trim().toLowerCase();
  if (!kw) return [];
  const out = [];
  SUBJECTS.forEach((s) => {
    s.grades.forEach((g) => {
      const gb = s.books[g.id] || {};
      TYPES.forEach((t) => {
        (gb[t] || []).forEach((book) => {
          const hay = (book.name + ' ' + book.version + ' ' + book.feature).toLowerCase();
          if (hay.indexOf(kw) >= 0) {
            out.push({
              subjectId: s.id, subjectName: s.name, gradeName: g.name,
              typeName: TYPE_META[t].name, book
            });
          }
        });
      });
    });
  });
  return out;
}

module.exports = {
  TYPE_META, TYPES, LEVEL_META, SUBJECTS,
  subjects, getSubject, gradesOf, booksOf, recommendTrack, searchBooks
};
