/**
 * 统一「语音输入」（录音 → 语音转文字）
 *
 * 引擎优先级（任一可用即可，都不可用时明确报错，绝不静默失败）：
 *   1) 微信同声传译插件 WechatSI（官方、免密钥、端上识别，需在 app.json 声明插件）
 *   2) 云函数 asr（录音先上传云存储，再由云函数调 ASR；需在 utils/config.js 配 ASR_CLOUD_FUNCTION）
 *
 * 页面只需调用 capture()，内部完成「申请麦克风权限 → 录音 → 转写 → 回填文字」，
 * 转写结果通过 onText 回调拿到（可再手动编辑），失败通过 onError 拿到可读原因。
 */
const config = require('./config');
const upload = require('./upload');

const MAX_MS = 60000;          // 单次最长 60s
const MIN_MS = 400;            // 太短视为误触

let state = 'idle';            // idle | recording | transcribing
let plugin = null;
let pluginChecked = false;
let siMgr = null;
let rec = null;
let cbs = null;
let partial = '';
let startedAt = 0;
let stopReason = 'stop';       // stop | cancel

/* ---------------- 能力探测 ---------------- */

function getPlugin() {
  if (pluginChecked) return plugin;
  pluginChecked = true;
  try {
    // 仅在 app.json 声明了 WechatSI 插件时才可用；未声明会抛错，捕获即视为不可用
    // eslint-disable-next-line
    plugin = requirePlugin('WechatSI');
  } catch (e) {
    plugin = null;
  }
  return plugin;
}

function cloudAsrReady() {
  return !!(config.ASR_CLOUD_FUNCTION && upload.cloudReady());
}

/** 返回可用的识别引擎：'plugin' | 'cloud' | '' */
function engine() {
  if (getPlugin()) return 'plugin';
  if (cloudAsrReady()) return 'cloud';
  return '';
}

function available() { return !!engine(); }

function isRecording() { return state === 'recording'; }

/* ---------------- 权限 ---------------- */

function ensurePermission() {
  return new Promise((resolve) => {
    if (typeof wx.getSetting !== 'function') return resolve({ ok: true });
    wx.getSetting({
      success: (res) => {
        const auth = (res && res.authSetting) || {};
        if (auth['scope.record'] === true) return resolve({ ok: true });
        if (auth['scope.record'] === false) {
          return resolve({
            ok: false,
            msg: '麦克风权限已被拒绝。请到「小程序右上角 → 设置 → 权限管理」中允许麦克风后重试。'
          });
        }
        if (typeof wx.authorize !== 'function') return resolve({ ok: true });
        wx.authorize({
          scope: 'scope.record',
          success: () => resolve({ ok: true }),
          fail: () => resolve({ ok: false, msg: '需要麦克风权限才能使用语音输入，请在弹窗中点「允许」。' })
        });
      },
      fail: () => resolve({ ok: true })
    });
  });
}

/* ---------------- 结束与回调 ---------------- */

function finish(text, errMsg) {
  if (state === 'idle') return;
  state = 'idle';
  const cb = cbs;
  cbs = null;
  siMgr = null;
  rec = null;
  stopReason = 'stop';
  if (!cb) return;
  if (stopReason === 'cancel') { if (cb.onEnd) cb.onEnd(); return; }
  if (errMsg) { if (cb.onError) cb.onError(errMsg); if (cb.onEnd) cb.onEnd(); return; }
  const t = String(text || '').trim();
  if (!t) { if (cb.onError) cb.onError('没有识别到内容，请靠近麦克风再试一次'); if (cb.onEnd) cb.onEnd(); return; }
  if (cb.onText) cb.onText(t);
  if (cb.onEnd) cb.onEnd();
}

/* ---------------- 引擎 1：WechatSI 插件 ---------------- */

function startPlugin(cb) {
  siMgr.onStart = () => {};
  siMgr.onRecognize = (res) => {
    if (res && res.result) {
      partial = res.result;
      if (cb && cb.onPartial) cb.onPartial(res.result, !!res.isFinal);
    }
  };
  siMgr.onStop = (res) => {
    const t = (res && res.result) || partial || '';
    finish(t);
  };
  siMgr.onError = (e) => {
    finish('', (e && (e.errMsg || e.message)) || '语音识别出错');
  };
  siMgr.onNeedCloseAudioCtxt = () => {};
  try {
    siMgr.start({ duration: MAX_MS, lang: 'zh_CN' });
  } catch (e) {
    finish('', '无法启动录音：' + ((e && e.message) || e));
  }
}

/* ---------------- 引擎 2：云函数 ASR ---------------- */

function doCloudAsr(tempFilePath) {
  if (!tempFilePath) { finish('', '录音失败，没有拿到音频'); return; }
  // 音频也要先上传云存储，云函数才能拉取（临时路径跨端不可用）
  upload.uploadOne(upload.makeAttach({ kind: 'audio', tempPath: tempFilePath, ext: 'mp3' }))
    .then((fileID) => {
      if (!fileID) { finish('', '音频上传失败，请检查网络后重试'); return; }
      wx.cloud.callFunction({
        name: config.ASR_CLOUD_FUNCTION,
        data: { fileID },
        success: (res) => {
          const r = res && res.result;
          if (r && r.text) { finish(r.text); return; }
          finish('', (r && r.error) || '语音识别未返回结果');
        },
        fail: (e) => finish('', (e && e.message) || '语音识别调用失败')
      });
    });
}

