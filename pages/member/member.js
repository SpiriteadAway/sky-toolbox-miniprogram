// 会员中心 - 简洁版（无赞赏/打赏功能）
const app = getApp();
const auth = require('../../utils/auth');

Page({
  data: {
    isLoggedIn: false,
    memberInfo: null,
    profile: null,
    loading: true
  },

  onLoad() { this.refreshAll(); },
  onShow() { this.refreshAll(); },

  async refreshAll() {
    const isLoggedIn = app.globalData.isLoggedIn;
    const profile = isLoggedIn ? app.globalData.profile : null;
    this.setData({ isLoggedIn, profile, loading: true });
    if (isLoggedIn) {
      await this.loadMemberInfo();
    } else {
      this.setData({ loading: false, memberInfo: null });
    }
  },

  async loadMemberInfo() {
    try {
      const info = await auth.refreshMemberInfo();
      if (!info || !info.registered) {
        // 未注册 → 自动注册（静默）
        const res = await auth.registerMember(
          app.globalData.profile ? app.globalData.profile.nickName : '',
          app.globalData.profile ? app.globalData.profile.avatarPath : ''
        );
        if (res.code === 200) {
          app.refreshAuthState();
          const updated = auth.getMemberInfo();
          this.setData({ memberInfo: updated || { registered: true, credits: 1 }, loading: false });
          return;
        }
      }
      this.setData({ memberInfo: info || { registered: false, credits: 0 }, loading: false });
    } catch (e) {
      this.setData({ memberInfo: auth.getMemberInfo() || { registered: false, credits: 0 }, loading: false });
    }
  },

  // ========== 注册 ==========
  async handleRegister() {
    if (!this.data.isLoggedIn) return wx.showToast({ title: '请先登录', icon: 'none' });
    wx.showLoading({ title: '注册中...' });
    try {
      const res = await auth.registerMember(app.globalData.profile.nickName, app.globalData.profile.avatarPath);
      wx.hideLoading();
      if (res.code === 200) {
        wx.showToast({ title: '注册成功，已送1次体验', icon: 'success' });
        await this.loadMemberInfo();
        app.refreshAuthState();
      } else {
        wx.showToast({ title: res.msg || '注册失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '注册失败', icon: 'none' });
    }
  },

  noop() {},
  goHeight() { wx.navigateTo({ url: '/pages/height/height' }); },
  goLogin() { wx.switchTab({ url: '/pages/profile/profile' }); },

  onContact(e) {
    console.log('客服会话回调:', e.detail);
  },

  async onPullDownRefresh() {
    await this.refreshAll();
    wx.stopPullDownRefresh();
  }
});
