// 云函数：管理员给用户加额度
// 需要验证管理员身份
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 管理员密钥（建议后续改为环境变量或数据库存储）
const ADMIN_SECRET = 'xiaomoadmin';

exports.main = async (event, context) => {
  const { adminSecret, targetOpenId, targetNickName, amount, reason } = event;

  // 验证管理员身份
  if (!adminSecret || adminSecret !== ADMIN_SECRET) {
    return { code: 403, msg: '管理员验证失败' };
  }

  if (!amount || amount <= 0) {
    return { code: 400, msg: '请输入有效的额度数量' };
  }

  try {
    const membersCol = db.collection('members');
    let member;

    // 支持通过 openId 或昵称查找用户
    if (targetOpenId) {
      const result = await membersCol.where({ _openid: targetOpenId }).get();
      if (result.data.length === 0) {
        return { code: 404, msg: '未找到该用户' };
      }
      member = result.data[0];
    } else if (targetNickName) {
      const result = await membersCol.where({ nickName: targetNickName }).get();
      if (result.data.length === 0) {
        return { code: 404, msg: '未找到该用户' };
      }
      member = result.data[0];
    } else {
      return { code: 400, msg: '请指定用户' };
    }

    // 增加额度
    const now = Date.now();
    await membersCol.doc(member._id).update({
      data: {
        credits: _.inc(amount),
        updatedAt: now
      }
    });

    // 记录操作日志
    await db.collection('adminLogs').add({
      data: {
        action: 'addCredits',
        targetOpenId: member._openid,
        targetNickName: member.nickName,
        amount: amount,
        reason: reason || '管理员赠送',
        createdAt: now
      }
    });

    return {
      code: 200,
      msg: `成功给「${member.nickName}」增加 ${amount} 次额度`,
      data: {
        nickName: member.nickName,
        creditsBefore: member.credits || 0,
        creditsAfter: (member.credits || 0) + amount
      }
    };
  } catch (err) {
    console.error('管理员操作失败:', err);
    return { code: 500, msg: '操作失败：' + err.message };
  }
};
