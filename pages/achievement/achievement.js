const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const achievementService = require('../../services/achievement');
const store = require('../../utils/store');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/achievement/achievement'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/achievement/achievement'); },

  data: {
    themeCls: '',
    stat: { streak: 0, focusHours: 0, taskDone: 0, total: 0, earned: 0, next: null },
    groups: [],
    makeup: { cards: 0, leaveUsed: 0, leaveMax: 3 }
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


  onLoad() { this._unsub = store.subscribe(store.TOPICS.MISTAKE_CHANGED, () => this.load()); },
  onShow() { this._applyTheme(); this.load(); },
  onUnload() { this._unsub && this._unsub(); },

  load() {
    this.setData({
      stat: achievementService.overview(),
      groups: achievementService.groupBadges(),
      makeup: achievementService.makeupState()
    });
  },

  useMakeup() {
    if (achievementService.useMakeup()) { wx.showToast({ title: '已用 1 张补签卡', icon: 'success' }); this.load(); }
    else wx.showToast({ title: '补签卡不足', icon: 'none' });
  },

  useLeave() {
    if (achievementService.useLeave()) { wx.showToast({ title: '已请假 1 天', icon: 'success' }); this.load(); }
    else wx.showToast({ title: '本月请假已用完', icon: 'none' });
  }
});
