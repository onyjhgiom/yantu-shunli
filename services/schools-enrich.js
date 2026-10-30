/**
 * 院校画像增强层（计算机类 408 统考 · 11408 / 22408）
 *
 * ⚠️ 数据诚信约定（与 schools-data.js / school-fresh.js 一致，绝不编造）：
 *   1. 学科评估 assess 仅录入【教育部第四轮学科评估(2017)】的公开结果，字段标 round:'第四轮'。
 *      仅填写有把握的院校；拿不准的不写（UI 退回到层次徽标），绝不杜撰字母等级。
 *   2. 复试特点 retest 为「公开事实 + 经验参考」：机试/笔试/面试是否常见来自各校复试方案整理，
 *      具体权重与当年形式以院校研究生院复试细则为准（已注明「经验参考」）。
 *   3. 二本友好度 friendly 是【基于报录比/复试风格的经验判断】，非官方指标，UI 明确标注「经验参考」。
 *   4. 重点平台 platform 为各校重点实验室/研究中心的公开事实（代表性方向），非该校独家数据。
 *   5. 未显式录入的院校由 deriveDefault() 按层次/标签推导默认值，保证全库 237 所都能展示画像。
 *
 * 键为院校代码 school.c（与 schools-data.js 一一对应）。
 */

/* 学科评估等级说明（第四轮，2017 官方） */
const ASSESS_FIELDS = {
  cs: '计算机科学与技术',
  se: '软件工程',
  nse: '网络空间安全'
};
const ASSESS_ROUND = '第四轮(2017)';

/**
 * 显式录入的院校画像（只录有把握的）。
 * assess: { cs, se, nse } 取值 'A+'/'A'/'A-'/'B+'/'B'/'B-'/'C+'/'C'/'C-'/'—'
 * retest.machine: 是否有上机机试（经验参考）
 * retest.english: 是否重英语（面试/文献）
 * friendly: '高'/'中'/'低'（二本友好度，经验参考）
 */
