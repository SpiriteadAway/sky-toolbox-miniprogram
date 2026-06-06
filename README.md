# 🕊️ Sky小精灵 — 光遇工具箱

微信小程序，为《光·遇》（Sky: Children of the Light）玩家提供一站式实用工具。

## ✨ 功能

| 模块 | 说明 |
|---|---|
| 🏠 **首页** | 功能入口导航，快捷跳转 |
| 👤 **身高测量** | 上传角色截图，AI 测身高（消耗额度） |
| 🎁 **礼包查询** | 查询已复刻/未复刻礼包信息 |
| 📋 **每日任务** | 查看当天任务、大蜡烛、季节蜡烛位置 |
| 🕯️ **蜡烛位置** | 每日大蜡烛 + 季节蜡烛分布图 |
| 🌤️ **天气预报** | 红石/黑石天气预测图 |
| 🗺️ **光翼查询** | 输入光遇 ID 查询光翼收集进度（普通 126 + 永久 132） |
| ⏳ **倒计时** | 活动/复刻倒计时 |
| 📅 **活动日历** | 当月活动日程图 |
| 👑 **会员中心** | 购买额度，解锁更多查询次数 |
| 🔧 **管理后台** | 用户额度管理 + 赞赏充值审批 |

## 🏗️ 技术栈

- **前端**：微信小程序原生框架（WXML + WXSS + JS）
- **后端**：微信云开发（CloudBase）
  - 云函数：Node.js
  - 数据库：云开发数据库
  - 数据预拉取
- **第三方 API**：[应天 API](https://api.t1qq.com/user/register?cps=zjXCv8z) 提供游戏数据

## 📁 项目结构

```
sky-toolbox/
├── pages/                  # 页面
│   ├── index/              # 首页
│   ├── height/             # 身高测量
│   ├── gift/               # 礼包查询
│   ├── tasks/              # 每日任务
│   ├── candle/             # 蜡烛位置
│   ├── weather/            # 天气预报
│   ├── guangyi/            # 光翼查询
│   ├── countdown/          # 倒计时
│   ├── calendar/           # 活动日历
│   ├── member/             # 会员中心
│   ├── login/              # 登录
│   ├── profile/            # 个人中心
│   └── admin/              # 管理后台
├── cloudfunctions/         # 云函数
│   ├── getOpenId/          # 获取 OpenID
│   ├── registerMember/     # 注册会员
│   ├── useCredit/          # 消耗额度
│   ├── createOrder/        # 创建支付订单
│   ├── paymentCallback/    # 支付回调
│   ├── queryGuangyi/       # 光翼查询代理
│   ├── prefetchData/       # 数据预拉取
│   ├── systemConfig/       # 系统配置
│   ├── initDb/             # 初始化数据库
│   ├── adminLogin/         # 管理员登录
│   ├── adminSearch/        # 用户搜索
│   ├── adminAddCredits/    # 添加额度
│   ├── submitTopupRequest/ # 提交充值申请
│   ├── approveTopup/       # 审批充值
│   └── adminGetTopupRequests/ # 充值列表
├── data/
│   └── wings_lookup.js     # 光翼数据（258 个光翼）
├── utils/
│   ├── api.js              # API 请求封装
│   ├── auth.js             # 用户认证
│   ├── qr.js               # 二维码生成
│   └── adapt.js            # 适配工具
├── images/                 # 图标资源
├── app.js / app.json / app.wxss  # 应用入口
└── project.config.json     # 项目配置
```

## 🚀 快速开始

### 1. 环境准备

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 微信小程序 AppID（[注册](https://mp.weixin.qq.com/)）
- 开通云开发（CloudBase）

### 2. 克隆项目

```bash
git clone https://github.com/SpiriteadAway/sky-toolbox-miniprogram.git
```

### 3. 配置密钥

在项目根目录编辑以下文件，将占位符替换为真实值：

**`utils/api.js`**
```js
const API_KEY = '你的应天API密钥';  // 从 https://api.t1qq.com 获取
```

**`project.config.json`**
```json
"appid": "你的小程序AppID"
```

**`cloudfunctions/adminLogin/index.js`**
```js
const ADMIN_SECRET = '你的管理员密钥';
```

**`cloudfunctions/createOrder/index.js`**
```js
const MCH_CONFIG = {
  mchId: '你的商户号',
  apiKey: '你的微信支付API密钥',
  appId: '你的AppID',
  ...
};
```

### 4. 初始化云开发

1. 微信开发者工具中打开项目
2. 点击「云开发」开通环境
3. 修改 `app.js` 中的云环境 ID：
   ```js
   wx.cloud.init({ env: '你的云环境ID' });
   ```
4. 右键 `cloudfunctions/initDb` → 上传并部署 → 云端运行一次，初始化数据库集合
5. 逐个右键上传所有云函数

### 5. 配置服务器域名

微信后台 `开发 → 开发管理 → 服务器域名` 添加：

| 类型 | 域名 |
|---|---|
| request 合法域名 | `https://api.t1qq.com` |
| downloadFile 合法域名 | `https://ok.166.net`（天气图片 CDN） |

### 6. 预览运行

微信开发者工具点击「预览」，扫码体验。

## 📝 使用说明

### 身高测量
1. 在游戏中截取角色正面站立图
2. 上传截图 → AI 识别 → 返回身高值
3. 每测量一次消耗 1 个额度

### 光翼查询
1. 输入游戏内光遇 ID
2. 点击查询 → 显示各地图普通光翼收集进度 + 永久光翼（复刻/常驻）收集率
3. 未收集的光翼按地图显示缺失数量

### 会员额度
- 新用户注册赠送 1 次免费额度
- 赞赏支持可获取更多额度
- 管理后台可手动添加额度

## ⚠️ 注意事项

- 本项目仅供学习交流，请勿用于商业用途
- 光翼数据为手工整理，可能有遗漏，欢迎提 Issue 补充
- API 密钥等敏感信息已脱敏，请自行替换为真实值
- 云函数部署后密钥在云端运行，不会暴露给客户端

## 📄 License

MIT
