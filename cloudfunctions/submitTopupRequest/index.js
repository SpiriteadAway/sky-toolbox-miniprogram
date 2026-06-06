// 云函数：用户提交赞赏码充值申请
// 支持自动审批模式（autoApprove=true 时直接到账）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { amount, autoApprove, orderNote } = event;
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;

  if (!openId) {
    return { code: 401, msg: '请先登录' };
  }

  const payAmount = parseFloat(amount);
  if (!payAmount || payAmount <= 0) {
    return { code: 400, msg: '请输入有效的赞赏金额' };
  }

  // 根据金额计算赠送次数
  let credits;
  if (payAmount >= 9.99) credits = 100;
  else if (payAmount >= 4.99) credits = 30;
  else if (payAmount >= 1.99) credits = 10;
  else if (payAmount >= 0.99) credits = 5;
  else if (payAmount >= 0.5) credits = 3;
  else credits = 1;

  try {
    // 查找用户信息
    const memberResult = await db.collection('members').where({ _openid: openId }).get();
    
    if (memberResult.data.length === 0) {
      return { code: 404, msg: '未找到会员记录，请先注册' };
    }

    const member = memberResult.data[0];
    const nickName = member.nickName || '未知用户';
    const memberId = member._id;

    const now = Date.now();

    // 自动审批模式：直接加额度，不需要管理员介入
    if (autoApprove) {
      // 先加额度
      await db.collection('members').doc(memberId).update({
        data: {
          credits: _.inc(credits),
          updatedAt: now
        }
      });

      // 获取最新额度
      const updated = await db.collection('members').doc(memberId).get();
      const currentCredits = updated.data ? (updated.data.credits || 0) : credits;

      // 记录申请（已审批）
      const requestData = {
        _openid: openId,
        nickName: nickName,
        amount: payAmount,
        credits: credits,
        status: 'approved',
        note: '赞赏码自动到账',
        createdAt: now,
        updatedAt: now
      };
      await db.collection('topupRequests').add({ data: requestData });

      // 记录日志
      await db.collection('adminLogs').add({
        data: {
          action: 'autoApproveTopup',
          targetOpenId: openId,
          targetNickName: nickName,
          amount: payAmount,
          credits: credits,
          reason: '赞赏码自动到账',
          createdAt: now
        }
      });

      return {
        code: 200,
        msg: `赞赏到账成功！+${credits}次额度`,
        data: {
          amount: payAmount,
          credits: credits,
          status: 'approved',
          currentCredits: currentCredits,
          autoApproved: true
        }
      };
    }

    // 非自动审批模式：提交申请等待管理员审核
    const requestData = {
      _openid: openId,
      nickName: nickName,
      amount: payAmount,
      credits: credits,
      status: 'pending',
      note: orderNote || '',
      orderNo: orderNote || '',  // 订单号，管理员核对用
      createdAt: now,
      updatedAt: now
    };

    const result = await db.collection('topupRequests').add({ data: requestData });

    return {
      code: 200,
      msg: '充值申请已提交，等待管理员审核',
      data: {
        requestId: result._id,
        amount: payAmount,
        credits: credits,
        status: 'pending',
        currentCredits: member.credits || 0,
        autoApproved: false
      }
    };
  } catch (err) {
    console.error('提交充值失败:', err);
    return { code: 500, msg: '操作失败：' + err.message };
  }
};
