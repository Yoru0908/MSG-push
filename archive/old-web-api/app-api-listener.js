/**
 * 坂道消息 App API 实时监听器
 * 使用 refresh_token 实现近实时消息推送
 */

require('dotenv').config();
const axios = require('axios');

// API 配置 (X-Talk-App-ID 需要包含版本号 2.4)
const SITES = {
    nogizaka: {
        name: '乃木坂46',
        baseUrl: 'https://api.n46.glastonr.net',
        appId: 'jp.co.sonymusic.communication.nogizaka 2.4',
    },
    sakurazaka: {
        name: '櫻坂46',
        baseUrl: 'https://api.s46.glastonr.net',
        appId: 'jp.co.sonymusic.communication.sakurazaka 2.4',
    },
    hinatazaka: {
        name: '日向坂46',
        baseUrl: 'https://api.kh.glastonr.net',
        appId: 'jp.co.sonymusic.communication.keyakizaka 2.4',  // 日向坂用keyakizaka
    }
};

class AppApiListener {
    constructor() {
        this.tokens = {};       // 存储 access_token
        this.refreshTokens = {  // refresh_token
            nogizaka: process.env.NOGIZAKA_REFRESH_TOKEN,
            sakurazaka: process.env.SAKURAZAKA_REFRESH_TOKEN,
            hinatazaka: process.env.HINATAZAKA_REFRESH_TOKEN,
        };
        this.lastMessageIds = {};
        this.isRunning = false;
        this.checkInterval = 15000; // 15秒检查一次
    }

    /**
     * 使用 refresh_token 获取新的 access_token
     */
    async updateToken(siteKey) {
        const site = SITES[siteKey];
        const refreshToken = this.refreshTokens[siteKey];

        if (!refreshToken) {
            console.log(`⚠️ ${site.name}: 未配置 refresh_token`);
            return null;
        }

        try {
            console.log(`🔄 ${site.name}: 刷新 access_token...`);

            const response = await axios.post(
                `${site.baseUrl}/v2/update_token`,
                { refresh_token: refreshToken },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Talk-App-ID': site.appId,
                        'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 11)',
                    }
                }
            );

            const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;

            this.tokens[siteKey] = access_token;

            // 如果返回了新的 refresh_token，更新它
            if (newRefreshToken && newRefreshToken !== refreshToken) {
                this.refreshTokens[siteKey] = newRefreshToken;
                console.log(`🔑 ${site.name}: 获得新的 refresh_token`);
            }

            console.log(`✅ ${site.name}: Token 刷新成功 (有效期: ${expires_in}秒)`);
            return access_token;

        } catch (error) {
            console.error(`❌ ${site.name}: Token 刷新失败:`, error.response?.data || error.message);
            return null;
        }
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
            console.error(`❌ ${site.name}: 获取groups失败:`, error.response?.status);
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
                // Token 过期，重新刷新
                await this.updateToken(siteKey);
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
            const refreshToken = this.refreshTokens[siteKey];
            if (!refreshToken) continue;

            // 确保有有效的 access_token
            if (!this.tokens[siteKey]) {
                await this.updateToken(siteKey);
            }

            await this.checkSite(siteKey);
        }
    }

    /**
     * 检查单个站点的新消息
     */
    async checkSite(siteKey) {
        const site = SITES[siteKey];

        try {
            // 获取订阅的成员
            const groups = await this.getGroups(siteKey);

            for (const group of groups) {
                if (!group.is_subscription) continue;  // 只检查订阅的成员

                const messages = await this.getTimeline(siteKey, group.id, 5);
                const lastId = this.lastMessageIds[`${siteKey}_${group.id}`];

                for (const message of messages) {
                    if (lastId && message.id <= lastId) break;

                    // 新消息！
                    await this.handleNewMessage(siteKey, group, message);
                }

                // 更新最后消息ID
                if (messages.length > 0) {
                    this.lastMessageIds[`${siteKey}_${group.id}`] = messages[0].id;
                }

                // 避免请求太快
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

        // 推送到 Discord
        await this.sendToDiscord(siteKey, group, message);
    }

    /**
     * 获取消息类型
     */
    getMessageType(message) {
        if (message.text) return 'テキスト';
        if (message.file?.content_type?.includes('image')) return '画像';
        if (message.file?.content_type?.includes('video')) return '動画';
        if (message.file?.content_type?.includes('audio')) return 'ボイス';
        return '不明';
    }

    /**
     * 推送到 Discord
     */
    async sendToDiscord(siteKey, group, message) {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) return;

        const site = SITES[siteKey];
        const messageType = this.getMessageType(message);

        try {
            const embed = {
                title: `💌 ${group.name} の新着メッセージ`,
                description: message.text || `[${messageType}]`,
                color: this.getSiteColor(siteKey),
                timestamp: message.published_at,
                thumbnail: {
                    url: group.image_url
                },
                footer: {
                    text: site.name
                }
            };

            // 如果有图片，添加图片
            if (message.file?.content_type?.includes('image')) {
                embed.image = { url: message.file.url };
            }

            await axios.post(webhookUrl, { embeds: [embed] });
            console.log('   ✅ 已推送到 Discord');

        } catch (error) {
            console.error('   ❌ Discord 推送失败:', error.message);
        }
    }

    /**
     * 获取站点颜色
     */
    getSiteColor(siteKey) {
        const colors = {
            nogizaka: 0x8E44AD,   // 紫色
            sakurazaka: 0xE91E63, // 粉色
            hinatazaka: 0x3498DB, // 蓝色
        };
        return colors[siteKey] || 0x5865F2;
    }

    /**
     * 启动监听
     */
    async start(intervalSeconds = 15) {
        this.checkInterval = intervalSeconds * 1000;
        this.isRunning = true;

        console.log('╔════════════════════════════════════════╗');
        console.log('║   坂道メッセージ App API リスナー      ║');
        console.log('╠════════════════════════════════════════╣');
        console.log(`║ 検査間隔: ${intervalSeconds}秒`);
        console.log('║ Ctrl+C で停止');
        console.log('╚════════════════════════════════════════╝\n');

        // 初始化所有 token
        for (const siteKey of Object.keys(SITES)) {
            if (this.refreshTokens[siteKey]) {
                await this.updateToken(siteKey);
                console.log(`   ${SITES[siteKey].name}: ✅ 準備完了`);
            } else {
                console.log(`   ${SITES[siteKey].name}: ⚠️ refresh_token 未設定`);
            }
        }

        // 定期刷新 token（每45分钟）
        setInterval(async () => {
            console.log('\n🔄 定期更新 token...');
            for (const siteKey of Object.keys(SITES)) {
                if (this.refreshTokens[siteKey]) {
                    await this.updateToken(siteKey);
                }
            }
        }, 45 * 60 * 1000);

        // 开始监听
        await this.checkAllSites();

        setInterval(() => {
            if (this.isRunning) {
                this.checkAllSites();
            }
        }, this.checkInterval);
    }

    /**
     * 停止监听
     */
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
    const listener = new AppApiListener();

    // 从命令行参数获取检查间隔
    const intervalSeconds = parseInt(process.argv[2]) || 15;

    listener.start(intervalSeconds);

    // 优雅退出
    process.on('SIGINT', () => {
        listener.stop();
        process.exit(0);
    });
}

module.exports = AppApiListener;
