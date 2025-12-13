const path = require('path');
const fs = require('fs');
const axios = require('axios');

const videoUrl = 'https://d3ux740zhdvrpf.cloudfront.net/private/messages/files/426508-20251212-080619.mp4?Expires=1765532716&Signature=S6E2jUDYwtsXNgdSHFJqvoT4q5iu-oLrAfRIScsYms6lJdQ4UPI1cV1T1sm-PVyN0t8sQWhEPJ~PWpu16~G5-SQbTodu0f82Z0rScSP2WfDY1KbMrr49k0q5uYzExdKW5gsyTPAcjTdd7lrbnPzb9QaAJuW5yK9433TR0-5e7dfAUT~VS9phM6e9meju~hac7Hmgd8MDGjIFq3ZgzPkThvg2~M4V4-1Vl7tcPVHn~a-CfxmLq3SylVzhFPGPaYp9PWdObLO2X3CPmAavyWuuxsS1yItyrzUQ6JBRsEYKJP~NfJhKklsg17pQkEn8gP9BNCoEY4AnxTPrOfWqG~ccjw__&Key-Pair-Id=K3PZ1V79C6AO42';

async function test() {
    const mediaDir = '/opt/msg-pusher/media/高井_俐香';
    if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
    }

    console.log('下载视频...');
    const response = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
    });

    const localPath = path.join(mediaDir, '426508-test.mp4');
    fs.writeFileSync(localPath, response.data);
    console.log('下载完成:', localPath);
    console.log('文件大小:', fs.statSync(localPath).size, 'bytes');

    // 发送到 QQ
    console.log('发送到 QQ...');
    const r = await axios.post('http://127.0.0.1:3000/send_group_msg', {
        group_id: 1059030628,
        message: '[CQ:video,file=file://' + localPath + ']',
    });
    console.log('发送结果:', r.data.status, r.data.message || '');
}

test().catch(e => console.error('Error:', e.message));
