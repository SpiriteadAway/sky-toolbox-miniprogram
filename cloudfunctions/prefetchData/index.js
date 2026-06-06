// 云函数：数据预拉取
// 微信在小程序冷启动时调用此函数，提前获取数据并缓存到本地
// 配置路径：MP后台 → 开发管理 → 开发设置 → 数据预加载 → 填写此云函数名
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  // event 包含微信预拉取请求的参数：
  //   appid, token/code, timestamp, path, query, scene
  // 其中 token 由 wx.setBackgroundFetchToken() 设置
  // code 在未设置 token 时由微信生成
  
  const { token } = event;
  const wxContext = cloud.getWXContext();
  
  // 优先用 token（客户端设置的 openId），其次用 cloud context
  let openId = token || wxContext.OPENID;

  console.log('prefetchData 被调用, openId:', openId, 'path:', event.path);

  try {
    // 1. 获取会员信息
    let memberInfo = null;
    if (openId) {
      const memberResult = await db.collection('members')
        .where({ _openid: openId })
        .get();
      
      if (memberResult.data.length > 0) {
        const m = memberResult.data[0];
        memberInfo = {
          registered: true,
          nickName: m.nickName,
          credits: m.credits || 0,
          totalQueries: m.totalQueries || 0,
          memberLevel: m.memberLevel || 'free',
          memberExpireAt: m.memberExpireAt || 0
        };
      } else {
        memberInfo = {
          registered: false,
          credits: 0,
          totalQueries: 0,
          memberLevel: 'free',
          memberExpireAt: 0
        };
      }
    }

    // 2. 组合返回数据
    const data = {
      openId: openId,
      memberInfo: memberInfo,
      prefetchTime: Date.now(),
      version: '1.0.0'
    };

    // 3. 返回字符串（微信要求返回 HTTP body 为字符串，不超过 256KB）
    return JSON.stringify(data);

  } catch (err) {
    console.error('prefetchData 失败:', err);
    // 返回最小数据，不阻塞启动
    return JSON.stringify({
      openId: openId,
      memberInfo: null,
      prefetchTime: Date.now(),
      error: err.message
    });
  }
};
