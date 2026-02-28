/**
 * 临时追赶脚本 (Catch-up Script)
 * 专门用于拉取 2026年2月23日 未被推送到 QQ 的消息并重新推送。
 */
require('dotenv').config();
const AppApiListenerV3 = require('./app-api-listener-v3');
const pushConfig = require('./push-config');

async function runCatchUp() {
    console.log('🚀 开始执行 2026/02/23 消息补发脚本...\n');

    // 初始化监听器实例以复用其获取和推送逻辑
    const listener = new AppApiListenerV3();

    // 强制先认证
    console.log('🔐 认证中...');
    for (const siteKey of Object.keys(pushConfig.defaultPushRules)) {
        if (pushConfig.defaultPushRules[siteKey]) {
            await listener.authenticate(siteKey);
        }
    }

    // 设置目标日期范围 (东京时间 2月23日)
    const targetDateStr = '2026/2/23';

    for (const siteKey of Object.keys(pushConfig.defaultPushRules)) {
        if (!listener.tokens[siteKey]) continue;

        console.log(`\n🔍 正在检查 [${siteKey}]...`);
        try {
            const groups = await listener.getGroups(siteKey);

            for (const group of groups) {
                // 检查是否在监控名单中
                if (pushConfig.watchMembers.length > 0 &&
                    !pushConfig.watchMembers.includes(group.name)) {
                    continue;
                }

                // 检查是否有有效订阅
                const hasSubscription = group.subscription && group.subscription.state === 'active';
                if (!hasSubscription) continue;

                console.log(`\n   >> 拉取 ${group.name} 的消息...`);
                // 拉取较多消息以覆盖一天，上限先设为 30 条
                const messages = await listener.getTimeline(siteKey, group.id, 30);

                let foundToday = false;

                // 为了保证时间线顺序，从旧到新处理
                for (let i = messages.length - 1; i >= 0; i--) {
                    const message = messages[i];
                    const msgTime = new Date(message.published_at);

                    // 转换为日本时间格式 2026/2/23
                    const msgDateStr = msgTime.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });

                    if (msgDateStr === targetDateStr) {
                        foundToday = true;
                        console.log(`   [发现目标消息] 时间: ${message.published_at}`);

                        // 调用 AppApiListenerV3 内部的方法进行推送
                        await listener.handleNewMessage(siteKey, group, message);
                        await listener.sleep(1000); // 间隔1秒防止风控
                    }
                }

                if (!foundToday) {
                    console.log(`   [无 ${targetDateStr} 的消息]`);
                }

                await listener.sleep(500); // 成员之间的间隔
            }
        } catch (error) {
            console.error(`❌ [${siteKey}] 处理失败:`, error.message);
        }
    }

    console.log('\n✅ 补发脚本执行完毕！');
    process.exit(0);
}

runCatchUp();
