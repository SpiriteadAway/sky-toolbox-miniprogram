var auth = require('./utils/auth');

App({
  onLaunch: function () {
    console.log('光遇工具箱启动');

    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d2gcm8evg722423c1',
        traceUser: true
      });
      console.log('云开发已初始化');
    }

    // 初始化安全区域（修复刘海屏/异形屏标题栏问题）
    this.initSafeArea();

    this.globalData.isLoggedIn = auth.isLoggedIn();
    this.globalData.profile = auth.getProfile();
    this.globalData.memberInfo = auth.getMemberInfo();
    console.log('登录状态:', this.globalData.isLoggedIn ? '已登录' : '未登录');

    // 初始化预拉取
    this.initPrefetch();

    // 异步刷新会员信息（如果预拉取有数据则跳过）
    if (this.globalData.isLoggedIn && !this.globalData.prefetchData) {
      this.refreshMemberInfo();
    }
  },

  globalData: {
    isLoggedIn: false,
    profile: null,
    memberInfo: null,
    cloudEnvId: 'cloud1-d2gcm8evg722423c1',
    prefetchData: null,  // 预拉取的数据
    safeArea: { top: 0, bottom: 0 }  // 安全区域
  },

  // ========== 安全区域初始化 ==========

  /**
   * 检测设备安全区域并设置 CSS 变量
   * 解决刘海屏/水滴屏/异形屏标题栏显示问题
   */
  initSafeArea: function () {
    try {
      var sysInfo = wx.getSystemInfoSync();
      var safeArea = sysInfo.safeArea || {};
      var statusBarHeight = sysInfo.statusBarHeight || 0;

      // 计算顶部安全距离（状态栏高度）
      var top = safeArea.top || statusBarHeight || 20;
      var bottom = sysInfo.screenHeight - (safeArea.bottom || sysInfo.screenHeight);

      this.globalData.safeArea = { top: top, bottom: bottom };
      this.globalData.statusBarHeight = statusBarHeight;
      this.globalData.platform = sysInfo.platform;

      console.log('安全区域:', JSON.stringify({ top: top, bottom: bottom, statusBar: statusBarHeight, platform: sysInfo.platform, model: sysInfo.model }));
    } catch (e) {
      console.warn('安全区域检测失败:', e);
    }
  },

  // ========== 数据预拉取 ==========

  /**
   * 初始化预拉取：读取微信提前缓存的数据
   */
  initPrefetch: function () {
    var app = this;

    // 监听后续预拉取数据更新
    if (wx.onBackgroundFetchData) {
      wx.onBackgroundFetchData(function (res) {
        console.log('收到预拉取数据更新:', res.timeStamp);
        var data = app.parsePrefetchData(res.fetchedData);
        if (data) {
          app.applyPrefetchData(data);
        }
      });
    }

    // 读取已缓存的预拉取数据
    if (wx.getBackgroundFetchData) {
      wx.getBackgroundFetchData({
        fetchType: 'pre',
        success: function (res) {
          console.log('读取预拉取数据成功, timeStamp:', res.timeStamp);
          var data = app.parsePrefetchData(res.fetchedData);
          if (data) {
            app.applyPrefetchData(data);
          }
        },
        fail: function (err) {
          console.log('无预拉取缓存（首次启动正常现象）:', err.errMsg);
        }
      });
    }
  },

  /**
   * 解析预拉取数据
   */
  parsePrefetchData: function (raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('预拉取数据解析失败:', e);
      return null;
    }
  },

  /**
   * 应用预拉取数据到全局状态
   */
  applyPrefetchData: function (data) {
    var app = this;
    app.globalData.prefetchData = data;

    if (data.memberInfo) {
      // 缓存会员信息到本地
      app.globalData.memberInfo = data.memberInfo;
      wx.setStorageSync('sky_member_info', data.memberInfo);
      console.log('预拉取会员信息已应用, credits:', data.memberInfo.credits);
    }

    if (data.openId && app.globalData.profile) {
      app.globalData.profile.openId = data.openId;
      app.globalData.profile.userId = data.openId;
      wx.setStorageSync('sky_user_profile', app.globalData.profile);
    }
  },

  // ========== 通用 ==========

  refreshAuthState: function () {
    var app = getApp();
    app.globalData.isLoggedIn = auth.isLoggedIn();
    app.globalData.profile = auth.getProfile();
    app.globalData.memberInfo = auth.getMemberInfo();

    // 登录后设置预拉取 token（下次冷启动生效）
    if (app.globalData.isLoggedIn && app.globalData.profile && app.globalData.profile.openId) {
      if (wx.setBackgroundFetchToken) {
        wx.setBackgroundFetchToken({
          token: app.globalData.profile.openId
        });
      }
    }
  },

  refreshMemberInfo: function () {
    var app = this;
    auth.refreshMemberInfo().then(function (info) {
      if (info) {
        app.globalData.memberInfo = info;
      }
    }).catch(function () {});
  }
});
