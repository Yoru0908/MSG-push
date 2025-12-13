/**
 * 测试使用 Session Cookie 刷新 Access Token
 */

const axios = require('axios');

// 从抓包获取的 Session Cookie
const SESSION_COOKIE = 'session=ec6941ca-b4c3-4a98-8d27-3b8d0f828f60';

// API 配置
const API_BASE = 'https://api.message.hinatazaka46.com';
const HEADERS = {
    'X-Talk-App-ID': 'jp.co.sonymusic.communication.keyakizaka 2.5',
    'X-Talk-App-Platform': 'web',
    'Cookie': SESSION_COOKIE,
    'Content-Type': 'application/json'
};

async function test() {
    console.log('🔄 Step 1: 使用 Session Cookie 调用 /v2/update_token...');

    try {
        const updateRes = await axios.post(`${API_BASE}/v2/update_token`, {}, {
            headers: HEADERS
        });

        console.log('✅ Token 刷新成功!');
        console.log('   access_token:', updateRes.data.access_token?.substring(0, 40) + '...');
        console.log('   expires_in:', updateRes.data.expires_in, '秒');

        // 检查是否返回了新的 Cookie
        const newCookies = updateRes.headers['set-cookie'];
        if (newCookies) {
            console.log('\n🍪 返回的新 Cookies:');
            newCookies.forEach(c => {
                const parts = c.split(';');
                console.log('   Value:', parts[0]);
                const expires = parts.find(p => p.trim().toLowerCase().startsWith('expires='));
                if (expires) console.log('   Expires:', expires.trim());
            });
        }

        // Step 2: 使用新 Access Token 测试 API
        console.log('\n🔄 Step 2: 测试获取群组列表...');
        const groupsRes = await axios.get(`${API_BASE}/v2/groups`, {
            headers: {
                ...HEADERS,
                'Authorization': `Bearer ${updateRes.data.access_token}`
            }
        });

        const groups = groupsRes.data.groups || groupsRes.data;
        console.log(`✅ 成功获取 ${groups.length} 个群组`);

        // 打印订阅的成员
        const subscribed = groups.filter(g => g.is_subscription);
        if (subscribed.length > 0) {
            console.log('\n📋 已订阅的成员:');
            subscribed.forEach(g => console.log(`   - ${g.name}`));
        }

    } catch (e) {
        console.error('❌ 失败:', e.message);
        if (e.response) {
            console.error('   状态码:', e.response.status);
            console.error('   数据:', JSON.stringify(e.response.data));
        }
    }
}

test();
