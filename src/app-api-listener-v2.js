/**
 * 坂道消息 App API 实时监听器 V2
 * 使用 Google OAuth refresh_token 进行认证
 */

require('dotenv').config();
const axios = require('axios');

// Google OAuth 配置 (从 mitmproxy 抓取获得)
const GOOGLE_CLIENT_IDS = {
    nogizaka: '774090812281-f7fgecm61lajta7ghq04rmiglrc0ignh.apps.googleusercontent.com',
    sakurazaka: '653287631533-ha0dtiv68rtdi3mpsc3lovjh5vm3935c.apps.googleusercontent.com',
    hinatazaka: '197175115117-te99msjq1966l0cchpsil99ht7560nfa.apps.googleusercontent.com',
};

// API 配置
const SITES = {
    nogizaka: {
        name: '乃木坂46',
        baseUrl: 'https://api.n46.glastonr.net',
        appId: 'jp.co.sonymusic.communication.nogizaka 2.4',
        envKey: 'NOGIZAKA',
    },
    sakurazaka: {
        name: '櫻坂46',
        baseUrl: 'https://api.s46.glastonr.net',
        appId: 'jp.co.sonymusic.communication.sakurazaka 2.4',
        envKey: 'SAKURAZAKA',
    },
    hinatazaka: {
        name: '日向坂46',
        baseUrl: 'https://api.kh.glastonr.net',
        appId: 'jp.co.sonymusic.communication.keyakizaka 2.4',
        envKey: 'HINATAZAKA',
    }
};

class AppApiListenerV2 {
    constructor() {
        this.tokens = {};           // App access_token
        this.googleRefreshTokens = { // Google OAuth refresh_token
            nogizaka: process.env.NOGIZAKA_REFRESH_TOKEN,
            sakurazaka: process.env.SAKURAZAKA_REFRESH_TOKEN,
            hinatazaka: process.env.HINATAZAKA_REFRESH_TOKEN,
        };
        this.lastMessageIds = {};
        this.isRunning = false;
        this.checkInterval = 15000;
    }

    /**
     * 使用 Google refresh_token 获取 Google access_token 和 id_token
     */
    async getGoogleTokens(siteKey, googleRefreshToken) {
        const clientId = GOOGLE_CLIENT_IDS[siteKey];

        try {
            const response = await axios.post(
                'https://oauth2.googleapis.com/token',
                new URLSearchParams({
                    client_id: clientId,
                    refresh_token: googleRefreshToken,
                    grant_type: 'refresh_token',
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                }
            );

            console.log(`✅ ${SITES[siteKey].name}: Google token 刷新成功`);
            return {
                accessToken: response.data.access_token,
                idToken: response.data.id_token,
            };
        } catch (error) {
            console.error(`❌ ${SITES[siteKey].name}: Google token 刷新失败:`, error.response?.data || error.message);
            return null;
        }
    }

    /**
     * 使用 Google access_token 登录 App API，获取 App token
     */
    async signInWithGoogle(siteKey, googleAccessToken, googleIdToken) {
        const site = SITES[siteKey];

        try {
            console.log(`🔐 ${site.name}: 使用 Google 登录 App API...`);

            const response = await axios.post(
                `${site.baseUrl}/v2/signin`,
                {
                    auth_type: 'google',
                    token: googleIdToken,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Talk-App-ID': site.appId,
                        'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 11)',
                    }
                }
            );

            const { access_token, refresh_token } = response.data;
            this.tokens[siteKey] = access_token;

            console.log(`✅ ${site.name}: App 登录成功！`);
            return access_token;

        } catch (error) {
            console.error(`❌ ${site.name}: App 登录失败:`, error.response?.data || error.message);
            return null;
        }
    }

    /**
     * 完整的认证流程
     */
    async authenticate(siteKey) {
        const googleRefreshToken = this.googleRefreshTokens[siteKey];
        if (!googleRefreshToken) {
            console.log(`⚠️ ${SITES[siteKey].name}: 未配置 Google refresh_token`);
            return false;
        }

        // Step 1: Google refresh_token -> Google tokens
        const googleTokens = await this.getGoogleTokens(siteKey, googleRefreshToken);
        if (!googleTokens) return false;

        // Step 2: Google id_token -> App signin -> App access_token
        const appToken = await this.signInWithGoogle(siteKey, googleTokens.accessToken, googleTokens.idToken);
        return !!appToken;
    }

    /**
     * 获取订阅的成员列表
     */
    async getGroups(siteKey) {
        const site = SITES[siteKey];
        const token = this.tokens[siteKey];

        if (!token) return [];

        try {
            const response = await axios.get(
                `${site.baseUrl}/v2/groups`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                        'X-Talk-App-ID': site.appId,
                    }
                }
            );

