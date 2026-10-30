const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const wordService = require('../../services/word');

const MODE_NAME = { recognize: '看词选义', recall: '看义选词', spelling: '拼写' };

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/word/study'); },

  data: {
    themeCls: '',
    mode: 'recognize',
    modeName: '',
    scope: 'new',
    bookId: 'all',
    idx: 0,
    total: 0,
    card: null,
    answered: false,
    picked: null,
    correct: null,
    inputVal: '',
    done: false,
    learned: 0,
    correctCount: 0,
    empty: false
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



  onLoad(options) {
    const bookId = options.bookId || 'all';
    const scope = options.scope || 'new';
    const mode = options.mode || wordService.settings().mode || 'recognize';
    this.setData({ mode, modeName: MODE_NAME[mode] || '', scope, bookId });
    this._buildQueue(bookId, scope, mode);
  },

  _buildQueue(bookId, scope, mode) {
    let queue = [];
    if (scope === 'extra') {
      queue = wordService.extraList();
    } else if (scope === 'new') {
      queue = wordService.todayPlan(bookId).news;
    } else if (scope === 'review') {
      queue = wordService.todayPlan(bookId).reviews;
    } else { // all：自由学习，随机抽 20
      queue = shuffle(wordService.allWords(bookId)).slice(0, 20);
    }
    this._queue = queue;
    if (!queue.length) { this.setData({ empty: true, total: 0, done: true }); return; }
    this.setData({ empty: false, total: queue.length, idx: 0, learned: 0, correctCount: 0, done: false });
    this._renderCard();
  },

  _renderCard() {
    const mode = this.data.mode;
    const word = this._queue[this.data.idx];
    if (!word) { this.setData({ done: true }); return; }
    const pool = wordService.allWords(this.data.bookId);
    let prompt = '';
    let options = [];
    if (mode === 'recognize') {
      prompt = word.w;
      const dts = wordService.distractors(word, pool, 3).map((d) => d.meaning);
      options = shuffle([{ text: word.meaning, correct: true }].concat(dts.map((t) => ({ text: t, correct: false }))));
    } else if (mode === 'recall') {
      prompt = word.meaning;
      const dts = wordService.distractors(word, pool, 3).map((d) => d.w);
      options = shuffle([{ text: word.w, correct: true }].concat(dts.map((t) => ({ text: t, correct: false }))));
    } else { // spelling
      prompt = word.meaning + (word.phonetic ? '  ' + word.phonetic : '');
    }
    this.setData({
      card: {
        id: word.id, w: word.w, meaning: word.meaning, phonetic: word.phonetic || '',
        example: word.example || '', roots: word.roots || '', deriv: word.deriv || '',
        prompt, options
      },
      answered: false, picked: null, correct: null, inputVal: ''
    });
  },

  onChoice(e) {
    if (this.data.answered) return;
    const picked = e.currentTarget.dataset.text;
    const correct = e.currentTarget.dataset.correct;
    this.setData({ answered: true, picked, correct: !!correct });
  },

  onInput(e) { this.setData({ inputVal: e.detail.value }); },

  onSubmitSpelling() {
    if (this.data.answered) return;
    const ok = (this.data.inputVal || '').trim().toLowerCase() === (this.data.card.w || '').toLowerCase();
    this.setData({ answered: true, correct: ok, picked: this.data.inputVal });
  },

  onNext() {
    if (!this.data.answered || !this.data.card) return;
    const q = this.data.correct ? 5 : 0;
    wordService.studySubmit(this.data.card.id, q);
    const learned = this.data.learned + 1;
    const correctCount = this.data.correctCount + (this.data.correct ? 1 : 0);
    const nextIdx = this.data.idx + 1;
    if (nextIdx >= this.data.total) {
      this.setData({ done: true, learned, correctCount });
      return;
    }
    this.setData({ idx: nextIdx, learned, correctCount }, () => this._renderCard());
  },

  onRestart() { this._buildQueue(this.data.bookId, this.data.scope, this.data.mode); },

  onBack() { wx.navigateBack(); }
});
