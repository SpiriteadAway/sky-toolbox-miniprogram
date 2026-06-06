const auth = require('../../utils/auth');

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    loginTime: '',
    loading: false,
    error: '',
    // 编辑中的临时数据
    avatarPath: '',
    nickName: ''
  },

  onLoad() {
    this.checkLoginState();
  },

  onShow() {
    this.checkLoginState();
  },

  /**
   * 检查登录状态
   */
  checkLoginState() {
    const isLoggedIn = auth.isLoggedIn();
    const profile = auth.getProfile();
    const userInfo = auth.getUserInfo();

    this.setData({
      isLoggedIn,
      profile,
      userInfo,
      avatarPath: profile ? profile.avatarPath : '',
      nickName: profile ? profile.nickName : '',
      loginTime: userInfo ? this.formatTime(userInfo.loginTime) : ''
    });
  },

  /**
   * 选择头像回调（open-type="chooseAvatar"）
   */
  onChooseAvatar(e) {
    const avatarPath = e.detail.avatarUrl;
    console.log('选择了头像:', avatarPath);
    this.setData({ avatarPath, error: '' });
  },

  /**
   * 昵称输入
   */
  onNicknameInput(e) {
    this.setData({ nickName: e.detail.value, error: '' });
  },

  /**
   * 昵称失去焦点
   */
  onNicknameBlur(e) {
    if (e.detail.value !== this.data.nickName) {
      this.setData({ nickName: e.detail.value });
    }
  },

  /**
   * 处理登录（兼容旧版微信一键登录）
   */
  handleLogin() {
    if (this.data.loading) return;

    const { avatarPath, nickName } = this.data;

    // 新版：通过 chooseAvatar + nickname 登录
    if (avatarPath && nickName && nickName.trim()) {
      this.doLogin(avatarPath, nickName.trim());
      return;
    }

    // 降级：尝试旧版 getUserProfile
    this.setData({ loading: true, error: '' });

    auth.login()
      .then(userInfo => {
        console.log('登录成功:', userInfo);
        this.onLoginSuccess(userInfo);
      })
      .catch(err => {
        console.error('登录失败:', err);
        this.setData({
          error: err.message || '请设置头像和昵称后点击「确认登录」',
          loading: false
        });
      });
  },

  /**
   * 确认登录（新版：头像+昵称已选好后点击）
   */
  handleConfirmLogin() {
    const { avatarPath, nickName } = this.data;

    if (!avatarPath) {
      this.setData({ error: '请先点击头像区域选择头像' });
      return;
    }
    if (!nickName || !nickName.trim()) {
      this.setData({ error: '请输入昵称' });
      return;
    }

    this.doLogin(avatarPath, nickName.trim());
  },

  /**
   * 执行登录
   */
  doLogin(avatarPath, nickName) {
    this.setData({ loading: true, error: '' });

    auth.saveProfile(avatarPath, nickName)
      .then(profile => {
        console.log('保存成功:', profile);
        const app = getApp();
        app.refreshAuthState();

        this.setData({
          isLoggedIn: true,
          userInfo: auth.getUserInfo(),
          loginTime: this.formatTime(Date.now()),
          loading: false
        });

        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        });

        // 延迟跳转到首页
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' });
        }, 1500);
      })
      .catch(err => {
        console.error('登录失败:', err);
        this.setData({
          error: err.message || '登录失败，请重试',
          loading: false
        });
      });
  },

  /**
   * 登录成功回调（旧版兼容）
   */
  onLoginSuccess(userInfo) {
    const app = getApp();
    app.refreshAuthState();

    this.setData({
      isLoggedIn: true,
      userInfo,
      loginTime: this.formatTime(Date.now()),
      loading: false
    });

    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1500
    });

    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' });
    }, 1500);
  },

  /**
   * 去个人中心
   */
  goToProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  /**
   * 回首页
   */
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    const d = new Date(timestamp);
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}`;
  }
});
