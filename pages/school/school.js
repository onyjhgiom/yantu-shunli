const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const schoolService = require('../../services/school');
const freshService = require('../../services/school-fresh');

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/school/school'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/school/school'); },

  data: {
    themeCls: '',
    keyword: '',
    province: '',
    provinces: schoolService.PROVINCES,
    tag: '',
    tags: schoolService.TAGS,
    degreeType: '',
    degreeTypes: ['专硕', '学硕'],
    examCode: '',
    examCodes: schoolService.EXAM_CODES.map((c) => ({ code: c, label: schoolService.EXAM_CODE_LABELS[c].replace(/^[^（]+（/, '').replace('）', '') })),
    results: [],
    targets: [],
    // 信息时效
    season: freshService.DATA_SEASON,
    syncAt: freshService.SYNC_AT,
    version: freshService.VERSION,
    hasLive: false,
    newCount: 0,
    refreshing: false,
    fetchedAt: '',
    changeTotal: 0,
    stats: {},
    phase: null
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
    this.load();
    // 进入院校库时静默拉取最新时效数据；有更新则刷新当前页（不打断用户）
    schoolService.checkFreshSilent(() => { this.load(); });
  },

  load() {
    const r = schoolService.search({
      keyword: this.data.keyword,
      province: this.data.province,
      tag: this.data.tag,
      degreeType: this.data.degreeType,
      examCode: this.data.examCode
    });
    const fs = schoolService.syncState();
    this.setData({
      results: r.map((s) => ({
        code: s.code, name: s.name, province: s.province, city: s.city,
        tags: s.tags, type: s.type, levelName: s.levelName,
        assessCs: (s.assess && s.assess.cs) || '', assessRound: s.assessRound,
        friendly: s.friendly, friendlyClass: ({ '高': 'high', '中': 'mid', '低': 'low' })[s.friendly] || 'mid', programCount: (s.programs || []).length,
        examCodes: Array.from(new Set((s.programs || []).map((p) => p.examCode)))
      })),
      targets: schoolService.userTargets().map((t) => ({ id: t.id, schoolName: t.schoolName, majorName: t.majorName, tier: t.tier })),
      season: freshService.DATA_SEASON,
      syncAt: freshService.SYNC_AT,
      version: fs.version,
      hasLive: fs.hasLive,
      newCount: fs.newCount,
      fetchedAt: fs.fetchedAt,
      changeTotal: schoolService.changeList().length,
      stats: schoolService.stats(),
      phase: freshService.currentPhase()
    });
  },

  /** 手动刷新：拉取云端最新时效数据 */
  onRefresh() {
    if (this.data.refreshing) return;
    this.setData({ refreshing: true });
    schoolService.refreshFresh(true).then((res) => {
      this.setData({ refreshing: false });
      if (res.ok && res.newer) {
        this.load();
        wx.showToast({ title: '已更新到 ' + (res.version || ''), icon: 'success' });
      } else if (res.ok) {
        wx.showToast({ title: '已是最新', icon: 'none' });
      } else {
        wx.showToast({ title: '暂用本地数据', icon: 'none' });
      }
    });
  },

  onKeyword(e) { this.setData({ keyword: e.detail.value }); },
  doSearch() { this.load(); },
  clearKeyword() { this.setData({ keyword: '' }, () => this.load()); },
  onProvince(e) { this.setData({ province: this.data.province === e.currentTarget.dataset.v ? '' : e.currentTarget.dataset.v }, () => this.load()); },
  onTag(e) { this.setData({ tag: this.data.tag === e.currentTarget.dataset.v ? '' : e.currentTarget.dataset.v }, () => this.load()); },
  onDegree(e) { this.setData({ degreeType: this.data.degreeType === e.currentTarget.dataset.v ? '' : e.currentTarget.dataset.v }, () => this.load()); },
  onExamCode(e) { this.setData({ examCode: this.data.examCode === e.currentTarget.dataset.v ? '' : e.currentTarget.dataset.v }, () => this.load()); },

  goDetail(e) { wx.navigateTo({ url: '/pages/school/detail?code=' + e.currentTarget.dataset.code }); },
  goTargets() { wx.navigateTo({ url: '/pages/school/compare' }); },
  goChanges() {
    schoolService.markFreshSeen();
    wx.navigateTo({ url: '/pages/school/changes' });
  },

  copyChsi() {
    wx.setClipboardData({
      data: freshService.CHSI.host,
      success: () => wx.showModal({
        title: '已复制研招网地址',
        content: freshService.CHSI.host + '\n\n考研信息以研招网与目标院校研究生院公告为准，建议每周核一次。',
        showCancel: false
      })
    });
  },

  showCalendar() {
    wx.showModal({
      title: this.data.season + ' 招生季关键节点',
      content: freshService.calendar().map((c) => c.title + '：' + c.desc).join('\n\n'),
      showCancel: false
    });
  }
});
