/**
 * 研途顺利 · 云端 AI 代理（零依赖 Node 服务）
 * 作用：持有 Ark API Key（仅服务端，前端不接触），把小程序的 /ai/chat 转发给火山方舟。
 * 运行：把真实 key 写入同目录 .env（见 .env.example），然后 `node server/index.js`
 * 安全：.env 已在 .gitignore，请勿提交真实 key；生产请部署到 HTTPS 并配小程序 request 合法域名。
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// —— 读取 .env（若存在）到 process.env ——
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}
loadEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);
const ARK_KEY = process.env.ARK_API_KEY || '';
const ARK_MODEL = process.env.ARK_MODEL || 'doubao-pro-32k-241215';
const ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS));
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// 转发到火山方舟，返回模型文本
function callArk(messages) {
  return new Promise((resolve, reject) => {
    if (!ARK_KEY) return reject(new Error('ARK_API_KEY 未配置'));
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

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.url === '/health' && req.method === 'GET') return sendJSON(res, 200, { ok: true, model: ARK_MODEL, hasKey: !!ARK_KEY });

  if (req.url === '/ai/chat' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const messages = Array.isArray(body.messages) && body.messages.length ? body.messages : [{ role: 'user', content: (body.text || '').toString() }];
      const text = await callArk(messages);
      return sendJSON(res, 200, { text });
    } catch (e) {
      return sendJSON(res, 502, { error: String(e.message || e) });
    }
  }

  sendJSON(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`[研途顺利 AI 代理] 监听 http://localhost:${PORT}  model=${ARK_MODEL}  key=${ARK_KEY ? '已配置' : '未配置(请填 server/.env)'}`);
});
