const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const schoolService = require('../../services/school');
const freshService = require('../../services/school-fresh');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/school/changes'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/school/changes'); },

  data: {
    themeCls: '',
    kind: '',
    kinds: [
      { key: '', name: '全部' },
      { key: 'to408', name: '改考 408' },
      { key: 'back', name: '回退自命题' },
      { key: 'new', name: '专业调整' }
    ],
    season: freshService.DATA_SEASON,
    syncAtText: freshService.SYNC_AT,
    version: freshService.VERSION,
    hasLive: false,
    summary: freshService.SYNC_NOTE.summary,
    policy: freshService.SYNC_NOTE.policy,
    caution: freshService.SYNC_NOTE.caution,
    chsi: freshService.CHSI,
    phase: null,
    calendar: [],
    list: [],
    total: 0
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
  onShow() {
    this._applyTheme();
    // 进入改考动态即视为「已读」：清除院校库首页的新动态红点
    schoolService.markFreshSeen();
    // 静默拉取最新动态；有更新则刷新本页
    schoolService.checkFreshSilent(() => this.reloadHeader());
  },



  onLoad() {
    this.setData({
      phase: freshService.currentPhase(),
      calendar: freshService.calendar()
    });
    this.reloadHeader();
  },

  reloadHeader() {
    const fs = schoolService.syncState();
    this.setData({
      season: freshService.DATA_SEASON,
      syncAtText: freshService.SYNC_AT,
      version: fs.version,
      hasLive: fs.hasLive
    });
    this.load();
  },

  load() {
    const list = schoolService.changeList({ kind: this.data.kind }).map((c) => ({
      id: c.id,
      school: c.school,
      code: schoolService.codeOfSchoolName(c.school),
      college: c.college,
      major: c.major,
      majorCode: c.code,
      deg: c.degreeType || (/^(081200|083500|083900|140500)$/.test(c.code) ? '学硕' : '专硕'),
      kind: c.kind,
      kindName: c.kindName,
      from: c.from,
      to: c.to,
      season: c.season,
      date: c.date,
      source: c.source,
      url: c.url,
      note: c.note || ''
    }));
    this.setData({ list, total: list.length });
  },

  onKind(e) { this.setData({ kind: e.currentTarget.dataset.k }, () => this.load()); },

  openDetail(e) {
    const { code, school } = e.currentTarget.dataset;
    if (code) wx.navigateTo({ url: '/pages/school/detail?code=' + code });
    else wx.showToast({ title: '该校暂未收录，请到' + school + '研究生院查看', icon: 'none' });
  },

  /** 复制公告原文链接，到浏览器核实 */
  copyUrl(e) {
    const url = e.currentTarget.dataset.url || '';
    if (!url) { wx.showToast({ title: '该公告暂无直链，请查院校研招网', icon: 'none' }); return; }
    wx.setClipboardData({
      data: url,
      success: () => wx.showModal({
        title: '已复制公告链接',
        content: url + '\n\n微信小程序无法直接跳转外链，请粘贴到浏览器打开核实。',
        showCancel: false
      })
    });
  },

  copyChsi() {
    wx.setClipboardData({
      data: this.data.chsi.host,
      success: () => wx.showModal({
        title: '已复制研招网地址',
        content: this.data.chsi.host + '\n\n建议每周看一次目标院校研招网，改考与停招信息都从这里先发出。',
        showCancel: false
      })
    });
  },

  openCalendar() {
    wx.showModal({
      title: this.data.season + ' 招生季关键节点',
      content: this.data.calendar.map((c) => c.title + '：' + c.desc).join('\n\n'),
      showCancel: false
    });
  }
});
