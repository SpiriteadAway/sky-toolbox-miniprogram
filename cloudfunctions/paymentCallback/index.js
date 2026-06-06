// 云函数：支付回调处理
// 接收微信支付结果通知，更新用户额度
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { outTradeNo } = event;

  if (!outTradeNo) {
    return { code: 400, msg: '缺少订单号' };
  }

  try {
    // 1. 查找订单
    const orderResult = await db.collection('orders').where({ outTradeNo }).get();

    if (orderResult.data.length === 0) {
      return { code: 404, msg: '订单不存在' };
    }

    const order = orderResult.data[0];

    // 2. 防止重复处理
    if (order.status === 'paid') {
      return { code: 200, msg: '已处理，跳过' };
    }

    // 3. 更新订单状态
    await db.collection('orders').doc(order._id).update({
      data: {
        status: 'paid',
        paidAt: Date.now()
      }
    });

    // 4. 给用户增加额度
    const memberResult = await db.collection('members').where({ _openid: order._openid }).get();

    if (memberResult.data.length > 0) {
      const member = memberResult.data[0];
      const _ = db.command;
      await db.collection('members').doc(member._id).update({
        data: {
          credits: _.inc(order.credits),
          updatedAt: Date.now()
        }
      });
    }

    return {
      code: 200,
      msg: '额度充值成功',
      data: {
        credits: order.credits,
        outTradeNo
      }
    };
  } catch (err) {
    console.error('支付回调处理失败:', err);
    return { code: 500, msg: '处理失败：' + err.message };
  }
};
