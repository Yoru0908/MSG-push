/**
 * Playwright Web 登录 Demo
 * 
 * 功能：
 * 1. 首次运行：打开浏览器让用户手动登录，保存状态
 * 2. 之后运行：加载状态，自动刷新 Token
 * 3. 如果失败：发送 Discord 通知
 * 
 * 使用方法：
 * - 首次运行：node scripts/playwright-login.js --init
 * - 自动刷新：node scripts/playwright-login.js
 */

const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    // 站点配置
    sites: {
        hinatazaka: {
            name: '日向坂46',
            welcomeUrl: 'https://message.hinatazaka46.com/welcome',
            apiBase: 'https://api.message.hinatazaka46.com',
        },
        sakurazaka: {
            name: '樱坂46',
            welcomeUrl: 'https://message.sakurazaka46.com/welcome',
            apiBase: 'https://api.message.sakurazaka46.com',
        },
        nogizaka: {
            name: '乃木坂46',
            welcomeUrl: 'https://message.nogizaka46.com/welcome',
            apiBase: 'https://api.message.nogizaka46.com',
        },
    },

    // 状态文件保存路径
    stateDir: path.join(__dirname, '../.browser-state'),

    // Discord Webhook
    discordWebhook: 'https://discord.com/api/webhooks/1448890346787438726/B5Ua-DLBcYPfjE7TO2vi1yZIhpZBLT5LCNTfmsum8xxH_G0J5Ek3rhjqhj733JwYRuTy',

    // Token 保存路径
    tokenFile: path.join(__dirname, '../.web-tokens.json'),
};

// 确保目录存在
if (!fs.existsSync(CONFIG.stateDir)) {
    fs.mkdirSync(CONFIG.stateDir, { recursive: true });
}

/**
 * 发送 Discord 通知
 */
async function sendDiscordAlert(message) {
    try {
        await axios.post(CONFIG.discordWebhook, {
            content: `⚠️ **坂道消息推送警告**\n${message}`,
        });
        console.log('📢 Discord 通知已发送');
    } catch (e) {
        console.error('Discord 通知发送失败:', e.message);
    }
}

/**
 * 初始化模式：让用户手动登录并保存状态
 */
async function initMode(siteKey) {
    const site = CONFIG.sites[siteKey];
    if (!site) {
        console.error(`❌ 未知站点: ${siteKey}`);
        return;
    }

    const stateFile = path.join(CONFIG.stateDir, `${siteKey}-state.json`);

    console.log(`🚀 初始化 ${site.name} 登录状态...`);
    console.log(`   请在浏览器中完成登录，登录成功后脚本会自动保存状态。\n`);

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // 监听网络请求，捕获 Token
    let accessToken = null;
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/v2/signin') && response.status() === 200) {
            try {
                const data = await response.json();
                if (data.access_token) {
                    accessToken = data.access_token;
                    console.log('✅ 检测到登录成功！');
                    console.log('   Access Token:', accessToken.substring(0, 40) + '...');
                }
            } catch (e) { /* ignore */ }
        }
    });

    await page.goto(site.welcomeUrl);

    // 等待用户登录（最多 5 分钟）
    console.log('⏳ 等待登录...');
    try {
        await page.waitForURL('**/talks**', { timeout: 300000 }); // 登录成功后通常跳转到 /talks
        console.log('✅ 检测到页面跳转，登录可能成功');
    } catch (e) {
        console.log('⏰ 等待超时或用户关闭浏览器');
    }

    // 保存状态
    await context.storageState({ path: stateFile });
    console.log(`💾 浏览器状态已保存到: ${stateFile}`);

    // 保存 Token
    if (accessToken) {
        const tokens = fs.existsSync(CONFIG.tokenFile)
            ? JSON.parse(fs.readFileSync(CONFIG.tokenFile, 'utf8'))
            : {};
        tokens[siteKey] = {
            accessToken,
            updatedAt: new Date().toISOString(),
        };
        fs.writeFileSync(CONFIG.tokenFile, JSON.stringify(tokens, null, 2));
        console.log(`💾 Token 已保存`);
    }

    await browser.close();
    console.log('\n✅ 初始化完成！之后可以运行无头模式自动刷新 Token。');
}

