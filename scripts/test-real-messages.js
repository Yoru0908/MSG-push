require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const translator = require('../src/translator');

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
        console.log('   下载媒体中:', fileName);
        const response = await axios.get(message.file, { responseType: 'arraybuffer', timeout: 60000 });
        fs.writeFileSync(localPath, response.data);
    }
    return containerPath;
}

async function sendToQQ(memberName, message, translated) {
    const msgTime = new Date(message.published_at);
    const timeStr = msgTime.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    let msgContent = `【${memberName}】 ${timeStr}\n━━━━━━━━━━\n`;

    if (message.text) {
        if (translated) {
            msgContent += message.text + `\n\n📝 ${translated}`;
        } else {
            msgContent += message.text;
        }
    } else {
        if (message.type === 'video') msgContent += '[视频]';
        else if (message.type === 'voice') msgContent += '[语音]';
        else if (message.type === 'picture') msgContent += '[图片]';
        else msgContent += `[${message.type}]`;
    }

    // 发送文字
    await axios.post(`${apiUrl}/send_group_msg`, { group_id: groupId, message: msgContent });
    console.log('   文字已发送');

    // 发送媒体
    if (message.file && (message.type === 'picture' || message.type === 'image')) {
        const containerPath = await downloadMedia(memberName, message);
        await axios.post(`${apiUrl}/send_group_msg`, {
            group_id: groupId,
            message: `[CQ:image,file=file://${containerPath}]`
        });
        console.log('   图片已发送');
    }
}

async function test() {
    console.log('登录中...');
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
    console.log('登录成功');

    // 获取消息
    const timeline = await axios.get('https://api.kh.glastonr.net/v2/groups/90/timeline', {
        params: { count: 50, order: 'desc' },
        headers: { 'Authorization': 'Bearer ' + token, 'X-Talk-App-ID': 'jp.co.sonymusic.communication.keyakizaka 2.4' }
    });

    const msgs = timeline.data.messages || [];
    const textOnly = msgs.find(m => m.type === 'text' && m.text);
    const pictureWithText = msgs.find(m => m.type === 'picture' && m.text && m.file);

    // 测试 1: 纯文本
    console.log('\n=== 测试 1: 纯文本消息 ===');
    console.log('原文:', textOnly.text);
    const translated1 = await translator.translate(textOnly.text, '高井 俐香');
    console.log('翻译:', translated1);
    await sendToQQ('高井 俐香', textOnly, translated1);
    console.log('✅ 纯文本消息发送成功');

    // 测试 2: 带图片的文本
    console.log('\n=== 测试 2: 带图片的文本消息 ===');
    console.log('原文:', pictureWithText.text);
    const translated2 = await translator.translate(pictureWithText.text, '高井 俐香');
    console.log('翻译:', translated2);
    await sendToQQ('高井 俐香', pictureWithText, translated2);
    console.log('✅ 带图片的文本消息发送成功');

    console.log('\n🎉 所有测试完成！');
}

test().catch(e => console.error('Error:', e.message));
