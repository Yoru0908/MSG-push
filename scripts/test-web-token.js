const axios = require('axios');

// 用户提供的 Web 版 Access Token
const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjU1MTUwNzYsInN1YiI6IjYzNjMwMCJ9.F9ydYT1b1CA56EsHUY8l_BWDSkNxAH_2iaoenEwwf_M";

// Web 版配置
const CONFIG = {
    baseUrl: 'https://api.message.hinatazaka46.com',
    headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'X-Talk-App-ID': 'jp.co.sonymusic.communication.keyakizaka 2.5', // Web 版 ID
        'X-Talk-App-Platform': 'web',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
    }
};

async function test() {
    console.log('🔄 测试 Web 版 Token...');
    try {
        // 获取群组列表
        const res = await axios.get(`${CONFIG.baseUrl}/v2/groups`, { headers: CONFIG.headers });
        const groups = res.data.groups || res.data;
        console.log(`✅ 成功获取群组列表: ${groups.length} 个`);

        // 打印前几个群组
        groups.slice(0, 3).forEach(g => console.log(`   - ${g.name} (ID: ${g.id})`));

        // 尝试获取大野愛実的时间线
        const ohno = groups.find(g => g.name.includes('大野'));
        if (ohno) {
            console.log(`\n🔄 获取 ${ohno.name} 的消息...`);
            const timeline = await axios.get(`${CONFIG.baseUrl}/v2/groups/${ohno.id}/timeline`, {
                headers: CONFIG.headers,
                params: { count: 5 }
            });
            const msgs = timeline.data.messages;
            console.log(`✅ 获取成功: ${msgs.length} 条`);
            if (msgs.length > 0) {
                console.log(`   最新消息: ${msgs[0].text?.substring(0, 20)}... (${msgs[0].published_at})`);
            }
        }

    } catch (e) {
        console.error('❌ 请求失败:', e.message);
        if (e.response) {
            console.error('   状态码:', e.response.status);
            console.error('   数据:', JSON.stringify(e.response.data));
        }
    }
}

test();
