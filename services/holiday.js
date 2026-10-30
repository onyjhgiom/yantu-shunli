/**
 * 法定节假日与调休安排
 *
 * 数据来源（唯一依据，不臆造）：
 *   国务院办公厅《关于2026年部分节假日安排的通知》国办发明电〔2025〕7号，2025-11-04 发布。
 *   原文：元旦 1/1–1/3 放假调休（1/4 周日上班）；春节 2/15–2/23 放假调休共 9 天
 *   （2/14、2/28 周六上班）；清明 4/4–4/6 放假；劳动节 5/1–5/5 放假调休（5/9 周六上班）；
 *   端午 6/19–6/21 放假；中秋 9/25–9/27 放假；国庆 10/1–10/7 放假调休
 *   （9/20 周日、10/10 周六上班）。
 *
 * ⚠️ 只收录**官方已公布**的年份。2027 年安排通常于 2026 年 11 月上旬公布，届时在
 *    YEARS 里补一条即可；未公布的年份一律返回「未知」，页面据此提示"待官方公布"，
 *    绝不用往年规律推算——考研日历跨年，推算出的调休是错的。
 */
const util = require('../utils/util');

/* 每年：rest = 放假区间（闭区间）；work = 调休补班日 */
const YEARS = {
  2026: {
    rest: [
      ['2026-01-01', '2026-01-03', '元旦'],
      ['2026-02-15', '2026-02-23', '春节'],
      ['2026-04-04', '2026-04-06', '清明节'],
      ['2026-05-01', '2026-05-05', '劳动节'],
      ['2026-06-19', '2026-06-21', '端午节'],
      ['2026-09-25', '2026-09-27', '中秋节'],
      ['2026-10-01', '2026-10-07', '国庆节']
    ],
    work: [
      ['2026-01-04', '元旦调休'],
      ['2026-02-14', '春节调休'],
      ['2026-02-28', '春节调休'],
      ['2026-05-09', '劳动节调休'],
      ['2026-09-20', '国庆节调休'],
      ['2026-10-10', '国庆节调休']
    ]
  }
};

/* 展开成 date → { type, name } 查找表（模块加载时算一次） */
const MAP = Object.create(null);
Object.keys(YEARS).forEach((y) => {
  const cfg = YEARS[y];
  cfg.rest.forEach((r) => {
    eachDate(r[0], r[1], (d) => { MAP[d] = { type: 'holiday', name: r[2] }; });
  });
  cfg.work.forEach((r) => {
    // 调休补班是**单个**日期：[日期, 名称]
    MAP[r[0]] = { type: 'work', name: r[1] };
  });
});

/** 闭区间逐日回调（纯字符串日期运算，不依赖时区） */
function eachDate(from, to, fn) {
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 400) {
    fn(cur);
    cur = util.dateStr(util.addDays(cur, 1));
    guard += 1;
  }
}

/** 某一天的节假日信息；没有则返回 null。type: holiday 放假 / work 调休上班 */
function get(dateStr) {
  const hit = MAP[dateStr];
  return hit ? { type: hit.type, name: hit.name } : null;
}

/** 该年是否已收录官方安排 */
function hasYear(year) {
  return Object.prototype.hasOwnProperty.call(YEARS, year);
}

/** 已收录的年份列表（升序） */
function years() {
  return Object.keys(YEARS).map(Number).sort((a, b) => a - b);
}

/**
 * 某月整月的节假日映射，直接喂给 calendar.monthMatrix 的 opts.holidays。
 * @returns {Object} { 'YYYY-MM-DD': {type, name, short} }
 */
function monthMap(year, month) {
  const out = {};
  const prefix = year + '-' + (month < 10 ? '0' + month : month) + '-';
  Object.keys(MAP).forEach((d) => {
    if (d.indexOf(prefix) !== 0) return;
    out[d] = { type: MAP[d].type, name: MAP[d].name, short: MAP[d].type === 'holiday' ? '休' : '班' };
  });
  return out;
}

/** 人类可读的说明文案（用于日期详情卡） */
function describe(dateStr) {
  const h = get(dateStr);
  if (!h) return '';
  if (h.type === 'holiday') return h.name + '（法定假日放假）';
  return h.name + '（调休上班）';
}

module.exports = { YEARS, get, hasYear, years, monthMap, describe };
