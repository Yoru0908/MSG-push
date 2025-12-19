# 📱 手机配置指南

## 1️⃣ 安装 VPN 客户端

请在应用商店搜索并安装 **"WireGuard"**
(图标是一条红色的龙/蛇)

- **iOS**: [App Store Link](https://apps.apple.com/us/app/wireguard/id1441195209)
- **Android**: [Google Play Link](https://play.google.com/store/apps/details?id=com.wireguard.android)

---

## 2️⃣ 导入配置

部署完成后，我会提供以下 **配置文本**。

1. 打开手机端 **WireGuard**
2. 点击右上角 **+ (加号)**
3. 选择 **"从剪贴板添加"** (如果你复制了文本) 
   - 或者选择 **"扫描二维码"** (如果你生成了二维码)
4. 给配置起个名字（例如 `TixPlus Proxy`）
5. 点击保存

**配置文本示例:**
```ini
[Interface]
PrivateKey = (这里会是你生成的私钥)
Address = 10.66.66.2/24
DNS = 8.8.8.8

[Peer]
PublicKey = (这里会是服务器的公钥)
Endpoint = 43.153.144.133:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
```

---

## 3️⃣ 安装抓包证书 (MITM)

**⚠️ 这一步最关键，否则无法抓取 HTTPS**

1. 确保服务器已启动 mitmproxy (脚本部署后会告诉你如何启动)
2. 手机打开 WireGuard 开启 VPN 连接
3. 打开手机浏览器 (Safari/Chrome)，访问：**http://mitm.it**
4. 点击对应的图标下载证书
   - iOS 点 Apple, Android 点 Android
5. **[iOS 特别步骤]**:
   - 下载后去 **设置** → **已下载描述文件** → **安装**
   - 安装完后，去 **设置** → **通用** → **关于本机** → **证书信任设置**
   - 找到 `mitmproxy` 证书，**开启开关** (变绿)

---

## 4️⃣ 开始抓包测试

1. 保持 VPN 连接
2. 在服务器上运行抓包监控 (稍后提供地址)
3. 打开 TixPlus App 操作
4. 服务器端应该能看到流量刷屏！

---

## 🆘 常见问题

- **连上 VPN 后无法上网？**
  - 检查服务器防火墙是否开放 51820/UDP
  - 检查 IP 转发是否开启 (脚本已自动配置)

- **抓不到 HTTPS (显示红色错误)？**
  - 证书没信任！请重做步骤 3
  - 某些 App 有 SSL Pinning (TixPlus 的部分接口可能有，但大部分应该能抓)
