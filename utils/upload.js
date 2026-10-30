/**
 * 统一「选文件 / 选图片 → 落地」的附件工具
 *
 * 设计要点（对应云存储 fileID 方案）：
 *  1. 选完立刻用本地临时路径（tempPath）渲染，缩略图马上可见，用户无等待；
 *  2. 再后台上传到云存储，成功后把 url 换成 fileID（持久化），清空 tempPath；
 *  3. 云开发不可用或上传失败 → 保留本地路径并标记 localOnly，页面提示「仅本机可见」，
 *     绝不静默失败、也绝不阻塞本地使用；
 *  4. 发给模型时，图片转 base64 data URL（云 fileID 外部模型无法直接拉取），
 *     其它文件只带元信息，保证任何模型/降级路径都不炸。
 */
const config = require('./config');

const CLOUD_PREFIX = 'cloud://';
const MAX_IMAGE = 10 * 1024 * 1024;   // 单图 10MB
const MAX_FILE = 20 * 1024 * 1024;    // 单文件 20MB
const MAX_COUNT = 9;

function isCloudFile(url) {
  return typeof url === 'string' && url.indexOf(CLOUD_PREFIX) === 0;
}

/** 云开发是否可用（已配置环境 ID 且基础库支持） */
function cloudReady() {
  return !!(
    config.CLOUD_ENV_ID &&
    typeof wx !== 'undefined' &&
    wx.cloud &&
    typeof wx.cloud.uploadFile === 'function'
  );
}

function newId() {
  return 'a_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function extOf(path, fallback) {
  const m = String(path || '').match(/\.([A-Za-z0-9]{2,5})(?:\?|$)/);
  return m ? m[1].toLowerCase() : (fallback || 'bin');
}

function bytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + 'B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'KB';
  return (n / 1024 / 1024).toFixed(1) + 'MB';
}

/** 组装一个附件对象（kind: image / file） */
function makeAttach(o) {
  return {
    id: newId(),
    kind: o.kind,
    name: o.name || '',
    size: o.size || 0,
    sizeText: bytes(o.size),
    ext: o.ext || '',
    /* 渲染用：优先 fileID，其次本地临时路径 */
    url: o.fileID || o.tempPath || '',
    tempPath: o.tempPath || '',
    fileID: o.fileID || '',
    localOnly: !o.fileID,
    uploading: !!o.tempPath && !o.fileID,
    /* 语音/录音类 */
    duration: o.duration || 0,
    asrText: o.asrText || '',
    failed: false
  };
}

/* ---------------- 选择 ---------------- */

/** 选图片（可多选），返回附件数组（本地路径，可直接渲染） */
function chooseImages(count) {
  return new Promise((resolve) => {
    if (typeof wx.chooseMedia !== 'function') {
      // 老基础库降级
      wx.chooseImage({
        count: count || MAX_COUNT,
        sizeType: ['compressed'],
        success: (res) => {
          const list = (res.tempFilePaths || []).map((p, i) => makeAttach({
            kind: 'image', tempPath: p, size: (res.tempFiles && res.tempFiles[i] && res.tempFiles[i].size) || 0,
            ext: extOf(p, 'jpg'), name: '图片' + (i + 1)
          }));
          resolve(list);
        },
        fail: () => resolve([])
      });
      return;
    }
    wx.chooseMedia({
      count: count || MAX_COUNT,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const list = (res.tempFiles || []).map((f) => {
          if (f.size > MAX_IMAGE) {
            return makeAttach({ kind: 'image', tempPath: f.tempFilePath, size: f.size, ext: extOf(f.tempFilePath, 'jpg'), name: '大图' });
          }
          return makeAttach({ kind: 'image', tempPath: f.tempFilePath, size: f.size, ext: extOf(f.tempFilePath, 'jpg'), name: '图片' });
        }).filter((a) => a.size <= MAX_IMAGE);
        resolve(list);
      },
      fail: () => resolve([])
    });
  });
}

/** 选文件（从聊天会话里选，支持 doc/pdf/zip 等） */
function chooseFiles(count) {
  return new Promise((resolve) => {
    if (typeof wx.chooseMessageFile !== 'function') {
      wx.showToast({ title: '当前微信版本不支持选文件', icon: 'none' });
      resolve([]);
      return;
    }
    wx.chooseMessageFile({
      count: count || 1,
      type: 'all',
      success: (res) => {
        const list = (res.tempFiles || []).map((f) => makeAttach({
          kind: 'file',
          name: f.name || '文件',
          size: f.size || 0,
          ext: extOf(f.name, 'bin'),
          tempPath: f.path || ''
        })).filter((a) => a.size <= MAX_FILE);
        if (!(res.tempFiles || []).length) resolve([]);
        else if (list.length < (res.tempFiles || []).length) {
          wx.showToast({ title: '有文件超过 20MB 已被跳过', icon: 'none' });
        }
        resolve(list);
      },
      fail: () => resolve([])
    });
  });
}

