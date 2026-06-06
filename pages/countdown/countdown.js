const api = require('../../utils/api');

Page({
  data: {
    data: null,
    loading: true,
    error: ''
  },

  onLoad() {
    this.fetchCountdown();
  },

  fetchCountdown() {
    this.setData({ loading: true, error: '', data: null });

    api.request(api.BASE_URL + '/api/sky/sc/gf/djs', {})
      .then(res => {
        console.log('倒计时结果:', res);
        if (res.code === 200 && res.data) {
          this.setData({
            data: res.data,
            loading: false
          });
        } else {
          this.setData({
            error: res.msg || '获取数据失败',
            loading: false
          });
        }
      })
      .catch(err => {
        console.error('倒计时查询出错:', err);
        const msg = err.message || err.errMsg || '网络请求失败';
        this.setData({
          error: (msg.includes('url not in domain list') ? '❌ 域名未配置白名单\n请在微信后台添加 https://api.t1qq.com' :
                  msg.includes('timeout') ? '⏱ 请求超时，请重试' :
                  '📡 ' + msg),
          loading: false
        });
      });
  }
});
