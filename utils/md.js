/**
 * 极简 Markdown → 结构化 blocks（零依赖）
 *
 * 为什么自建而不是用 rich-text：
 * rich-text 只认内联 style，无法复用 app.wxss 里的 CSS 变量与主题色，
 * 一旦换肤就得改一堆内联样式字符串；自建 blocks 由 WXML 按类型渲染，样式统一走 wxss。
 *
 * 支持：# 标题 / - 列表 / 1. 有序 / > 引用 / ``` 代码块 / --- 分隔线 / **加粗** / `行内代码`
 * 不支持：表格、图片、链接跳转（链接退化为纯文本 —— 小程序无法直接打开外链，
 *        保留成可点的假链接反而误导用户）
 *
 * 输出 block 类型：
 *   { k, t:'h',     lv:1|2|3, inl }
 *   { k, t:'p',               inl }
 *   { k, t:'li',    n:'1'|'', inl }   n 为空 = 无序
 *   { k, t:'quote',           inl }
 *   { k, t:'code',  text }
 *   { k, t:'hr' }
 * inl 为行内片段数组：{ k, b:true 加粗, c:true 行内代码, v:文本 }
 *
 * k 是预生成的唯一键，供 WXML 的 wx:key 使用（blocks 没有天然主键）。
 */

/** 行内解析：**加粗** / __加粗__ / `代码` / [文字](链接) */
function inline(text) {
  const src = String(text == null ? '' : text);
  const out = [];
  let last = 0;
  let seq = 0;
  const re = /\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\[([^\]]+)\]\([^)]*\)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ k: 'i' + (seq++), v: src.slice(last, m.index) });
    if (m[1] != null || m[2] != null) out.push({ k: 'i' + (seq++), b: true, v: m[1] != null ? m[1] : m[2] });
    else if (m[3] != null) out.push({ k: 'i' + (seq++), c: true, v: m[3] });
    else out.push({ k: 'i' + (seq++), v: m[4] });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ k: 'i' + (seq++), v: src.slice(last) });
  if (!out.length) out.push({ k: 'i0', v: '' });
  return out;
}

/** 主解析：文本 → blocks */
function parse(text) {
  const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  const out = [];
  let code = null;
  let seq = 0;
  const push = (b) => { b.k = 'b' + (seq++); out.push(b); };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, '');

    // 代码块围栏
    if (/^\s*```/.test(line)) {
      if (code) { push({ t: 'code', text: code.join('\n') }); code = null; }
      else code = [];
      continue;
    }
    if (code) { code.push(raw); continue; }

    const s = line.trim();
    if (!s) continue;                                    // 空行只作块间隔，不产出空块

    // 分隔线
    if (/^([-*_])\1{2,}$/.test(s)) { push({ t: 'hr' }); continue; }

    // 标题（剥离前导序号，"### 1. 基础阶段" → "基础阶段"）
    let m = s.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      const title = m[2].replace(/^\d{1,2}\s*[.、)）]\s*/, '').trim();
      push({ t: 'h', lv: Math.min(m[1].length, 3), inl: inline(title || m[2]) });
      continue;
    }

    // 引用
    m = s.match(/^>\s?(.*)$/);
    if (m) { push({ t: 'quote', inl: inline(m[1]) }); continue; }

    // 无序列表：符号后必须跟空白，避免把 "-3 分" 误判为列表
    m = s.match(/^[-*+•▪·]\s+(.*)$/);
    if (m) { push({ t: 'li', n: '', inl: inline(m[1]) }); continue; }

    // 有序列表：数字后不能紧跟数字，避免把 "1.5 小时" 误判为列表
    m = s.match(/^(\d{1,2})\s*[.、)）](?!\d)\s+(.*)$/);
    if (m) { push({ t: 'li', n: m[1], inl: inline(m[2]) }); continue; }

    // 普通段落：逐行成块，保留原有的换行语义（本地规则引擎的输出即多行文本）
    push({ t: 'p', inl: inline(s) });
  }
  if (code) push({ t: 'code', text: code.join('\n') });
  return out;
}

/** blocks → 纯文本（用于分享标题、会话预览等） */
function toText(blocks) {
  return (blocks || []).map((b) => {
    if (b.t === 'hr') return '';
    if (b.t === 'code') return b.text || '';
    return (b.inl || []).map((s) => s.v).join('');
  }).filter(Boolean).join('\n');
}

/** 直接由原始文本取纯文本（剥掉 Markdown 符号） */
function plain(text) {
  return toText(parse(text));
}

module.exports = { parse, toText, plain, inline };
