# Tixplus 顔写真替换工具

通过 mitmproxy 拦截并替换入场验证用的顔写真图片。

## 文件结构

```
ticketplus抓包/
├── replace_face.py    # mitmproxy 替换脚本
├── fake_face.jpg      # 替换用的图片 (需要自己添加)
├── flows              # 抓包数据
└── README.md          # 本文件
```

## 使用方法

### 1. 准备替换图片

将你想替换的人脸图片放在此文件夹，命名为 `fake_face.jpg`

```bash
cp /path/to/your/photo.jpg ./fake_face.jpg
```

### 2. 本地测试 (WiFi 环境)

```bash
# 启动带替换功能的 mitmweb
mitmweb -s replace_face.py

# 手机设置代理: 电脑IP:8080
# 访问 App，观察是否替换成功
```

### 3. 服务器部署 (蜂窝网络)

详见下方服务器部署章节。

## 替换原理

脚本会拦截三种请求：

| 接口 | 说明 |
|------|------|
| `/img/eticket-face-picture/check/` | 替换返回的图片 URL |
| `/img/eticket-face-picture/load/` | 替换 base64 图片数据 |
| S3 图片请求 | 直接替换图片内容 |

## 服务器部署

### 前提条件
- 一台 VPS (有公网 IP)
- 已安装 Python 3.8+
- 已安装 WireGuard

### 部署步骤

```bash
# 1. 安装 mitmproxy
pip3 install mitmproxy

# 2. 上传脚本和替换图片
scp replace_face.py fake_face.jpg user@server:/opt/face-replace/

# 3. 在服务器运行
mitmdump -s replace_face.py --listen-host 0.0.0.0 -p 8080 --set flow_detail=0

# 4. 配置 WireGuard VPN 路由所有流量

# 5. 手机连接 VPN，配置代理指向 VPN 内网地址
```

### 或使用环境变量替换为在线图片

```bash
export FAKE_FACE_URL="https://your-server.com/fake_face.jpg"
mitmdump -s replace_face.py
```

## 注意事项

⚠️ **法律风险提醒**
- 此工具仅供技术研究和测试使用
- 使用此工具替换入场验证照片可能违反服务条款
- 请勿用于任何违法目的

## 调试

查看替换日志：
```bash
# mitmproxy 会输出替换日志，格式如:
# [FaceReplace] ✅ 替换 S3 图片: /emtg.jp/tixplus_face_pictures/...
```
