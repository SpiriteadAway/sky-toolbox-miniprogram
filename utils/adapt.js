// 设备适配工具
// 获取安全区、导航栏高度等信息

var deviceInfo = null;

function getDeviceInfo() {
  if (deviceInfo) return deviceInfo;

  try {
    var sysInfo = wx.getSystemInfoSync();
    var menuInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;

    deviceInfo = {
      // 屏幕信息
      screenWidth: sysInfo.screenWidth,
      screenHeight: sysInfo.screenHeight,
      windowWidth: sysInfo.windowWidth,
      windowHeight: sysInfo.windowHeight,
      pixelRatio: sysInfo.pixelRatio,
      platform: sysInfo.platform,        // ios / android / devtools
      model: sysInfo.model,

      // 安全区 (px)
      safeAreaTop: sysInfo.safeArea ? sysInfo.safeArea.top : 0,
      safeAreaBottom: sysInfo.safeArea ? (sysInfo.screenHeight - sysInfo.safeArea.bottom) : 0,

      // 状态栏 (px)
      statusBarHeight: sysInfo.statusBarHeight || 20,

      // 导航栏估算 (px)
      navBarHeight: menuInfo
        ? (menuInfo.top - sysInfo.statusBarHeight) * 2 + menuInfo.height
        : 44,

      // 胶囊按钮位置
      menuRect: menuInfo || { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 },

      // 判断
      isIOS: sysInfo.platform === 'ios',
      isAndroid: sysInfo.platform === 'android',
      isNotch: (sysInfo.safeArea && sysInfo.safeArea.top > 20) || false,
      isSmallScreen: sysInfo.screenWidth <= 340
    };

    console.log('设备信息:', JSON.stringify(deviceInfo));
  } catch (e) {
    deviceInfo = { error: e.message };
  }

  return deviceInfo;
}

// px 转 rpx（小程序标准是 750rpx = screenWidth px）
function px2rpx(px) {
  var info = getDeviceInfo();
  return (px * 750) / info.screenWidth;
}

// rpx 转 px
function rpx2px(rpx) {
  var info = getDeviceInfo();
  return (rpx * info.screenWidth) / 750;
}

module.exports = {
  getDeviceInfo: getDeviceInfo,
  px2rpx: px2rpx,
  rpx2px: rpx2px
};
