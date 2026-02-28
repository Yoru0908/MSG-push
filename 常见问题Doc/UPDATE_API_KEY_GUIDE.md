# MSG推送系统 - API Key 更新指南

## Gemini API Key 更新

本系统通过 Cloudflare Worker 代理调用 Gemini API，需要更新 CF Worker 上的 API Key。

### 更新 CF Worker 上的 API Key

1. 访问 Cloudflare Dashboard: https://dash.cloudflare.com
2. 进入 Workers → gemini-proxy
3. 设置新的环境变量 `GEMINI_API_KEY`
4. 保存并部署

或者使用 wrangler CLI：

```bash
# 部署新 Key
wrangler secret put GEMINI_API_KEY
# 输入新的 API Key
```

### 验证

```bash
# 测试翻译功能
curl -s -X POST "https://gemini-proxy.srzwyuu.workers.dev?key=新的API_KEY&model=gemini-2.5-pro" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

---

## APP Refresh Token 更新 (订阅过期后必须)

当成员订阅过期并重新订阅后，需要更新对应的 `APP_REFRESH_TOKEN`：

### 1. 手机连接 mitmproxy

确保手机通过服务器的代理 (43.153.144.133:8080) 上网

### 2. 打开APP触发认证

在手机上打开日向坂46/乃木坂46/櫻坂46 APP，进入对应成员的MSG界面

### 3. 从 mitmweb 获取新 Token

1. 访问 mitmweb: http://43.153.144.133:8081
2. 搜索 `update_token` 请求
3. 查看请求体中的 `refresh_token` 值

### 4. 更新配置

```bash
# SSH 连接服务器
ssh -i "/Users/yoru/Documents/SA/项目/sakamichi-tools/MSG推送/服务器/43.153.144.133_id_ed25519" root@43.153.144.133

# 编辑服务器 .env
nano /opt/msg-pusher/.env

# 更新对应的 token
HINATAZAKA_APP_REFRESH_TOKEN=新的token
SAKURAZAKA_APP_REFRESH_TOKEN=新的token
NOGIZAKA_APP_REFRESH_TOKEN=新的token
```

### 5. 重启服务

```bash
pkill -f "msg-pusher/src/main.js"
cd /opt/msg-pusher && nohup node src/main.js > /tmp/msg-pusher.log 2>&1 &
```
