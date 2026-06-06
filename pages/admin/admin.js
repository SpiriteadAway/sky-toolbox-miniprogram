// 管理后台：用户额度管理 + 赞赏充值审批

const FEATURE_LABELS = {
  height: { name: '身高查询', emoji: '📏' },
  gift: { name: '礼包查询', emoji: '🎁' }
};

Page({
  data: {
    isAdmin: false,
    adminSecret: '',

    // Tab 切换
    activeTab: 'users', // 'users' | 'topup' | 'settings'

    // ===== 系统设置 =====
    freeFeatures: { height: false, gift: false },
    freeFeatureLoading: '',

    // ===== 用户管理 =====
    searchKeyword: '',
    searchResult: null,
    searchError: '',
    searching: false,
    selectedUser: null,
    addAmount: 5,
    addReason: '管理员赠送',
    adding: false,
    addResult: null,
    quickAmounts: [1, 3, 5, 10, 20, 50],

    // ===== 充值审批 =====
    topupList: [],
    topupLoading: false,
    topupFilter: 'pending', // pending | all
    topupTotal: 0,
    approving: null, // 当前审批中的 requestId
    topupError: ''
  },

  onLoad() {
    const adminToken = wx.getStorageSync('sky_admin_token');
    if (adminToken) {
      this.setData({ isAdmin: true });
      this.loadTopupRequests();
    }
  },

  // ========== 管理员登录 ==========
  onSecretInput(e) {
    this.setData({ adminSecret: e.detail.value });
  },

  async handleAdminLogin() {
    const secret = this.data.adminSecret.trim();
    if (!secret) {
      wx.showToast({ title: '请输入管理员密钥', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '验证中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminLogin',
        data: { adminSecret: secret }
      });
      wx.hideLoading();
      if (res.result.code === 200) {
        wx.setStorageSync('sky_admin_token', res.result.data.token);
        this.setData({ isAdmin: true, adminSecret: '' });
        this.loadTopupRequests();
        wx.showToast({ title: '管理员验证成功', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.msg || '密钥错误', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  // ========== Tab 切换 ==========
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'topup') this.loadTopupRequests();
    if (tab === 'settings') this.loadSystemConfig();
  },

  // ========== 用户管理 ==========
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  async handleSearch() {
    const keyword = this.data.searchKeyword.trim();
    this.setData({ searching: true, searchResult: null, searchError: '', selectedUser: null });

    try {
      const res = await wx.cloud.callFunction({
        name: 'adminSearch',
        data: {
          adminSecret: 'xiaomoadmin',
          keyword: keyword || undefined,
          pageSize: 30
        }
      });

      if (res.result.code === 200) {
        this.setData({ searchResult: res.result.data, searching: false });
      } else {
        this.setData({ searchError: res.result.msg || '搜索失败', searching: false });
      }
    } catch (err) {
      this.setData({ searching: false, searchError: '搜索失败：' + (err.message || '网络错误') });
    }
  },

  onSelectUser(e) {
    const user = e.currentTarget.dataset.user;
    this.setData({ selectedUser: user, addResult: null });
  },

  onClearSelection() {
    this.setData({ selectedUser: null, addResult: null });
  },

  onQuickAmount(e) {
    this.setData({ addAmount: e.currentTarget.dataset.amount });
  },

  onAmountInput(e) {
    const v = parseInt(e.detail.value) || 0;
    this.setData({ addAmount: Math.max(1, Math.min(999, v)) });
  },

  onReasonInput(e) {
    this.setData({ addReason: e.detail.value });
  },

  async handleAddCredits() {
    const { selectedUser, addAmount, addReason } = this.data;
    if (!selectedUser) {
      wx.showToast({ title: '请先搜索并选择用户', icon: 'none' });
      return;
    }
    if (addAmount <= 0) {
      wx.showToast({ title: '请输入有效额度', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认赠送额度',
      content: `确认给「${selectedUser.nickName}」赠送 ${addAmount} 次额度吗？\n当前额度：${selectedUser.credits || 0} 次`,
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        this.setData({ adding: true, addResult: null });

        try {
          const res = await wx.cloud.callFunction({
            name: 'adminAddCredits',
            data: {
              adminSecret: 'xiaomoadmin',
              targetOpenId: selectedUser._openid,
              amount: addAmount,
              reason: addReason || '管理员赠送'
            }
          });

          this.setData({ adding: false });
          if (res.result.code === 200) {
            this.setData({
              addResult: { success: true, msg: res.result.msg, detail: res.result.data },
              selectedUser: { ...selectedUser, credits: res.result.data.creditsAfter }
            });
            wx.showToast({ title: '赠送成功', icon: 'success' });
            this.handleSearch();
          } else {
            this.setData({ addResult: { success: false, msg: res.result.msg } });
            wx.showToast({ title: res.result.msg, icon: 'none' });
          }
        } catch (err) {
          this.setData({ adding: false, addResult: { success: false, msg: '操作失败：' + (err.message || '网络错误') } });
        }
      }
    });
  },

  // ========== 充值审批 ==========
  async loadTopupRequests() {
    this.setData({ topupLoading: true, topupError: '' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminGetTopupRequests',
        data: {
          adminSecret: 'xiaomoadmin',
          status: this.data.topupFilter === 'pending' ? 'pending' : undefined,
          pageSize: 50
        }
      });
      if (res.result.code === 200) {
        this.setData({
          topupList: res.result.data.list,
          topupTotal: res.result.data.total,
          topupLoading: false
        });
      } else {
        this.setData({ topupError: res.result.msg, topupLoading: false });
      }
    } catch (err) {
      this.setData({ topupLoading: false, topupError: '加载失败：' + (err.message || '网络错误') });
    }
  },

  onTopupFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ topupFilter: filter });
    this.loadTopupRequests();
  },

  async handleApprove(e) {
    const request = e.currentTarget.dataset.request;
    const orderInfo = (request.orderNo || request.note) ? '\n订单号：' + (request.orderNo || request.note) : '';
    wx.showModal({
      title: '确认审批',
      content: `通过「${request.nickName}」的赞赏充值？\n赞赏 ¥${request.amount} → +${request.credits} 次${orderInfo}`,
      confirmText: '通过',
      cancelText: '取消',
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        this.setData({ approving: request._id });
        try {
          const res = await wx.cloud.callFunction({
            name: 'approveTopup',
            data: {
              adminSecret: 'xiaomoadmin',
              requestId: request._id,
              action: 'approve'
            }
          });
          this.setData({ approving: null });
          if (res.result.code === 200) {
            wx.showToast({ title: '审批通过！额度已发放', icon: 'success' });
            this.loadTopupRequests();
          } else {
            wx.showToast({ title: res.result.msg, icon: 'none' });
          }
        } catch (err) {
          this.setData({ approving: null });
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  async handleReject(e) {
    const request = e.currentTarget.dataset.request;
    wx.showModal({
      title: '拒绝申请',
      content: `确认拒绝「${request.nickName}」的充值申请？`,
      confirmText: '拒绝',
      confirmColor: '#ef4444',
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        this.setData({ approving: request._id });
        try {
          const res = await wx.cloud.callFunction({
            name: 'approveTopup',
            data: {
              adminSecret: 'xiaomoadmin',
              requestId: request._id,
              action: 'reject',
              note: '管理员拒绝'
            }
          });
          this.setData({ approving: null });
          if (res.result.code === 200) {
            wx.showToast({ title: '已拒绝', icon: 'success' });
            this.loadTopupRequests();
          } else {
            wx.showToast({ title: res.result.msg, icon: 'none' });
          }
        } catch (err) {
          this.setData({ approving: null });
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  // ========== 系统设置 ==========
  async loadSystemConfig() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'systemConfig',
        data: { action: 'get' }
      });
      if (res.result.code === 200) {
        this.setData({ freeFeatures: res.result.data.freeFeatures || {} });
      }
    } catch (err) {
      console.error('加载系统配置失败', err);
    }
  },

  async toggleFeatureFree(e) {
    const feature = e.currentTarget.dataset.feature;
    const current = this.data.freeFeatures[feature] || false;
    const newVal = !current;

    wx.showModal({
      title: newVal ? '开启免费' : '关闭免费',
      content: newVal
        ? `开启后，「${FEATURE_LABELS[feature].name}」将免费使用，不消耗额度。`
        : `关闭后，「${FEATURE_LABELS[feature].name}」恢复正常扣费。`,
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        this.setData({ freeFeatureLoading: feature });
        try {
          const res = await wx.cloud.callFunction({
            name: 'systemConfig',
            data: { action: 'toggleFeature', adminSecret: 'xiaomoadmin', feature, freeMode: newVal }
          });
          if (res.result.code === 200) {
            const freeFeatures = { ...this.data.freeFeatures, [feature]: newVal };
            this.setData({ freeFeatures });
            wx.showToast({ title: newVal ? '已开启免费' : '已关闭免费', icon: 'success' });
          } else {
            wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
        this.setData({ freeFeatureLoading: '' });
      }
    });
  },

  // ========== 通用 ==========
  handleLogout() {
    wx.removeStorageSync('sky_admin_token');
    this.setData({
      isAdmin: false,
      searchResult: null,
      selectedUser: null,
      addResult: null,
      searchKeyword: '',
      topupList: []
    });
    wx.showToast({ title: '已退出管理后台', icon: 'success' });
  },

  async handleGetMyOpenId() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenId' });
      const openId = res.result.openid || '获取失败';
      wx.showModal({
        title: '你的 openId',
        content: openId,
        showCancel: false,
        confirmText: '复制',
        success: () => {
          wx.setClipboardData({ data: openId, success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
        }
      });
    } catch (err) {
      wx.showToast({ title: '获取失败', icon: 'none' });
    }
  }
});
