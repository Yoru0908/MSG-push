/**
 * 主入口 - 同时启动消息推送和群聊回复模块
 */

require('dotenv').config();

const AppApiListenerV3 = require('./app-api-listener-v3');
const GroupChatHandler = require('./group-chat-handler');
const usageStats = require('./usage-stats');

async function main() {
    console.log('🚀 坂道消息推送系统 v3');
    console.log('='.repeat(60));
    console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo' })}`);
    console.log('');

    // 启动消息推送模块
    const pusher = new AppApiListenerV3();
    await pusher.start();

    // 启动群聊回复模块
    const chatHandler = new GroupChatHandler();
    await chatHandler.start();

    // 启动 API 使用统计定时任务（每天 23:50 发送日报）
    usageStats.startScheduler();

    console.log('');
    console.log('✅ 所有模块已启动');
    console.log('   - 消息推送: 运行中');
    console.log('   - 群聊翻译: 运行中');
    console.log('   - 统计日报: 每天 23:50 发送');
    console.log('');

    // 优雅退出
    process.on('SIGINT', () => {
        console.log('\n🛑 正在关闭...');
        pusher.stop();
        chatHandler.stop();
        process.exit(0);
    });
}

main().catch(error => {
    console.error('💥 启动失败:', error);
    process.exit(1);
});
