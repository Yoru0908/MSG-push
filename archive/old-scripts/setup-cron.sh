#!/bin/bash

# 设置cron定时任务
# Token有效期1小时，每30分钟运行一次

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NODE_PATH=$(which node)

echo "📋 设置定时任务..."
echo "项目路径: $PROJECT_DIR"
echo "Node路径: $NODE_PATH"
echo ""

# 创建日志目录
mkdir -p "$PROJECT_DIR/logs"

# cron任务配置
CRON_JOB="*/30 * * * * cd $PROJECT_DIR && $NODE_PATH src/index.js >> $PROJECT_DIR/logs/cron.log 2>&1"

# 添加到crontab
(crontab -l 2>/dev/null | grep -v "src/index.js"; echo "$CRON_JOB") | crontab -

echo "✅ Cron任务已添加"
echo ""
echo "📋 当前cron任务:"
crontab -l | grep "src/index.js"
echo ""
echo "💡 说明:"
echo "  - 每30分钟运行一次"
echo "  - 日志: logs/cron.log"
echo "  - 查看日志: tail -f logs/cron.log"
echo "  - 删除任务: crontab -e (手动删除对应行)"
echo ""
echo "⚠️  重要: Token每小时过期，请设置提醒每45分钟手动更新Token"
