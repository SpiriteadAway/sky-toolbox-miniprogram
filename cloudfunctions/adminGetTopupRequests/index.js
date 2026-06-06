// 云函数：管理员获取充值申请列表
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ADMIN_SECRET = 'xiaomoadmin';

exports.main = async (event, context) => {
  const { adminSecret, status, page = 1, pageSize = 20 } = event;

  if (!adminSecret || adminSecret !== ADMIN_SECRET) {
    return { code: 403, msg: '管理员验证失败' };
  }

  try {
    let query = db.collection('topupRequests');

    if (status) {
      query = query.where({ status });
    }

    const totalResult = await query.count();
    const total = totalResult.total;

    const result = await query
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return {
      code: 200,
      msg: '成功',
      data: {
        list: result.data,
        total,
        page,
        pageSize
      }
    };
  } catch (err) {
    console.error('获取充值申请失败:', err);
    return { code: 500, msg: '获取失败：' + err.message };
  }
};
