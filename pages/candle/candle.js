const api = require('../../utils/api');

Page({
  data: {
    // 0 = 大蜡烛, 1 = 季蜡
    tabIndex: 0,
    tabs: [
      { name: '每日大蜡烛', icon: '🕯️', key: 'scdl' },
      { name: '季节蜡烛', icon: '✨', key: 'scjl' }
    ],

    // 双缓存：分别存两张图
    images: ['', ''],
    loading: [true, true],
    errors: ['', ''],
    loaded: [false, false]
  },

  onLoad() {
    this.loadImage(0);
    this.loadImage(1);
  },

  /**
   * 加载图片（从 API 直接获取二进制图片数据）
   */
  loadImage(tabIdx) {
    const key = this.data.tabs[tabIdx].key;
    const url = api.BASE_URL + '/api/sky/sc/' + key + '?key=' + api.API_KEY;

    // 更新 loading 状态
    const loading = [...this.data.loading];
    loading[tabIdx] = true;
    this.setData({ loading });

    wx.request({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 20000,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.byteLength > 100) {
          const enc = new Uint8Array(res.data);
          const isJPEG = enc[0] === 0xFF && enc[1] === 0xD8;
          const isPNG  = enc[0] === 0x89 && enc[1] === 0x50;
          const isGIF  = enc[0] === 0x47 && enc[1] === 0x49;

          if (isJPEG || isPNG || isGIF) {
            const base64 = wx.arrayBufferToBase64(res.data);
            const mime = isPNG ? 'image/png' : (isGIF ? 'image/gif' : 'image/jpeg');
            const dataUrl = `data:${mime};base64,${base64}`;

            const images = [...this.data.images];
            images[tabIdx] = dataUrl;
            const loading = [...this.data.loading];
            loading[tabIdx] = false;
            const loaded = [...this.data.loaded];
            loaded[tabIdx] = true;
            const errors = [...this.data.errors];
            errors[tabIdx] = '';

            this.setData({ images, loading, loaded, errors });
          } else {
            const loading = [...this.data.loading];
            loading[tabIdx] = false;
            const errors = [...this.data.errors];
            errors[tabIdx] = '接口返回非图片数据';
            this.setData({ loading, errors });
          }
        } else {
          const loading = [...this.data.loading];
          loading[tabIdx] = false;
          const errors = [...this.data.errors];
          errors[tabIdx] = res.statusCode === 201
            ? '此接口需要邀请码激活\n请在游戏中右上角齿轮 → 好友\n找到「使用编号」粘贴后使用'
            : `HTTP ${res.statusCode}`;
          this.setData({ loading, errors });
        }
      },
      fail: (err) => {
        const msg = err.errMsg || err.message || '';
        const loading = [...this.data.loading];
        loading[tabIdx] = false;
        const errors = [...this.data.errors];
        errors[tabIdx] = msg.includes('timeout') ? '⏱ 请求超时，请重试' :
                         msg.includes('fail') ? '📡 网络异常' : msg;
        this.setData({ loading, errors });
      }
    });
  },

  /**
   * 切换 Tab
   */
  switchTab(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    this.setData({ tabIndex: idx });
  },

  /**
   * 图片加载完成
   */
  onImageLoad(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    const loaded = [...this.data.loaded];
    loaded[idx] = true;
    this.setData({ loaded });
  },

  /**
   * 预览图片
   */
  onPreview() {
    const url = this.data.images[this.data.tabIndex];
    if (url) {
      wx.previewImage({ urls: [url], current: url });
    }
  },

  /**
   * 保存图片
   */
  onSave() {
    const url = this.data.images[this.data.tabIndex];
    if (!url) return;

    const fs = wx.getFileSystemManager();
    const filePath = wx.env.USER_DATA_PATH + '/candle_' + Date.now() + '.jpg';
    const base64 = url.split(',')[1];
    const buffer = wx.base64ToArrayBuffer(base64);
    fs.writeFile({
      filePath,
      data: buffer,
      success: () => {
        wx.saveImageToPhotosAlbum({
          filePath,
          success: () => wx.showToast({ title: '保存成功', icon: 'success' }),
          fail: (err) => {
            if (err.errMsg.includes('auth deny')) {
              wx.showModal({
                title: '需要相册权限',
                content: '请在设置中允许保存图片',
                success: (r) => { if (r.confirm) wx.openSetting(); }
              });
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          }
        });
      },
      fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
    });
  },

  /**
   * 重试加载
   */
  onRetry(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    const errors = [...this.data.errors];
    errors[idx] = '';
    this.setData({ errors });
    this.loadImage(idx);
  }
});
