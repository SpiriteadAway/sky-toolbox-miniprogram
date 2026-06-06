const api = require('../../utils/api');
const auth = require('../../utils/auth');

Page({
  data: {
    isLoggedIn: false,
    codeValue: '',
    loading: false,
    result: null,
    error: '',
    inputFocus: true,
    historyList: [],
    showHistory: true,
    // 会员信息
    memberInfo: null,
    credits: 0
  },

  onLoad() {
    this.checkAuth();
    this.loadHistory();
    this.loadMemberInfo();
  },

  onShow() {
    this.checkAuth();
    this.loadHistory();
    this.loadMemberInfo();
  },

  checkAuth() {
    const isLoggedIn = auth.isLoggedIn();
    this.setData({ isLoggedIn });
  },

  async loadMemberInfo() {
    if (!this.data.isLoggedIn) return;
    try {
      const info = await auth.refreshMemberInfo();
      if (info) {
        this.setData({ memberInfo: info, credits: info.credits || 0 });
      }
    } catch (e) {}
  },

  loadHistory() {
    if (!this.data.isLoggedIn) {
      this.setData({ historyList: [] });
      return;
    }
    const history = auth.getHeightHistory();
    this.setData({ historyList: history.slice(0, 20) });
  },

  onInputChange(e) {
    this.setData({ codeValue: e.detail.value, error: '' });
  },

  onClear() {
    this.setData({ codeValue: '', result: null, error: '' });
  },

  async onSubmit() {
    const code = this.data.codeValue.trim();
    if (!code) {
      this.setData({ error: '请输入好友码' });
      return;
    }

    // 未登录 → 提示登录
    if (!this.data.isLoggedIn) {
      wx.showModal({
        title: '需要登录',
        content: '使用测身高功能需要先登录并注册会员。\n注册即送 1 次免费体验！',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/login' });
        }
      });
      return;
    }

    // 先查询 API，成功后再处理扣费
    this.setData({ loading: true, error: '', result: null });

    try {
      const res = await api.request(api.BASE_URL + '/api/sky/sc/dmsczb', { code });
      console.log('身高查询结果:', res);

      if (res.code === 200) {
        // 查询成功 → 统一调用 useCredit（免费模式自动放行）
        const creditResult = await auth.useCredit('height');

        if (!creditResult.allowed) {
          // 未登录、未注册或额度不足
          this.setData({ loading: false });
          if (creditResult.needLogin) {
            wx.showModal({
              title: '请先登录',
              content: creditResult.msg || '使用此功能需要先登录。',
              confirmText: '去登录',
              cancelText: '取消',
              success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/login/login' }); }
            });
            return;
          }
          wx.showModal({
            title: creditResult.needRegister ? '请先注册会员' : '额度不足',
            content: creditResult.msg || '请前往购买页面充值或联系管理员获取额度。',
            confirmText: '去处理',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) wx.switchTab({ url: '/pages/member/member' });
            }
          });
          return;
        }

        this.setData({ result: res, loading: false });
        this.loadMemberInfo();

        if (this.data.isLoggedIn) {
          auth.addHeightRecord(code, res);
          this.loadHistory();
        }

        wx.showToast({
          title: creditResult.freeMode ? '🧪 免费内测 · 查询成功' : '查询成功，已消耗 1 次',
          icon: 'none', duration: 2000
        });
      } else if (res.code === 201) {
        // 需要邀请码 → 不扣额度
        this.setData({
          error: '此接口需要邀请码激活\n\n请在游戏中右上角齿轮 → 好友\n找到「使用编号」\n复制粘贴进来后即可使用',
          loading: false
        });

      } else {
        // 接口返回异常 → 不扣额度
        this.setData({
          error: res.msg || '查询失败，请检查代码是否正确',
          loading: false
        });
      }
    } catch (err) {
      // 网络错误/超时 → 不扣额度
      console.error('查询出错:', err);
      const msg = err.message || err.errMsg || '网络请求失败';
      this.setData({
        error: (msg.includes('url not in domain list') ? '❌ 域名未配置白名单\n请在微信后台添加 https://api.t1qq.com' :
                msg.includes('timeout') ? '⏱ 请求超时，请重试' :
                msg.includes('fail') ? '📡 网络异常：' + msg :
                '😞 ' + msg),
        loading: false
      });
    }
  },

  onHistoryTap(e) {
    const record = e.currentTarget.dataset.record;
    if (record) {
      this.setData({
        codeValue: record.code,
        result: {
          msg: record.msg,
          url: record.url,
          time: record.time
        }
      });
      wx.pageScrollTo({ scrollTop: 0, duration: 300 });
    }
  },

  toggleHistory() {
    this.setData({ showHistory: !this.data.showHistory });
  },

  goLogin() {
    wx.switchTab({ url: '/pages/member/member' });
  }
});
