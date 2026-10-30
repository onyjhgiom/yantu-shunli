const fs = require('fs');
const path = require('path');
const https = require('https');

const env = {};
fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
});
const KEY = env.ARK_API_KEY;

function chat(model) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model,
      messages: [{ role: 'user', content: '用一句话回答：408计算机统考包含哪四门课？' }],
      temperature: 0.7, stream: false
    });
    const req = https.request({
      hostname: 'ark.cn-beijing.volces.com',
      path: '/api/v3/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY, Accept: 'application/json' }
    }, (r) => {
      let b = ''; r.on('data', (d) => b += d);
      r.on('end', () => {
        try {
          const j = JSON.parse(b);
          const t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          resolve({ model, ok: !!t, text: t ? t.slice(0, 90) : JSON.stringify(j).slice(0, 160) });
        } catch (e) { resolve({ model, ok: false, text: b.slice(0, 160) }); }
      });
    });
    req.on('error', (e) => resolve({ model, ok: false, text: String(e) }));
    req.write(payload); req.end();
  });
}

const candidates = [
  'deepseek-v4-pro-260425',
  'deepseek-v4-flash-ga-260731',
  'glm-5-2-260617',
  'doubao-seed-2-0-pro-260215',
  'doubao-seed-character-251128'
];

(async () => {
  for (const m of candidates) {
    const r = await chat(m);
    console.log((r.ok ? 'OK  ' : 'FAIL') + ' | ' + r.model + ' | ' + r.text.replace(/\n/g, ' '));
  }
})();
