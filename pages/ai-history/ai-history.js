const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const chat = require('../../services/chat');
const planStore = require('../../services/planStore');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/ai-history/ai-history'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/ai-history/ai-history'); },

  data: {
    themeCls: '',
    tab: 'chat',
    chatList: [],
    planList: [],
    planOpen: {}
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
    this.setData({
      chatList: chat.overview(),
      planList: planStore.overview()
    });
  },

  switchTab(e) {
    const t = e.currentTarget.dataset.t;
    if (t === this.data.tab) return;
    this.setData({ tab: t });
  },

  /** 打开某条历史对话 → 进入 AI 页并定位到该会话 */
  openChat(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/ai/ai?session=' + id });
  },

  delChat(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除对话',
      content: '确定删除这条对话记录吗？删除后不可恢复。',
      success: (r) => { if (r.confirm) { chat.remove(id); this.load(); } }
    });
  },

  togglePlan(e) {
    const id = e.currentTarget.dataset.id;
    const key = 'planOpen.' + id;
    this.setData({ [key]: !this.data.planOpen[id] });
  },

  delPlan(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除规划',
      content: '确定删除这条规划快照吗？删除后不可恢复。',
      success: (r) => { if (r.confirm) { planStore.remove(id); this.load(); } }
    });
  },

  goAi() { wx.navigateTo({ url: '/pages/ai/ai' }); }
});
