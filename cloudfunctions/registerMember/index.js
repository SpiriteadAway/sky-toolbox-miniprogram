// 云函数：注册会员
// 新用户注册后获得 1 次免费额度
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { nickName, avatarPath } = event;
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;

  if (!openId) {
    return { code: 401, msg: '获取用户身份失败' };
  }

  try {
    const membersCol = db.collection('members');

    // 检查是否已注册
    const existResult = await membersCol.where({ _openid: openId }).get();
    if (existResult.data.length > 0) {
      const member = existResult.data[0];
      return {
        code: 200,
        msg: '已注册',
        data: {
          _id: member._id,
          credits: member.credits,
          totalQueries: member.totalQueries || 0,
          createdAt: member.createdAt
        }
      };
    }

    // 新用户注册，赠送 1 次额度
    const now = Date.now();
    const result = await membersCol.add({
      data: {
        _openid: openId,
        nickName: nickName || '光之子',
        avatarPath: avatarPath || '',
        credits: 1,              // 新用户 1 次免费体验
        totalQueries: 0,
        memberLevel: 'free',     // free | month | year | lifetime
        memberExpireAt: 0,
        createdAt: now,
        updatedAt: now
      }
    });

    return {
      code: 200,
      msg: '注册成功，已赠送 1 次体验额度',
      data: {
        _id: result._id,
        credits: 1,
        totalQueries: 0,
        createdAt: now
      }
    };
  } catch (err) {
    console.error('注册会员失败:', err);
    return { code: 500, msg: '注册失败：' + err.message };
  }
};
