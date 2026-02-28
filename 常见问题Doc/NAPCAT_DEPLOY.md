# NapCat QQ机器人 Docker 部署指南

## 📋 信息

- **服务器**: CentOS (43.153.144.133)
- **机器人QQ**: 3286920362

---

## 🚀 部署步骤

### Step 1: 创建目录

```bash
mkdir -p /opt/napcat/config
cd /opt/napcat
```

### Step 2: 创建 docker-compose.yml

```bash
cat > docker-compose.yml << 'EOF'
version: '3'
services:
  napcat:
    image: docker.io/mlikiowa/napcat-docker:latest
    container_name: napcat
    restart: always
    ports:
      - "3000:3000"    # OneBot API
      - "6099:6099"    # Web UI
    volumes:
      - ./config:/app/napcat/config
      - ./qq:/root/.config/QQ
    environment:
      - ACCOUNT=3286920362
      - HTTP_PORT=3000
      - WS_PORT=3001
      - WEB_UI_ENABLE=true
      - WEB_UI_PORT=6099
    mac_address: 02:42:ac:11:00:02
EOF
```

### Step 3: 启动

```bash
docker-compose up -d
```

### Step 4: 登录

1. 访问 Web UI: `http://43.153.144.133:6099/webui`
2. 输入 Token (在日志里查看)
3. 扫码登录 QQ

---

## 🔧 更新监听器配置

在 `.env` 中：
```env
LAGRANGE_API=http://43.153.144.133:3000
```
(NapCat 兼容 OneBot v11，所以 API 地址配置一样)
