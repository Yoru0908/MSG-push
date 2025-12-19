# WireGuard VPN + mitmproxy 抓包系统

## 部署步骤

### 1. 上传脚本到服务器

```bash
scp -i ~/.ssh/your_key vpn/deploy_vpn.sh root@43.153.144.133:/root/
```

### 2. SSH 登录服务器执行

```bash
ssh -i ~/.ssh/your_key root@43.153.144.133

chmod +x deploy_vpn.sh
./deploy_vpn.sh
```

### 3. 获取手机配置

脚本执行完成后，会显示手机的 WireGuard 配置。你也可以用这个命令查看：

```bash
cat /etc/wireguard/client_phone.conf
```

### 4. 手机安装 WireGuard

- **iOS**: App Store 搜索 "WireGuard"
- **Android**: Google Play 搜索 "WireGuard"

### 5. 导入配置到手机

方法1: 直接复制配置内容
方法2: 生成二维码扫描

```bash
# 服务器上安装 qrencode
yum install -y qrencode

# 生成二维码
qrencode -t ansiutf8 < /etc/wireguard/client_phone.conf
```

### 6. 安装 mitmproxy 证书

1. 手机连接 VPN
2. 浏览器访问 `http://mitm.it`
3. 下载并安装对应系统的证书
4. iOS 需要在 **设置 → 通用 → 关于本机 → 证书信任设置** 中启用信任

### 7. 开始抓包

```bash
# 服务器上启动 mitmproxy
/opt/start_mitmproxy.sh

# 或者带 Web 界面
mitmweb --mode transparent --web-host 0.0.0.0 --web-port 8081
```

然后访问 `http://43.153.144.133:8081` 查看抓包结果。

---

## 常用命令

```bash
# 查看 WireGuard 状态
wg show

# 重启 WireGuard
systemctl restart wg-quick@wg0

# 查看连接的客户端
wg show wg0 peers

# 停止 mitmproxy
Ctrl+C
```

## 故障排除

### 手机连不上 VPN
1. 检查服务器防火墙是否放行 51820/UDP
2. 检查 WireGuard 是否启动: `systemctl status wg-quick@wg0`

### 抓不到 HTTPS
1. 确认证书已正确安装并信任
2. 某些 App 有 SSL Pinning，无法抓包
