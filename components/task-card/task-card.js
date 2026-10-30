const { SUBJECT_MAP, PRIORITY } = require('../../utils/theme');
const util = require('../../utils/util');

Component({
  properties: {
    task: { type: Object, value: {} },
    showPriority: { type: Boolean, value: true }
  },
  data: { view: {} },
  observers: {
    task(t) {
      if (!t || !t.id) { this.setData({ view: {} }); return; }
      const sub = SUBJECT_MAP[t.subject] || SUBJECT_MAP.other;
      const pri = PRIORITY[t.priority] || PRIORITY.mid;
      this.setData({
        view: {
          done: t.status === 'done',
          /* 未完成 = 未做且未取消（canceled 视为作废，不再当作待办红标） */
          undone: t.status !== 'done' && t.status !== 'canceled',
          subjectName: sub.name,
          subjectColor: sub.color,
          subjectBg: sub.bg,
          priorityLabel: pri.label,
          priorityColor: pri.color,
          priorityBg: pri.bg,
          estText: t.estimatedMinutes ? util.fmtMinutes(t.estimatedMinutes) : '',
          actualText: t.actualMinutes ? util.fmtMinutes(t.actualMinutes) : '',
          overdue: !!t.overdue,
          childCount: t.childCount || 0
        }
      });
    }
  },
  methods: {
    onTap() { this.triggerEvent('tap', { task: this.data.task }); },
    onToggle() { this.triggerEvent('toggle', { task: this.data.task }); }
  }
});
