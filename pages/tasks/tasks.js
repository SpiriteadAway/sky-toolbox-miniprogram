// 每日任务 - 应天API 直出
const IMG_URL = 'https://api.t1qq.com/api/sky/gy/sc/scsky.php';

Page({
  data: { imageSrc: '', loading: true, error: '' },
  onLoad() { this.load(); },

  load() {
    this.setData({ loading: true, error: '' });
    wx.request({
      url: IMG_URL, method: 'GET', responseType: 'arraybuffer', timeout: 20000,
      success: res => {
        if (res.statusCode === 200 && res.data && res.data.byteLength > 100) {
          this.setData({ imageSrc: 'data:image/jpeg;base64,' + wx.arrayBufferToBase64(res.data), loading: false });
        } else {
          this.setData({ error: `HTTP ${res.statusCode}`, loading: false });
        }
      },
      fail: err => this.setData({ error: '📡 网络错误', loading: false })
    });
  },

  save() {
    if (!this.data.imageSrc) return;
    const fs = wx.getFileSystemManager();
    const fp = wx.env.USER_DATA_PATH + '/task.jpg';
    fs.writeFile({
      filePath: fp, data: wx.base64ToArrayBuffer(this.data.imageSrc.split(',')[1]),
      success: () => wx.saveImageToPhotosAlbum({
        filePath: fp,
        success: () => wx.showToast({ title: '已保存', icon: 'success' }),
        fail: e => { if (e.errMsg.includes('auth deny')) wx.showModal({ title: '需要相册权限', confirmText: '去设置', success: r => { if (r.confirm) wx.openSetting(); } }); }
      })
    });
  }
});
