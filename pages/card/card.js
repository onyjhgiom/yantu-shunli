const share = require('../../utils/share');
const cardService = require('../../services/card');
const theme = require('../../utils/theme');
const store = require('../../utils/store');

const themeStore = require('../../utils/theme');
Page({
  onShareAppMessage: function () { return share.build(this, 'pages/card/card'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/card/card'); },

  data: {
    themeCls: '',
    decks: [],
    deckId: '',
    cards: [],
    subjects: theme.SUBJECTS.concat([{ key: 'other', name: '其他', short: '他', color: 'var(--sub)' }]),
    showDeckForm: false,
    newDeckName: '',
    newDeckSubject: 'other',
    newDeckSubjectName: '其他',
    showCardForm: false,
    editingId: '',
    newFront: '',
    newBack: '',
    newCloze: '',
    dueTotal: 0
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


  onLoad() { this._unsub = store.subscribe(store.TOPICS.CARD_CHANGED, () => this.load()); },
  onShow() { this._applyTheme(); this.load(); },
  onUnload() { this._unsub && this._unsub(); },

  load() {
    const decks = cardService.decks();
    let deckId = this.data.deckId;
    if (!deckId || !decks.find((d) => d.id === deckId)) deckId = decks.length ? decks[0].id : '';
    const cards = deckId ? cardService.cardsOf(deckId) : [];
    this.setData({
      decks,
      deckId,
      cards: cards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        cloze: c.cloze,
        subjectName: (theme.SUBJECT_MAP[c.subject] || {}).name || '其他',
        due: (c.srs && c.srs.dueDate) || ''
      })),
      dueTotal: cardService.dueQueue().length
    });
  },

  selectDeck(e) { this.setData({ deckId: e.currentTarget.dataset.id, showCardForm: false }, () => this.load()); },
  toggleDeckForm() { this.setData({ showDeckForm: !this.data.showDeckForm, newDeckName: '' }); },
  onDeckName(e) { this.setData({ newDeckName: e.detail.value }); },
  onDeckSubject(e) {
    const s = this.data.subjects[e.detail.value];
    this.setData({ newDeckSubject: s.key, newDeckSubjectName: s.name });
  },

  addDeck() {
    if (!this.data.newDeckName) { wx.showToast({ title: '输入牌组名', icon: 'none' }); return; }
    const d = cardService.addDeck({ name: this.data.newDeckName, subject: this.data.newDeckSubject });
    this.setData({ showDeckForm: false, deckId: d.id }, () => this.load());
  },

  removeDeck(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除牌组', content: '牌组及其中卡片将一并删除',
      success: (r) => { if (r.confirm) { cardService.removeDeck(id); this.load(); } }
    });
  },

  toggleCardForm() {
    if (this.data.showCardForm) { this.setData({ showCardForm: false, editingId: '' }); return; }
    this.setData({ showCardForm: true, editingId: '', newFront: '', newBack: '', newCloze: '' });
  },

  /** 点卡片行 = 进入编辑（原来整行点直接删，太容易误触） */
  editCard(e) {
    const id = e.currentTarget.dataset.id;
    const c = cardService.cards().find((x) => x.id === id);
    if (!c) return;
    this.setData({
      showCardForm: true, editingId: id,
      newFront: c.front || '', newBack: c.back || '', newCloze: c.cloze || ''
    });
  },

  cancelEdit() { this.setData({ showCardForm: false, editingId: '', newFront: '', newBack: '', newCloze: '' }); },
  onCardInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },

  addCard() {
    if (this._saving) return;                 // 防连点重复提交
    if (!this.data.newFront && !this.data.newBack) { wx.showToast({ title: '填写正反面', icon: 'none' }); return; }
    this._saving = true;
    const subject = (this.data.decks.find((d) => d.id === this.data.deckId) || {}).subject || 'other';
    if (this.data.editingId) {
      cardService.updateCard(this.data.editingId, { front: this.data.newFront, back: this.data.newBack, cloze: this.data.newCloze });
    } else {
      cardService.addCard({ deckId: this.data.deckId, subject, front: this.data.newFront, back: this.data.newBack, cloze: this.data.newCloze });
    }
    this._saving = false;
    this.setData({ showCardForm: false, editingId: '', newFront: '', newBack: '', newCloze: '' }, () => this.load());
  },

  removeCard(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除卡片', content: '删除后无法恢复，确定删除？',
      confirmColor: themeStore.palette().danger,
      success: (r) => {
        if (!r.confirm) return;
        cardService.removeCard(id);
        // 正在编辑这张卡时，顺手关掉表单
        if (this.data.editingId === id) this.setData({ showCardForm: false, editingId: '' });
        this.load();
      }
    });
  },

  goStats() { wx.navigateTo({ url: '/pages/card/statistics' }); },

  goReview() { wx.navigateTo({ url: '/pages/card/review?deckId=' + this.data.deckId }); }
});
