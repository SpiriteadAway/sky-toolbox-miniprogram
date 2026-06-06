const wingsLookup = require('../../data/wings_lookup');

const MAP_EMOJI = {
  '晨岛': '🌅', '云野': '☁️', '雨林': '🌿', '霞谷': '🏔️',
  '暮土': '🏜️', '禁阁': '🏛️', '暴风眼': '🌪️', '破晓季': '🌑', '狂欢船队': '🎪'
};
const MAP_ORDER = { '晨岛':1, '云野':2, '雨林':3, '霞谷':4, '暮土':5, '禁阁':6, '暴风眼':7, '破晓季':8, '狂欢船队':9 };

function emoji(map) { return MAP_EMOJI[map] || '📍'; }
function order(map) { return MAP_ORDER[map] || 50; }

// 配置总数
const TOTALS = { normal: 0, permNormal: 0, permTravel: 0 };
for (const info of Object.values(wingsLookup)) {
  if (info.type === 'normal') TOTALS.normal++;
  else if (info.map === '普通永久') TOTALS.permNormal++;
  else if (info.map === '复刻永久') TOTALS.permTravel++;
}

Page({
  data: {
    codeValue: '', loading: false, error: '', hasResult: false,
    normalCollected: 0, normalRate: 0, normalMaps: [], normalMissing: [],
    permNormalCollected: 0, permNormalRate: 0, permNormalTotal: TOTALS.permNormal,
    permTravelCollected: 0, permTravelRate: 0, permTravelTotal: TOTALS.permTravel, permTravelMissing: 0,
    permTotalCollected: 0, permTotalRate: 0
  },

  onLoad() {},

  onInputChange(e) { this.setData({ codeValue: e.detail.value, error: '' }); },

  onClear() {
    this.setData({
      codeValue: '', error: '', hasResult: false,
      normalCollected: 0, normalRate: 0, normalMaps: [], normalMissing: [],
      permNormalCollected: 0, permNormalRate: 0,
      permTravelCollected: 0, permTravelRate: 0, permTravelMissing: 0,
      permTotalCollected: 0, permTotalRate: 0
    });
  },

  async onSubmit() {
    const id = this.data.codeValue.trim();
    if (!id) { this.setData({ error: '请输入光遇ID' }); return; }
    this.setData({ loading: true, error: '' });
    try {
      const res = await wx.cloud.callFunction({ name: 'queryGuangyi', data: { id } });
      if (res.result?.success) {
        this.processResult(res.result);
      } else {
        // 尝试提取更具体的错误信息
        const errData = res.result;
        const msg = errData?.message || errData?.msg || errData?.error || '查询失败';
        throw new Error(msg);
      }
    } catch (err) {
      this.setData({ error: '查询失败: ' + (err.errMsg || err.message || '未知错误'), loading: false });
    }
  },

  processResult(apiRes) {
    try {
      const raw = JSON.parse(apiRes.data.result);
      const playerMap = {};
      (raw.wing_buffs || []).forEach(wb => { playerMap[wb.name] = wb.collected; });

      const normalByMap = {};
      let normalCollected = 0;
      const normalMissing = [];
      let permNormalCollected = 0, permTravelCollected = 0, permTravelMissing = 0;

      for (const [name, info] of Object.entries(wingsLookup)) {
        const collected = playerMap[name] === true;

        if (info.type === 'normal') {
          if (!normalByMap[info.map]) {
            normalByMap[info.map] = { map: info.map, emoji: emoji(info.map), total: 0, collected: 0 };
          }
          normalByMap[info.map].total++;
          if (collected) { normalCollected++; normalByMap[info.map].collected++; }
          if (!collected) normalMissing.push({ map: info.map, area: info.area });
        } else if (info.map === '普通永久') {
          if (collected) permNormalCollected++;
        } else if (info.map === '复刻永久') {
          if (collected) permTravelCollected++;
          else permTravelMissing++;
        }
      }

      const normalMaps = Object.values(normalByMap)
        .sort((a, b) => order(a.map) - order(b.map))
        .map(g => ({
          ...g,
          rateText: g.total > 0 ? (g.collected / g.total * 100).toFixed(0) : '0',
          rateWidth: g.total > 0 ? (g.collected / g.total * 100) : 0,
          isFull: g.collected === g.total
        }));

      // 未收集聚合
      const mg = {};
      normalMissing.forEach(m => {
        const k = m.area ? `${m.map} · ${m.area}` : m.map;
        if (!mg[k]) mg[k] = { map: m.map, area: m.area, emoji: emoji(m.map), count: 0 };
        mg[k].count++;
      });

      const pc = permNormalCollected + permTravelCollected;

      this.setData({
        hasResult: true,
        normalCollected, normalRate: Math.round(normalCollected / TOTALS.normal * 100),
        normalMaps,
        normalMissing: Object.values(mg).sort((a, b) => order(a.map) - order(b.map)),
        permNormalCollected, permNormalRate: Math.round(permNormalCollected / TOTALS.permNormal * 100),
        permTravelCollected, permTravelRate: Math.round(permTravelCollected / TOTALS.permTravel * 100),
        permTravelMissing,
        permTotalCollected: pc, permTotalRate: Math.round(pc / 132 * 100),
        loading: false, error: ''
      });
    } catch (e) {
      this.setData({ error: '数据解析失败', loading: false });
    }
  }
});
