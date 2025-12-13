# 坂道46消息推送系统

自动抓取日向坂46和櫻坂46官方消息并推送到Discord。

## 🎉 新版特性（v2.0 - API版本）

| 对比项 | 新版API | 旧版Playwright |
|-------|---------|---------------|
| **速度** | **<2秒** ⚡ | 30-60秒 |
| **内存占用** | **<10MB** 💾 | ~200MB |
| **稳定性** | **直接API调用** ✅ | 依赖页面结构 |
| **多成员支持** | **✅ 支持所有成员** 🎯 | ❌ 不支持 |
| **资源消耗** | **仅HTTP请求** | 需要完整浏览器 |

## 📱 支持站点

- ✅ 日向坂46 (message.hinatazaka46.com) - **支持所有成员timeline**
- ✅ 櫻坂46 (message.sakurazaka46.com) - **支持所有成员timeline**

## ⚠️ 重要说明

**Token有效期**: 约1小时  
**登录方式**: 谷歌OAuth（无法自动登录）  
**解决方案**: 
- 本地使用：每45分钟手动更新Token
- GitHub Actions：每天更新1-2次Token到Secrets

详见：`使用说明-Token管理.md`

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 获取API认证信息

使用Chrome DevTools获取认证信息（3分钟完成）：

**步骤：**

1. **打开网站并登录**
   ```
   https://message.hinatazaka46.com
   ```

2. **打开开发者工具**
   - 按 `F12` 或右键 → 检查

3. **切换到Network标签**
   - 点击 `Network` 标签
   - 勾选 `Preserve log`
   - 过滤选择 `Fetch/XHR`

4. **浏览timeline触发API**
   - 浏览消息页面
   - 等待消息加载

5. **找到timeline API请求**
   - 在请求列表中找到：`timeline?count=200`
   - 点击该请求

6. **复制认证信息**
   
   在右侧 **Request Headers** 中找到并复制：
   ```
   authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   cookie: __td_signed=true; _fbp=fb.1.xxx; WAPID=xxx; ...
   ```

7. **配置到.env文件**

   编辑 `.env` 文件：
   ```env
   HINATAZAKA_API_TOKEN=Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   HINATAZAKA_COOKIE=__td_signed=true; _fbp=fb.1.xxx; WAPID=xxx; ...
   ```

### 3. 配置Discord Webhook

1. 在Discord服务器创建webhook
2. 复制webhook URL
3. 添加到 `.env` 文件：

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
```

### 4. 测试API连接

```bash
# 测试日向坂46 API（所有成员）
npm test

# 测试单个主Group
npm test single

# 测试櫻坂46
npm run test:sakura
```

### 5. 启动监控

```bash
# 启动自动监控（默认抓取所有成员）
npm start
```

## 📁 项目结构

```
├── src/                    # 📦 核心代码
│   ├── index.js            # 主程序入口
│   ├── config.js           # 多站点配置
│   ├── api-scraper.js      # API消息抓取器（新版）
│   └── discord.js          # Discord推送
├── test-api.js             # 🧪 API测试工具
├── data/                   # 💾 数据目录（git忽略）
│   ├── hash-*.txt          # 内容hash
│   └── messages-*.json     # 最新消息
├── archive/                # 📦 旧版代码归档
│   └── old-playwright-version/
├── .github/workflows/      # ⚙️ GitHub Actions
│   └── scrape.yml
├── package.json            # 📦 项目配置
├── .env.example            # 环境变量模板
└── README.md               # 📖 项目文档
```

## 🔐 API认证方案

### Bearer Token + Cookie认证

新版本直接调用官方API，使用以下认证方式：

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Cookie: WAPID=xxx; _ga=xxx; ...
```

### Token有效期

- **Bearer Token**：通常7-30天
- **Cookie**：通常30天

### 更新认证信息

当Token过期时，重新执行获取步骤：

```bash
# 1. 浏览器重新登录
# 2. F12 获取新的Request Headers
# 3. 更新.env文件中的认证信息
# 4. 重启服务
```

### 环境变量配置

```env
# 必需配置
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx

# API认证（从F12获取）
HINATAZAKA_API_TOKEN=Bearer eyJhbGc...
HINATAZAKA_COOKIE=__td_signed=true; _fbp=fb.1.xxx; ...

SAKURAZAKA_API_TOKEN=Bearer eyJhbGc...
SAKURAZAKA_COOKIE=__td_signed=true; _fbp=fb.1.xxx; ...
```

## ⚙️ GitHub Actions配置

### 自动化流程

```yaml
触发方式：
  - 定时：每15分钟
  - 手动：workflow_dispatch
  - Push：推送到main分支

执行步骤：
  1. 安装依赖和Playwright
  2. 恢复保存的认证信息
  3. 执行抓取
  4. 推送新消息到Discord
  5. 提交更新的数据文件
```

