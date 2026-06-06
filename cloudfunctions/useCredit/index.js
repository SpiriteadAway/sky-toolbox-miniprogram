// 云函数：消耗额度（测身高时调用）
// 返回剩余额度，额度不足时拒绝
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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
      return { code: 404, msg: '请先注册会员' };
    }

    const member = result.data[0];

    // 检查会员是否过期
    const now = Date.now();
    if (member.memberLevel !== 'free' && member.memberLevel !== 'lifetime') {
      if (member.memberExpireAt && member.memberExpireAt < now) {
        // 会员已过期，降级为免费
        await membersCol.doc(member._id).update({
          data: {
            memberLevel: 'free',
            memberExpireAt: 0,
            updatedAt: now
          }
        });
        member.memberLevel = 'free';
        member.credits = member.credits || 0;
      }
    }

    // 检查额度
    const currentCredits = member.credits || 0;

    if (currentCredits <= 0) {
      return {
        code: 402,
        msg: '额度不足',
        data: {
          credits: 0,
          memberLevel: member.memberLevel,
          hint: '请购买会员或等待管理员赠送额度'
        }
      };
    }

    // 消耗 1 次额度
    await membersCol.doc(member._id).update({
      data: {
        credits: _.inc(-1),
        totalQueries: _.inc(1),
        updatedAt: now
      }
    });

    return {
      code: 200,
      msg: '消耗成功',
      data: {
        credits: currentCredits - 1,
        totalQueries: (member.totalQueries || 0) + 1,
        memberLevel: member.memberLevel
      }
    };
  } catch (err) {
    console.error('消耗额度失败:', err);
    return { code: 500, msg: '操作失败：' + err.message };
  }
};
