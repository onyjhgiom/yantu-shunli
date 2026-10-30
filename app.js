/**
 * 研途顺利 · 考研助手
 * App 入口：初始化默认数据、生成开机问候、暴露全局数据
 */
const profileService = require('./services/profile');
const notifyService = require('./services/notify');
const themeStore = require('./utils/theme');
const config = require('./utils/config');

App({
  globalData: {
    greeting: '研途顺利。',
    hasSetup: false,
    version: '1.0.0'
  },

  onLaunch() {
    // 0. 云开发初始化（仅当填写了 CLOUD_ENV_ID，否则保持纯本地运行）
    if (config.CLOUD_ENV_ID && typeof wx !== 'undefined' && wx.cloud && wx.cloud.init) {
      try {
        wx.cloud.init({ env: config.CLOUD_ENV_ID, traceUser: true });
      } catch (e) {
        // 不要静默吞掉：环境 ID 填错（如只填了环境名称 cloud1）时这里会失败，
        // AI 会降级到本地规则，控制台给出线索便于自查。
        console.warn('[研途顺利] wx.cloud.init 失败，AI 将降级为本地规则。'
          + '请确认 utils/config.js 的 CLOUD_ENV_ID 是「环境 ID」（形如 cloud1-xxxxxxxx）而非「环境名称」。',
          config.CLOUD_ENV_ID, e);
      }
    } else if (typeof wx !== 'undefined' && wx.cloud && !config.CLOUD_ENV_ID) {
      console.info('[研途顺利] 未配置 CLOUD_ENV_ID，AI 使用本地规则引擎（功能正常，不联网）。');
    }

    // 1. 确保本地数据结构存在（首次运行会写入默认值）
    profileService.ensureDefaults();

    // 1.5 播种今日站内通知（倒计时提醒 + 每日一句），不重复生成
    try { notifyService.seedToday(); } catch (e) { /* 通知失败不影响启动 */ }

    // 2. 依据当前时间 + 用户名字生成开机问候（问候生成已下沉到 profileService，
    //    改名后由 setProfile 同步刷新 globalData.greeting，无需这里再维护一份逻辑）
    const profile = profileService.getProfile();
    this.globalData.hasSetup = profileService.isSetup();
    this.globalData.greeting = profileService.greeting(profile.name);

    // 3. 应用用户上次选择的皮肤到导航栏 / tabBar。
    //    app.json 里的窗口色只是「默认皮肤」的兜底，这里按存储值覆盖，
    //    否则选了深色皮肤的用户每次冷启都会先闪一下浅色系统栏。
    themeStore.applyChrome();
  }
});
