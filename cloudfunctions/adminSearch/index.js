// 云函数：管理员搜索用户
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ADMIN_SECRET = 'xiaomoadmin';

exports.main = async (event, context) => {
  const { adminSecret, keyword, page = 1, pageSize = 20 } = event;

  if (!adminSecret || adminSecret !== ADMIN_SECRET) {
    return { code: 403, msg: '管理员验证失败' };
  }

  try {
    const membersCol = db.collection('members');
    let query = membersCol;

    if (keyword && keyword.trim()) {
      const kw = keyword.trim();
      // 搜索昵称或 openId（前缀匹配）
      query = membersCol.where({
        nickName: db.RegExp({
          regexp: kw,
          options: 'i'
        })
      });
    }

    const totalResult = await (keyword ? query : membersCol).count();
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
    console.error('搜索用户失败:', err);
    return { code: 500, msg: '搜索失败：' + err.message };
  }
};
