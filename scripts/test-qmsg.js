/**
 * Qmsg酱 QQ群推送测试脚本
 */

const axios = require('axios');
const pushConfig = require('../src/push-config');

const qmsgKey = pushConfig.qmsgKey;
const testGroupId = '1059030628';  // 测试群

console.log('🔄 测试 Qmsg酱 推送到 QQ 群...');
console.log(`   KEY: ${qmsgKey.substring(0, 10)}...`);
console.log(`   群号: ${testGroupId}`);

const msgContent = `【大野愛実】
━━━━━━━━━━
这是一条测试消息！
坂道メッセージ監視システム V3
时间: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;

axios.post(
    `https://qmsg.zendee.cn/group/${qmsgKey}`,
    new URLSearchParams({
        msg: msgContent,
        qq: testGroupId,
    }),
    {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    }
).then(response => {
    if (response.data.success) {
        console.log('✅ Qmsg酱 推送成功！');
        console.log('   响应:', JSON.stringify(response.data));
    } else {
        console.log('❌ Qmsg酱 推送失败:');
        console.log('   原因:', response.data.reason);
        console.log('   响应:', JSON.stringify(response.data));
    }
}).catch(err => {
    console.log('❌ 请求失败:', err.message);
});
