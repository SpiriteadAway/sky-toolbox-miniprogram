const auth = require('../../utils/auth');

Page({
  data: {
    isLoggedIn: false,
    profile: null,
    // 编辑中的临时数据
    avatarPath: '',
    nickName: '',
    // UI 状态
    historyCount: 0,
    storageSize: '0 KB',
    saving: false,
    error: '',
    // 弹窗控制
    showEditModal: false,
    showSignOutModal: false,
    showLogoutModal: false,
    // 会员信息
    memberInfo: null
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    const isLoggedIn = auth.isLoggedIn();
    const profile = auth.getProfile();
    const history = auth.getHeightHistory();
    const memberInfo = auth.getMemberInfo();

    this.setData({
      isLoggedIn,
      profile,
      avatarPath: profile ? profile.avatarPath : '',
      nickName: profile ? profile.nickName : '',
      historyCount: history.length,
      storageSize: this.calcStorageSize(),
      memberInfo
    });

    // 异步刷新云端会员信息
    if (isLoggedIn) {
      this.refreshMemberInfo();
    }
  },

  async refreshMemberInfo() {
    try {
      const info = await auth.refreshMemberInfo();
      if (info) {
        this.setData({ memberInfo: info });
      }
    } catch (e) {
      // 静默
    }
  },

  /**
   * 选择头像回调（open-type="chooseAvatar"）
   */
  onChooseAvatar(e) {
    const avatarPath = e.detail.avatarUrl;
    console.log('选择了头像:', avatarPath);
    this.setData({ avatarPath });
  },

  /**
   * 昵称输入
   */
  onNicknameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  /**
   * 昵称失去焦点（type="nickname" 的 input 在 blur 时会做安全检测）
   */
  onNicknameBlur(e) {
    if (e.detail.value !== this.data.nickName) {
      this.setData({ nickName: e.detail.value });
    }
  },

  // ========== 修改个人信息 ==========

  /**
   * 打开编辑个人信息弹窗
   */
  showEditProfile() {
    const profile = auth.getProfile();
    this.setData({
      showEditModal: true,
      avatarPath: profile ? profile.avatarPath : '',
      nickName: profile ? profile.nickName : ''
    });
  },

  /**
   * 关闭编辑弹窗
   */
  hideEditModal() {
    this.setData({ showEditModal: false });
  },

  /**
   * 保存个人资料
   */
  handleSaveProfile() {
    const { avatarPath, nickName } = this.data;
    
    if (!avatarPath) {
      this.setData({ error: '请先选择头像' });
      return;
    }
    if (!nickName || !nickName.trim()) {
      this.setData({ error: '请先设置昵称' });
      return;
    }

    this.setData({ saving: true, error: '' });

    auth.saveProfile(avatarPath, nickName.trim())
      .then(profile => {
        const app = getApp();
        app.refreshAuthState();
        this.setData({ saving: false, showEditModal: false });
        this.loadData();
        wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 });
      })
      .catch(err => {
        this.setData({
          saving: false,
          error: err.message || '保存失败，请重试'
        });
      });
  },

  // ========== 注册会员 ==========

  async handleRegisterMember() {
    const profile = auth.getProfile();
    if (!profile) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '注册中...' });
    try {
      const res = await auth.registerMember(profile.nickName, profile.avatarPath);
      wx.hideLoading();
      if (res.code === 200) {
        wx.showToast({ title: res.msg || '注册成功', icon: 'success' });
        this.loadData();
      } else {
        wx.showToast({ title: res.msg || '注册失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '注册失败', icon: 'none' });
    }
  },

  // ========== 退出登录 ==========

  showSignOutConfirm() {
    this.setData({ showSignOutModal: true });
  },

  hideSignOutConfirm() {
    this.setData({ showSignOutModal: false });
  },

  /**
   * 退出登录：仅清除登录状态，保留身高测量等数据
   * 重新登录后可找回数据
   */
  handleSignOut() {
    this.setData({ showSignOutModal: false });
    auth.signOut();
    const app = getApp();
    app.refreshAuthState();
    this.loadData();
    wx.showToast({ title: '已退出登录', icon: 'success', duration: 1500 });
  },

  // ========== 注销账号 ==========

  showLogoutConfirm() {
    this.setData({ showLogoutModal: true });
  },

  hideLogoutConfirm() {
    this.setData({ showLogoutModal: false });
  },

  /**
   * 注销账号：永久清除所有数据
   * 此操作不可撤销
   */
  handleLogout() {
    this.setData({ showLogoutModal: false });
    auth.logout();
    const app = getApp();
    app.refreshAuthState();
    this.loadData();
    wx.showToast({ title: '账号已注销，所有数据已清除', icon: 'success', duration: 2000 });
  },

  // ========== 管理后台 ==========

  goMember() {
    wx.switchTab({ url: '/pages/member/member' });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' });
  },

  // 客服回调
  onContact(e) {
    console.log('客服会话回调:', e.detail);
    // 用户点击客服消息中的小程序卡片返回时，detail.path 和 detail.query 会包含返回信息
    // 可以在这里做页面跳转逻辑
  },

  // ========== 其他 ==========

  clearHistory() {
    if (this.data.historyCount === 0) {
      wx.showToast({ title: '没有可清空的记录', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有身高测量记录吗？此操作不可撤销。',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          auth.clearHeightHistory();
          this.loadData();
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      }
    });
  },

  dismissError() {
    this.setData({ error: '' });
  },

  noop() {},

  calcStorageSize() {
    try {
      const info = wx.getStorageInfoSync();
      const kb = Math.round(info.currentSize);
      return kb < 1024 ? kb + ' KB' : (kb / 1024).toFixed(1) + ' MB';
    } catch (e) {
      return '未知';
    }
  }
});
