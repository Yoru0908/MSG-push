/**
 * 调试 API 返回数据
 */

require('dotenv').config();
const axios = require('axios');

const GOOGLE_CLIENT_ID = '197175115117-te99msjq1966l0cchpsil99ht7560nfa.apps.googleusercontent.com';
const SITE = {
    name: '日向坂46',
    baseUrl: 'https://api.kh.glastonr.net',
    appId: 'jp.co.sonymusic.communication.keyakizaka 2.4',
};

async function debug() {
    const refreshToken = process.env.HINATAZAKA_REFRESH_TOKEN;

    // 获取 Google tokens
    const googleRes = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // 登录
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
    console.log('✅ 登录成功\n');

    // 获取 groups - 尝试不同的参数
    console.log('📋 尝试获取 groups...\n');

    const groupsRes = await axios.get(`${SITE.baseUrl}/v2/groups`, {
        headers: {
            'Authorization': `Bearer ${appToken}`,
            'X-Talk-App-ID': SITE.appId,
        }
    });

    console.log('返回数据类型:', Array.isArray(groupsRes.data) ? 'Array' : typeof groupsRes.data);

    const groups = Array.isArray(groupsRes.data) ? groupsRes.data : (groupsRes.data.groups || []);
    console.log(`\n找到 ${groups.length} 个 groups\n`);

    // 显示所有 open 状态的成员
    console.log('🎯 已开放成员:');
    groups.filter(g => g.state === 'open' && g.name).forEach(g => {
        const hasSubscription = g.subscription && g.subscription.state !== 'none';
        console.log(`   ${hasSubscription ? '✅' : '⬜'} ${g.name} (ID: ${g.id})${hasSubscription ? ` [${g.subscription.state}]` : ''}`);
    });

    // 搜索大野
    const ohno = groups.find(g => g.name && g.name.includes('大野'));
    if (ohno) {
        console.log(`\n📌 找到 大野: ${ohno.name} (ID: ${ohno.id})`);
    } else {
        console.log('\n❌ 未找到 大野');
    }
}

debug().catch(err => {
    console.error('❌ 错误:', err.response?.data || err.message);
});
