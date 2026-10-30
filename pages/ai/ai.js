const share = require('../../utils/share');
const themeStore = require('../../utils/theme');

const aiService = require('../../services/ai');
const chat = require('../../services/chat');
const md = require('../../utils/md');
const util = require('../../utils/util');
const upload = require('../../utils/upload');
const voice = require('../../utils/voice');

const GREETING = '我是你的考研助手。\n可以问我：数学怎么提分？这周计划怎么排？我哪科最薄弱？今天该先做什么？';

/** 原始消息 → 视图消息（附加 blocks 以便 Markdown 渲染） */
function toMsg(raw) {
  return {
    id: raw.id,
    role: raw.role,
    text: raw.text,
    at: raw.at,
    attach: raw.attach || [],
    blocks: md.parse(raw.text)
  };
}

function greetingMsg() {
  return { id: util.uid('m'), role: 'ai', text: GREETING, at: Date.now(), blocks: md.parse(GREETING) };
}

Page({
  onShareAppMessage: function () { return share.build(this, 'pages/ai/ai'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/ai/ai'); },

  data: {
    themeCls: '',
    enabled: true,
    cloudMode: false,
    modeText: '本地规则',
    modeHint: '',
    modeWarn: false,
    advice: { summary: '', priorities: [], tips: [] },
    messages: [],
    input: '',
    scrollTo: '',
    sessionId: '',
    /* 多模态：待发送附件 / 上传中 / 录音中 / 等待回复 */
    attach: [],
    attachBusy: false,
    rec: false,
    recSec: 0,
    sending: false,
    typing: false
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


  _mode(m) {
    if (m === 'cloudFn') {
      return {
        cloudMode: true,
        modeWarn: false,
        modeText: '云函数',
        modeHint: '模型运行在云端（火山方舟），密钥只保存在服务端，前端不持有、不外传。'
      };
    }
    if (m === 'cloud') {
      return {
        cloudMode: true,
        modeWarn: false,
        modeText: '云端代理',
        modeHint: '模型经由你的自建代理转发，密钥只保存在服务端，前端不持有、不外传。'
      };
    }
    if (m === 'cloudFailed') {
      const err = aiService.cloudError();
      return {
        cloudMode: false,
        modeWarn: true,
        modeText: '本地规则',
        modeHint: '云函数已配置但调用失败，当前改由本地规则引擎作答。'
          + '原因：' + (err || '未知') + '。'
          + '请检查：① 云函数 ai 是否已「上传并部署」；② 云开发控制台里是否已配环境变量 ARK_API_KEY；'
          + '③ utils/config.js 的 CLOUD_ENV_ID 是环境 ID（形如 cloud1-xxxxxxxx）而不是环境名称。'
      };
    }
    return {
      cloudMode: false,
      modeWarn: false,
      modeText: '本地规则',
      modeHint: '当前由本地规则引擎驱动，结合你的真实目标与学习数据作答，不联网。配置云函数或代理后自动升级。'
    };
  },

  /** 每次对话后刷新徽标，让它如实反映「刚才到底用的是谁」 */
  _refreshMode() { this.setData(this._mode(aiService.mode())); },

  onLoad(options) {
    const enabled = aiService.aiEnabled();
    const advice = aiService.advice();

    // 指定会话（从历史页点进来）→ 切换到该会话；否则确保有当前会话
    if (options && options.session) chat.use(options.session);
    const sid = chat.ensure();

    const raws = chat.messagesOf(sid);
    const messages = raws.length ? raws.map(toMsg) : [greetingMsg()];

    this.setData(Object.assign(
      { enabled, advice, sessionId: sid, messages },
      this._mode(aiService.mode())
    ), () => this._scroll());
  },

  onShow() { this._applyTheme();
    const enabled = aiService.aiEnabled();
    this.setData(Object.assign({ enabled, advice: aiService.advice() }, this._mode(aiService.mode())));
  },

  onUnload() {
    if (this._recTimer) clearInterval(this._recTimer);
    if (voice.isRecording()) voice.cancel();
  },

  /* ===== 多模态：图片 / 文件 ===== */
  pickImg() {
    upload.chooseImages(9 - this.data.attach.length).then((list) => this._addAttach(list));
  },
  pickFile() {
    if (this.data.attach.length >= 9) { wx.showToast({ title: '最多 9 个附件', icon: 'none' }); return; }
    upload.chooseFiles(1).then((list) => this._addAttach(list));
  },
  _addAttach(list) {
    if (!list || !list.length) return;
    const attach = this.data.attach.concat(list).slice(0, 9);
    this.setData({ attach, attachBusy: true });
    // 先用本地临时路径渲染（秒出），再后台上传换 fileID
    upload.uploadAll(list, (done) => {
      this.setData({ attach: this.data.attach.map((a) => (a.id === done.id ? done : a)) });
    }).then((all) => {
      const onlyLocal = all.filter((a) => a.localOnly).length;
      this.setData({ attachBusy: false });
      if (onlyLocal && !upload.cloudReady()) {
        wx.showToast({ title: '云存储未配置，附件仅本机可见', icon: 'none' });
      }
    });
  },
  removeAttach(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ attach: this.data.attach.filter((a) => a.id !== id) });
  },
  previewAtt(e) { upload.previewImage(e.currentTarget.dataset.url); },

  /* ===== 语音输入（转文字落到输入框，仍可编辑） ===== */
  onMic() {
    if (this.data.rec) { voice.stop(); return; }
    voice.capture({
      onStart: () => {
        this.setData({ rec: true, recSec: 0 });
        if (this._recTimer) clearInterval(this._recTimer);
        this._recTimer = setInterval(() => {
          const sec = Math.floor(voice.elapsed() / 1000);
          if (sec >= 60) { voice.stop(); return; }
          this.setData({ recSec: sec });
        }, 200);
      },
      onText: (t) => this.setData({ input: (this.data.input ? this.data.input + ' ' : '') + t }),
      onError: (m) => wx.showToast({ title: String(m).split('\n')[0], icon: 'none', duration: 2500 }),
      onEnd: () => {
        if (this._recTimer) clearInterval(this._recTimer);
        this._recTimer = null;
        this.setData({ rec: false, recSec: 0 });
      }
    });
  },
  cancelRec() { voice.cancel(); },

  onInput(e) { this.setData({ input: e.detail.value }); },

  send() {
    if (this.data.sending) return;                 // 防连点
    const text = (this.data.input || '').trim();
    const attach = this.data.attach || [];
    if (!text && !attach.length) return;

    // 多轮上下文：取当前会话最近若干条，不含本次
    const history = chat.recent();

    // 落库用户消息并渲染（附件一并带上）
    const u = chat.append('user', text, attach);
    const msgs = this.data.messages.slice();
    msgs.push({ id: u.id, role: 'user', text, at: u.at, attach: u.attach, blocks: md.parse(text) });
    this.setData({ messages: msgs, input: '', attach: [], sending: true, typing: true }, () => this._scroll());

    if (!this.data.enabled) {
      this._reply('「允许 AI 读取学习数据」当前为关闭状态。开启后我才能结合你的真实数据回答（我的 → 隐私与 AI 权限）。');
      return;
    }

    // 优先走云函数 / 云端代理，失败自动降级本地规则引擎（附件以多模态传入）
    aiService.chat(text, history, attach)
      .then((res) => {
        const a = chat.append('ai', res.text);
        const msgs2 = this.data.messages.slice();
        msgs2.push({ id: a.id, role: 'ai', text: res.text, at: a.at, attach: [], blocks: md.parse(res.text) });
        this.setData({ messages: msgs2, sending: false, typing: false }, () => this._scroll());
        this._refreshMode();
      })
      .catch(() => {
        this.setData({ sending: false, typing: false });
        this._reply('暂时无法连接云端，已切换为本地解答。');
        this._refreshMode();
      });
  },

  _reply(text) {
    const a = chat.append('ai', text);
    const msgs = this.data.messages.slice();
    msgs.push({ id: a.id, role: 'ai', text, at: a.at, attach: [], blocks: md.parse(text) });
    this.setData({ messages: msgs, sending: false, typing: false }, () => this._scroll());
  },

  /** 新建对话：保留历史，开一条空会话 */
  newChat() {
    const sid = chat.create();
    this.setData({ sessionId: sid, messages: [greetingMsg()], scrollTo: '' });
  },

  _scroll() {
    const i = this.data.messages.length - 1;
    this.setData({ scrollTo: 'msg-' + i });
  },

  goHistory() { wx.navigateTo({ url: '/pages/ai-history/ai-history' }); },
  goProfile() { wx.switchTab({ url: '/pages/profile/profile' }); },
  goPlanAi() { wx.navigateTo({ url: '/pages/plan-ai/plan-ai' }); }
});