/**
 * 自动刷新模式：加载状态，刷新 Token
 */
async function refreshMode(siteKey) {
    const site = CONFIG.sites[siteKey];
    if (!site) {
        console.error(`❌ 未知站点: ${siteKey}`);
        return null;
    }

    const stateFile = path.join(CONFIG.stateDir, `${siteKey}-state.json`);

    if (!fs.existsSync(stateFile)) {
        console.error(`❌ 未找到 ${site.name} 的登录状态，请先运行: node scripts/playwright-login.js --init ${siteKey}`);
        await sendDiscordAlert(`${site.name} 需要重新登录！请运行初始化命令。`);
        return null;
    }

    console.log(`🔄 刷新 ${site.name} 的 Token...`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: stateFile });
    const page = await context.newPage();

    let accessToken = null;
    let loginSuccess = false;

    // 监听登录响应
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/v2/signin') && response.status() === 200) {
            try {
                const data = await response.json();
                if (data.access_token) {
                    accessToken = data.access_token;
                    loginSuccess = true;
                }
            } catch (e) { /* ignore */ }
        }
    });

    try {
        // 访问页面（如果已登录，可能直接跳转）
        await page.goto(site.welcomeUrl, { waitUntil: 'networkidle' });

        // 检查是否已经在登录状态
        const currentUrl = page.url();
        if (currentUrl.includes('/talks')) {
            console.log('   检测到已登录状态');
            // 尝试刷新页面获取新 Token（可能需要点击某个按钮或直接调用 API）
        }

        // 等待一下看是否有 Token
        await page.waitForTimeout(3000);

        // 如果没有自动获得 Token，尝试点击登录按钮
        if (!accessToken) {
            // 查找 Google 登录按钮
            const googleBtn = await page.$('button:has-text("Google"), [data-provider="google"]');
            if (googleBtn) {
                console.log('   点击 Google 登录按钮...');
                await googleBtn.click();
                await page.waitForTimeout(5000);
            }
        }

        // 保存更新后的状态
        await context.storageState({ path: stateFile });

    } catch (e) {
        console.error('❌ 刷新失败:', e.message);
        await sendDiscordAlert(`${site.name} Token 刷新失败: ${e.message}\n请手动重新登录。`);
    }

    await browser.close();

    if (accessToken) {
        console.log('✅ Token 刷新成功!');
        console.log('   Access Token:', accessToken.substring(0, 40) + '...');

        // 保存 Token
        const tokens = fs.existsSync(CONFIG.tokenFile)
            ? JSON.parse(fs.readFileSync(CONFIG.tokenFile, 'utf8'))
            : {};
        tokens[siteKey] = {
            accessToken,
            updatedAt: new Date().toISOString(),
        };
        fs.writeFileSync(CONFIG.tokenFile, JSON.stringify(tokens, null, 2));

        return accessToken;
    } else {
        console.log('⚠️ 未能获取 Token，可能需要重新初始化');
        await sendDiscordAlert(`${site.name} 未能获取 Token，Session 可能已过期。请重新登录。`);
        return null;
    }
}

/**
 * 主函数
 */
async function main() {
    const args = process.argv.slice(2);
    const isInit = args.includes('--init');
    const siteKey = args.find(a => !a.startsWith('-')) || 'hinatazaka';

    console.log('========================================');
    console.log('  Playwright Web 登录 Demo');
    console.log('========================================\n');

    if (isInit) {
        await initMode(siteKey);
    } else {
        const token = await refreshMode(siteKey);
        if (token) {
            // 测试 Token 是否可用
            console.log('\n🔄 测试 Token...');
            try {
                const site = CONFIG.sites[siteKey];
                const res = await axios.get(`${site.apiBase}/v2/groups`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'X-Talk-App-ID': 'jp.co.sonymusic.communication.keyakizaka 2.5',
                        'X-Talk-App-Platform': 'web',
                    }
                });
                const groups = res.data.groups || res.data;
                console.log(`✅ API 测试成功! 获取到 ${groups.length} 个群组`);
            } catch (e) {
                console.error('❌ API 测试失败:', e.message);
            }
        }
    }
}

main().catch(console.error);
