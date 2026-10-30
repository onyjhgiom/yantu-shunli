const util = require('../../utils/util');

Component({
  properties: {
    subject: { type: Object, value: {} }
  },
  data: { timeText: '' },
  observers: {
    'subject.totalMinutes'(m) {
      this.setData({ timeText: util.fmtMinutes(m || 0) });
    }
  },
  methods: {
    onTap() { this.triggerEvent('select', { key: this.data.subject.key }); }
  }
});