function startCloud(cb) {
  rec.onStart = () => {};
  rec.onError = (e) => { finish('', (e && e.errMsg) || '录音失败'); };
  rec.onStop = (res) => {
    const dur = (res && res.duration) || 0;
    if (dur && dur < MIN_MS) { finish('', '说话时间太短'); return; }
    doCloudAsr(res && res.tempFilePath);
  };
  try {
    rec.start({ duration: MAX_MS, format: 'mp3', sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000 });
  } catch (e) {
    finish('', '无法启动录音：' + ((e && e.message) || e));
  }
}

/* ---------------- 对外 API ---------------- */

/**
 * 一站式语音输入。
 * @param {object} cb
 *   onStart()            录音已开始（可开始计时/动画）
 *   onPartial(text,final) 实时中间结果（仅插件引擎）
 *   onText(text)         最终识别文本（页面回填输入框，之后仍可编辑）
 *   onError(msg)         失败/不可用的可读原因
 *   onEnd()              录音结束（无论成败）
 */
function capture(cb) {
  const handlers = cb || {};
  if (state !== 'idle') { if (handlers.onError) handlers.onError('正在录音中，请先停止'); return; }
  const eng = engine();
  if (!eng) {
    if (handlers.onError) {
      handlers.onError(
        '语音识别暂不可用：未检测到可用的识别引擎。\n' +
        '启用方式（二选一）：\n' +
        '① 在小程序管理后台「设置 → 第三方设置 → 插件管理」添加官方插件「微信同声传译 WechatSI」，并在 app.json 声明；\n' +
        '② 部署语音识别云函数，并在 utils/config.js 填写 ASR_CLOUD_FUNCTION。\n' +
        '你仍然可以直接打字输入。'
      );
    }
    return;
  }
  cbs = handlers;
  state = 'recording';
  partial = '';
  startedAt = Date.now();
  stopReason = 'stop';

  ensurePermission().then((p) => {
    if (!p.ok) { finish('', p.msg); return; }
    if (eng === 'plugin') {
      siMgr = getPlugin().getRecordRecognitionManager();
      if (handlers.onStart) handlers.onStart();
      startPlugin(handlers);
    } else {
      rec = wx.getRecorderManager();
      if (handlers.onStart) handlers.onStart();
      startCloud(handlers);
    }
  });
}

/** 停止录音并转写 */
function stop() {
  if (state !== 'recording') return;
  stopReason = 'stop';
  state = 'transcribing';
  if (siMgr) { try { siMgr.stop(); } catch (e) { finish('', '停止失败'); } return; }
  if (rec) { try { rec.stop(); } catch (e) { finish('', '停止失败'); } return; }
  finish('', '录音未启动');
}

/** 取消录音，不转写 */
function cancel() {
  if (state === 'idle') return;
  stopReason = 'cancel';
  if (siMgr) { try { siMgr.stop(); } catch (e) { /* noop */ } }
  if (rec) { try { rec.stop(); } catch (e) { /* noop */ } }
  finish('');
}

/** 已录时长（ms），页面可据此显示计时与进度 */
function elapsed() { return startedAt ? Date.now() - startedAt : 0; }

/* ---------------- 仅录音（用于「插入语音附件」） ----------------
 * 刻意独立于 ASR 引擎：没配置识别插件/云函数时，语音附件依然可用，
 * 只是拿不到文字。onStop 回调 { tempPath, duration }，由调用方上传成附件。
 */
let recOnly = null;

function recordAudio(cb) {
  const c = cb || {};
  if (recOnly) { if (c.onError) c.onError('正在录音中，请先停止'); return; }
  if (state !== 'idle') { if (c.onError) c.onError('正在录音中，请先停止'); return; }
  ensurePermission().then((p) => {
    if (!p.ok) { if (c.onError) c.onError(p.msg); return; }
    recOnly = wx.getRecorderManager();
    startedAt = Date.now();
    recOnly.onStart = () => { if (c.onStart) c.onStart(); };
    recOnly.onError = (e) => {
      recOnly = null; state = 'idle';
      if (c.onError) c.onError((e && e.errMsg) || '录音失败');
      if (c.onEnd) c.onEnd();
    };
    recOnly.onStop = (res) => {
      recOnly = null; state = 'idle';
      const dur = (res && res.duration) || 0;
      const path = (res && res.tempFilePath) || '';
      if (!path) { if (c.onError) c.onError('录音失败，没有拿到音频'); }
      else if (dur && dur < MIN_MS) { if (c.onError) c.onError('说话时间太短'); }
      else if (c.onStop) c.onStop({ tempPath: path, duration: Math.round(dur / 1000) });
      if (c.onEnd) c.onEnd();
    };
    try {
      recOnly.start({ duration: MAX_MS, format: 'mp3', sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000 });
    } catch (e) {
      recOnly = null; state = 'idle';
      if (c.onError) c.onError('无法启动录音：' + ((e && e.message) || e));
      if (c.onEnd) c.onEnd();
    }
  });
}

/** 停止"仅录音" */
function stopAudio() {
  if (recOnly) { try { recOnly.stop(); } catch (e) { recOnly = null; state = 'idle'; } }
}

/** 取消"仅录音"，不产生附件 */
function cancelAudio() {
  if (!recOnly) return;
  try { recOnly.stop(); } catch (e) { /* noop */ }
}

module.exports = {
  MAX_MS, capture, stop, cancel, elapsed,
  available, engine, isRecording, getState: () => state,
  recordAudio, stopAudio, cancelAudio
};
