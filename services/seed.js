/**
 * 知识树种子数据：四科章节 / 知识点
 * 数学、英语、政治为内置；专业课支持用户自定义章节（存于本地 majorTree）
 */
const db = require('./db');

const BASE = {
  math: {
    name: '数学',
    stages: ['基础阶段', '强化阶段', '冲刺阶段'],
    groups: [
      {
        name: '高等数学',
        chapters: [
          { name: '函数、极限、连续', points: ['函数性质', '数列极限', '函数极限', '无穷小与无穷大', '函数的连续性'] },
          { name: '一元函数微分学', points: ['导数定义', '求导法则', '高阶导数', '微分', '中值定理', '导数应用'] },
          { name: '一元函数积分学', points: ['不定积分', '定积分', '定积分应用', '反常积分'] },
          { name: '多元函数微积分学', points: ['偏导数', '全微分', '二重积分', '三重积分', '曲线曲面积分'] },
          { name: '常微分方程', points: ['一阶微分方程', '可降阶方程', '线性微分方程'] },
          { name: '无穷级数', points: ['数项级数', '幂级数', '傅里叶级数'] }
        ]
      },
      {
        name: '线性代数',
        chapters: [
          { name: '行列式', points: ['行列式性质', '行列式计算'] },
          { name: '矩阵', points: ['矩阵运算', '逆矩阵', '初等变换', '矩阵的秩'] },
          { name: '向量', points: ['线性相关性', '极大无关组', '向量空间'] },
          { name: '线性方程组', points: ['齐次方程组', '非齐次方程组'] },
          { name: '特征值与特征向量', points: ['特征值计算', '相似对角化', '实对称矩阵'] },
          { name: '二次型', points: ['二次型标准形', '正定性'] }
        ]
      },
      {
        name: '概率论与数理统计',
        chapters: [
          { name: '随机事件与概率', points: ['古典概型', '条件概率', '独立性'] },
          { name: '随机变量及其分布', points: ['分布函数', '离散型随机变量', '连续型随机变量'] },
          { name: '多维随机变量', points: ['联合分布', '边缘分布', '随机变量独立性'] },
          { name: '随机变量的数字特征', points: ['数学期望', '方差', '协方差与相关系数'] },
          { name: '大数定律与中心极限定理', points: ['大数定律', '中心极限定理'] },
          { name: '数理统计', points: ['抽样分布', '参数估计', '假设检验'] }
        ]
      }
    ]
  },
  english: {
    name: '英语',
    stages: ['基础阶段', '强化阶段', '冲刺阶段'],
    groups: [
      { name: '词汇', chapters: [
        { name: '核心词汇', points: ['高频词 Unit1-10', '高频词 Unit11-20', '熟词僻义'] },
        { name: '词组与搭配', points: ['动词搭配', '固定短语'] }
      ] },
      { name: '语法与长难句', chapters: [
        { name: '句法基础', points: ['句子成分', '简单句与复合句'] },
        { name: '长难句拆解', points: ['定语从句', '状语从句', '名词性从句', '非谓语动词', '特殊结构'] }
      ] },
      { name: '阅读理解', chapters: [
        { name: '题型分类', points: ['主旨大意题', '细节题', '推理判断题', '词义句意题', '态度题'] },
        { name: '篇章训练', points: ['经济类', '科技类', '社会类', '文化教育类'] }
      ] },
      { name: '写作', chapters: [
        { name: '小作文', points: ['书信', '通知', '备忘录'] },
        { name: '大作文', points: ['图画作文', '图表作文', '话题模板'] }
      ] },
      { name: '翻译 / 完形 / 新题型', chapters: [
        { name: '翻译', points: ['英译汉技巧', '长句处理'] },
        { name: '完形填空', points: ['逻辑衔接', '词汇辨析'] },
        { name: '新题型', points: ['七选五', '排序题', '小标题'] }
      ] }
    ]
  },
  politics: {
    name: '政治',
    stages: ['强化阶段', '冲刺阶段'],
    groups: [
      { name: '马克思主义基本原理', chapters: [
        { name: '辩证唯物主义', points: ['唯物论', '辩证法', '认识论'] },
        { name: '历史唯物主义', points: ['社会存在与意识', '社会基本矛盾', '人民群众'] },
        { name: '政治经济学', points: ['商品与货币', '资本与剩余价值', '垄断资本主义'] },
        { name: '科学社会主义', points: ['社会主义的发展', '共产主义理想'] }
      ] },
      { name: '毛泽东思想和中国特色社会主义理论体系', chapters: [
        { name: '毛泽东思想', points: ['新民主主义革命', '社会主义改造', '社会主义建设道路'] },
        { name: '中国特色社会主义理论', points: ['邓小平理论', '三个代表', '科学发展观'] },
        { name: '习近平新时代中国特色社会主义思想', points: ['新时代坚持和发展中国特色社会主义', '五位一体总体布局', '四个全面战略布局'] }
      ] },
      { name: '中国近现代史纲要', chapters: [
        { name: '旧民主主义革命', points: ['鸦片战争', '太平天国', '辛亥革命'] },
        { name: '新民主主义革命', points: ['五四运动', '建党', '抗日战争', '解放战争'] },
        { name: '社会主义革命与建设', points: ['新中国成立', '改革开放'] }
      ] },
      { name: '思想道德与法治', chapters: [
        { name: '人生观与价值观', points: ['人生价值', '理想信念'] },
        { name: '道德与法治', points: ['道德规范', '法律基础', '宪法'] }
      ] },
      { name: '形势与政策', chapters: [
        { name: '时政热点', points: ['年度大事记', '重要会议精神'] }
      ] }
    ]
  },
  major: {
    name: '专业课',
    stages: ['基础阶段', '强化阶段', '冲刺阶段'],
    groups: [
      { name: '数据结构', chapters: [
        { name: '线性表', points: ['顺序表', '链表', '栈与队列', '串'] },
        { name: '树与二叉树', points: ['二叉树遍历', '线索二叉树', '哈夫曼树', '平衡二叉树'] },
        { name: '图', points: ['图的存储', '图的遍历', '最小生成树', '最短路径', '拓扑排序'] },
        { name: '查找与排序', points: ['折半查找', 'B树与B+树', '哈希表', '各类排序算法'] }
      ] },
      { name: '计算机组成原理', chapters: [
        { name: '数据的表示与运算', points: ['定点数', '浮点数', '运算方法'] },
        { name: '存储系统', points: ['Cache', '主存', '虚拟存储器'] },
        { name: '指令系统与CPU', points: ['指令格式', '寻址方式', 'CPU数据通路', '流水线'] },
        { name: '总线与IO', points: ['总线', '中断', 'DMA'] }
      ] },
      { name: '操作系统', chapters: [
        { name: '进程管理', points: ['进程与线程', '调度算法', '同步与互斥', '死锁'] },
        { name: '内存管理', points: ['分页', '分段', '页面置换算法'] },
        { name: '文件管理', points: ['文件结构', '目录', '磁盘调度'] },
        { name: 'IO管理', points: ['IO方式', '缓冲技术'] }
      ] },
      { name: '计算机网络', chapters: [
        { name: '体系结构', points: ['OSI与TCP/IP', '分层模型'] },
        { name: '物理层与数据链路层', points: ['编码与调制', '差错控制', '介质访问控制'] },
        { name: '网络层', points: ['IP协议', '路由算法', '子网划分'] },
        { name: '传输层与应用层', points: ['TCP与UDP', '可靠传输', 'HTTP/DNS/FTP'] }
      ] }
    ]
  }
};

