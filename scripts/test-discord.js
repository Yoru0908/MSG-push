/**
 * Discord 推送测试脚本
 */

require('dotenv').config();
const axios = require('axios');
const pushConfig = require('../src/push-config');

const webhookUrl = pushConfig.discordWebhook;

if (!webhookUrl) {
    console.log('❌ 未配置 Discord Webhook');
    process.exit(1);
}

console.log('🔄 发送测试消息到 Discord...');

axios.post(webhookUrl, {
    embeds: [{
        title: '💌 测试推送',
        description: '这是一条测试消息，用于验证Discord推送功能是否正常工作。\n\n监视中的成员：\n- 正源司陽子 (日向坂46)\n- 大野愛実 (日向坂46)\n- 山下瞳月 (櫻坂46)\n- 中川智尋 (櫻坂46)',
        color: 0x3498DB,
        timestamp: new Date().toISOString(),
        footer: { text: '坂道メッセージ監視システム V3' }
    }]
}).then(() => {
    console.log('✅ Discord 测试推送成功！请检查你的Discord频道。');
}).catch(err => {
    console.log('❌ Discord 推送失败:', err.message);
});
