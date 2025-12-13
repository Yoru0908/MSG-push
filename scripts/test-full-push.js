/**
 * 完整推送流程测试脚本 (包含翻译)
 */

require('dotenv').config();
const axios = require('axios');
const pushConfig = require('../src/push-config');
const translator = require('../src/translator');

// 模拟站点配置
const SITE = {
    name: 'Sakurazaka46',
    siteKey: 'sakurazaka',
    appId: '2.4',
    baseUrl: 'https://api.sakurazaka46.com',
};

// 简单的 token 获取函数
async function getGoogleTokens(siteKey) {
    const GOOGLE_CLIENT_IDS = {
        nogizaka: '91433230722-os56t3g350e9803t89v2398u8686898a.apps.googleusercontent.com',
        sakurazaka: '91433230722-2t33b6452i80650942e65k53466d735j.apps.googleusercontent.com',
        hinatazaka: '91433230722-j2t048i45050f2882q26638309193711.apps.googleusercontent.com',
    };

    const refreshToken = process.env[`${siteKey.toUpperCase()}_REFRESH_TOKEN`];
    console.log(`Reading token for ${siteKey}: ${refreshToken ? 'Found' : 'Missing'}`);
    if (!refreshToken) return null;

    try {
        const res = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: GOOGLE_CLIENT_IDS[siteKey],
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        });
        return res.data;
    } catch (e) {
        console.error('Token refresh failed:', e.message);
        return null;
    }
}

async function test() {
    console.log('🔄 获取 Google token...');
    const tokens = await getGoogleTokens(SITE.siteKey);
    if (!tokens) {
        console.log('❌ 获取 token 失败');
        return;
    }
    console.log('✅ Google token 获取成功');

    console.log('🔄 登录 App...');
    const signinRes = await axios.post(
        `${SITE.baseUrl}/v2/signin`,
        { token: tokens.access_token },
        { headers: { 'X-Talk-App-ID': SITE.appId } }
    );
    const appToken = signinRes.data.access_token;
    console.log('✅ App 登录成功');

    console.log('🔄 获取成员列表...');
    const groupsRes = await axios.get(
        `${SITE.baseUrl}/v2/groups`,
        {
            headers: {
                'Authorization': `Bearer ${appToken}`,
                'X-Talk-App-ID': SITE.appId,
            }
        }
    );

    const groups = Array.isArray(groupsRes.data) ? groupsRes.data : (groupsRes.data.groups || []);
    console.log(`   找到 ${groups.length} 个成员`);

    // 搜索中川智尋
    const ohno = groups.find(g => g.name.includes('中川'));
    if (!ohno) {
        console.log('❌ 未找到中川智尋');
        return;
    }

    console.log(`✅ 找到 ${ohno.name} (ID: ${ohno.id})`);

    // 获取历史消息
    console.log('🔄 获取历史消息...');
    const timelineRes = await axios.get(
        `${SITE.baseUrl}/v2/groups/${ohno.id}/timeline`,
        {
            params: { count: 50 },
            headers: {
                'Authorization': `Bearer ${appToken}`,
                'X-Talk-App-ID': SITE.appId,
            }
        }
    );

    const messages = timelineRes.data.messages || [];
    if (messages.length === 0) {
        console.log('❌ 没有找到消息');
        return;
    }

    console.log(`✅ 找到 ${messages.length} 条消息`);

    // 取最新一条消息
    const msg = messages[0];

    console.log(`\n----------------------------------------`);
    console.log(`处理消息: ${msg.published_at}`);
    console.log(`类型: ${msg.file ? msg.file.content_type : 'text'}`);
    console.log(`内容: ${msg.text?.substring(0, 30) || '[无文本]'}...`);

    // 翻译
    if (msg.text) {
        console.log('   🤖 正在翻译...');
        const translated = await translator.translate(msg.text, ohno.name);
        if (translated) {
            console.log('   ✅ 翻译完成');
            msg.text += `\n\n━━━━━━━━━━\n(翻译)\n${translated}`;
        }
    }

    // 推送到 QQ (NapCat)
    console.log('🔄 推送到 QQ 群 1059030628...');
    try {
        let msgContent = `【${ohno.name}】\n`;
        msgContent += `━━━━━━━━━━\n`;
        msgContent += msg.text || '';

        // 发送文本
        await axios.post(`http://localhost:3000/send_group_msg`, {
            group_id: 1059030628,
            message: msgContent,
        });

        // 发送图片
        if (msg.file?.content_type?.includes('image')) {
            console.log('   发送图片...');
            await axios.post(`http://localhost:3000/send_group_msg`, {
                group_id: 1059030628,
                message: `[CQ:image,file=${msg.file.url}]`,
            });
        }
        // 发送视频
        else if (msg.file?.content_type?.includes('video')) {
            console.log('   发送视频链接...');
            await axios.post(`http://localhost:3000/send_group_msg`, {
                group_id: 1059030628,
                message: `[视频] ${msg.file.url}`,
            });
        }

        console.log('✅ QQ 群推送成功');
    } catch (e) {
        console.error('❌ QQ 群推送失败', e.message);
    }

    console.log('\n🎉 测试完成！');
}

test();
