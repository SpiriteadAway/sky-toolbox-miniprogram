// 云函数：初始化数据库集合
// 在微信开发者工具中运行一次即可创建所需集合
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    // 尝试创建集合（如果已存在会失败但不影响）
    const results = [];

    const collections = ['members', 'adminLogs', 'topupRequests', 'orders'];
    for (const name of collections) {
      try {
        await db.createCollection(name);
        results.push(name + ' 集合已创建');
      } catch (e) {
        results.push(name + ' 集合: ' + (e.errCode === -1 ? '已存在' : e.message));
      }
    }

    return {
      code: 200,
      msg: '初始化完成',
      data: results
    };
  } catch (err) {
    return { code: 500, msg: '初始化失败：' + err.message };
  }
};
