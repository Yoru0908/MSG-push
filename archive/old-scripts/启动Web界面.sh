#!/bin/bash

# 坂道消息Web界面启动脚本

echo "🌸 启动坂道消息Web界面..."
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未安装Node.js，请先安装"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 安装额外依赖
if ! npm list express &> /dev/null; then
    echo "📦 安装Web服务器依赖..."
    npm install express cors
fi

# 启动Web服务器
echo ""
echo "🚀 启动Web服务器..."
echo "📍 访问地址: http://localhost:3000"
echo "💡 按Ctrl+C停止服务器"
echo ""

node src/web-api-server.js
