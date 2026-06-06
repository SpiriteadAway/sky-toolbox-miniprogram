const auth = require('../../utils/auth');

Page({
  data: {
    isLoggedIn: false,
    profile: null,
    memberInfo: null
  },

  onLoad() {
    this.refreshState();
  },

  onShow() {
    this.refreshState();
  },

  async refreshState() {
    const isLoggedIn = auth.isLoggedIn();
    const memberInfo = auth.getMemberInfo();
    this.setData({
      isLoggedIn,
      profile: isLoggedIn ? auth.getProfile() : null,
      memberInfo
    });

    // 异步刷新会员信息
    if (isLoggedIn) {
      try {
        const info = await auth.refreshMemberInfo();
        if (info) this.setData({ memberInfo: info });
      } catch (e) {}
    }
  },

  goToMine() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  goToMember() {
    wx.switchTab({ url: '/pages/member/member' });
  }
});
