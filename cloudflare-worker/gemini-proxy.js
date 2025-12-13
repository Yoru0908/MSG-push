// Cloudflare Worker - Gemini API 代理
// 部署步骤：
// 1. 登录 Cloudflare Dashboard -> Workers & Pages
// 2. 创建新 Worker
// 3. 粘贴此代码并部署
// 4. 获取 Worker URL (如: gemini-proxy.xxx.workers.dev)

export default {
    async fetch(request, env) {
        // 只允许 POST 请求
        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }

        // 获取请求体
        const body = await request.text();

        // 从 URL 获取 API Key 和模型
        const url = new URL(request.url);
        const apiKey = url.searchParams.get('key');
        const model = url.searchParams.get('model') || 'gemini-2.5-pro';

        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Missing API key' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 转发到 Google Gemini API
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(geminiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body,
            });

            const data = await response.text();

            return new Response(data, {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },
};
