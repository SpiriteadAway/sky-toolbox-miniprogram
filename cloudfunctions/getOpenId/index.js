// 云函数：getOpenId
// 返回当前用户的微信 openId
// 部署后在云端运行，无需手动传 AppSecret
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async function (event, context) {
  var wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID || ''
  };
};
