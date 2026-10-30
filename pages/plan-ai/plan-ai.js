const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const aiService = require('../../services/ai');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/plan-ai/plan-ai'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/plan-ai/plan-ai'); },

  data: {
    themeCls: '',
    enabled: true,
    reason: '',
    plan: null,
    insight: [],
    insightLoading: false,
    insightFrom: ''
  },
  /* 主题：同步皮肤 class + 导航栏 / tabBar + 需要真实色值的组件属性。
   * 注意：switch 等原生组件的 color 是「属性值」而非样式，吃不了 var()，必须传真值。 */
  _applyTheme() {
    const p = themeStore.palette();
    this.setData({
      themeCls: themeStore.activeClass(),
      themeKey: themeStore.active().key,
      swColor: p.forest,
      barColor: p.forest
    });
    themeStore.applyChrome();
  },


  onShow() { this._applyTheme(); this.load(); },

  load() {
    const p = aiService.plan();
    this.setData({
      enabled: !!p.enabled,
      reason: p.reason || '',
      plan: p.enabled ? p : null
    });
    if (!p.enabled) this.setData({ insight: [], insightLoading: false, insightFrom: '' });
    else this._loadInsight();
  },

  /**
   * 云端策略：本地骨架是同步算出来的，先渲染；这里异步补上模型给出的文字策略。
   * 每个页面实例只取一次（force 除外），避免每次 onShow 都产生一次云函数调用。
   */
  _loadInsight(force) {
    if (!force && this._insightFetched) return;
    this._insightFetched = true;
    this.setData({ insightLoading: true, insight: [], insightFrom: '' });
    aiService.planInsight()
      .then((r) => {
        this.setData({
          insightLoading: false,
          insight: (r && r.items) || [],
          insightFrom: r ? 'cloud' : ''
        });
      })
      .catch(() => this.setData({ insightLoading: false }));
  },

  regen() {
    if (this._regenLock) return;        // 防连点重复请求
    this._regenLock = true;
    setTimeout(() => { this._regenLock = false; }, 800);
    this._insightFetched = false;
    this.load();
    wx.showToast({ title: '已重新生成', icon: 'none' });
  },
  goProfile() { wx.switchTab({ url: '/pages/profile/profile' }); },
  goExam() { wx.navigateTo({ url: '/pages/exam/exam' }); },
  goSchool() { wx.navigateTo({ url: '/pages/school/school' }); }
});
