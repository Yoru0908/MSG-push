require('dotenv').config();
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const apiUrl = 'http://127.0.0.1:3000';
const groupId = 1059030628;

async function downloadAndSend(memberName, message) {
    const safeMemberName = memberName.replace(/\s+/g, '_');
    const mediaDir = `/opt/napcat/config/media/${safeMemberName}`;
    if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
    }

    const urlPath = new URL(message.file).pathname;
    const fileName = path.basename(urlPath.split('?')[0]);
    const localPath = path.join(mediaDir, fileName);
    const containerPath = `/app/napcat/config/media/${safeMemberName}/${fileName}`;

    // 下载
    if (!fs.existsSync(localPath)) {
        console.log('下载中:', fileName);
        const response = await axios.get(message.file, {
            responseType: 'arraybuffer',
            timeout: 60000
        });
        fs.writeFileSync(localPath, response.data);
        console.log('下载完成, 大小:', response.data.length);
    } else {
        console.log('文件已存在:', fileName);
    }

    // 格式化时间
    const msgTime = new Date(message.published_at);
    const timeStr = msgTime.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    // 发送文字（如果有）
    let msgContent = `【${memberName}】 ${timeStr}\n━━━━━━━━━━\n`;
    if (message.text) {
        msgContent += message.text;
    } else {
        if (message.type === 'video') msgContent += '[视频]';
        else if (message.type === 'voice') msgContent += '[语音]';
        else if (message.type === 'picture' || message.type === 'image') msgContent += '[图片]';
        else msgContent += `[${message.type}]`;
    }

    console.log('发送文字...');
    await axios.post(`${apiUrl}/send_group_msg`, {
        group_id: groupId,
        message: msgContent,
    });

    // 发送媒体
    let cqCode;
    if (message.type === 'picture' || message.type === 'image') {
        cqCode = `[CQ:image,file=file://${containerPath}]`;
    } else if (message.type === 'video') {
        cqCode = `[CQ:video,file=file://${containerPath}]`;
    } else if (message.type === 'voice') {
        cqCode = `[CQ:record,file=file://${containerPath}]`;
    }

    console.log('发送媒体:', message.type);
    const r = await axios.post(`${apiUrl}/send_group_msg`, {
        group_id: groupId,
        message: cqCode,
    });
    console.log('结果:', r.data.status, r.data.message || '');
}

async function test() {
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

    const timeline = await axios.get('https://api.kh.glastonr.net/v2/groups/90/timeline', {
        params: { count: 100, order: 'desc' },
        headers: { 'Authorization': 'Bearer ' + token, 'X-Talk-App-ID': 'jp.co.sonymusic.communication.keyakizaka 2.4' }
    });

    const msgs = timeline.data.messages || [];

    // 找各种类型的消息
    const picture = msgs.find(m => m.type === 'picture' && m.file);
    const voice = msgs.find(m => m.type === 'voice' && m.file);
    const textWithPicture = msgs.find(m => m.type === 'picture' && m.text && m.file);

    console.log('\n=== 测试图片 ===');
    if (picture) await downloadAndSend('高井 俐香', picture);

    console.log('\n=== 测试语音 ===');
    if (voice) await downloadAndSend('高井 俐香', voice);

    console.log('\n=== 测试文字+图片 ===');
    if (textWithPicture) await downloadAndSend('高井 俐香', textWithPicture);

    console.log('\n完成！');
}

test().catch(e => console.error('Error:', e.message));
