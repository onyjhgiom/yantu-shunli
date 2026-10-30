const themeStore = require('../../utils/theme');

Page({
  data: {
    themeCls: '',
    groups: [
      {
        name: '学习工具',
        items: [
          { icon: '◷', name: '番茄钟', url: '/pages/focus/focus', color: 'var(--forest)' },
          { icon: 'A', name: '背单词', url: '/pages/word/word', color: 'var(--c-english)' },
          { icon: '▦', name: '卡片复习', url: '/pages/card/card', color: 'var(--ok)' },
          { icon: '◫', name: '模考自测', url: '/pages/exam/exam', color: 'var(--danger)' },
          { icon: '✕', name: '错题本', url: '/pages/mistake/mistake', color: 'var(--danger)' }
        ]
      },
      {
        name: '备考资源',
        items: [
          { icon: '◈', name: '备考资源', url: '/pages/resource/resource', color: 'var(--forest-deep)' },
          { icon: '📰', name: '考研资讯', url: '/pages/news/news', color: 'var(--c-english)' },
          { icon: '✎', name: '刷题系统', url: '/pages/quiz/quiz', color: 'var(--forest-deep)' },
          { icon: '✍️', name: '笔记中心', url: '/pages/notes/notes', color: 'var(--forest)' }
        ]
      },
      {
        name: '规划与心态',
        items: [
          { icon: '◷', name: '考研日历', url: '/pages/timeline/timeline', color: 'var(--c-english)' },
          { icon: '✺', name: 'AI 规划', url: '/pages/plan-ai/plan-ai', color: 'var(--forest-deep)' },
          { icon: '♡', name: '心态记录', url: '/pages/mood/mood', color: 'var(--danger)' },
          { icon: '★', name: '打卡成就', url: '/pages/achievement/achievement', color: 'var(--warn)' }
        ]
      }
    ]
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
  onShow() { this._applyTheme(); },



  onTap(e) {
    const url = e.currentTarget.dataset.url;
    wx.navigateTo({ url });
  }
});
