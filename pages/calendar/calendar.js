const api = require('../../utils/api');

Page({
  data: {
    imageSrc: '',
    loading: true,
    imageLoaded: false,
    error: '',
    debugInfo: ''
  },

  onLoad() {
    this.onLoadImage();
  },

  onLoadImage() {
    const that = this;
    that.setData({ 
      loading: true, 
      error: '', 
      imageLoaded: false, 
      imageSrc: '',
      debugInfo: ''
    });

    const url = api.getCalendarImageUrl();
    that.setData({ debugInfo: '正在请求: ' + url });

    wx.request({
      url: url,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 20000,
      success(res) {
        if (res.statusCode === 200 && res.data && res.data.byteLength > 100) {
          const enc = new Uint8Array(res.data);
          const isJPEG = enc[0] === 0xFF && enc[1] === 0xD8;
          const isPNG  = enc[0] === 0x89 && enc[1] === 0x50;
          const isGIF  = enc[0] === 0x47 && enc[1] === 0x49;
          
          if (isJPEG || isPNG || isGIF) {
            const base64 = wx.arrayBufferToBase64(res.data);
            const mime = isPNG ? 'image/png' : (isGIF ? 'image/gif' : 'image/jpeg');
            const dataUrl = `data:${mime};base64,${base64}`;
            
            that.setData({
              imageSrc: dataUrl,
              loading: false,
              debugInfo: '图片加载成功 (base64, ' + (base64.length / 1024).toFixed(0) + 'KB)'
            });
          } else {
            let text = '';
            for (let i = 0; i < Math.min(enc.length, 300); i++) {
              text += String.fromCharCode(enc[i]);
            }
            that.setData({
              error: '接口返回异常: ' + text,
              loading: false
            });
          }
        } else {
          that.setData({
            error: res.statusCode !== 200 ? `HTTP ${res.statusCode}` : '返回数据为空',
            loading: false
          });
        }
      },
      fail(err) {
        const msg = err.errMsg || err.message || '';
        that.setData({
          error: (msg.includes('url not in domain list') ? '❌ 域名未配置白名单\n请在微信后台添加 https://api.t1qq.com' :
                  msg.includes('timeout') ? '⏱ 请求超时，请重试' :
                  '📡 ' + msg),
          loading: false,
          debugInfo: ''
        });
      }
    });
  },

  onImageLoad() {
    this.setData({ imageLoaded: true, error: '' });
  },

  onImageError(e) {
    this.setData({ error: '图片渲染失败', imageLoaded: false });
  },

  onSaveImage() {
    if (!this.data.imageSrc) return;
    const fs = wx.getFileSystemManager();
    const filePath = wx.env.USER_DATA_PATH + '/save_calendar.jpg';
    const base64 = this.data.imageSrc.split(',')[1];
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
                title: '提示',
                content: '需要相册权限',
                success: (r) => { if (r.confirm) wx.openSetting(); }
              });
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          }
        });
      },
      fail: () => wx.showToast({ title: '写入失败', icon: 'none' })
    });
  }
});