            return response.data.groups || [];
        } catch (error) {
            if (error.response?.status === 401) {
                // Token 过期，重新认证
                await this.authenticate(siteKey);
            }
            return [];
        }
    }

    /**
     * 获取成员的最新消息
     */
    async getTimeline(siteKey, groupId, count = 20) {
        const site = SITES[siteKey];
        const token = this.tokens[siteKey];

        if (!token) return [];

        try {
            const response = await axios.get(
                `${site.baseUrl}/v2/groups/${groupId}/timeline`,
                {
                    params: { count },
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                        'X-Talk-App-ID': site.appId,
                    }
                }
            );

            return response.data.messages || [];
        } catch (error) {
            if (error.response?.status === 401) {
                await this.authenticate(siteKey);
            }
            return [];
        }
    }

    /**
     * 检查所有站点的新消息
     */
    async checkAllSites() {
        const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        console.log(`\n🔍 [${now}] 检查新消息...`);

        for (const siteKey of Object.keys(SITES)) {
            if (!this.googleRefreshTokens[siteKey]) continue;
            if (!this.tokens[siteKey]) continue;  // 跳过未认证的站点

            await this.checkSite(siteKey);
        }
    }

    /**
     * 检查单个站点的新消息
     */
    async checkSite(siteKey) {
        const site = SITES[siteKey];

        try {
            const groups = await this.getGroups(siteKey);

            for (const group of groups) {
                if (!group.is_subscription) continue;

                const messages = await this.getTimeline(siteKey, group.id, 5);
                const lastId = this.lastMessageIds[`${siteKey}_${group.id}`];

                for (const message of messages) {
                    if (lastId && message.id <= lastId) break;
                    await this.handleNewMessage(siteKey, group, message);
                }

                if (messages.length > 0) {
                    this.lastMessageIds[`${siteKey}_${group.id}`] = messages[0].id;
                }

                await this.sleep(200);
            }
        } catch (error) {
            console.error(`❌ ${site.name}: 检查失败:`, error.message);
        }
    }

    /**
     * 处理新消息
     */
    async handleNewMessage(siteKey, group, message) {
        const site = SITES[siteKey];

        console.log(`\n🎉 ${site.name} - ${group.name} 发来新消息！`);
        console.log(`   时间: ${message.published_at}`);
        console.log(`   类型: ${this.getMessageType(message)}`);

        if (message.text) {
            console.log(`   内容: ${message.text.substring(0, 50)}...`);
        }

        await this.sendToDiscord(siteKey, group, message);
    }

    getMessageType(message) {
        if (message.text) return 'テキスト';
        if (message.file?.content_type?.includes('image')) return '画像';
        if (message.file?.content_type?.includes('video')) return '動画';
        if (message.file?.content_type?.includes('audio')) return 'ボイス';
        return '不明';
    }

    async sendToDiscord(siteKey, group, message) {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) return;

        const site = SITES[siteKey];

        try {
            const embed = {
                title: `💌 ${group.name} の新着メッセージ`,
                description: message.text || `[${this.getMessageType(message)}]`,
                color: this.getSiteColor(siteKey),
                timestamp: message.published_at,
                thumbnail: { url: group.image_url },
                footer: { text: site.name }
            };

            if (message.file?.content_type?.includes('image')) {
                embed.image = { url: message.file.url };
            }

            await axios.post(webhookUrl, { embeds: [embed] });
            console.log('   ✅ 已推送到 Discord');

        } catch (error) {
            console.error('   ❌ Discord 推送失败:', error.message);
        }
    }

    getSiteColor(siteKey) {
        const colors = {
            nogizaka: 0x8E44AD,
            sakurazaka: 0xE91E63,
            hinatazaka: 0x3498DB,
        };
        return colors[siteKey] || 0x5865F2;
    }

    /**
     * 启动监听
     */
    async start(intervalSeconds = 15) {
        this.checkInterval = intervalSeconds * 1000;
        this.isRunning = true;

        console.log('╔════════════════════════════════════════════╗');
        console.log('║  坂道メッセージ App API リスナー V2        ║');
        console.log('║  (Google OAuth refresh_token 方式)         ║');
        console.log('╠════════════════════════════════════════════╣');
        console.log(`║ 検査間隔: ${intervalSeconds}秒`);
        console.log('║ Ctrl+C で停止');
        console.log('╚════════════════════════════════════════════╝\n');

        // 认证所有站点
        console.log('🔐 認証中...\n');
        for (const siteKey of Object.keys(SITES)) {
            if (this.googleRefreshTokens[siteKey]) {
                const success = await this.authenticate(siteKey);
                console.log(`   ${SITES[siteKey].name}: ${success ? '✅ 準備完了' : '❌ 認証失敗'}`);
            } else {
                console.log(`   ${SITES[siteKey].name}: ⚠️ refresh_token 未設定`);
            }
        }

        // 定期刷新 token（每30分钟）
        setInterval(async () => {
            console.log('\n🔄 定期更新 token...');
            for (const siteKey of Object.keys(SITES)) {
                if (this.googleRefreshTokens[siteKey]) {
                    await this.authenticate(siteKey);
                }
            }
        }, 30 * 60 * 1000);

        // 开始监听
        console.log('\n');
        await this.checkAllSites();

        setInterval(() => {
            if (this.isRunning) {
                this.checkAllSites();
            }
        }, this.checkInterval);
    }

    stop() {
        this.isRunning = false;
        console.log('\n👋 リスナーを停止しました');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 运行
if (require.main === module) {
    const listener = new AppApiListenerV2();
    const intervalSeconds = parseInt(process.argv[2]) || 15;

    listener.start(intervalSeconds);

    process.on('SIGINT', () => {
        listener.stop();
        process.exit(0);
    });
}

module.exports = AppApiListenerV2;