const ENRICH = {
  // ---------- 顶尖 (lv1) ----------
  '10003': { // 清华大学
    assess: { cs: 'A+', se: 'A', nse: 'A-' }, intro: '计算机系居国内顶尖，系统、AI、图形学全栈强，资源与出路顶级。',
    strengths: ['学科顶尖', 'AI 强', '系统强', '就业顶尖', '北京'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试(上机编程)+笔试+面试，重基础与工程能力，竞争极激烈，隐性看重本科与竞赛。' },
    friendly: '低', friendlyNote: '顶尖校，面试隐性看重本科出身与竞赛，二本需极高分+硬核项目背书。',
    platform: ['智能技术与系统国家重点实验室', '人机交互与媒体集成教育部重点实验室']
  },
  '10001': { // 北京大学
    assess: { cs: 'A', se: 'A', nse: 'A' }, intro: '理论与系统并重，人工智能、图形学、数据库传统强，学术氛围浓。',
    strengths: ['学科顶尖', '理论强', '学术强', '北京'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+笔试+面试，重算法与科研潜力，对本科出身隐性有要求。' },
    friendly: '低', friendlyNote: '顶尖校，二本需极强科研/竞赛背景才有面试话语权。',
    platform: ['高可信软件技术教育部重点实验室']
  },
  '10335': { // 浙江大学
    assess: { cs: 'A+', se: 'A+', nse: '—' }, intro: 'CAD&CG 国家重点实验室撑起图形学顶尖，AI 与系统均强，产学研活跃。',
    strengths: ['学科顶尖', '图形学强', 'AI 强', '杭州'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+面试，重工程与项目，竞争极激烈。' },
    friendly: '低', friendlyNote: '顶尖校，二本需极高分+项目。',
    platform: ['计算机辅助设计与图形学国家重点实验室', '人工智能研究所']
  },
  '90002': { // 国防科技大学
    assess: { cs: 'A+', se: 'A+', nse: 'A+' }, intro: '并行与分布处理、网安国防特色顶尖，军内/军工出路独特。',
    strengths: ['学科顶尖', '并行计算强', '网安强', '军工'],
    retest: { machine: true, written: true, interviewWeight: '中', english: false, note: '机试+笔试+面试，重系统与底层，军工背景审核特殊。' },
    friendly: '低', friendlyNote: '顶尖校+政审特殊，二本门槛极高。',
    platform: ['并行与分布处理国家重点实验室', '拥塞控制与网络生存性湖南省重点实验室']
  },
  // ---------- 强势 985 / 顶尖 211 (lv2) ----------
  '10006': { // 北京航空航天大学
    assess: { cs: 'A', se: 'A', nse: 'A-' }, intro: '计算机与软件均 A，嵌入式、虚拟现实、网安特色明显，航天军工去向多。',
    strengths: ['学科强', '虚拟现实强', '网安强', '北京', '航天军工'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+笔试+面试，重代码与项目，对双非相对友好但有竞争。' },
    friendly: '中', friendlyNote: '985 中相对务实，但计院竞争仍大，二本需高分+项目。',
    platform: ['虚拟现实技术与系统国家重点实验室', '软件开发环境国家重点实验室']
  },
  '10013': { // 北京邮电大学
    assess: { cs: 'A', se: 'B+', nse: 'B+' }, intro: '计算机 A、信息类老牌强校，网络与通信交叉特色，互联网就业极佳。',
    strengths: ['计算机强', '网络强', '互联网去向好', '北京'],
    retest: { machine: true, written: false, interviewWeight: '中', english: true, note: '机试+面试为主，重编程与通信背景，体量较大机会相对多。' },
    friendly: '中', friendlyNote: '211 中计算机最卷之一，但名额多，二本高分+机试强可冲。',
    platform: ['网络与交换技术国家重点实验室']
  },
  '10213': { // 哈尔滨工业大学
    assess: { cs: 'A', se: 'A', nse: 'B' }, intro: '系统、AI、机器人传统强，深圳校区拉高就业，寒地工科名校。',
    strengths: ['学科强', '系统强', '机器人强', '深圳校区', '就业好'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+笔试+面试，重基础与工程，本部+深圳校区可选。' },
    friendly: '中', friendlyNote: '985 务实，深圳校区名额多，二本高分可冲。',
    platform: ['机器人与系统国家重点实验室', '哈工大(深圳) 计算机学院']
  },
  '10248': { // 上海交通大学
    assess: { cs: 'A', se: 'A-', nse: '—' }, intro: '计算机 A、AI 与系统强，上海地缘与校企资源顶级，联培基地多。',
    strengths: ['学科强', 'AI 强', '上海', '校企资源顶级', '联培机会多'],
    retest: { machine: true, written: true, interviewWeight: '中高', english: true, note: '机试(ACM 风格)+笔试+面试，重英语、竞赛与科研潜力，计算机学院本部最卷。' },
    friendly: '低', friendlyNote: '顶尖 985，面试隐性看重本科/竞赛/英语，二本需高分+机试极强；可走医学影像 AI、联培基地等友好方向。',
    platform: ['图像处理与模式识别研究所', '人工智能研究院', '上海交大-联影医学影像联合实验室']
  },
  '10284': { // 南京大学
    assess: { cs: 'A', se: 'A', nse: '—' }, intro: '软件与 AI 理论强，周志华团队撑起机器学习顶尖，学术与就业均衡。',
    strengths: ['学科强', 'AI 理论强', '软件强', '南京'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+笔试+面试，重算法与机器学习基础。' },
    friendly: '低', friendlyNote: '顶尖 985，二本需高分+科研/项目。',
    platform: ['计算机软件新技术国家重点实验室']
  },
  '10487': { // 华中科技大学
    assess: { cs: 'A', se: 'A-', nse: 'B+' }, intro: '计算机 A、系统与外存储强，武汉光电国家研究中心支撑，互联网大厂认可高。',
    strengths: ['学科强', '系统强', '就业好', '武汉'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+面试，重代码与项目，体量较大。' },
    friendly: '中', friendlyNote: '985 务实、名额多，二本高分可冲。',
    platform: ['武汉光电国家研究中心', '服务计算技术与系统教育部重点实验室']
  },
  '10614': { // 电子科技大学
    assess: { cs: 'A', se: 'A-', nse: 'B+' }, intro: '计算机 A、电子信息顶尖，成电在西南互联网与芯片圈认可极高。',
    strengths: ['学科强', '电子信息强', '就业好', '成都'],
    retest: { machine: true, written: false, interviewWeight: '中', english: true, note: '机试+面试为主，重编程，沙河/清水河校区可选。' },
    friendly: '中', friendlyNote: '985 务实，二本高分可冲。',
    platform: ['电子科技大学-华为', '神经信息教育部重点实验室']
  },
  '10358': { // 中国科学技术大学
    assess: { cs: 'A-', se: 'A-', nse: '—' }, intro: '理科底色强，AI、体系结构、量子信息交叉，科研导向明显。',
    strengths: ['学科强', 'AI 强', '科研强', '合肥'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+面试，重数学与算法基础。' },
    friendly: '低', friendlyNote: '顶尖科研校，二本需极强数理+科研背景。',
    platform: ['语音及语言信息处理国家工程实验室']
  },
  '10247': { // 同济大学
    assess: { cs: 'A-', se: 'A-', nse: 'B' }, intro: '计算机 A-、土木/汽车/设计交叉特色，上海地缘强，复试较务实。',
    strengths: ['学科强', '上海', '交叉(汽车/土木)强', '复试务实'],
    retest: { machine: false, written: true, interviewWeight: '中高', english: true, note: '笔试(含手写代码)+面试+外语，无硬性 OJ 机试，整体较务实。' },
    friendly: '中', friendlyNote: '985 对双非相对包容，复录比友好，二本高分可冲；全日制专硕考数一英一。',
    platform: ['嵌入式系统与服务计算教育部重点实验室', '同济-联影智能医学影像']
  },
  '10486': { // 武汉大学
    assess: { cs: 'A-', se: 'A', nse: 'B+' }, intro: '软件 A、AI 与遥感信息交叉，国家网络安全学院支撑网安特色。',
    strengths: ['学科强', '软件强', '网安强', '武汉'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+面试，网安院独立划线，重代码。' },
    friendly: '中', friendlyNote: '985 务实，名额较多，二本高分可冲。',
    platform: ['国家多媒体软件工程技术研究中心', '武汉大学国家网络安全学院']
  },
  '10533': { // 中南大学
    assess: { cs: 'A-', se: 'A-', nse: 'B+' }, intro: '计算机 A-、医疗大数据与交通信息特色，长沙性价比高。',
    strengths: ['学科强', '医疗大数据强', '长沙'],
    retest: { machine: true, written: true, interviewWeight: '中', english: false, note: '机试+面试，重代码与项目。' },
    friendly: '中', friendlyNote: '985 务实，二本高分可冲。',
    platform: ['医疗大数据应用技术国家工程实验室']
  },
  '10699': { // 西北工业大学
    assess: { cs: 'A-', se: 'B+', nse: '—' }, intro: '计算机 A-、三航(航空/航天/航海)背景强，西安军工去向多。',
    strengths: ['学科强', '三航交叉', '西安', '军工'],
    retest: { machine: true, written: true, interviewWeight: '中', english: false, note: '机试+面试，重系统与嵌入式。' },
    friendly: '中', friendlyNote: '985 务实，二本高分可冲。',
    platform: ['空天地海一体化大数据应用技术国家工程实验室']
  },
  '10698': { // 西安交通大学
    assess: { cs: 'A-', se: 'B+', nse: '—' }, intro: '计算机 A-、人工智能与大数据新兴强，C9 地缘在西北。',
    strengths: ['学科强', 'AI 强', '西安', 'C9'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+面试，重算法与数学。' },
    friendly: '中', friendlyNote: '985 务实，二本高分可冲。',
    platform: ['人机共存知识计算创新中心']
  },
  '10246': { // 复旦大学
    assess: { cs: 'B+', se: 'B+', nse: '—' }, intro: '综合顶尖校，计算机规模适中但 AI 与交叉强，上海地缘顶级。',
    strengths: ['综合顶尖', 'AI 强', '上海'],
    retest: { machine: true, written: true, interviewWeight: '中高', english: true, note: '机试+面试，重英语与科研潜力。' },
    friendly: '低', friendlyNote: '顶尖 985，二本门槛高。',
    platform: ['上海市智能信息处理重点实验室']
  },
  '10286': { // 东南大学
    assess: { cs: 'B+', se: 'B', nse: '—' }, intro: '计算机 B+、网络与可视媒体交叉，南京工科强校。',
    strengths: ['网络强', '南京', '工科强'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '985 务实，二本高分可冲。',
    platform: ['计算机网络和信息集成教育部重点实验室']
  },
  '10558': { // 中山大学
    assess: { cs: 'B+', se: 'B', nse: 'B-' }, intro: '广州地缘强，AI 与超算(天河)交叉，珠三角就业好。',
    strengths: ['广州', '超算强', '就业好'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+面试，重代码与项目。' },
    friendly: '中', friendlyNote: '985 务实，二本高分可冲。',
    platform: ['国家超级计算广州中心']
  },
  '10269': { // 华东师范大学
    assess: { cs: 'B+', se: 'B', nse: '—' }, intro: '上海 985，教育与数据科学交叉，师范底色但计算机就业不弱。',
    strengths: ['上海', '数据科学强', '教育交叉'],
    retest: { machine: true, written: false, interviewWeight: '中', english: true, note: '机试+面试，重代码与项目。' },
    friendly: '中', friendlyNote: '上海 985，二本高分可冲，地缘加分。',
    platform: ['上海市高可信计算重点实验室']
  },
  '10056': { // 天津大学
    assess: { cs: 'B+', se: 'B', nse: '—' }, intro: '天津工科强校，计算机规模适中，智能与软件交叉。',
    strengths: ['天津', '工科强', '智能强'],
    retest: { machine: true, written: true, interviewWeight: '中', english: false, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '985 务实，二本高分可冲。',
    platform: ['天津市认知计算与应用重点实验室']
  },
  '10055': { // 南开大学
    assess: { cs: 'B+', se: 'B', nse: '—' }, intro: '天津综合强校，计算机理论扎实，规模适中。',
    strengths: ['天津', '综合强'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+面试，重基础。' },
    friendly: '中', friendlyNote: '985 务实，二本高分可冲。',
    platform: ['天津市智能机器人技术重点实验室']
  },
  '10183': { // 吉林大学
    assess: { cs: 'A-', se: 'B+', nse: 'B' }, intro: '计算机老牌强校，软件与符号计算特色，体量巨大名额多。',
    strengths: ['学科强', '软件强', '名额多', '长春'],
    retest: { machine: true, written: true, interviewWeight: '中', english: false, note: '机试+面试，重代码，名额多机会相对大。' },
    friendly: '中', friendlyNote: '985 务实、名额多，二本高分可冲。',
    platform: ['符号计算与知识工程教育部重点实验室']
  },
  '10141': { // 大连理工大学
    assess: { cs: 'B+', se: 'B', nse: '—' }, intro: '东北工科强校，计算机规模适中，软件与智能交叉。',
    strengths: ['大连', '工科强'],
    retest: { machine: true, written: true, interviewWeight: '中', english: false, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '985 务实，二本高分可冲。',
    platform: ['辽宁省泛在网络与服务软件重点实验室']
  },
  '10561': { // 华南理工大学
    assess: { cs: 'B+', se: 'B', nse: '—' }, intro: '广州工科强校，计算机与软件工程交叉，珠三角就业极佳。',
    strengths: ['广州', '就业好', '工科强'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+面试，重代码与项目。' },
    friendly: '中', friendlyNote: '985 务实、地缘强，二本高分可冲。',
    platform: ['广东省计算机网络重点实验室']
  },
  '10384': { // 厦门大学
    assess: { cs: 'B+', se: 'B-', nse: '—' }, intro: '厦门综合强校，计算机规模适中，AI 与多媒体交叉。',
    strengths: ['厦门', '综合强', 'AI 强'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '985 务实，二本高分可冲。',
    platform: ['福建省智慧城市感知与计算重点实验室']
  },
  '10422': { // 山东大学
    assess: { cs: 'B+', se: 'B', nse: '—' }, intro: '济南/青岛双校区，计算机体量较大，软件与网络交叉。',
    strengths: ['山东', '名额多'],
    retest: { machine: true, written: true, interviewWeight: '中', english: false, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '985 务实、名额多，二本高分可冲。',
    platform: ['数字媒体技术教育部工程研究中心']
  },
  '10532': { // 湖南大学
    assess: { cs: 'B+', se: 'B', nse: '—' }, intro: '长沙工科强校，计算机与机器人交叉，岳麓山下的性价比 985。',
    strengths: ['长沙', '机器人强'],
    retest: { machine: true, written: true, interviewWeight: '中', english: false, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '985 务实，二本高分可冲。',
    platform: ['机器人视觉感知与控制技术国家工程研究中心']
  },
  '10611': { // 重庆大学
    assess: { cs: 'B+', se: 'B-', nse: '—' }, intro: '重庆综合 985，计算机规模适中，大数据与智能交叉。',
    strengths: ['重庆', '综合强'],
    retest: { machine: true, written: true, interviewWeight: '中', english: false, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '985 务实，二本高分可冲。',
    platform: ['信息物理社会可信服务计算教育部重点实验室']
  },
  '10701': { // 西安电子科技大学
    assess: { cs: 'A-', se: 'B+', nse: 'A+' }, intro: '网安 A+(全国顶尖)、计算机 A-，电子信息与密码学特色，军工/大厂去向多。',
    strengths: ['网安顶尖', '计算机强', '密码学强', '西安', '就业好'],
    retest: { machine: true, written: false, interviewWeight: '中', english: true, note: '机试+面试为主，网安院重密码学与代码，性价比极高。' },
    friendly: '中', friendlyNote: '211 中计算机/网安最值得冲，二本高分+机试强强烈推荐。',
    platform: ['综合业务网理论及关键技术国家重点实验室', '网络与信息安全国家级实验教学中心']
  },
  '10357': { // 安徽大学
    assess: { cs: 'B', se: 'B', nse: '—' }, intro: '安徽省属 211，计算机 B、人工智能学院新建，合肥地缘 + 中科大辐射，性价比高。',
    strengths: ['安徽 211', '合肥', '性价比高', 'AI 新建'],
    retest: { machine: false, written: true, interviewWeight: '中', english: false, note: '笔试(含手写代码)+面试，无硬性 OJ 机试，整体务实、对双非包容。' },
    friendly: '高', friendlyNote: '211 中对二本最友好之一，复试线贴近国家线档，二本冲专硕现实。',
    platform: ['计算智能与信号处理教育部重点实验室', '安徽大学人工智能学院']
  },
  '10336': { // 杭州电子科技大学
    assess: { cs: 'B+', se: 'B-', nse: '—' }, intro: '计算机 B+、电子信息特色，阿里系校友密集，杭州互联网就业极佳。',
    strengths: ['计算机强', '杭州', '互联网去向好', '阿里校友'],
    retest: { machine: true, written: false, interviewWeight: '中', english: true, note: '机试+面试为主，重编程，双非中的香饽饽。' },
    friendly: '高', friendlyNote: '双非强校中对二本非常友好，机试强即可，性价比极高。',
    platform: ['射频电路与系统教育部重点实验室']
  },
  '10590': { // 深圳大学
    assess: { cs: 'B', se: 'B-', nse: '—' }, intro: '深圳地缘顶级，计算机 B、经费充足，腾讯系校友与实习便利。',
    strengths: ['深圳', '地缘顶级', '就业好', '经费足'],
    retest: { machine: true, written: false, interviewWeight: '中', english: true, note: '机试+面试，重代码与项目，本地实习资源极佳。' },
    friendly: '高', friendlyNote: '双非但地缘顶级，对二本友好，编程强推荐。',
    platform: ['广东省ATR重点实验室']
  },
  '10287': { // 南京航空航天大学
    assess: { cs: 'B', se: 'B', nse: '—' }, intro: '南京工科 211，计算机与航空信息交叉，军工/长三角去向。',
    strengths: ['南京', '航空交叉', '211'],
    retest: { machine: true, written: true, interviewWeight: '中', english: false, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '211 务实，二本高分可冲。',
    platform: ['模式分析与机器智能工信部重点实验室']
  },
  '10288': { // 南京理工大学
    assess: { cs: 'B', se: 'B', nse: '—' }, intro: '南京工科 211，计算机与光电/武器信息交叉。',
    strengths: ['南京', '211', '光电交叉'],
    retest: { machine: true, written: true, interviewWeight: '中', english: false, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '211 务实，二本高分可冲。',
    platform: ['计算机科学与技术江苏省重点学科']
  },
  '10285': { // 苏州大学
    assess: { cs: 'B-', se: 'B-', nse: '—' }, intro: '苏州地缘强，计算机规模适中，AI 与软件交叉，经费充足。',
    strengths: ['苏州', '地缘强', '经费足'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '211 务实、地缘好，二本高分可冲。',
    platform: ['江苏省计算机信息处理技术重点实验室']
  },
  '10280': { // 上海大学
    assess: { cs: 'B', se: 'B-', nse: '—' }, intro: '上海 211，计算机规模适中，地缘与就业在上海有优势。',
    strengths: ['上海', '211', '地缘强'],
    retest: { machine: true, written: false, interviewWeight: '中', english: true, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '上海 211，地缘加分，二本高分可冲。',
    platform: ['上海大学计算机工程与科学学院']
  },
  '10251': { // 华东理工大学
    assess: { cs: 'B', se: 'B-', nse: '—' }, intro: '上海 211，化工背景强，计算机与过程信息交叉。',
    strengths: ['上海', '211', '化工交叉'],
    retest: { machine: true, written: true, interviewWeight: '中', english: true, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '上海 211，二本高分可冲。',
    platform: ['化工过程先进控制与优化技术教育部重点实验室']
  },
  '10255': { // 东华大学
    assess: { cs: 'C+', se: 'C+', nse: '—' }, intro: '上海 211，以纺织/服装出名，计算机规模小但上海地缘有就业便利。',
    strengths: ['上海', '211', '过线友好'],
    retest: { machine: false, written: true, interviewWeight: '中', english: false, note: '笔试+面试为主，重基础。' },
    friendly: '高', friendlyNote: '上海 211 中相对易上岸，二本保底上海地缘可选。',
    platform: ['东华大学计算机科学与技术系']
  },
  '10359': { // 合肥工业大学
    assess: { cs: 'B', se: 'B-', nse: '—' }, intro: '安徽 211，计算机稳健，合肥地缘 + 中科大辐射，性价比不错。',
    strengths: ['安徽 211', '合肥', '性价比高'],
    retest: { machine: true, written: true, interviewWeight: '中', english: false, note: '机试+面试，重代码。' },
    friendly: '中', friendlyNote: '211 务实，二本高分可冲，安大之外安徽另一选择。',
    platform: ['安全关键工业测控技术教育部工程研究中心']
  },
  '10269_ecnu': null // placeholder (unused)
};

/* 友好的默认推导：未显式录入的院校按层次/标签给基线画像（不编造具体评级） */
function deriveDefault(school) {
  const lv = school.lv;
  const tags = school.tg || [];
  const is985 = tags.indexOf('985') >= 0;
  const is211 = tags.indexOf('211') >= 0;
  const isDouble = tags.indexOf('双一流') >= 0;

  // 学科评估：不编造具体等级，仅给「层次定性」
  const assess = null; // 未逐校核对，UI 用层次徽标代替

  // 优势标签：由层次/标签/地域推导（公开可验证）
  const strengths = [];
  if (is985) strengths.push('985');
  if (is211) strengths.push('211');
  if (isDouble && !is985 && !is211) strengths.push('双一流');
  if (school.city === '北京' || school.city === '上海' || school.city === '深圳' || school.city === '广州' || school.city === '杭州' || school.city === '南京') strengths.push(school.city + '地缘');
  if (lv <= 2) strengths.push('学科强');
  if (lv >= 4) strengths.push('过线友好');

  // 复试特点默认（经验参考）
  const retest = {
    machine: null, // 未知，不武断说有/无
    written: true,
    interviewWeight: '中',
    english: false,
    note: '以笔试+面试为主，部分方向含上机，具体形式与权重以院校研究生院当年复试细则为准（经验参考）。'
  };

  // 二本友好度默认（按层次经验参考）
  const friendly = lv <= 1 ? '低' : (lv === 2 ? '中' : (lv === 3 ? '中' : '高'));

  return {
    assess,
    intro: (school.n || '') + '属' + (is985 ? '985' : is211 ? '211' : isDouble ? '双一流' : '地方重点') + '高校，计算机类考 408，位于' + (school.city || school.province) + '。具体学科实力与复试形式以院校官方为准。',
    strengths,
    retest,
    friendly,
    friendlyNote: '按院校层次的经验参考：' + (friendly === '低' ? '顶尖校面试隐性看重本科，二本需极高分+项目。' : friendly === '中' ? '中上层次，二本高分可冲。' : '层次相对友好，二本较易上岸。'),
    platform: []
  };
}

/** 取某院校画像（显式优先，否则默认推导） */
function enrichOf(school) {
  const e = ENRICH[school.c];
  if (e) return Object.assign({ source: 'verified' }, e, { assessRound: ASSESS_ROUND, assessFields: ASSESS_FIELDS });
  return Object.assign({ source: 'derived' }, deriveDefault(school), { assessRound: null, assessFields: ASSESS_FIELDS });
}

/** 二本友好度排序权重（用于智能推荐） */
function friendlyWeight(friendly) {
  if (friendly === '高') return 1;
  if (friendly === '中') return 0;
  return -1;
}

module.exports = {
  ASSESS_FIELDS, ASSESS_ROUND,
  ENRICH, deriveDefault, enrichOf, friendlyWeight
};