### 设置步骤

**1. 本地完成首次登录**

```bash
npm run login:hinata
npm run login:sakura
```

**2. 获取cookies内容**

```bash
cat data/cookies-hinatazaka46.json
cat data/cookies-sakurazaka46.json
```

**3. 添加到GitHub Secrets**

在仓库设置中添加：
- `DISCORD_WEBHOOK_URL`
- `HINATAZAKA_COOKIES` - 日向坂cookies（JSON）
- `SAKURAZAKA_COOKIES` - 櫻坂cookies（JSON）
- `HINATAZAKA_EMAIL` / `HINATAZAKA_PASSWORD` - 用于自动登录
- `SAKURAZAKA_EMAIL` / `SAKURAZAKA_PASSWORD`

**4. 推送到GitHub**

```bash
git add .
git commit -m "feat: 初始化坂道消息推送系统"
git push
```

GitHub Actions会自动开始运行！

## 🔐 环境变量

需要在GitHub Secrets中配置：

**必需：**
- `DISCORD_WEBHOOK_URL` - Discord webhook地址

**认证方式（根据探测结果选择）：**

方案A - 如果使用Token：
- `HINATAZAKA_TOKEN` - 日向坂46 API token
- `SAKURAZAKA_TOKEN` - 櫻坂46 API token

方案B - 如果需要自动登录：
- `HINATAZAKA_EMAIL` / `HINATAZAKA_PASSWORD` - 日向坂46账号
- `SAKURAZAKA_EMAIL` / `SAKURAZAKA_PASSWORD` - 櫻坂46账号

## 📝 使用命令

### 主要命令

```bash
# 启动监控（抓取所有站点+所有成员）
npm start

# 测试API连接
npm test                  # 日向坂46（所有成员）
npm run test:sakura       # 櫻坂46（所有成员）
npm test single           # 只测试主Group

# 发现所有成员及其API端点
npm run discover          # 生成 member-api-endpoints.json
```

### 已发现成员

**日向坂46**: 20位成员  
**櫻坂46**: 25位成员  
**总计**: 45位成员

每个成员的完整API端点保存在 `member-api-endpoints.json`

### API端点规律

**关键发现**：`成员ID = 个人group_id`

例如：
- 金村美玖 (ID: 58) → `/v2/groups/58/timeline`
- 遠藤理子 (ID: 119) → `/v2/groups/119/timeline`

### API信息

```bash
# 核心API节点
GET /v2/groups?organization_id=1      # 获取所有groups
GET /v2/groups/{group_id}/members     # 获取成员信息
GET /v2/groups/{member_id}/timeline   # 获取成员消息timeline
GET /v2/groups/{member_id}/past_messages  # 历史消息
GET /v2/tags                          # 标签列表
GET /v2/receipts                      # 已读回执
GET /v2/products                      # 订阅产品
```

## 🎯 智能变化检测

系统使用SHA256 hash检测内容变化：

```
首次运行 → 抓取内容 → 计算hash → 保存 → 推送Discord
后续运行 → 抓取内容 → 计算hash → 对比 → 有变化才推送
```

**优点：**
- ✅ 避免重复推送
- ✅ 精确检测变化
- ✅ 节省Discord rate limit

## 🐛 故障排查

### 登录失败

```bash
# 1. 检查网络连接
ping message.hinatazaka46.com

# 2. 手动登录网站确认账号正常

# 3. 删除旧的cookies重新登录
rm data/cookies-*.json
npm run login:hinata
```

### 抓取失败

```bash
# 1. 检查认证是否有效
ls -la data/cookies-*.json

# 2. 重新登录
npm run login:hinata

# 3. 测试抓取
npm run scrape:hinata
```

### Discord推送失败

```bash
# 1. 验证webhook URL
echo $DISCORD_WEBHOOK_URL

# 2. 测试webhook
curl -X POST $DISCORD_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"content": "测试消息"}'
```

## 💡 高级配置

### 修改抓取间隔

编辑 `.github/workflows/scrape.yml`：

```yaml
schedule:
  - cron: '*/15 * * * *'  # 每15分钟
  # - cron: '*/5 * * * *'   # 每5分钟
  # - cron: '0 * * * *'     # 每小时
```

### 自定义Discord消息

编辑 `discord.js` 中的 `buildEmbeds` 方法。

### 添加更多站点

编辑 `config.js`：

```javascript
sites: [
  // ... 现有站点
  {
    name: '新站点',
    slug: 'newsite',
    url: 'https://...',
    // ...
  }
]
```

## 📄 许可证

MIT License

## 🙏 致谢

- [Playwright](https://playwright.dev/) - 浏览器自动化
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook) - 消息推送
- [GitHub Actions](https://github.com/features/actions) - 自动化运行
