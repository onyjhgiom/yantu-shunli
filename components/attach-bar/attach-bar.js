/**
 * 附件输入条（图片 / 文件 / 语音）
 *
 * 复用于笔记、模考等需要「图文 + 语音」混合输入的页面：
 *   · ＋     选图片（多选，自动后台上传换 fileID）
 *   · 📎    选文件
 *   · 🎤    语音：弹出「转文字 / 插入语音附件」二选一
 *            - 转文字：录音 → 语音识别 → 通过 triggerEvent('asr') 把文字抛给页面追加到输入框
 *            - 语音附件：录音 → 上传 → 作为 kind:'audio' 的附件进列表（不依赖识别引擎）
 *
 * 附件结构统一用 utils/upload.makeAttach()，页面只需监听 change 事件拿数组。
 */
const upload = require('../../utils/upload');
const voice = require('../../utils/voice');

Component({
  options: { addGlobalClass: true },
  properties: {
    /** 附件数组（受控；父组件用 value 传入） */
    value: { type: Array, value: [] },
    /** 是否允许选文件 */
    allowFile: { type: Boolean, value: true }
  },
  data: { rec: false, recSec: 0, uploading: false },
  observers: {
    value(v) { if (Array.isArray(v)) this._list = v.slice(); }
  },
  lifetimes: {
    created() { this._list = []; },
    detached() {
      if (this._recTimer) clearInterval(this._recTimer);
      if (voice.isRecording()) voice.cancel();
    }
  },
  methods: {
    _emit() {
      this.triggerEvent('change', { list: this._list.slice() });
    },
    _add(list) {
      if (!list || !list.length) return;
      this._list = this._list.concat(list);
      this.setData({ uploading: true });
      this._emit();
      // 先本地临时路径秒出，再后台上传换 fileID
      upload.uploadAll(list, (done) => {
        this._list = this._list.map((a) => (a.id === done.id ? done : a));
        this._emit();
      }).then((all) => {
        this.setData({ uploading: false });
        if (all.some((a) => a.localOnly) && !upload.cloudReady()) {
          wx.showToast({ title: '云存储未配置，附件仅本机可见', icon: 'none' });
        }
      });
    },

    /* ---------- 图片 / 文件 ---------- */
    pickImg() {
      upload.chooseImages(Math.max(1, 9 - this._list.length)).then((l) => this._add(l));
    },
    pickFile() {
      if (this._list.length >= 9) { wx.showToast({ title: '最多 9 个附件', icon: 'none' }); return; }
      upload.chooseFiles(1).then((l) => this._add(l));
    },
    removeItem(e) {
      const id = e.currentTarget.dataset.id;
      this._list = this._list.filter((a) => a.id !== id);
      this._emit();
    },
    preview(e) { upload.previewImage(e.currentTarget.dataset.url); },
    playAudio(e) {
      const url = e.currentTarget.dataset.url;
      if (!url) { wx.showToast({ title: '音频已失效', icon: 'none' }); return; }
      if (upload.isCloudFile(url)) {
        upload.downloadToTemp(url).then((p) => {
          if (!p) { wx.showToast({ title: '音频已失效', icon: 'none' }); return; }
          this._play(p);
        });
        return;
      }
      this._play(url);
    },
    _play(url) {
      const ctx = wx.createInnerAudioContext();
      ctx.src = url;
      ctx.onError(() => wx.showToast({ title: '播放失败', icon: 'none' }));
      ctx.play();
      this._audio = ctx;
    },

    /* ---------- 语音 ---------- */
    onMic() {
      if (this.data.rec) { this.stopRec(); return; }
      wx.showActionSheet({
        itemList: ['语音转文字', '插入语音附件'],
        success: (res) => {
          if (res.tapIndex === 0) this._asr();
          else this._recAttach();
        },
        fail: () => {}
      });
    },
    /** 语音转文字：结果通过 asr 事件抛给页面 */
    _asr() {
      this.setData({ rec: true, recSec: 0 });
      voice.capture({
        onStart: () => {
          this._recTimer = setInterval(() => {
            const s = Math.floor(voice.elapsed() / 1000);
            if (s >= 60) { voice.stop(); return; }
            this.setData({ recSec: s });
          }, 200);
        },
        onText: (t) => this.triggerEvent('asr', { text: t }),
        onError: (m) => wx.showToast({ title: String(m).split('\n')[0], icon: 'none', duration: 2500 }),
        onEnd: () => this._endRec()
      });
    },
    /** 插入语音附件：不依赖识别引擎 */
    _recAttach() {
      this.setData({ rec: true, recSec: 0 });
      voice.recordAudio({
        onStart: () => {
          this._recTimer = setInterval(() => {
            const s = Math.floor(voice.elapsed() / 1000);
            if (s >= 60) { voice.stopAudio(); return; }
            this.setData({ recSec: s });
          }, 200);
        },
        onStop: (r) => {
          this._add([upload.makeAttach({
            kind: 'audio', name: '语音 ' + r.duration + '″',
            tempPath: r.tempPath, ext: 'mp3', duration: r.duration
          })]);
        },
        onError: (m) => wx.showToast({ title: String(m), icon: 'none' }),
        onEnd: () => this._endRec()
      });
    },
    /** 停止当前语音操作（转文字 / 录音附件都走它） */
    stopRec() {
      if (voice.getState() === 'recording') voice.stop();
      else voice.stopAudio();
    },
    cancelRec() { voice.cancel(); voice.cancelAudio(); },
    _endRec() {
      if (this._recTimer) clearInterval(this._recTimer);
      this._recTimer = null;
      this.setData({ rec: false, recSec: 0 });
    }
  }
});
