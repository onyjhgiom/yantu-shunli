const notify = require('../../services/notify');
const themeStore = require('../../utils/theme');

const util = require('../../utils/util');

Page({
  data: {
    themeCls: '',
    list: [],
    unread: 0
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


  onShow() { this._applyTheme();
    notify.seedToday();
    this.load();
  },

  load() {
    const list = notify.all();
    this.setData({
      list: list.map((n) => {
        const m = notify.TYPE_META[n.type] || notify.TYPE_META.system;
        return {
          id: n.id, type: n.type, title: n.title, content: n.content,
          link: n.link || '', date: n.date,
          icon: m.icon, color: m.color, name: m.name, read: !!n.read
        };
      }),
      unread: notify.unreadCount()
    });
  },

  onItem(e) {
    const id = e.currentTarget.dataset.id;
    const item = notify.all().find((n) => n.id === id);
    notify.markRead(id);
    this.load();
    if (item && item.link) wx.navigateTo({ url: item.link });
  },

  onDelete(e) {
    notify.remove(e.currentTarget.dataset.id);
    this.load();
  },

  markAll() {
    notify.markAll();
    this.load();
    wx.showToast({ title: '已全部已读', icon: 'none' });
  },

  clearAll() {
    wx.showModal({
      title: '清空通知', content: '确定清空全部通知？', confirmColor: themeStore.palette().danger,
      success: (r) => { if (r.confirm) { notify.clear(); this.load(); } }
    });
  }
});
