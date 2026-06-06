// 云函数：管理员登录验证
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ADMIN_SECRET = '***';

exports.main = async (event, context) => {
  const { adminSecret } = event;

  if (!adminSecret) {
    return { code: 400, msg: '请输入管理员密钥' };
  }

  if (adminSecret !== ADMIN_SECRET) {
    return { code: 403, msg: '密钥错误' };
  }

  return {
    code: 200,
    msg: '验证成功',
    data: {
      token: 'admin_' + Date.now().toString(36),
      expireAt: Date.now() + 24 * 60 * 60 * 1000 // 24小时有效
    }
  };
};
