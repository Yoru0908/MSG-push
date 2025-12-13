/**
 * 测试直接使用 Access Token 和 Cookie 调用 API
 */

const axios = require('axios');

// 从抓包获取的 Access Token 和 Session Cookie
const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjU1MTUwNzYsInN1YiI6IjYzNjMwMCJ9.F9ydYT1b1CA56EsHUY8l_BWDSkNxAH_2iaoenEwwf_M";
const SESSION_COOKIE = 'session=ec6941ca-b4c3-4a98-8d27-3b8d0f828f60';

// API 配置
const API_BASE = 'https://api.message.hinatazaka46.com';

async function test() {
    // 检查 Token 过期时间
    const payload = JSON.parse(Buffer.from(ACCESS_TOKEN.split('.')[1], 'base64').toString());
    const expireDate = new Date(payload.exp * 1000);
    const now = new Date();

    console.log('🔍 Access Token 信息:');
    console.log('   过期时间:', expireDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
    console.log('   当前时间:', now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
    console.log('   剩余时间:', Math.round((expireDate - now) / 1000 / 60), '分钟');

    if (expireDate < now) {
        console.log('⚠️ Token 已过期!');
    }

    console.log('\n🔄 测试 API 调用...');
    try {
        const res = await axios.get(`${API_BASE}/v2/groups`, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Talk-App-ID': 'jp.co.sonymusic.communication.keyakizaka 2.5',
                'X-Talk-App-Platform': 'web',
                'Cookie': SESSION_COOKIE
            }
        });

        const groups = res.data.groups || res.data;
        console.log(`✅ 成功! 获取到 ${groups.length} 个群组`);

        // 获取订阅成员
        const subscribed = groups.filter(g => g.is_subscription);
        console.log(`\n📋 已订阅: ${subscribed.length} 个成员`);
        subscribed.forEach(g => console.log(`   - ${g.name}`));

    } catch (e) {
        console.error('❌ 失败:', e.message);
        if (e.response) {
            console.error('   状态码:', e.response.status);
        }
    }
}

test();
