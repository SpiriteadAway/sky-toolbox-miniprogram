// 云函数：获取会员信息
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;

  if (!openId) {
    return { code: 401, msg: '请先登录' };
  }

  try {
    const membersCol = db.collection('members');
    const result = await membersCol.where({ _openid: openId }).get();

    if (result.data.length === 0) {
      return {
        code: 200,
        msg: '未注册',
        data: {
          registered: false,
          credits: 0,
          totalQueries: 0,
          memberLevel: 'free',
          memberExpireAt: 0
        }
      };
    }

    const member = result.data[0];

    // 检查会员过期
    const now = Date.now();
    if (member.memberLevel !== 'free' && member.memberLevel !== 'lifetime') {
      if (member.memberExpireAt && member.memberExpireAt < now) {
        await membersCol.doc(member._id).update({
          data: {
            memberLevel: 'free',
            memberExpireAt: 0,
            updatedAt: now
          }
        });
        member.memberLevel = 'free';
        member.memberExpireAt = 0;
      }
    }

    return {
      code: 200,
      msg: '成功',
      data: {
        registered: true,
        _id: member._id,
        nickName: member.nickName,
        credits: member.credits || 0,
        totalQueries: member.totalQueries || 0,
        memberLevel: member.memberLevel || 'free',
        memberExpireAt: member.memberExpireAt || 0,
        createdAt: member.createdAt
      }
    };
  } catch (err) {
    console.error('获取会员信息失败:', err);
    return { code: 500, msg: '获取失败：' + err.message };
  }
};
