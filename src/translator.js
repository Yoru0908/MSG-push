const axios = require('axios');
const usageStats = require('./usage-stats');

// 从环境变量读取配置
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCcbmhtIuTPm1QyfjHwaV5cKo4GMPdWwRA';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

const fs = require('fs');
const path = require('path');

// 读取 Prompt 文件
const PROMPT_FILE = path.join(__dirname, 'prompt.md');
const PROMPT_OCR_FILE = path.join(__dirname, 'Prompt-orc.md');

let SYSTEM_PROMPT = '';
let SYSTEM_PROMPT_OCR = '';

try {
    SYSTEM_PROMPT = fs.readFileSync(PROMPT_FILE, 'utf8');
} catch (e) {
    console.error('⚠️ 无法读取 prompt.md:', e.message);
    SYSTEM_PROMPT = `你是一个资深的坂道系偶像粉丝字幕组翻译。
请将用户的日文消息翻译成通顺的中文。

- 如果有颜文字，请保留
- 如果有梗或特定称呼，请意译或在括号内解释
- 只输出翻译后的内容，不要包含"翻译："等前缀`;
}

try {
    SYSTEM_PROMPT_OCR = fs.readFileSync(PROMPT_OCR_FILE, 'utf8');
} catch (e) {
    console.error('⚠️ 无法读取 Prompt-orc.md，使用默认 prompt');
    SYSTEM_PROMPT_OCR = SYSTEM_PROMPT;
}

/**
 * 通用请求函数 - 通过 Cloudflare Worker 代理
 */
async function sendGeminiRequest(text, memberName, isOcr = false) {
    const systemPrompt = isOcr ? SYSTEM_PROMPT_OCR : SYSTEM_PROMPT;
    const userContent = `【成员名字】: ${memberName}\n\n【日文原文】:\n${text}`;

    // 通过 Cloudflare Worker 代理访问
    const proxyUrl = `https://gemini-proxy.srzwyuu.workers.dev?key=${GEMINI_API_KEY}&model=${MODEL}`;

    try {
        const response = await axios.post(
            proxyUrl,
            {
                contents: [{
                    parts: [{ text: `${systemPrompt}\n\n${userContent}` }]
                }],
                generationConfig: {
                    temperature: 0.5,
                    maxOutputTokens: 4096,
                }
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: isOcr ? 300000 : 60000
            }
        );

        return {
            text: response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim(),
            usage: response.data.usageMetadata || {}
        };
    } catch (error) {
        throw error;
    }
}

/**
 * 翻译消息
 */
async function translate(text, memberName) {
    if (!text) return null;

    try {
        const result = await sendGeminiRequest(text, memberName, false);
        const translatedText = result.text;

        // 统计
        const usage = result.usage;
        const inputTokens = usage.promptTokenCount || 0;
        const outputTokens = usage.candidatesTokenCount || 0;
        const cachedTokens = usage.cachedContentTokenCount || 0;

        usageStats.recordCall('translate', inputTokens, outputTokens, !!translatedText, cachedTokens);
        return translatedText || null;
    } catch (error) {
        console.error('   ⚠️ 翻译失败:', error.message);
        if (error.response) {
            console.error('   响应:', JSON.stringify(error.response.data));
        }
        usageStats.recordCall('translate', 0, 0, false);
        return null;
    }
}

/**
 * OCR 翻译
 */
async function translateForOcr(text, memberName) {
    if (!text) return null;

    try {
        const result = await sendGeminiRequest(text, memberName, true);
        const translatedText = result.text;

        const usage = result.usage;
        const inputTokens = usage.promptTokenCount || 0;
        const outputTokens = usage.candidatesTokenCount || 0;
        const cachedTokens = usage.cachedContentTokenCount || 0;

        usageStats.recordCall('translateOcr', inputTokens, outputTokens, !!translatedText, cachedTokens);
        return translatedText || null;
    } catch (error) {
        console.error('   ⚠️ OCR翻译失败:', error.message);
        if (error.response) {
            console.error('   响应:', JSON.stringify(error.response.data));
        }
        usageStats.recordCall('translateOcr', 0, 0, false);
        return null;
    }
}

module.exports = { translate, translateForOcr };

// 如果直接运行此文件，进行测试
if (require.main === module) {
    const testText = process.argv[2] || 'おはよう！今日も頑張ろうね！';
    const mode = process.argv[3] || 'normal'; // 'normal' 或 'ocr'

    if (mode === 'ocr') {
        translateForOcr(testText, '测试').then(result => {
            console.log('OCR 双语翻译结果:');
            console.log(result);
        });
    } else {
        translate(testText, 'テスト').then(result => {
            console.log('普通翻译结果:');
            console.log(result);
        });
    }
}
