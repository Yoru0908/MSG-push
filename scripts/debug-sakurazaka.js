/**
 * 查看樱坂46成员列表
 */

require('dotenv').config();
const axios = require('axios');

const GOOGLE_CLIENT_ID = '653287631533-ha0dtiv68rtdi3mpsc3lovjh5vm3935c.apps.googleusercontent.com';
const SITE = {
    name: '櫻坂46',
    baseUrl: 'https://api.s46.glastonr.net',
    appId: 'jp.co.sonymusic.communication.sakurazaka 2.4',
};

async function debug() {
    const refreshToken = process.env.SAKURAZAKA_REFRESH_TOKEN;

    const googleRes = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const signInRes = await axios.post(
        `${SITE.baseUrl}/v2/signin`,
        { auth_type: 'google', token: googleRes.data.id_token },
        {
            headers: {
                'Content-Type': 'application/json',
                'X-Talk-App-ID': SITE.appId,
            }
        }
    );
    const appToken = signInRes.data.access_token;
    console.log('✅ 櫻坂46 登录成功\n');

    const groupsRes = await axios.get(`${SITE.baseUrl}/v2/groups`, {
        headers: {
            'Authorization': `Bearer ${appToken}`,
            'X-Talk-App-ID': SITE.appId,
        }
    });

    const groups = Array.isArray(groupsRes.data) ? groupsRes.data : (groupsRes.data.groups || []);
    console.log(`找到 ${groups.length} 个 groups\n`);

    console.log('🎯 已开放成员:');
    groups.filter(g => g.state === 'open' && g.name).forEach(g => {
        const hasSubscription = g.subscription && g.subscription.state !== 'none';
        console.log(`   ${hasSubscription ? '✅' : '⬜'} ${g.name} (ID: ${g.id})${hasSubscription ? ` [${g.subscription.state}]` : ''}`);
    });

    // 搜索目标成员
    console.log('\n📌 搜索目标成员:');
    const targets = ['山下', '中川'];
    targets.forEach(name => {
        const found = groups.find(g => g.name && g.name.includes(name));
        if (found) {
            console.log(`   ✅ ${found.name} (ID: ${found.id})`);
        } else {
            console.log(`   ❌ 未找到 ${name}`);
        }
    });
}

debug().catch(err => {
    console.error('❌ 错误:', err.response?.data || err.message);
});
