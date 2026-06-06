const API_KEY = 'yQOWdbECiAUu9rBUscyz6zRvYh';
const BASE_URL = 'https://api.t1qq.com';

/**
 * 通用 GET 请求
 */
function request(url, params = {}) {
  params.key = API_KEY;
  const query = Object.keys(params)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${url}?${query}`,
      method: 'GET',
      timeout: 15000,
      success(res) {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(new Error(`请求失败: ${res.statusCode}`));
        }
      },
      fail(err) {
        reject(new Error(`网络错误: ${err.errMsg}`));
      }
    });
  });
}

/**
 * 获取每日任务图片 URL（直接返回图片链接）
 */
function getDailyTasksImageUrl() {
  return `${BASE_URL}/api/sky/sc/scrw?key=${API_KEY}`;
}

/**
 * 获取活动日历图片 URL
 */
function getCalendarImageUrl() {
  return `${BASE_URL}/api/sky/sc/hdrl?key=${API_KEY}`;
}

module.exports = {
  API_KEY,
  BASE_URL,
  request,
  getDailyTasksImageUrl,
  getCalendarImageUrl
};