/* ---------------- 上传 ---------------- */

/** 上传单个附件到云存储，成功后返回 fileID；失败返回空串（不抛） */
function uploadOne(att) {
  return new Promise((resolve) => {
    if (!cloudReady() || !att.tempPath || isCloudFile(att.url)) { resolve(att.fileID || ''); return; }
    const d = new Date();
    const mm = d.getMonth() + 1;
    const ym = '' + d.getFullYear() + (mm < 10 ? '0' + mm : mm);
    const cloudPath = 'yantu-attach/' + ym + '/' + att.id + '.' + (att.ext || 'bin');
    wx.cloud.uploadFile({
      cloudPath,
      filePath: att.tempPath,
      success: (res) => resolve((res && res.fileID) || ''),
      fail: () => resolve('')
    });
  });
}

/**
 * 批量后台上传并回调进度。onEach(att) 每张完成即回调（用于把 fileID 写回）。
 * 任何一张失败都只标记 localOnly，不影响其它。
 */
function uploadAll(list, onEach) {
  const arr = (list || []).slice();
  if (!arr.length) return Promise.resolve(arr);
  return Promise.all(arr.map((att) =>
    uploadOne(att).then((fileID) => {
      const next = Object.assign({}, att, {
        fileID: fileID || '',
        url: fileID || att.tempPath || att.url,
        tempPath: fileID ? '' : att.tempPath,   // 上传成功后清空临时路径，避免冷启动读到失效路径
        localOnly: !fileID,
        uploading: false
      });
      if (typeof onEach === 'function') onEach(next);
      return next;
    })
  ));
}

/** 删除云文件（best-effort，失败只警告，不阻塞） */
function removeFiles(fileIDs) {
  const list = (fileIDs || []).filter(isCloudFile);
  if (!list.length || typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.deleteFile !== 'function') return;
  try {
    wx.cloud.deleteFile({ fileList: list, fail: () => {} });
  } catch (e) { /* noop */ }
}

/* ---------------- 供模型消费 ---------------- */

/** 读本地文件为 base64（不带 data: 前缀） */
function readBase64(filePath) {
  return new Promise((resolve) => {
    if (!filePath || typeof wx.getFileSystemManager !== 'function') { resolve(''); return; }
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data || ''),
      fail: () => resolve('')
    });
  });
}

const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp'
};

/**
 * 把图片附件转成模型可用的 data URL（OpenAI 兼容 vision 格式）。
 * 只能读本地临时路径；已是云 fileID 的先下载再读。失败返回空串（调用方降级）。
 */
async function toDataUrl(att) {
  let path = att.tempPath || '';
  if (!path && isCloudFile(att.url)) path = await downloadToTemp(att.url);
  if (!path) return '';
  const b64 = await readBase64(path);
  if (!b64) return '';
  return 'data:' + (MIME[att.ext] || 'image/jpeg') + ';base64,' + b64;
}

/** 云 fileID 下载成本地临时路径 */
function downloadToTemp(fileID) {
  return new Promise((resolve) => {
    if (!isCloudFile(fileID) || typeof wx === 'undefined' || !wx.cloud || typeof wx.cloud.downloadFile !== 'function') {
      resolve('');
      return;
    }
    wx.cloud.downloadFile({
      fileID,
      success: (res) => resolve((res && res.tempFilePath) || ''),
      fail: () => resolve('')
    });
  });
}

/** 预览图片（兼容云 fileID：先下载再 preview） */
function previewImage(url) {
  const go = (u) => wx.previewImage({ current: u, urls: [u] });
  if (isCloudFile(url)) {
    downloadToTemp(url).then((p) => { if (p) go(p); else wx.showToast({ title: '图片已失效', icon: 'none' }); });
    return;
  }
  if (!url) { wx.showToast({ title: '图片已失效', icon: 'none' }); return; }
  go(url);
}

module.exports = {
  CLOUD_PREFIX, MAX_IMAGE, MAX_FILE, MAX_COUNT,
  isCloudFile, cloudReady, makeAttach, bytes,
  chooseImages, chooseFiles, uploadOne, uploadAll, removeFiles,
  readBase64, toDataUrl, downloadToTemp, previewImage
};
