var STORAGE_KEY = {
  PROFILE: 'sky_user_profile',
  HEIGHT_HISTORY: 'sky_height_history'
};

// ========== 基础用户信息 ==========

function isLoggedIn() {
  var profile = getProfile();
  return !!(profile && profile.nickName);
}

function getProfile() {
  return wx.getStorageSync(STORAGE_KEY.PROFILE) || null;
}

/**
 * 获取用户信息（login 页面兼容用）
 */
function getUserInfo() {
  var profile = getProfile();
  if (!profile) return null;
  return {
    nickName: profile.nickName,
    avatarUrl: profile.avatarPath,
    loginTime: profile.createdAt
  };
}

/**
 * 登录：使用 chooseAvatar + nickname 组件获取的信息
 * 等同于 saveProfile
 */
function login() {
  return new Promise(function (resolve, reject) {
    // 新版微信登录：通过 button open-type="chooseAvatar" + input type="nickname" 获取
    // 这里提供兼容层：如果已有 profile 则直接返回
    var existing = getProfile();
    if (existing) {
      resolve(getUserInfo());
      return;
    }
    // 没有 profile 时触发用户授权流程
    wx.getUserProfile({
      desc: '用于保存你的测量记录',
      success: function (res) {
        var userInfo = res.userInfo;
        saveProfile(userInfo.avatarUrl, userInfo.nickName)
          .then(function (profile) {
            resolve(getUserInfo());
          })
          .catch(reject);
      },
      fail: function (err) {
        // 降级：引导用户去个人中心手动设置
        reject(new Error('请前往「我的」页面设置头像和昵称'));
      }
    });
  });
}

function generateLocalId() {
  var existing = getProfile();
  if (existing && existing.userId) return existing.userId;
  var ts = Date.now().toString(36).toUpperCase();
  var r = Math.random().toString(36).substring(2, 8).toUpperCase();
  return 'SKY' + ts + r;
}

function fetchOpenId() {
  return new Promise(function (resolve) {
    if (!wx.cloud) { resolve(''); return; }
    wx.cloud.callFunction({
      name: 'getOpenId',
      success: function (res) { resolve(res.result.openid || ''); },
      fail: function () { resolve(''); }
    });
  });
}

function saveProfile(avatarPath, nickName) {
  return new Promise(function (resolve, reject) {
    if (!avatarPath || !nickName) {
      reject(new Error('头像和昵称不能为空'));
      return;
    }
    var fs = wx.getFileSystemManager();
    var savedPath = wx.env.USER_DATA_PATH + '/avatar_' + Date.now() + '.png';
    try { fs.saveFileSync(avatarPath, savedPath); } catch (e) {
      try { fs.copyFileSync(avatarPath, savedPath); } catch (e2) {}
    }
    var localId = generateLocalId();
    var profile = { userId: localId, nickName: nickName, avatarPath: savedPath, createdAt: Date.now() };
    wx.setStorageSync(STORAGE_KEY.PROFILE, profile);
    fetchOpenId().then(function (openid) {
      if (openid) {
        profile.openId = openid;
        profile.userId = openid;
        wx.setStorageSync(STORAGE_KEY.PROFILE, profile);
      }
      // 登录即自动注册会员（已注册则返回已有信息，新用户送1次额度）
      registerMember(nickName, savedPath).then(function () {
        resolve(profile);
      }).catch(function () {
        // 注册失败不影响登录
        resolve(profile);
      });
    }).catch(function () {
      resolve(profile);
    });
  });
}

function signOut() {
  wx.removeStorageSync(STORAGE_KEY.PROFILE);
  wx.removeStorageSync('sky_member_info');
}

function logout() {
  var profile = getProfile();
  if (profile && profile.avatarPath) {
    try { wx.getFileSystemManager().unlinkSync(profile.avatarPath); } catch (e) {}
  }
  wx.removeStorageSync(STORAGE_KEY.PROFILE);
  wx.removeStorageSync(STORAGE_KEY.HEIGHT_HISTORY);
  wx.removeStorageSync('sky_member_info');
}

// ========== 身高历史 ==========

function getHeightHistory() {
  return wx.getStorageSync(STORAGE_KEY.HEIGHT_HISTORY) || [];
}

function addHeightRecord(code, result) {
  var history = getHeightHistory();
  var record = { id: Date.now(), code: code, msg: result.msg || '', url: result.url || '',
    time: result.time || new Date().toLocaleString('zh-CN'), createdAt: Date.now() };
  history.unshift(record);
  if (history.length > 50) history.length = 50;
  wx.setStorageSync(STORAGE_KEY.HEIGHT_HISTORY, history);
  return record;
}

function clearHeightHistory() {
  wx.removeStorageSync(STORAGE_KEY.HEIGHT_HISTORY);
}

// ========== 会员系统（云数据库） ==========

/**
 * 获取会员信息（先读缓存，异步刷新云端）
 */
function getMemberInfo() {
  return wx.getStorageSync('sky_member_info') || null;
}

/**
 * 从云端刷新会员信息
 */
