/**
 * 通用工具：日期、格式化、id
 */

function pad(n) { return n < 10 ? '0' + n : '' + n; }

/** 取 YYYY-MM-DD */
function dateStr(d) {
  const x = d ? new Date(d) : new Date();
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** 解析 YYYY-MM-DD 为本地 0 点 Date */
function parseDate(s) {
  if (!s) return new Date();
  if (s instanceof Date) return s;
  const p = String(s).split('-').map(Number);
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
}

function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return d;
}

/** b - a 的天数（以自然日计） */
function daysBetween(a, b) {
  const da = parseDate(a); da.setHours(0, 0, 0, 0);
  const db = parseDate(b); db.setHours(0, 0, 0, 0);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/** 分钟 -> 1h20m / 45m */
function fmtMinutes(m) {
  m = Math.max(0, Math.round(m || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return mm + 'm';
  return mm > 0 ? `${h}h${pad(mm)}m` : `${h}h`;
}

/** 分钟 -> 2.5 小时（保留一位小数） */
function fmtHours(m) {
  return (Math.round((m || 0) / 6) / 10).toFixed(1);
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
function weekdayCN(d) { return WEEK[parseDate(d).getDay()]; }

/** 本周一 0 点 */
function startOfWeek(d) {
  const x = parseDate(d);
  const day = x.getDay() === 0 ? 7 : x.getDay();
  x.setDate(x.getDate() - (day - 1));
  return x;
}

function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** 考研初试一般在每年 12 月倒数第二个周末，这里给出默认估算日 */
function defaultExamDate(year) {
  // 12 月的第 3 个周六（近似）
  const d = new Date(year, 11, 1);
  let saturday = 0;
  for (let i = 1; i <= 31; i++) {
    const t = new Date(year, 11, i);
    if (t.getDay() === 6) { saturday++; if (saturday === 3) { d.setDate(i); break; } }
  }
  return dateStr(d);
}

/**
 * 下一个即将到来的 12 月考研初试所在的「日历年份」。
 *
 * 考研初试固定在每年 12 月；考生却习惯用「届」称呼（27考研 = 2026年12月那场）。
 * 这里用来决定「我的目标」里年份选择器的默认项：
 *   - 今天还没过今年 12 月考试 → 默认选今年（如 2026）
 *   - 今天已过今年 12 月考试 → 默认选明年（如 2027）
 * 避免默认指向下一年、把倒计时凭空多算约一整年。
 */
function nextExamYear() {
  const y = new Date().getFullYear();
  const thisDec = defaultExamDate(y);
  return daysBetween(dateStr(), thisDec) >= 0 ? y : y + 1;
}

/** 相对日期文案 */
function relativeDay(s) {
  const diff = daysBetween(dateStr(), s);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === 2) return '后天';
  if (diff === -1) return '昨天';
  return `${parseDate(s).getMonth() + 1}月${parseDate(s).getDate()}日`;
}

/** 日期段文案（不含时分），fmtDateTime / dayLabel 共用 */
function dayPart(d, day, today) {
  if (day === today) return '今天';
  if (day === dateStr(addDays(today, -1))) return '昨天';
  if (d.getFullYear() === parseDate(today).getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 时间戳 -> 今天 14:05 / 昨天 09:30 / 9月20日 21:12 */
function fmtDateTime(ts) {
  const d = ts instanceof Date ? ts : new Date(ts || Date.now());
  const day = dateStr(d);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${dayPart(d, day, dateStr())} ${hm}`;
}

/** 聊天记录里的日期分隔：今天 / 昨天 / 9月20日 */
function dayLabel(ts) {
  const d = ts instanceof Date ? ts : new Date(ts || Date.now());
  return dayPart(d, dateStr(d), dateStr());
}

module.exports = {
  pad, dateStr, parseDate, addDays, daysBetween,
  fmtMinutes, fmtHours, weekdayCN, startOfWeek,
  uid, clamp, defaultExamDate, nextExamYear, relativeDay, fmtDateTime, dayLabel
};
