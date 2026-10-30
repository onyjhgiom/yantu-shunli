Component({
  properties: {
    percent: { type: Number, value: 0 },
    height: { type: Number, value: 14 },
    color: { type: String, value: 'var(--forest)' },
    track: { type: String, value: 'var(--line)' }
  },
  data: { safePercent: 0 },
  observers: {
    percent(v) {
      const n = Math.max(0, Math.min(100, Math.round(v || 0)));
      this.setData({ safePercent: n });
    }
  },
  lifetimes: {
    attached() {
      const n = Math.max(0, Math.min(100, Math.round(this.data.percent || 0)));
      this.setData({ safePercent: n });
    }
  }
});
