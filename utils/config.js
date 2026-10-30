/**
 * 全局配置（不含任何前端密钥）
 *
 * AI 有三级来源，按优先级自动选择，任一级失败都会降级到下一级：
 *   1) 云函数   AI_CLOUD_FUNCTION —— wx.cloud.callFunction，**不需要配置 request 合法域名**（生产推荐）
 *   2) 自建代理 AI_BACKEND_URL    —— 你自己的 Node 服务（server/index.js），需 HTTPS + 域名白名单
 *   3) 本地规则 （上面都为空）—— 完全离线，本机规则引擎作答
 *
 * 密钥（Ark API Key）只存在于服务端：云函数环境变量/代码，或 server/.env。前端永不持有。
 */
module.exports = {
  // 微信云开发云函数名（填了且已 wx.cloud.init 才会走云函数）
  AI_CLOUD_FUNCTION: 'ai',

  // 云开发环境 ID：填了才会执行 wx.cloud.init()。
  // ⚠️ 要填的是「环境 ID」而不是「环境名称」：
  //    名称形如 cloud1；ID 形如 cloud1-1a2b3c4d5e6f7g8h（名称 + 短横线 + 随机串）。
  //    只填名称会导致环境不存在，AI 会静默降级到本地规则。
  // 查看位置：云开发控制台左上角环境下拉 / 「概览」页，或开发者工具「云开发」面板顶部。
  // 留空则不初始化云开发（保持纯本地，功能正常，只是不联网）。
  CLOUD_ENV_ID: 'cloud1-d3g3qtumf67d59c42',

  // 上线请留空：留空后 AI 走「云函数 ai」或本地规则引擎，前端不发起任何网络请求，
  // 因此无需配置 request 合法域名。本地联调 server/index.js 时可临时填 http://localhost:3000
  AI_BACKEND_URL: '',

  // 语音转文字（ASR）云函数名：留空则不启用「云函数 ASR」这条路。
  // 语音输入默认走官方插件「微信同声传译 WechatSI」（需在 app.json plugins 里声明）；
  // 只有当你在云开发里自行部署了 ASR 云函数、且函数按 { fileID } 入参、返回 { text } 时，
  // 才把这里填成函数名。音频会先自动上传云存储，再把 fileID 传给该函数。
  ASR_CLOUD_FUNCTION: ''
};
