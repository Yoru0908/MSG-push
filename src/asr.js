/**
 * 音视频转写模块 (ASR)
 * 使用 Gemini 3.1 Pro 进行音视频转写
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const usageStats = require('./usage-stats');

// ASR 专用模型
const ASR_MODEL = 'gemini-3.1-pro-preview'; // Gemini 2.0 Flash Experimental 支持音视频

// 读取 Prompt 文件
const PROMPT_FILE = path.join(__dirname, 'prompt.md');
let SYSTEM_PROMPT = '';

try {
    SYSTEM_PROMPT = fs.readFileSync(PROMPT_FILE, 'utf8');
} catch (e) {
    console.error('⚠️ 无法读取 prompt.md:', e.message);
    SYSTEM_PROMPT = `你是一个坂道系偶像字幕组翻译。
请将音视频中的日文内容转写并翻译成简体中文。

要求：
- 只输出纯净的简体中文译文
- 保持原文的情感和语气
- 如有颜文字或emoji请保留
- 如果无法识别，请标注[无法识别]
- 只输出翻译后的内容，不要包含"翻译："等前缀`;
}

/**
 * 将本地文件转换为 Gemini API 需要的 base64 格式
 */
function fileToBase64(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        return fileBuffer.toString('base64');
    } catch (e) {
        console.error(`⚠️ 读取文件失败: ${filePath}`, e.message);
        return null;
    }
}

/**
 * 获取文件的 MIME 类型
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.3gp': 'video/3gpp',
        '.aac': 'audio/aac',
        '.ogg': 'audio/ogg',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * 通过 Cloudflare Worker 代理调用 Gemini API 进行音视频转写
 */
async function transcribeMedia(filePath, memberName) {
    if (!filePath || !fs.existsSync(filePath)) {
        console.error('⚠️ 文件不存在:', filePath);
        return null;
    }

    const fileSize = fs.statSync(filePath).size;
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB 限制

    if (fileSize > MAX_FILE_SIZE) {
        console.log(`   ⚠️ 文件太大 (${(fileSize / 1024 / 1024).toFixed(1)}MB)，跳过转写`);
        return null;
    }

    // 转换为 base64
    const base64Data = fileToBase64(filePath);
    if (!base64Data) {
        return null;
    }

    const mimeType = getMimeType(filePath);
    const fileName = path.basename(filePath);

    // 构建 prompt
    const userContent = `【成员名字】: ${memberName}
【任务】: 请仔细聆听音视频内容，将日文内容准确转写并翻译成简体中文。

【要求】
- 只输出纯净的简体中文译文
- 保持原文的情感、语气和颜文字/emoji
- 如有不确定的内容，标注[疑似: xxx]
- 如果无法识别或无声音，标注[无语音内容]或[无法识别]
- 只输出翻译后的内容，不要添加任何前缀或解释`;

    // 通过 Cloudflare Worker 代理
    const proxyUrl = `https://gemini-proxy.srzwyuu.workers.dev?model=${ASR_MODEL}`;

    try {
        console.log(`   🎤 正在调用 Gemini ASR 转写...`);

        const response = await axios.post(
            proxyUrl,
            {
                contents: [{
                    parts: [
                        { text: `${SYSTEM_PROMPT}\n\n${userContent}` },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Data
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 8192,
                }
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 300000 // 5分钟超时
            }
        );

        const transcribedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (transcribedText) {
            // 统计
            const usage = response.data.usageMetadata || {};
            const inputTokens = usage.promptTokenCount || 0;
            const outputTokens = usage.candidatesTokenCount || 0;
            const cachedTokens = usage.cachedContentTokenCount || 0;

            usageStats.recordCall('asr', inputTokens, outputTokens, true, cachedTokens);

            console.log(`   ✅ ASR 转写完成 (${(fileSize / 1024 / 1024).toFixed(1)}MB)`);
            return transcribedText;
        } else {
            console.log(`   ⚠️ ASR 未返回有效内容`);
            usageStats.recordCall('asr', 0, 0, false);
            return null;
        }
    } catch (error) {
        console.error('   ⚠️ ASR 转写失败:', error.message);
        if (error.response) {
            console.error('   响应:', JSON.stringify(error.response.data).substring(0, 500));
        }
        usageStats.recordCall('asr', 0, 0, false);
        return null;
    }
}

/**
 * 直接处理音视频 URL（远程文件）
 * 适用于需要先下载再转写的场景
 */
async function transcribeFromUrl(mediaUrl, memberName, localFilePath) {
    // 如果已有本地文件路径，直接转写
    if (localFilePath && fs.existsSync(localFilePath)) {
        return await transcribeMedia(localFilePath, memberName);
    }

    // 否则返回 null，让调用方先下载
    return null;
}

module.exports = { transcribeMedia, transcribeFromUrl };

// 测试
if (require.main === module) {
    const testFile = process.argv[2];
    const testMember = process.argv[3] || '测试成员';

    if (testFile && fs.existsSync(testFile)) {
        console.log(`测试 ASR 转写: ${testFile}`);
        transcribeMedia(testFile, testMember).then(result => {
            console.log('\n===== 转写结果 =====');
            console.log(result || '转写失败');
        });
    } else {
        console.log('用法: node asr.js <音频/视频文件路径> [成员名字]');
    }
}
