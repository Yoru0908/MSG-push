const axios = require('axios');
const usageStats = require('./usage-stats');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyBPFyev06o31EgrCoOVqiiTtChBP88S0vc';
const MODEL = 'gemini-2.5-pro';

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
 * 调用 Google Gemini 翻译消息（仅译文输出）
 * @param {string} text 日文原文
 * @param {string} memberName 成员名字（用于上下文）
 * @returns {Promise<string>} 翻译后的文本
 */
async function translate(text, memberName) {
    if (!text || !GOOGLE_API_KEY) return null;

    try {
        // 通过 Cloudflare Worker 代理访问 Gemini API（服务器 IP 被 Google 限制）
        const proxyUrl = `https://gemini-proxy.srzwyuu.workers.dev?key=${GOOGLE_API_KEY}&model=${MODEL}`;

        const response = await axios.post(
            proxyUrl,
            {
                contents: [
                    {
                        parts: [
                            {
                                text: `${SYSTEM_PROMPT}\n\n【成员名字】: ${memberName}\n\n【日文原文】:\n${text}`
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 1.0,
                    maxOutputTokens: 65536,
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // 60秒超时
            }
        );

        const translatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        // 统计 Token 使用量
        const usageMetadata = response.data.usageMetadata || {};
        const inputTokens = usageMetadata.promptTokenCount || 0;
        const outputTokens = usageMetadata.candidatesTokenCount || 0;
        const cachedTokens = usageMetadata.cachedContentTokenCount || 0;
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
 * 调用 Google Gemini 翻译消息（中日双语对照输出，用于 OCR）
 * @param {string} text 日文原文
 * @param {string} memberName 成员名字（用于上下文）
 * @returns {Promise<string>} 中日双语对照的翻译文本
 */
async function translateForOcr(text, memberName) {
    if (!text || !GOOGLE_API_KEY) return null;

    try {
        // 通过 Cloudflare Worker 代理访问 Gemini API（服务器 IP 被 Google 限制）
        const proxyUrl = `https://gemini-proxy.srzwyuu.workers.dev?key=${GOOGLE_API_KEY}&model=${MODEL}`;

        const response = await axios.post(
            proxyUrl,
            {
                contents: [
                    {
                        parts: [
                            {
                                text: `${SYSTEM_PROMPT_OCR}\n\n【成员名字】: ${memberName}\n\n【日文原文】:\n${text}`
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 1.0,
                    maxOutputTokens: 65536,
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 300000 // 5分钟超时（Prompt 较长，不急）
            }
        );

        const translatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        // 统计 Token 使用量
        const usageMetadata = response.data.usageMetadata || {};
        const inputTokens = usageMetadata.promptTokenCount || 0;
        const outputTokens = usageMetadata.candidatesTokenCount || 0;
        const cachedTokens = usageMetadata.cachedContentTokenCount || 0;
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
        translate(testText, '测试').then(result => {
            console.log('普通翻译结果:');
            console.log(result);
        });
    }
}

