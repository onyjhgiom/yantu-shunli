/**
 * 研途顺利 · AI 云函数（微信云开发）
 * 上传方式：微信开发者工具 → 右键 cloudfunctions/ai →「上传并部署：云端安装依赖」
 * 调用方式：wx.cloud.callFunction({ name: 'ai', data: { messages: [...] } })
 * 优势：callFunction 不需要配置 request 合法域名；密钥只存在于云端，前端永远拿不到。
 *
 * 密钥配置（唯一方式，源码中不得硬编码）：
 *   云开发控制台 → 云函数 ai → 配置 → 环境变量：ARK_API_KEY（必填）/ ARK_MODEL（可选）
 *   ⚠️ 改完环境变量后，若仍报「ARK_API_KEY 未配置」，右键本目录重新「上传并部署」一次。
 *   ⚠️ 默认超时 20 秒，接大模型容易不够，请在控制台把超时改为 60 秒。
 */
const https = require('https');

// 密钥只允许从环境变量读取，切勿写死在源码中（避免仓库泄露）
const ARK_KEY = process.env.ARK_API_KEY || '';
const ARK_MODEL = process.env.ARK_MODEL || 'deepseek-v4-pro-260425';
const ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

function callArk(messages) {
  return new Promise((resolve, reject) => {
    if (!ARK_KEY) return reject(new Error('ARK_API_KEY 未配置：请在云开发控制台 → 云函数 ai → 配置 → 环境变量 中设置 ARK_API_KEY'));
    const payload = JSON.stringify({ model: ARK_MODEL, messages, temperature: 0.7, stream: false });
    const u = new URL(ARK_URL);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ARK_KEY,
        'Accept': 'application/json'
      }
    }, (r) => {
      let buf = '';
      r.on('data', (d) => { buf += d; });
      r.on('end', () => {
        try {
          const j = JSON.parse(buf);
          const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          if (text) resolve(text);
          else reject(new Error('ark empty: ' + buf.slice(0, 200)));
        } catch (e) { reject(new Error('ark parse: ' + buf.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.main = async (event) => {
  try {
    const messages = Array.isArray(event.messages) && event.messages.length
      ? event.messages
      : [{ role: 'user', content: String(event.text || '') }];
    const text = await callArk(messages);
    return { text, model: ARK_MODEL };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
};
