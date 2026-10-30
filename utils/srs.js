/**
 * 间隔复习引擎（简化 SM-2）+ 考前压缩
 * 错题本与背诵卡片共用。q 评分：0=忘了，3=模糊，5=记得
 * 与 PRD 第 11.1 节一致：距初试越近，最大间隔越小，保证考前至少再见面 2~3 次
 */
const util = require('./util');

function review(item, q, today, daysToExam) {
  const s = (item && item.srs) || {};
  let ef = s.ef != null ? s.ef : 2.5;
  let interval = s.interval || 0;
  let reps = s.reps || 0;
  let lapses = s.lapses || 0;

  if (q < 3) {
    reps = 0;
    interval = 0; // 忘了：当天再见面，不推迟到明天
    lapses += 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 3;
    else interval = Math.round(interval * ef);
    reps += 1;
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const dte = daysToExam == null ? 999 : daysToExam;
  const cap = Math.max(1, Math.floor(dte / 3));
  interval = Math.min(interval, cap);

  return { ef, interval, reps, lapses, dueDate: util.dateStr(util.addDays(today, interval)) };
}

/** 是否进入今日复习队列（已掌握的不出现） */
function isDue(item, today) {
  if (!item) return false;
  if (item.masteredAt) return false;
  const due = (item.srs && item.srs.dueDate) || item.createdAtDate || today;
  return due <= today;
}

module.exports = { review, isDue };
