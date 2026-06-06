// 云函数：创建微信支付订单
// 调用微信支付统一下单接口，返回小程序调起支付所需参数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ======== 商户配置（需要替换为真实商户信息） ========
const MCH_CONFIG = {
  appId: '',          // 小程序 appId（云函数中可通过 cloud.getWXContext() 获取）
  mchId: '',          // 微信支付商户号
  apiKey: '',         // 微信支付 API 密钥（v2）
  // v3 配置（推荐）
  mchSerialNo: '',    // 商户证书序列号
  privateKey: '',     // 商户私钥（pem 格式）
  apiV3Key: ''        // API v3 密钥
};

// ======== 套餐配置 ========
const PLANS = {
  'month_10':    { name: '10次包',    amount: 1,   credits: 10,  desc: '10 次测身高' },
  'month_30':    { name: '30次包',    amount: 1,   credits: 30,  desc: '30 次测身高' },
  'month_100':   { name: '100次包',   amount: 1,   credits: 100, desc: '100 次测身高' },
  'week_5':      { name: '体验包',    amount: 1,   credits: 5,   desc: '5 次测身高' },
};

// 实际价格（单位：分）
const PLAN_AMOUNTS = {
  'week_5':      99,    // 0.99元
  'month_10':    199,   // 1.99元
  'month_30':    499,   // 4.99元
  'month_100':   999,   // 9.99元
};

exports.main = async (event, context) => {
  const { planId } = event; // 套餐 ID
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  const appId = wxContext.APPID;

  // 1. 参数校验
  if (!planId || !PLANS[planId]) {
    return { code: 400, msg: '无效的套餐' };
  }

  if (!openId) {
    return { code: 401, msg: '请先登录' };
  }

  const plan = PLANS[planId];
  const totalFee = PLAN_AMOUNTS[planId];

  // 2. 生成商户订单号
  const outTradeNo = 'SKY' + Date.now() + Math.random().toString(36).substr(2, 8);

  // 3. 检查商户配置
  if (!MCH_CONFIG.mchId || !MCH_CONFIG.apiKey || !MCH_CONFIG.appId) {
    // 未配置真实商户信息，使用云开发模拟支付（仅用于调试）
    console.warn('⚠️ 微信支付商户未配置，使用模拟模式');

    // 模拟订单：直接创建订单记录，状态 pending
    const orderData = {
      _openid: openId,
      outTradeNo: outTradeNo,
      planId: planId,
      planName: plan.name,
      credits: plan.credits,
      totalFee: totalFee,
      status: 'pending',     // pending | paid | cancelled
      createdAt: Date.now(),
      paidAt: null
    };

    try {
      const result = await db.collection('orders').add({ data: orderData });
      return {
        code: 200,
        msg: '模拟订单已创建（商户未配置）',
        data: {
          outTradeNo: outTradeNo,
          orderId: result._id,
          planName: plan.name,
          credits: plan.credits,
          totalFee: totalFee,
          mockMode: true
        }
      };
    } catch (err) {
      return { code: 500, msg: '创建订单失败：' + err.message };
    }
  }

  // ======== 以下是真实微信支付流程（商户配置完成后启用） ========

  try {
    // 4. 调用微信支付统一下单 API (v2)
    const crypto = require('crypto');
    const axios = require('axios');
    const parser = require('xml2js').parseString;

    const nonceStr = Math.random().toString(36).substr(2, 15);
    const spbillCreateIp = event.clientIp || '127.0.0.1';

    // 构造签名参数
    const signParams = {
      appid: appId,
      mch_id: MCH_CONFIG.mchId,
      nonce_str: nonceStr,
      body: `光遇工具箱-${plan.name}`,
      out_trade_no: outTradeNo,
      total_fee: totalFee,
      spbill_create_ip: spbillCreateIp,
      notify_url: 'https://your-domain.com/api/payment/callback', // 支付回调地址
      trade_type: 'JSAPI',
      openid: openId
    };

    // 生成签名
    const signStr = Object.keys(signParams).sort().map(k => k + '=' + signParams[k]).join('&') + '&key=' + MCH_CONFIG.apiKey;
    signParams.sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();

    // 构造 XML
    const xmlBody = '<xml>' + Object.keys(signParams).map(k => `<${k}>${signParams[k]}</${k}>`).join('') + '</xml>';

    // 调用微信支付接口
    const response = await axios.post('https://api.mch.weixin.qq.com/pay/unifiedorder', xmlBody, {
      headers: { 'Content-Type': 'text/xml' }
    });

    // 解析 XML 响应
    const result = await new Promise((resolve, reject) => {
      parser(response.data, { explicitArray: false }, (err, result) => {
        if (err) reject(err);
        else resolve(result.xml);
      });
    });

    if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') {
      return {
        code: 500,
        msg: result.err_code_des || result.return_msg || '支付接口调用失败'
      };
    }

    // 5. 保存订单到数据库
    const orderData = {
      _openid: openId,
      outTradeNo: outTradeNo,
      prepayId: result.prepay_id,
      planId: planId,
      planName: plan.name,
      credits: plan.credits,
      totalFee: totalFee,
      status: 'pending',
      createdAt: Date.now(),
      paidAt: null
    };

    await db.collection('orders').add({ data: orderData });

    // 6. 生成小程序调起支付参数
    const paySignParams = {
      appId: appId,
      timeStamp: String(Math.floor(Date.now() / 1000)),
      nonceStr: nonceStr,
      package: 'prepay_id=' + result.prepay_id,
      signType: 'MD5'
    };

    const paySignStr = Object.keys(paySignParams).sort().map(k => k + '=' + paySignParams[k]).join('&') + '&key=' + MCH_CONFIG.apiKey;
    paySignParams.paySign = crypto.createHash('md5').update(paySignStr).digest('hex').toUpperCase();

    return {
      code: 200,
      msg: '订单创建成功',
      data: {
        outTradeNo: outTradeNo,
        paymentParams: paySignParams,
        planName: plan.name,
        credits: plan.credits,
        totalFee: totalFee
      }
    };

  } catch (err) {
    console.error('微信支付下单失败:', err);
    return { code: 500, msg: '下单失败：' + err.message };
  }
};
