/**
 * NapCat QQ群推送测试脚本
 */

const axios = require('axios');
const pushConfig = require('../src/push-config');

const apiUrl = pushConfig.lagrangeApi;
const testGroupId = '1059030628';  // 测试群

console.log('🔄 测试 NapCat 推送到 QQ 群...');
console.log(`   API: ${apiUrl}`);
console.log(`   群号: ${testGroupId}`);

const msgContent = `【NapCat 测试】
━━━━━━━━━━
这是一条来自 NapCat 的测试消息！
如果看到这条消息，说明部署成功。
时间: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;

async function test() {
    try {
        // 发送文本
        await axios.post(`${apiUrl}/send_group_msg`, {
            group_id: parseInt(testGroupId),
            message: msgContent,
        });
        console.log('✅ 文本消息推送成功！');

        // 发送图片（可选）
        // await axios.post(`${apiUrl}/send_group_msg`, {
        //     group_id: parseInt(testGroupId),
        //     message: '[CQ:image,file=https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png]',
        // });
        // console.log('✅ 图片消息推送成功！');

    } catch (error) {
        console.log('❌ 推送失败:', error.message);
        if (error.response) {
            console.log('   响应:', JSON.stringify(error.response.data));
        }
    }
}

test();
