<div align="center">

# 研途顺利 · 计算机考研助手

**面向 11408 / 22408 的离线优先微信小程序** —— 择校、备考规划、题库练习、AI 复盘，一站式解决。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![微信小程序](https://img.shields.io/badge/微信小程序-Native-07C160?logo=wechat&logoColor=white)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![纯 JavaScript](https://img.shields.io/badge/语言-JavaScript%20(CommonJS)-F7DF1E?logo=javascript&logoColor=white)]()
[![无外部依赖](https://img.shields.io/badge/依赖-零-4CAF50)]()
[![后端可选](https://img.shields.io/badge/后端-可选-2196F3)]()

</div>

---

## 这是什么

一个**为计算机考研人做的备考助手小程序**。内容只覆盖两条主流路径，不做无关专业课：

| 路径 | 政治 | 英语 | 数学 | 专业课 | 常见学位 |
|---|---|---|---|---|---|
| **11408** | 政治 | 英语一 | 数学一 | 408 计算机学科专业基础 | 学术型硕士为主 |
| **22408** | 政治 | 英语二 | 数学二 | 408 计算机学科专业基础 | 专业型硕士为主 |

> 408 含：数据结构、计算机组成原理、操作系统、计算机网络（四门合卷，150 分）。

切换报考方向后，资源库、院校库、分析引擎会**自动过滤适配** —— 选 22408 不会看到数一的概率论与级数，选 11408 不会看到英二图表作文。

**核心特点：完全离线可用。** 不登录、不联网、零外部依赖（无 CDN、无外链字体、无图片资源），导入微信开发者工具就能跑 —— 地铁、图书馆、自习室没信号也能用。

---

## 功能一览

<table>
<tr><td width="50%" valign="top">

**📚 院校库 · 智能择校**
- **240 所招生单位 / 1043 个专业条目**，学硕（计算机科学与技术 0812、软件工程 0835）与专硕（电子信息 0854、计算机技术 085404）齐全
- 按层次（顶尖 / 强势 / 重点 / 双非强校 / 过线型）、省份、考试科目组合筛选
- 智能择校：输入分数给出**「冲 / 稳 / 保」三档推荐 + 录取概率估算**
- 详情页支持**录入真实复试线覆盖**参考值，并附官方招生网链接便于核实
- 覆盖 31 个省市

**📖 备考资源库（40 篇离线长文）**
- 408 四门速查、算法大题套路、计算题公式清单
- 英语一图画 / 英语二图表作文模板、政治答题模板
- 复试机试准备、408 调剂优势、复习策略方法
- 中文分词**全文检索**（标题命中权重 > 正文），支持收藏、一键存为笔记
- 每篇资源标注适用路径（11408 / 22408）

</td><td width="50%" valign="top">

**🧠 智能分析引擎（基于你的真实学习数据）**
- 学习节律：识别你的**黄金学习时段**
- 效率趋势：周环比对比
- 科目投入失衡：对照目标权重（408 35% / 数学 30% / 英语 20% / 政治 15%）
- 9 类风险预警、今日智能推荐、智能周报
- 样本不足时**明确不下结论**，不误导

**🤖 AI 考研助手**
- **三级降级架构**：云函数 → 自建代理 `server/` → 本地规则引擎，断网也能答
- 覆盖择校、调剂、复试机试、效率分析、资源检索、薄弱点突破等意图
- 内置中文分词检索，问「Cache 地址怎么划分」「数一和数二有什么区别」能精准召回
- **规划数值骨架本地计算**，模型只产出文字策略，数字可复现、不会被污染

**✅ 备考工具链**
- 学习计划 & 番茄钟（自动写入学习记录）、任务清单、错题本、卡片记忆、模考与成绩分析
- 报考背景管理、资讯、单词、题库自测、成就激励、考研时间轴等，**共 32 个页面**

</td></tr>
</table>

---

## 界面预览

> 建议把截图放进仓库 `docs/` 目录，并同步修改下面的路径。

<div align="center">
  <img src="docs/screenshot-home.png" width="200" alt="首页">
  <img src="docs/screenshot-school.png" width="200" alt="院校库择校推荐">
  <img src="docs/screenshot-resource.png" width="200" alt="资源中心检索">
  <img src="docs/screenshot-insight.png" width="200" alt="智能分析周报">
</div>

<div align="center">
  <img src="docs/screenshot-plan.png" width="200" alt="复习计划">
  <img src="docs/screenshot-focus.png" width="200" alt="番茄钟">
  <img src="docs/screenshot-quiz.png" width="200" alt="题库自测">
  <img src="docs/screenshot-ai.png" width="200" alt="AI 助手">
</div>

---

## 快速开始

### 方式一：本地运行（推荐先跑起来看）

1. 下载 / clone 本仓库
   ```bash
   git clone https://github.com/onyjhgiom/yantu-shunli.git
   ```
2. 打开**微信开发者工具** → 导入项目 → 选择本目录
3. 在 `project.config.json` 中填入你自己的 **AppID**
   > ⚠️ 请为它**单独申请 AppID + 独立云环境**。若与其它小程序共用同一 AppID，上传体验版会互相覆盖、云数据混用。
4. 点「编译」即可运行 —— 无需安装依赖、无需构建

### 方式二：启用云端 AI（可选）

默认走本地规则引擎，基础功能完整可用。想要更强的云端模型：

1. 在 `project.config.json` 中确认 `cloudfunctionRoot` 指向 `cloudfunctions/`
2. 微信开发者工具 → 云开发 → 新建环境 → 复制**环境 ID**
3. 在 `utils/config.js` 填入：
   ```js
   CLOUD_ENV_ID: '你的环境ID',   // 注意填 ID，不是环境名称
   AI_CLOUD_FUNCTION: 'ai'
   ```
4. 右键 `cloudfunctions/ai`、`cloudfunctions/school-sync` → **上传并部署：云端安装依赖**

> 💡 任何模型 Key 都只放服务端，**前端不持有任何密钥**。
> 如需自建代理，运行 `server/` 并配置 `ARK_API_KEY`（存于 `server/.env`，**请勿提交**）。

---

## 技术架构

- **原生微信小程序**，纯 JavaScript（CommonJS），零外部依赖、无 CDN、无外链字体/图片，导入即跑，**无需编译配置**
- **离线优先**：`services/db.js`（`wx.storage` 封装）为唯一真相源，无后端也能完整使用；接入后端只需替换 `services/` 内部实现，**页面零改动**（接口按 `{code, message, data}` 预留）
- **数据层**：`utils/store.js` 极简事件总线做跨页刷新
- **图表**：原生 Canvas 2D 自绘（已做 dpr 适配），不引入任何图表库
- **样式**：Editorial 风格，暖灰纸张底 `#F4F1E9` + 深森林绿 `#2E4F3E` + 陶土橙 `#C2703D`，配色统一走 `app.wxss` 的 CSS 变量
- **云开发（可选）**：`cloudfunctions/ai`（AI 云端化）、`cloudfunctions/school-sync`（院校数据同步）
- **自检**：`node --check` 全 JS 通过 + JSON 合法性校验 + 42 项数据链路冒烟测试

### 目录结构

```
yantu-shunli/
├── app.js / app.json / app.wxss       # 全局配置与样式（CSS 变量统一配色）
├── project.config.json                # 开发者工具项目配置
├── pages/                             # 32 个页面
│   ├── index/         school/         resource/
│   ├── ai/            plan-ai/        quiz/
│   ├── focus/         study/          plan/
│   └── ...
├── components/                        # 6 个复用组件
├── services/                          # 33 个业务模块（院校库/资源库/分析引擎/AI…）
├── utils/                             # 配置、工具、事件总线、分享中枢
├── cloudfunctions/                    # ai / school-sync（可选）
├── server/                            # 自建 AI 代理（可选，含 .env.example）
├── scripts/                           # 冒烟测试与构建脚本
├── tests/
└── docs/                              # README 截图
```

---

## 数据说明与免责声明

⚠️ **请务必阅读**

- 院校招生人数、复试分数线为**按院校层次估算的参考区间**，并非官方数据，年际波动可达 ±20 分，仅作择校初步参考；
- 每个专业均附**官方研究生招生网站**链接，填报前请务必以官方公布为准；
- 院校详情页提供「数据核实」入口，可录入查到的真实分数线**覆盖**参考值，录入后以你的数据为准；
- 资源库为离线备考速查，**不能替代官方教材与真题**；
- 项目内置的示例报考背景为**虚构人设**，不含任何真实个人信息。

## 隐私与合规

- 默认本地优先，学习数据存于本机；启用云能力后按微信云开发隐私规范处理；
- 本项目不收集与上传任何个人隐私信息；
- 前端不存储任何模型密钥。

---

## 参与贡献

欢迎任何形式的贡献：

- 🐛 **提 Issue** 报 Bug / 提需求（可用标签：`bug` / `enhancement` / `good first issue`）
- 💡 **提 PR** 改进功能或文档
- ⭐ **点个 Star** 让更多人看到 —— 对小程序项目来说，star 真的很重要
- 📖 **补充资源** 提交优质备考资料（走 `services/resources.js`，注意标注 `applies: ['11408'] / ['22408']`）

### 推荐 Topics（设置后更容易被搜到）

仓库页 → 右侧 **About** → ⚙️ → 添加：
`wechat-miniprogram` `考研` `408` `computer-science` `study-planner` `mini-program` `offline-first`

---

## 致谢

感谢每一位在考研路上坚持的研友。这个项目诞生于「想找个能离线用的备考工具」的朴素想法，愿它能帮你少一点焦虑、多一点专注。

**祝你上岸。** 🎓

---

## 相关链接

- 📦 同步镜像仓库（Gitee）：[https://gitee.com/clt2026/yantu-shunli](https://gitee.com/clt2026/yantu-shunli)
- 🐛 问题反馈：[GitHub Issues](https://github.com/onyjhgiom/yantu-shunli/issues)

## 开源协议

本项目基于 [MIT License](LICENSE) 开源 —— 欢迎自由使用、修改与再分发，保留署名即可。

仅供学习交流使用。院校招生信息以各招生单位官方发布为准，如有侵权或数据偏差请及时联系修正。

© 2026 onyjhgiom · 研途顺利
