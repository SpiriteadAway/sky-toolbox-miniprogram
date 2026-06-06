// 云函数：queryGuangyi
// 代理光翼查询 API（绕过微信开发者工具代理限制）
const cloud = require('wx-server-sdk');
const http = require('http');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const API_HOST = 'sh-aliyun2.vincentzyu233.cn';
const API_PORT = 51024;
const API_PATH = '/queryGuangyi';

exports.main = async function (event, context) {
  const { id } = event;
  
  if (!id) {
    return { success: false, msg: '缺少光遇ID' };
  }

  return new Promise((resolve, reject) => {
    const url = `${API_PATH}?id=${encodeURIComponent(id)}`;
    
    const req = http.get({
      hostname: API_HOST,
      port: API_PORT,
      path: url,
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          // 透传 API 返回，保留原始错误信息
          if (data.error) {
            resolve({ success: false, msg: data.message || data.error, error: data.error, detail: data.detail || '' });
          } else {
            resolve(data);
          }
        } catch (e) {
          resolve({ success: false, msg: 'API返回数据解析失败' });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, msg: '查询失败: ' + err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, msg: '查询超时' });
    });
  });
};