function pointId(key, group, chapter, point) {
  return `${key}::${group}::${chapter}::${point}`;
}

function normalize(key, raw) {
  return {
    key,
    name: raw.name,
    stages: raw.stages || ['基础阶段', '强化阶段', '冲刺阶段'],
    custom: !!raw.custom,
    groups: (raw.groups || []).map((g) => ({
      name: g.name,
      chapters: (g.chapters || []).map((c) => ({
        name: c.name,
        points: (c.points || []).map((p) => ({
          id: pointId(key, g.name, c.name, p),
          name: p
        }))
      }))
    }))
  };
}

/** 专业课自定义章节 */
function getCustomMajor() { return db.get(db.KEYS.majorTree, null); }

function setCustomMajor(tree) { db.set(db.KEYS.majorTree, tree); }

function treeOf(key) {
  if (key === 'major') {
    const custom = getCustomMajor();
    if (custom && custom.groups && custom.groups.length) {
      return normalize('major', Object.assign({}, BASE.major, { groups: custom.groups, custom: true }));
    }
  }
  const raw = BASE[key] || BASE.major;
  return normalize(key, raw);
}

/** 为某个分组追加一个章节 */
function addChapterToMajor(groupName, chapterName, points) {
  const tree = treeOf('major');
  const groups = JSON.parse(JSON.stringify(tree.groups));
  let group = groups.find((g) => g.name === groupName);
  if (!group) { group = { name: groupName, chapters: [] }; groups.push(group); }
  group.chapters.push({ name: chapterName, points: points || [] });
  // 去掉生成好的 id，保存时重新生成
  const plain = groups.map((g) => ({
    name: g.name,
    chapters: g.chapters.map((c) => ({ name: c.name, points: c.points.map((p) => (typeof p === 'string' ? p : p.name)) }))
  }));
  setCustomMajor({ groups: plain });
  return treeOf('major');
}

function resetMajor() { db.remove(db.KEYS.majorTree); }

module.exports = { BASE, treeOf, pointId, addChapterToMajor, resetMajor, getCustomMajor };