function refreshMemberInfo() {
  return new Promise(function (resolve) {
    if (!wx.cloud) {
      resolve(getMemberInfo());
      return;
    }
    wx.cloud.callFunction({
      name: 'getMemberInfo',
      success: function (res) {
        if (res.result.code === 200 && res.result.data) {
          wx.setStorageSync('sky_member_info', res.result.data);
          resolve(res.result.data);
        } else {
          resolve(getMemberInfo());
        }
      },
      fail: function () {
        resolve(getMemberInfo());
      }
    });
  });
}

/**
 * 注册会员（新用户送 1 次）
 */
function registerMember(nickName, avatarPath) {
  return new Promise(function (resolve, reject) {
    if (!wx.cloud) {
      reject(new Error('云开发未初始化'));
      return;
    }
    wx.cloud.callFunction({
      name: 'registerMember',
      data: {
        nickName: nickName || '',
        avatarPath: avatarPath || ''
      },
      success: function (res) {
        if (res.result.code === 200) {
          wx.setStorageSync('sky_member_info', res.result.data);
          resolve(res.result);
        } else {
          reject(new Error(res.result.msg || '注册失败'));
        }
      },
      fail: function (err) {
        reject(new Error('网络错误'));
      }
    });
  });
}

/**
 * 消耗额度（付费功能调用）
 * @param {string} feature - 功能标识: 'height' | 'gift'
 * @returns { allowed, credits, memberLevel, msg, freeMode }
 * 如果该功能开启了免费模式，跳过扣费直接放行
 */
function useCredit(feature) {
  feature = feature || '';
  return new Promise(function (resolve) {
    if (!wx.cloud) {
      resolve({ allowed: true, credits: -1, memberLevel: 'offline', msg: '离线模式' });
      return;
    }

    // 检查该功能是否开启了免费模式
    wx.cloud.callFunction({
      name: 'systemConfig',
      data: { action: 'get' },
      success: function (cfgRes) {
        var freeFeatures = (cfgRes.result.code === 200 && cfgRes.result.data)
          ? (cfgRes.result.data.freeFeatures || {})
          : {};

        if (freeFeatures[feature]) {
          // 🎉 该功能免费：但必须先登录+注册会员
          if (!isLoggedIn()) {
            resolve({
              allowed: false, credits: 0, memberLevel: 'guest',
              msg: '请先登录后再使用', needLogin: true
            });
            return;
          }
          if (!isMemberRegistered()) {
            resolve({
              allowed: false, credits: 0, memberLevel: 'unregistered',
              msg: '请先注册会员（免费注册，即送1次体验）', needRegister: true, freeMode: true
            });
            return;
          }
          // 已登录+已注册 → 免费放行
          resolve({
            allowed: true, credits: 999, memberLevel: 'beta',
            msg: '🧪 内测免费体验中', freeMode: true
          });
          return;
        }
        // 正常扣费流程
        doUseCredit(resolve);
      },
      fail: function () {
        doUseCredit(resolve);
      }
    });
  });
}

function doUseCredit(resolve) {
    wx.cloud.callFunction({
      name: 'useCredit',
      success: function (res) {
        var result = res.result;
        if (result.code === 200) {
          var info = getMemberInfo() || {};
          info.credits = result.data.credits;
          info.totalQueries = result.data.totalQueries;
          wx.setStorageSync('sky_member_info', info);
          resolve({
            allowed: true,
            credits: result.data.credits,
            totalQueries: result.data.totalQueries,
            memberLevel: result.data.memberLevel,
            msg: '消耗成功'
          });
        } else if (result.code === 402) {
          resolve({
            allowed: false,
            credits: 0,
            memberLevel: result.data ? result.data.memberLevel : 'free',
            msg: result.msg || '额度不足',
            hint: result.data ? result.data.hint : ''
          });
        } else if (result.code === 404) {
          resolve({
            allowed: false,
            credits: 0,
            memberLevel: 'unregistered',
            msg: result.msg || '请先注册会员',
            needRegister: true
          });
        } else {
          resolve({ allowed: true, credits: -1, memberLevel: 'error', msg: '服务异常，已降级放行' });
        }
      },
      fail: function (err) {
        console.error('useCredit 调用失败:', err);
        resolve({ allowed: true, credits: -1, memberLevel: 'offline', msg: '网络异常，离线模式' });
      }
    });
  }

/**
 * 检查是否已注册会员
 */
function isMemberRegistered() {
  var info = getMemberInfo();
  return !!(info && info.registered);
}

/**
 * 获取剩余额度
 */
function getRemainingCredits() {
  var info = getMemberInfo();
  return info ? (info.credits || 0) : -1;
}

module.exports = {
  // 基础
  isLoggedIn: isLoggedIn,
  getProfile: getProfile,
  getUserInfo: getUserInfo,
  login: login,
  saveProfile: saveProfile,
  signOut: signOut,
  logout: logout,
  // 身高历史
  getHeightHistory: getHeightHistory,
  addHeightRecord: addHeightRecord,
  clearHeightHistory: clearHeightHistory,
  // 会员
  getMemberInfo: getMemberInfo,
  refreshMemberInfo: refreshMemberInfo,
  registerMember: registerMember,
  useCredit: useCredit,
  isMemberRegistered: isMemberRegistered,
  getRemainingCredits: getRemainingCredits
};
