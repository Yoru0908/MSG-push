require('dotenv').config();
const axios = require('axios');
const path = require('path');
const fs = require('fs');

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

    // 获取高井俐香的消息
    const timeline = await axios.get('https://api.kh.glastonr.net/v2/groups/90/timeline', {
        params: { count: 100, order: 'desc' },
        headers: { 'Authorization': 'Bearer ' + token, 'X-Talk-App-ID': 'jp.co.sonymusic.communication.keyakizaka 2.4' }
    });

    const msgs = timeline.data.messages || [];

    // 找各种类型
    const types = {};
    msgs.forEach(m => {
        if (!types[m.type]) {
            types[m.type] = m;
        }
    });

    console.log('找到的消息类型:');
    for (const t of Object.keys(types)) {
        const m = types[t];
        console.log('---');
        console.log('类型:', t);
        console.log('ID:', m.id);
        console.log('有文字:', !!m.text);
        console.log('有文件:', !!m.file);
        if (m.text) console.log('文字预览:', m.text.substring(0, 30));
        if (m.file) console.log('文件URL:', m.file.substring(0, 80));
    }

    // 找一条既有文字又有图片的
    const textWithImage = msgs.find(m => m.text && m.file && m.type === 'image');
    if (textWithImage) {
        console.log('\n=== 既有文字又有图片的消息 ===');
        console.log('ID:', textWithImage.id);
        console.log('文字:', textWithImage.text.substring(0, 50));
        console.log('图片URL:', textWithImage.file.substring(0, 80));
    }
}

test().catch(e => console.error('Error:', e.message));
