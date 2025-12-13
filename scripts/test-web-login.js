/**
 * 测试使用 Web 版 Client ID 获取 Token 并登录
 */

require('dotenv').config();
const axios = require('axios');

// Web 版 Google Client ID (从网页源码获取)
const WEB_CLIENT_ID = '197175115117-d8st8utmfko5ktniloiknacst7m05o6n.apps.googleusercontent.com';

// 使用日向坂的 Refresh Token
const REFRESH_TOKEN = process.env.HINATAZAKA_REFRESH_TOKEN;

async function test() {
    console.log('🔄 Step 1: 使用 Web Client ID 刷新 Google Token...');

    if (!REFRESH_TOKEN) {
        console.log('❌ 未找到 HINATAZAKA_REFRESH_TOKEN');
        return;
    }

    try {
        // 尝试用 Web Client ID 刷新
        const googleRes = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: WEB_CLIENT_ID,
            refresh_token: REFRESH_TOKEN,
            grant_type: 'refresh_token',
        });

        console.log('✅ Google Token 刷新成功!');
        console.log('   access_token:', googleRes.data.access_token?.substring(0, 30) + '...');
        console.log('   id_token:', googleRes.data.id_token?.substring(0, 30) + '...');

        // Step 2: 使用 ID Token 登录 Web 版
        console.log('\n🔄 Step 2: 使用 ID Token 登录 Web 版 API...');
        const signinRes = await axios.post('https://api.message.hinatazaka46.com/v2/signin', {
            auth_type: 'google',
            device_uuid: null,
            runtimeType: 'google',
            token: googleRes.data.id_token
        }, {
            headers: {
                'X-Talk-App-ID': 'jp.co.sonymusic.communication.keyakizaka 2.5',
                'X-Talk-App-Platform': 'web',
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ 登录成功!');
        console.log('   access_token:', signinRes.data.access_token?.substring(0, 30) + '...');
        console.log('   expires_in:', signinRes.data.expires_in);

        // 提取 Set-Cookie
        const cookies = signinRes.headers['set-cookie'];
        if (cookies) {
            console.log('\n🍪 获取到的 Cookies:');
            cookies.forEach(c => console.log('  ', c.split(';')[0]));
        }

        // Step 3: 测试 API 调用
        console.log('\n🔄 Step 3: 测试获取群组列表...');
        const groupsRes = await axios.get('https://api.message.hinatazaka46.com/v2/groups', {
            headers: {
                'Authorization': `Bearer ${signinRes.data.access_token}`,
                'X-Talk-App-ID': 'jp.co.sonymusic.communication.keyakizaka 2.5',
                'X-Talk-App-Platform': 'web'
            }
        });

        const groups = groupsRes.data.groups || groupsRes.data;
        console.log(`✅ 成功! 获取到 ${groups.length} 个群组`);

    } catch (e) {
        console.error('❌ 失败:', e.message);
        if (e.response) {
            console.error('   状态码:', e.response.status);
            console.error('   数据:', JSON.stringify(e.response.data));
        }
    }
}

test();
