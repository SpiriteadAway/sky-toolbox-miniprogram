const api = require('../../utils/api');

Page({
  data: {
    images: [],
    loading: true,
    error: '',
    failedImages: {}
  },

  onLoad() {
    this.fetchWeather();
  },

  fetchWeather() {
    this.setData({ loading: true, error: '', images: [] });

    this.setData({ failedImages: {} });

    api.request(api.BASE_URL + '/api/sky/gytq', {})
      .then(res => {
        console.log('天气结果:', res);
        if (res.code === 200 && res.data && res.data.length > 0) {
          this.setData({
            images: res.data,
            loading: false
          });
        } else {
          this.setData({
            error: res.msg || '暂无天气数据',
            loading: false
          });
        }
      })
      .catch(err => {
        console.error('天气查询出错:', err);
        const msg = err.message || err.errMsg || '网络请求失败';
        this.setData({
          error: (msg.includes('url not in domain list') ? '❌ 域名未配置白名单\n请在微信后台添加 https://api.t1qq.com' :
                  msg.includes('timeout') ? '⏱ 请求超时，请重试' :
                  '📡 ' + msg),
          loading: false
        });
      });
  },

  onImgError(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ [`failedImages.${index}`]: true });
  },

  retryImage(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ [`failedImages.${index}`]: false });
  }
});
