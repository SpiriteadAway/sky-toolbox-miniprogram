// 云函数：管理员审批赞赏码充值申请
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const ADMIN_SECRET = 'xiaomoadmin';

exports.main = async (event, context) => {
  const { adminSecret, requestId, action, note } = event; // action: 'approve' | 'reject'

  if (!adminSecret || adminSecret !== ADMIN_SECRET) {
    return { code: 403, msg: '管理员验证失败' };
  }

  if (!requestId) {
    return { code: 400, msg: '缺少申请 ID' };
  }

  try {
    // 查找申请
    const reqResult = await db.collection('topupRequests').doc(requestId).get();
    if (!reqResult.data) {
      return { code: 404, msg: '申请不存在' };
    }

    const topupReq = reqResult.data;

    if (topupReq.status !== 'pending') {
      return { code: 400, msg: '该申请已处理过' };
    }

    const now = Date.now();

    if (action === 'approve') {
      // 审批通过：给用户加额度
      const memberResult = await db.collection('members').where({ _openid: topupReq._openid }).get();

      if (memberResult.data.length > 0) {
        const member = memberResult.data[0];
        await db.collection('members').doc(member._id).update({
          data: {
            credits: _.inc(topupReq.credits),
            updatedAt: now
          }
        });
      }

      // 更新申请状态
      await db.collection('topupRequests').doc(requestId).update({
        data: {
          status: 'approved',
          note: note || '已审批',
          updatedAt: now
        }
      });

      // 记录日志
      await db.collection('adminLogs').add({
        data: {
          action: 'approveTopup',
          targetOpenId: topupReq._openid,
          targetNickName: topupReq.nickName,
          amount: topupReq.amount,
          credits: topupReq.credits,
          reason: '赞赏码充值审批',
          createdAt: now
        }
      });

      return {
        code: 200,
        msg: `已通过「${topupReq.nickName}」的赞赏充值，+${topupReq.credits}次`,
        data: {
          credits: topupReq.credits,
          nickName: topupReq.nickName
        }
      };
    } else if (action === 'reject') {
      // 拒绝
      await db.collection('topupRequests').doc(requestId).update({
        data: {
          status: 'rejected',
          note: note || '已拒绝',
          updatedAt: now
        }
      });

      return {
        code: 200,
        msg: `已拒绝「${topupReq.nickName}」的充值申请`,
        data: { nickName: topupReq.nickName }
      };
    } else {
      return { code: 400, msg: '无效操作' };
    }
  } catch (err) {
    console.error('审批失败:', err);
    return { code: 500, msg: '审批失败：' + err.message };
  }
};
