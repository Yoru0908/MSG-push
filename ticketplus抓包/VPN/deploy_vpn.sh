#!/bin/bash
#
# WireGuard + mitmproxy 一键部署脚本 (CentOS)
# 用于远程抓包
#
# 使用方法：
#   chmod +x deploy_vpn.sh
#   sudo ./deploy_vpn.sh
#

set -e

# ============ 配置 ============
SERVER_IP="43.153.144.133"
WG_PORT="51820"
PROXY_PORT="8080"
WG_INTERFACE="wg0"
WG_SUBNET="10.66.66"
SERVER_WG_IP="${WG_SUBNET}.1"
CLIENT_WG_IP="${WG_SUBNET}.2"

# ============ 颜色 ============
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  WireGuard + mitmproxy 部署脚本${NC}"
echo -e "${GREEN}  服务器: ${SERVER_IP}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查 root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}请使用 root 权限运行此脚本${NC}"
   exit 1
fi

# ============ 安装 WireGuard ============
echo -e "${YELLOW}[1/6] 安装 WireGuard...${NC}"

# 添加 EPEL 仓库
yum install -y epel-release || true

# 安装 WireGuard
yum install -y wireguard-tools || {
    # 如果默认源没有，尝试 elrepo
    yum install -y https://www.elrepo.org/elrepo-release-7.el7.elrepo.noarch.rpm || true
    yum install -y kmod-wireguard wireguard-tools
}

echo -e "${GREEN}✓ WireGuard 已安装${NC}"

# ============ 生成密钥 ============
echo -e "${YELLOW}[2/6] 生成密钥对...${NC}"

mkdir -p /etc/wireguard
cd /etc/wireguard

# 服务器密钥
if [ ! -f server_private.key ]; then
    wg genkey | tee server_private.key | wg pubkey > server_public.key
    chmod 600 server_private.key
fi

# 客户端密钥
if [ ! -f client_private.key ]; then
    wg genkey | tee client_private.key | wg pubkey > client_public.key
    chmod 600 client_private.key
fi

SERVER_PRIVATE=$(cat server_private.key)
SERVER_PUBLIC=$(cat server_public.key)
CLIENT_PRIVATE=$(cat client_private.key)
CLIENT_PUBLIC=$(cat client_public.key)

echo -e "${GREEN}✓ 密钥已生成${NC}"

# ============ 配置 WireGuard ============
echo -e "${YELLOW}[3/6] 配置 WireGuard...${NC}"

cat > /etc/wireguard/${WG_INTERFACE}.conf << EOF
[Interface]
Address = ${SERVER_WG_IP}/24
ListenPort = ${WG_PORT}
PrivateKey = ${SERVER_PRIVATE}

# 启动时的 iptables 规则
PostUp = iptables -A FORWARD -i %i -j ACCEPT
PostUp = iptables -A FORWARD -o %i -j ACCEPT
PostUp = iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
# 将 VPN 流量重定向到 mitmproxy (透明代理)
PostUp = iptables -t nat -A PREROUTING -i %i -p tcp --dport 80 -j REDIRECT --to-port ${PROXY_PORT}
PostUp = iptables -t nat -A PREROUTING -i %i -p tcp --dport 443 -j REDIRECT --to-port ${PROXY_PORT}

PostDown = iptables -D FORWARD -i %i -j ACCEPT
PostDown = iptables -D FORWARD -o %i -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -t nat -D PREROUTING -i %i -p tcp --dport 80 -j REDIRECT --to-port ${PROXY_PORT}
PostDown = iptables -t nat -D PREROUTING -i %i -p tcp --dport 443 -j REDIRECT --to-port ${PROXY_PORT}

[Peer]
# 客户端 (手机)
PublicKey = ${CLIENT_PUBLIC}
AllowedIPs = ${CLIENT_WG_IP}/32
EOF

chmod 600 /etc/wireguard/${WG_INTERFACE}.conf

echo -e "${GREEN}✓ WireGuard 配置完成${NC}"

# ============ 开启 IP 转发 ============
echo -e "${YELLOW}[4/6] 开启 IP 转发...${NC}"

echo "net.ipv4.ip_forward = 1" > /etc/sysctl.d/99-wireguard.conf
sysctl -p /etc/sysctl.d/99-wireguard.conf

echo -e "${GREEN}✓ IP 转发已开启${NC}"

# ============ 安装 mitmproxy ============
echo -e "${YELLOW}[5/6] 安装 mitmproxy...${NC}"

# 安装 Python 和 pip
yum install -y python3 python3-pip || true

# 安装 mitmproxy
pip3 install mitmproxy --upgrade

echo -e "${GREEN}✓ mitmproxy 已安装${NC}"

# ============ 创建客户端配置 ============
echo -e "${YELLOW}[6/6] 生成客户端配置...${NC}"

cat > /etc/wireguard/client_phone.conf << EOF
[Interface]
PrivateKey = ${CLIENT_PRIVATE}
Address = ${CLIENT_WG_IP}/24
DNS = 8.8.8.8

[Peer]
PublicKey = ${SERVER_PUBLIC}
Endpoint = ${SERVER_IP}:${WG_PORT}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
EOF

echo -e "${GREEN}✓ 客户端配置已生成${NC}"

# ============ 启动 WireGuard ============
echo -e "${YELLOW}启动 WireGuard...${NC}"

systemctl enable wg-quick@${WG_INTERFACE}
systemctl start wg-quick@${WG_INTERFACE} || wg-quick up ${WG_INTERFACE}

echo -e "${GREEN}✓ WireGuard 已启动${NC}"

# ============ 防火墙配置 ============
echo -e "${YELLOW}配置防火墙...${NC}"

if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=${WG_PORT}/udp
    firewall-cmd --permanent --add-port=${PROXY_PORT}/tcp
    firewall-cmd --permanent --add-masquerade
    firewall-cmd --reload
elif command -v ufw &> /dev/null; then
    ufw allow ${WG_PORT}/udp
    ufw allow ${PROXY_PORT}/tcp
fi

echo -e "${GREEN}✓ 防火墙已配置${NC}"

# ============ 创建 mitmproxy 启动脚本 ============
cat > /opt/start_mitmproxy.sh << 'EOF'
#!/bin/bash
# 启动 mitmproxy 透明代理模式
cd /etc/wireguard
mitmdump --mode transparent --showhost --set block_global=false
EOF
chmod +x /opt/start_mitmproxy.sh

# ============ 完成 ============
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "📱 ${YELLOW}手机 WireGuard 配置文件:${NC}"
echo -e "   /etc/wireguard/client_phone.conf"
echo ""
echo -e "🔑 ${YELLOW}安装 mitmproxy 证书:${NC}"
echo -e "   1. 手机连接 VPN 后，访问 http://mitm.it"
echo -e "   2. 下载并安装对应系统的证书"
echo -e "   3. iOS 需在设置中信任证书"
echo ""
echo -e "🚀 ${YELLOW}启动抓包:${NC}"
echo -e "   /opt/start_mitmproxy.sh"
echo ""
echo -e "📋 ${YELLOW}查看客户端配置:${NC}"
cat /etc/wireguard/client_phone.conf
echo ""
echo -e "${GREEN}========================================${NC}"
