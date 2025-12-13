require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const apiUrl = 'http://127.0.0.1:3000';
const groupId = 1059030628;

async function downloadMedia(memberName, message) {
    const safeMemberName = memberName.replace(/\s+/g, '_');
    const mediaDir = `/opt/napcat/config/media/${safeMemberName}`;
    if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
    }

    const urlPath = new URL(message.file).pathname;
    const fileName = path.basename(urlPath.split('?')[0]);
    const localPath = path.join(mediaDir, fileName);
    const containerPath = `/app/napcat/config/media/${safeMemberName}/${fileName}`;

    if (!fs.existsSync(localPath)) {
        console.log('   📥 下载语音中:', fileName);
        const response = await axios.get(message.file, { responseType: 'arraybuffer', timeout: 60000 });
        fs.writeFileSync(localPath, response.data);
    }
    return containerPath;
}

async function test() {
    // 1. 获取语音消息
    const googleRes = await axios.post('https://oauth2.googleapis.com/token',
        new URLSearchParams({
            client_id: '197175115117-te99msjq1966l0cchpsil99ht7560nfa.apps.googleusercontent.com',
            refresh_token: process.env.HINATAZAKA_REFRESH_TOKEN,
            grant_type: 'refresh_token',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const signinRes = await axios.post('https://api.kh.glastonr.net/v2/signin',
        { auth_type: 'google', token: googleRes.data.id_token },
        { headers: { 'Content-Type': 'application/json', 'X-Talk-App-ID': 'jp.co.sonymusic.communication.keyakizaka 2.4' } }
    );
    const token = signinRes.data.access_token;

    // 高井俐香 ID=90
    console.log('🔍 获取最新消息...');
    const timeline = await axios.get('https://api.kh.glastonr.net/v2/groups/90/timeline', {
        params: { count: 50, order: 'desc' },
        headers: { 'Authorization': 'Bearer ' + token, 'X-Talk-App-ID': 'jp.co.sonymusic.communication.keyakizaka 2.4' }
    });

    const msgs = timeline.data.messages || [];
    const voiceMsg = msgs.find(m => m.type === 'voice');

    if (!voiceMsg) {
        console.log('❌ 未找到语音消息');
        return;
    }

    console.log(`🎤 找到语音消息: ${voiceMsg.id} (${voiceMsg.published_at})`);

    // 2. 发送文字头
    const msgTime = new Date(voiceMsg.published_at);
    const timeStr = msgTime.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const header = `【高井 俐香】 ${timeStr}\n━━━━━━━━━━\n[语音测试]`;

    await axios.post(`${apiUrl}/send_group_msg`, { group_id: groupId, message: header });
    console.log('✅ 文字头已发送');

    // 3. 模拟 app-api-listener-v3.js 的新逻辑
    const containerPath = await downloadMedia('高井 俐香', voiceMsg);
    console.log('💻 本地路径:', containerPath);

    // 3.1 发送语音条
    try {
        const cqCode = `[CQ:record,file=file://${containerPath}]`;
        await axios.post(`${apiUrl}/send_group_msg`, {
            group_id: groupId,
            message: cqCode,
        });
        console.log('✅ 语音条已发送');
    } catch (e) {
        console.error('❌ 语音条发送失败:', e.message);
    }

    // 3.2 上传文件
    try {
        const fileName = containerPath.split('/').pop();
        await axios.post(`${apiUrl}/upload_group_file`, {
            group_id: groupId,
            file: containerPath,
            name: fileName,
        });
        console.log(`✅ 语音文件上传成功: ${fileName}`);
    } catch (e) {
        console.error('❌ 语音文件上传失败:', e.message);
    }
}

test().catch(e => console.error('Error:', e.message));
