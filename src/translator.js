const axios = require('axios');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyBPFyev06o31EgrCoOVqiiTtChBP88S0vc';
const MODEL = 'gemini-2.5-flash';

const fs = require('fs');
const path = require('path');

// 读取 Prompt 文件
const PROMPT_FILE = path.join(__dirname, 'prompt.md');
let SYSTEM_PROMPT = '';

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

/**
 * 调用 Google Gemini 翻译消息
 * @param {string} text 日文原文
 * @param {string} memberName 成员名字（用于上下文）
 * @returns {Promise<string>} 翻译后的文本
 */
async function translate(text, memberName) {
    if (!text || !GOOGLE_API_KEY) return null;

    try {
        // 通过 Cloudflare Worker 代理访问 Gemini API
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
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30秒超时
            }
        );

        const translatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return translatedText || null;
    } catch (error) {
        console.error('   ⚠️ 翻译失败:', error.message);
        if (error.response) {
            console.error('   响应:', JSON.stringify(error.response.data));
        }
        return null;
    }
}

module.exports = { translate };
