# 如何获取 APP Refresh Token (UUID 格式)

## 概述

MSG推送系统使用 **`/v2/update_token`** 接口认证，需要 UUID 格式的 `refresh_token`。  
这种方式的优点是**不会顶掉手机的登录状态**。

## 推荐方法：Google OAuth Token 转换

由于 APP 通常有登录缓存，不需要清除缓存重新登录。只需捕获 Google OAuth token，然后转换即可。

### 步骤 1: 启动 mitmweb 代理

```bash
# SSH 连接服务器
ssh -i "43.153.144.133_id_ed25519" root@43.153.144.133

# 启动 mitmweb
mitmweb --mode regular --web-host 0.0.0.0 --web-port 8081 --listen-host 0.0.0.0 --listen-port 8080

# 本地建立 SSH 隧道访问 WebUI
ssh -i "43.153.144.133_id_ed25519" -N -L 8081:localhost:8081 root@43.153.144.133
```

浏览器打开 http://localhost:8081

### 步骤 2: 手机连接代理，打开 APP

1. 手机连接代理: `43.153.144.133:8080`
2. 打开对应 APP（日向坂46/櫻坂46/乃木坂46）
3. 正常浏览，让 APP 进行 OAuth 刷新

### 步骤 3: 在 mitmweb 捕获 Google OAuth Token

搜索: `~d oauth2.googleapis.com`

找到 `POST /token` 请求，查看 Response 中的 `refresh_token`：
```json
{
  "refresh_token": "1//0eXXX...",  // ← 复制这个
  ...
}
```

### 步骤 4: 转换为 APP Token

**注意**：不同站点使用不同的 API 和 Client ID：

| 站点 | API Base URL | Google Client ID |
|------|-------------|------------------|
| 日向坂46 | `api.kh.glastonr.net` | `197175115117-te99msjq1966l0cchpsil99ht7560nfa` |
| 櫻坂46 | `api.s46.glastonr.net` | `653287631533-ha0dtiv68rtdi3mpsc3lovjh5vm3935c` |
| 乃木坂46 | `api.n46.glastonr.net` | `774090812281-f7fgecm61lajta7ghq04rmiglrc0ignh` |

在服务器上执行转换脚本：

```bash
cd /opt/msg-pusher && node -e "
const axios = require('axios');

// ========== 配置区域 ==========
const GOOGLE_REFRESH_TOKEN = '你捕获的Google refresh_token';
const SITE = 'hinatazaka'; // 可选: hinatazaka, sakurazaka, nogizaka

// ========== 站点配置 ==========
const SITES = {
  hinatazaka: {
    clientId: '197175115117-te99msjq1966l0cchpsil99ht7560nfa.apps.googleusercontent.com',
    apiUrl: 'https://api.kh.glastonr.net',
    appId: 'jp.co.sonymusic.communication.keyakizaka 2.4'
  },
  sakurazaka: {
    clientId: '653287631533-ha0dtiv68rtdi3mpsc3lovjh5vm3935c.apps.googleusercontent.com',
    apiUrl: 'https://api.s46.glastonr.net',
    appId: 'jp.co.sonymusic.communication.sakurazaka 2.4'
  },
  nogizaka: {
    clientId: '774090812281-f7fgecm61lajta7ghq04rmiglrc0ignh.apps.googleusercontent.com',
    apiUrl: 'https://api.n46.glastonr.net',
    appId: 'jp.co.sonymusic.communication.nogizaka 2.4'
  }
};

async function convert() {
  const site = SITES[SITE];
  console.log('站点:', SITE);
  
  // 1. 获取 Google id_token
  console.log('1. 获取 Google id_token...');
  const googleRes = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: site.clientId,
    refresh_token: GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });
  console.log('   ✅ 成功');
  
  // 2. 调用 /v2/signin 获取 APP token
  console.log('2. 调用 /v2/signin...');
  const signinRes = await axios.post(
    site.apiUrl + '/v2/signin',
    { token: googleRes.data.id_token, auth_type: 'google' },
    { headers: { 'Content-Type': 'application/json', 'X-Talk-App-ID': site.appId } }
  );
  console.log('   ✅ 成功');
  
  console.log('');
  console.log('=== APP Refresh Token ===');
  console.log(signinRes.data.refresh_token);
}

convert().catch(e => console.error('❌ 错误:', e.response?.data || e.message));
"
```

## 更新配置

获取到 UUID 格式的 refresh_token 后，更新 `.env` 文件：

```bash
# 服务器
vim /opt/msg-pusher/.env

# 本地
vim /Users/yoru/Documents/SA/项目/sakamichi-tools/MSG推送/.env
```

添加/更新对应的 token：
```
HINATAZAKA_APP_REFRESH_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SAKURAZAKA_APP_REFRESH_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOGIZAKA_APP_REFRESH_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

然后重启服务：
```bash
ssh -i "43.153.144.133_id_ed25519" root@43.153.144.133 'pkill -f "node /opt/msg-pusher"; sleep 2; cd /opt/msg-pusher && nohup node src/main.js > /tmp/msg-pusher.log 2>&1 &'
```

## 当前 Token 状态 (2026-02-09)

| 站点 | APP Refresh Token |
|------|-------------------|
| 日向坂46 | `5d732b54-65c8-4f6f-a8a2-22f4cc001f84` |
| 櫻坂46 | `a8f80dbd-2997-4364-9ed9-a27fa7ca5b8a` |
| 乃木坂46 | `4817b1cc-69cf-493a-ad63-fef5cd9716c6` |

## Token 格式对比

| 类型 | 格式 | 用途 |
|------|------|------|
| Google OAuth | `1//0eXXX...` | 旧方式，用于 `/v2/signin` |
| APP Refresh | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | **推荐**，用于 `/v2/update_token`，不会顶掉手机登录 |

## 服务认证逻辑

服务启动时的认证流程：
1. 优先尝试 Google OAuth 认证
2. 如果 Google OAuth 失败，自动回退到 APP Token 刷新（需要配置 `appTokens`）

确保 `push-config.js` 中有 `appTokens` 配置：
```javascript
appTokens: {
    nogizaka: process.env.NOGIZAKA_APP_REFRESH_TOKEN || '',
    sakurazaka: process.env.SAKURAZAKA_APP_REFRESH_TOKEN || '',
    hinatazaka: process.env.HINATAZAKA_APP_REFRESH_TOKEN || '',
},
```

## 参考

- colmsg-main 项目: [doc/how_to_get_refresh_token.md](../colmsg-main/doc/how_to_get_refresh_token.md)
