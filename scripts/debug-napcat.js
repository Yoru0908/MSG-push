/**
 * NapCat API 调试脚本
 */

const axios = require('axios');
const pushConfig = require('../src/push-config');

const apiUrl = 'http://localhost:3000';
const testGroupId = '1059030628';
const testUserId = '314389463';

console.log('🔄 NapCat API 调试...');
console.log(`   API: ${apiUrl}`);

async function test() {
    // 1. 获取登录信息
    try {
        console.log('\n1️⃣ 获取登录信息...');
        const loginRes = await axios.get(`${apiUrl}/get_login_info`);
        console.log('   ✅ 登录信息:', JSON.stringify(loginRes.data));
    } catch (e) {
        console.log('   ❌ 获取登录信息失败:', e.message);
    }

    // 2. 发送私聊
    try {
        console.log('\n2️⃣ 发送私聊给 314389463...');
        const privateRes = await axios.post(`${apiUrl}/send_private_msg`, {
            user_id: parseInt(testUserId),
            message: '这是一条来自 NapCat 的私聊测试消息',
        });
        console.log('   ✅ 私聊发送结果:', JSON.stringify(privateRes.data));
    } catch (e) {
        console.log('   ❌ 私聊发送失败:', e.message);
    }

    // 3. 发送群消息
    try {
        console.log(`\n3️⃣ 发送群消息到 ${testGroupId}...`);
        const groupRes = await axios.post(`${apiUrl}/send_group_msg`, {
            group_id: parseInt(testGroupId),
            message: '这是一条来自 NapCat 的群测试消息',
        });
        console.log('   ✅ 群消息发送结果:', JSON.stringify(groupRes.data));
    } catch (e) {
        console.log('   ❌ 群消息发送失败:', e.message);
    }
}

test();
