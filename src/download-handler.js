/**
 * 下载处理模块
 * 调用 homeserver videobot API 下载视频，生成 Alist 直链
 */

const axios = require('axios');

const VIDEOBOT_API = process.env.VIDEOBOT_API || 'https://videodownload.sakamichi-tools.cn';
const ALIST_PUBLIC = process.env.ALIST_PUBLIC || 'https://alist.sakamichi-tools.cn';

// 从文本中提取 URL
function extractUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
}

// 判断是否为下载命令
function isDownloadCommand(text) {
    const keywords = ['下载', 'download', '帮我下', '录播', 'dl'];
    const lower = text.toLowerCase();
    return keywords.some(k => lower.includes(k));
}

// 提交下载任务
async function submitDownloadTask(url, action = 'download') {
    try {
        const resp = await axios.post(`${VIDEOBOT_API}/api/tasks`, {
            action,
            url
        }, { timeout: 10000 });
        return resp.data.task_id;
    } catch (e) {
        console.error('[Download] 提交任务失败:', e.message);
        return null;
    }
}

// 轮询任务状态（最多等 30 分钟）
async function waitForTask(taskId, maxWaitMs = 30 * 60 * 1000) {
    const startTime = Date.now();
    const pollInterval = 5000;

    while (Date.now() - startTime < maxWaitMs) {
        await new Promise(r => setTimeout(r, pollInterval));

        try {
            const resp = await axios.get(`${VIDEOBOT_API}/api/tasks/${taskId}`, {
                timeout: 10000
            });
            const task = resp.data;

            if (task.status === 'completed') {
                return { success: true, task };
            } else if (task.status === 'failed' || task.status === 'stopped') {
                return { success: false, task };
            }

            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.log(`[Download] 任务 ${taskId} 进行中... ${task.progress || 0}% (${elapsed}s)`);
        } catch (e) {
            console.error('[Download] 轮询失败:', e.message);
        }
    }

    return { success: false, task: null };
}

// 获取 Alist 直链
function getAlistLink(filename) {
    return `${ALIST_PUBLIC}/d/downloads/${filename}`;
}

// 主处理函数 - 在 group-chat-handler 中调用
async function handleDownloadRequest(event, textContent, sendReply) {
    const url = extractUrl(textContent);

    if (!url) {
        await sendReply(event, '❓ 请提供视频链接\n例如: @bot 下载 https://youtube.com/watch?v=xxx');
        return;
    }

    const isRecord = textContent.includes('录播') || textContent.includes('直播');
    const action = isRecord ? 'record' : 'download';

    await sendReply(event, `📥 正在提交${isRecord ? '录播' : '下载'}任务...\n🔗 ${url}`);

    // 提交任务
    const taskId = await submitDownloadTask(url, action);
    if (!taskId) {
        await sendReply(event, '❌ 任务提交失败，请稍后再试');
        return;
    }

    console.log(`[Download] 任务已提交: ${taskId}`);
    await sendReply(event, `✅ 任务已创建: ${taskId.slice(-8)}\n⏳ 正在下载，完成后自动发送链接...`);

    // 等待完成
    const result = await waitForTask(taskId);

    if (!result.success) {
        await sendReply(event, `❌ 下载失败，任务: ${taskId.slice(-8)}`);
        return;
    }

    // 获取文件信息
    const task = result.task;
    const outputFile = task.output_file || '';
    const filename = outputFile.split('/').pop();
    const fileSizeMb = task.file_size ? (task.file_size / 1024 / 1024).toFixed(1) : '?';

    // 生成下载链接
    const link = getAlistLink(filename);

    await sendReply(event,
        `🟢 下载完成！\n` +
        `📁 文件: ${filename}\n` +
        `📦 大小: ${fileSizeMb}MB\n` +
        `🔗 下载链接:\n${link}`
    );

    console.log(`[Download] 任务完成，链接已发送: ${link}`);
}

module.exports = {
    isDownloadCommand,
    handleDownloadRequest,
    extractUrl
};
