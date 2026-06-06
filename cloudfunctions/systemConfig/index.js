// 云函数：systemConfig
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ADMIN_SECRET = 'xiaomoadmin';
const CONFIG_ID = 'global_config';
const DEFAULT_FEATURES = { height: false, gift: false };

exports.main = async function (event, context) {
  const { action, adminSecret, feature, freeMode } = event;

  if (action === 'get') {
    try {
      const doc = await db.collection('system_config').doc(CONFIG_ID).get();
      return { code: 200, data: { freeFeatures: doc.data.freeFeatures || DEFAULT_FEATURES, updatedAt: doc.data.updatedAt || null } };
    } catch (e) {
      return { code: 200, data: { freeFeatures: DEFAULT_FEATURES, updatedAt: null } };
    }
  }

  if (action === 'toggleFeature') {
    if (adminSecret !== ADMIN_SECRET) return { code: 403, msg: '管理员验证失败' };
    if (!feature || typeof freeMode !== 'boolean') return { code: 400, msg: '参数错误' };

    try {
      // 先读现有配置
      let features;
      try {
        const doc = await db.collection('system_config').doc(CONFIG_ID).get();
        features = doc.data.freeFeatures || DEFAULT_FEATURES;
      } catch (e) {
        features = { ...DEFAULT_FEATURES };
      }

      // 修改
      features[feature] = freeMode;

      // 写回（set = upsert，不存在则创建）
      await db.collection('system_config').doc(CONFIG_ID).set({
        data: { freeFeatures: features, updatedAt: new Date().toISOString() }
      });

      return { code: 200, msg: '已更新', data: { feature, freeMode } };
    } catch (e) {
      return { code: 500, msg: '保存失败: ' + (e.message || '未知错误') };
    }
  }

  return { code: 400, msg: '无效操作' };
};
