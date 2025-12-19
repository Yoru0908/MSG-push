/**
 * 坂道消息 App API 监听器 V3
 * 支持按成员分组推送到 Discord + QQ
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pushConfig = require('./push-config');
const translator = require('./translator');

// Google OAuth 配置
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
    },
    sakurazaka: {
        name: '櫻坂46',
        baseUrl: 'https://api.s46.glastonr.net',
        appId: 'jp.co.sonymusic.communication.sakurazaka 2.4',
    },
    hinatazaka: {
        name: '日向坂46',
        baseUrl: 'https://api.kh.glastonr.net',
        appId: 'jp.co.sonymusic.communication.keyakizaka 2.4',
    }
};

class AppApiListenerV3 {
    constructor() {
        this.tokens = {};
        this.googleRefreshTokens = {
            nogizaka: process.env.NOGIZAKA_REFRESH_TOKEN,
            sakurazaka: process.env.SAKURAZAKA_REFRESH_TOKEN,
            hinatazaka: process.env.HINATAZAKA_REFRESH_TOKEN,
        };
        this.lastMessageIds = this.loadState();  // 从文件加载
        this.isRunning = false;
        this.checkInterval = 15000;
        this.memberGroups = {};  // 缓存成员 group 信息
        this.isFirstRun = {};    // 跟踪每个成员是否首次轮询
        this.failedMembers = {}; // 跟踪推送失败的成员
        this.failedPushes = [];  // 失败的推送任务队列
        this.retryCooldown = 1 * 60 * 1000; // 失败后等待1分钟重试
    }

    // 加载持久化状态
    loadState() {
        const stateFile = path.join(__dirname, '../.state/last-message-ids.json');
        try {
            if (fs.existsSync(stateFile)) {
                return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            }
        } catch (e) {
            console.error('⚠️ 加载状态文件失败:', e.message);
        }
        return {};
    }

    // 保存持久化状态
    saveState() {
        const stateDir = path.join(__dirname, '../.state');
        const stateFile = path.join(stateDir, 'last-message-ids.json');
        try {
            if (!fs.existsSync(stateDir)) {
                fs.mkdirSync(stateDir, { recursive: true });
            }
            fs.writeFileSync(stateFile, JSON.stringify(this.lastMessageIds, null, 2));
        } catch (e) {
            console.error('⚠️ 保存状态文件失败:', e.message);
        }
    }

    // ============ Google OAuth ============

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
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
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

    async signInWithGoogle(siteKey, googleAccessToken, googleIdToken) {
        const site = SITES[siteKey];

        try {
            const response = await axios.post(
                `${site.baseUrl}/v2/signin`,
                { auth_type: 'google', token: googleIdToken },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Talk-App-ID': site.appId,
                        'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 11)',
                    }
                }
            );

            this.tokens[siteKey] = response.data.access_token;
            console.log(`✅ ${site.name}: App 登录成功！`);
            return response.data.access_token;
        } catch (error) {
            console.error(`❌ ${site.name}: App 登录失败:`, error.response?.data || error.message);
            return null;
        }
    }

    async authenticate(siteKey) {
        const googleRefreshToken = this.googleRefreshTokens[siteKey];
        if (!googleRefreshToken) return false;

        const googleTokens = await this.getGoogleTokens(siteKey, googleRefreshToken);
        if (!googleTokens) return false;

        const appToken = await this.signInWithGoogle(siteKey, googleTokens.accessToken, googleTokens.idToken);
        return !!appToken;
    }

    // ============ API 调用 ============

    async getGroups(siteKey) {
        const site = SITES[siteKey];
        const token = this.tokens[siteKey];
        if (!token) return [];

        try {
            const response = await axios.get(`${site.baseUrl}/v2/groups`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'X-Talk-App-ID': site.appId,
                }
            });
            // API 可能返回 { groups: [] } 或直接返回数组
            const data = response.data;
            return Array.isArray(data) ? data : (data.groups || []);
        } catch (error) {
            if (error.response?.status === 401) await this.authenticate(siteKey);
            return [];
        }
    }

    async getTimeline(siteKey, groupId, count = 20) {
        const site = SITES[siteKey];
        const token = this.tokens[siteKey];
        if (!token) return [];

        try {
            const response = await axios.get(
                `${site.baseUrl}/v2/groups/${groupId}/timeline`,
                {
                    params: { count, order: 'desc' },
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                        'X-Talk-App-ID': site.appId,
                    }
                }
            );
            return response.data.messages || [];
        } catch (error) {
            if (error.response?.status === 401) await this.authenticate(siteKey);
            return [];
        }
    }

    // ============ 消息检查 ============

    async checkAllSites() {
        const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        console.log(`\n🔍 [${now}] 检查新消息...`);

        // 先处理失败队列中需要重试的任务
        await this.processFailedPushes();

        for (const siteKey of Object.keys(SITES)) {
            if (!this.googleRefreshTokens[siteKey]) continue;
            if (!this.tokens[siteKey]) continue;
            await this.checkSite(siteKey);
        }
    }

    // 处理失败的推送任务
    async processFailedPushes() {
        if (this.failedPushes.length === 0) return;

        const now = Date.now();
        const readyTasks = this.failedPushes.filter(t => now - t.failedAt >= this.retryCooldown);

        for (const task of readyTasks) {
            console.log(`   🔄 重试推送: ${task.memberName} -> 群 ${task.groupId}`);
            const success = await this.sendToQQGroupDirect(task.groupId, task.msgContent, task.message);

            if (success) {
                // 移除成功的任务
                this.failedPushes = this.failedPushes.filter(t => t !== task);
                console.log(`   ✅ 重试成功: ${task.memberName} -> 群 ${task.groupId}`);
            } else {
                // 更新失败时间，继续下次重试
                task.failedAt = now;
                task.retryCount = (task.retryCount || 1) + 1;

                // 超过5次重试就放弃
                if (task.retryCount > 5) {
                    this.failedPushes = this.failedPushes.filter(t => t !== task);
                    console.log(`   ❌ 放弃重试(超过5次): ${task.memberName} -> 群 ${task.groupId}`);
                }
            }
        }
    }

    async checkSite(siteKey) {
        const site = SITES[siteKey];

        try {
            const groups = await this.getGroups(siteKey);

            for (const group of groups) {
                // 检查是否有有效订阅
                const hasSubscription = group.subscription && group.subscription.state === 'active';
                if (!hasSubscription) continue;

                // 只监控配置中的成员
                const memberName = group.name;
                if (pushConfig.watchMembers.length > 0 &&
                    !pushConfig.watchMembers.includes(memberName)) {
                    continue;
                }

                const memberKey = `${siteKey}_${group.id}`;

                // 检查是否在冷却期
                if (this.failedMembers[memberKey]) {
                    const timeSinceFailure = Date.now() - this.failedMembers[memberKey];
                    if (timeSinceFailure < this.retryCooldown) {
                        continue; // 跳过冷却期内的成员
                    }
                    delete this.failedMembers[memberKey]; // 冷却期结束
                }

                // 缓存成员信息
                this.memberGroups[memberKey] = {
                    name: memberName,
                    siteKey: siteKey,
                    imageUrl: group.image_url,
                };

                const messages = await this.getTimeline(siteKey, group.id, 5);
                const lastTime = this.lastMessageIds[memberKey]; // 现在存储的是时间戳

                // 首次轮询该成员，只记录时间，不推送
                if (!lastTime && messages.length > 0) {
                    console.log(`   📝 ${memberName}: 首次轮询，记录最新消息时间`);
                    this.lastMessageIds[memberKey] = new Date(messages[0].published_at).getTime();
                    this.saveState();
                    continue;
                }

                for (const message of messages) {
                    const msgTimestamp = new Date(message.published_at).getTime();
                    // 用时间戳判断而不是 ID（因为 ID 不是严格递增的）
                    if (lastTime && msgTimestamp <= lastTime) break;

                    // 跳过超过24小时的旧消息
                    const ageHours = (Date.now() - msgTimestamp) / (1000 * 60 * 60);
                    if (ageHours > 24) {
                        console.log(`   ⏰ ${memberName}: 跳过超过24小时的旧消息`);
                        continue;
                    }

                    // 【重要】在处理消息前先更新时间戳，防止并发重复处理
                    this.lastMessageIds[memberKey] = msgTimestamp;
                    this.saveState();

                    const success = await this.handleNewMessage(siteKey, group, message);

                    if (!success) {
                        // 推送失败，记录冷却时间
                        this.failedMembers[memberKey] = Date.now();
                        console.log(`   ⚠️ ${memberName}: 推送失败，${this.retryCooldown / 1000}秒后重试`);
                        break;
                    }
                }

                await this.sleep(200);
            }
        } catch (error) {
            console.error(`❌ ${site.name}: 检查失败:`, error.message);
        }
    }

    // ============ 消息处理 ============

    async handleNewMessage(siteKey, group, message) {
        const site = SITES[siteKey];
        const memberName = group.name;

        console.log(`\n🎉 ${site.name} - ${memberName} 发来新消息！`);
        console.log(`   时间: ${message.published_at}`);
        console.log(`   类型: ${this.getMessageType(message)}`);
        if (message.text) {
            console.log(`   内容: ${message.text.substring(0, 50)}...`);
        }

        // 获取推送规则
        const memberRule = pushConfig.memberPushRules[memberName];
        const defaultRule = pushConfig.defaultPushRules[siteKey];

        // 推送到 Discord
        if (pushConfig.discordWebhook) {
            await this.sendToDiscord(siteKey, group, message);
        }

        // 【优化】先翻译一次，避免每个群都重复翻译
        let translatedText = null;
        if (message.text) {
            try {
                translatedText = await translator.translate(message.text, memberName);
                if (translatedText) {
                    console.log(`   ✅ 翻译完成`);
                } else {
                    console.log(`   ⚠️ 翻译失败，将只发送原文`);
                    // 翻译失败报警
                    this.sendTranslationErrorToDiscord(memberName, message.text);
                }
            } catch (e) {
                console.error('   ⚠️ 翻译出错:', e.message);
            }
        }

        // 推送到 QQ 群（使用已翻译的结果）
        // 只要有一个群推送成功就算成功
        let anySuccess = false;
        if (memberRule && memberRule.enabled && memberRule.qqGroups) {
            for (const groupId of memberRule.qqGroups) {
                const result = await this.sendToQQGroup(groupId, siteKey, group, message, translatedText);
                if (result) anySuccess = true;
            }
        } else if (defaultRule && defaultRule.enabled && defaultRule.qqGroups) {
            for (const groupId of defaultRule.qqGroups) {
                const result = await this.sendToQQGroup(groupId, siteKey, group, message, translatedText);
                if (result) anySuccess = true;
            }
        }

        return anySuccess;
    }

    getMessageType(message) {
        if (message.text) return 'テキスト';
        if (message.file?.content_type?.includes('image')) return '画像';
        if (message.file?.content_type?.includes('video')) return '動画';
        if (message.file?.content_type?.includes('audio')) return 'ボイス';
        return '不明';
    }

    // ============ Discord 推送 ============

    async sendToDiscord(siteKey, group, message) {
        try {
            const embed = {
                title: `💌 ${group.name} の新着メッセージ`,
                description: message.text || `[${this.getMessageType(message)}]`,
                color: this.getSiteColor(siteKey),
                timestamp: message.published_at,
                thumbnail: { url: group.image_url },
                footer: { text: SITES[siteKey].name }
            };

            if (message.file?.content_type?.includes('image')) {
                embed.image = { url: message.file.url };
            }

            await axios.post(pushConfig.discordWebhook, { embeds: [embed] });
            console.log('   ✅ Discord 推送成功');
        } catch (error) {
        }
    }

    async sendTranslationErrorToDiscord(memberName, originalText) {
        if (!pushConfig.discordAlertWebhook) return;

        try {
            const embed = {
                title: `⚠️ 翻译失败报警`,
                description: `**成员**: ${memberName}\n**原文**: ${originalText.substring(0, 500)}...`,
                color: 0xFF0000,
                timestamp: new Date().toISOString(),
            };
            await axios.post(pushConfig.discordAlertWebhook, { embeds: [embed] });
        } catch (e) {
            console.error('⚠️ Discord 报警发送失败:', e.message);
        }
    }

    // ============ QQ 推送 (OneBot v11) ============

    async sendToQQGroup(groupId, siteKey, group, message, translatedText = null) {
        const apiUrl = pushConfig.lagrangeApi;

        try {
            // 格式化时间（东京时区）
            const msgTime = new Date(message.published_at);
            const timeStr = msgTime.toLocaleString('ja-JP', {
                timeZone: 'Asia/Tokyo',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            // 构建消息内容
            let msgContent = `【${group.name}】 ${timeStr}\n`;
            msgContent += `━━━━━━━━━━\n`;

            if (message.text) {
                // 使用已翻译的内容（由 handleNewMessage 传入）
                if (translatedText) {
                    msgContent += message.text + `\n\n${translatedText}`;
                } else {
                    msgContent += message.text;
                }
            } else {
                // 根据 message.type 显示媒体类型
                if (message.type === 'video') {
                    msgContent += `[视频]`;
                } else if (message.type === 'voice') {
                    msgContent += `[语音]`;
                } else if (message.type === 'picture' || message.type === 'image') {
                    msgContent += `[图片]`;
                } else {
                    msgContent += `[${message.type || '媒体'}]`;
                }
            }

            // OneBot v11 发送群消息 API
            const response = await axios.post(`${apiUrl}/send_group_msg`, {
                group_id: parseInt(groupId),
                message: msgContent,
            });

            // 检查返回状态
            if (response.data && response.data.status === 'failed') {
                console.error(`   ❌ QQ群 ${groupId} 推送失败:`, response.data.message || 'API返回失败');
                return false;
            }

            // 如果有媒体文件，下载到服务器后发送
            if (message.file && typeof message.file === 'string') {
                const localPath = await this.downloadMedia(group.name, message);
                if (localPath) {
                    await this.sendMediaToQQ(apiUrl, groupId, message.type, localPath);
                }
            }

            console.log(`   ✅ QQ群 ${groupId} 推送成功`);
            return true;
        } catch (error) {
            console.error(`   ❌ QQ群 ${groupId} 推送失败:`, error.message);

            // 将失败的任务加入重试队列
            this.failedPushes.push({
                groupId,
                memberName: group.name,
                msgContent,
                message,
                failedAt: Date.now(),
                retryCount: 1,
            });

            return false;
        }
    }

    // 简化版发送（用于重试）
    async sendToQQGroupDirect(groupId, msgContent, message) {
        const apiUrl = pushConfig.lagrangeApi;

        try {
            const response = await axios.post(`${apiUrl}/send_group_msg`, {
                group_id: parseInt(groupId),
                message: msgContent,
            });

            if (response.data && response.data.status === 'failed') {
                return false;
            }

            // 如果有媒体文件
            if (message && message.file && typeof message.file === 'string') {
                const memberName = message.memberName || 'unknown';
                const localPath = await this.downloadMedia(memberName, message);
                if (localPath) {
                    await this.sendMediaToQQ(apiUrl, groupId, message.type, localPath);
                }
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    // 下载媒体文件到服务器（保存到 NapCat 可访问的目录）
    async downloadMedia(memberName, message) {
        try {
            // 宿主机路径：/opt/napcat/config/media/{成员名}/
            const safeMemberName = memberName.replace(/\s+/g, '_');
            const mediaDir = `/opt/napcat/config/media/${safeMemberName}`;
            if (!fs.existsSync(mediaDir)) {
                fs.mkdirSync(mediaDir, { recursive: true });
            }

            // 从 URL 提取文件名
            const urlPath = new URL(message.file).pathname;
            const fileName = path.basename(urlPath.split('?')[0]);
            const localPath = path.join(mediaDir, fileName);

            // 如果文件已存在，直接返回容器内路径
            if (fs.existsSync(localPath)) {
                // 返回容器内路径
                return `/app/napcat/config/media/${safeMemberName}/${fileName}`;
            }

            // 下载文件
            const response = await axios.get(message.file, {
                responseType: 'arraybuffer',
                timeout: 60000  // 60秒超时
            });
            fs.writeFileSync(localPath, response.data);
            console.log(`   📥 媒体已下载: ${fileName}`);
            // 返回容器内路径
            return `/app/napcat/config/media/${safeMemberName}/${fileName}`;
        } catch (error) {
            console.error(`   ⚠️ 媒体下载失败:`, error.message);
            return null;
        }
    }

    // 发送媒体到 QQ（使用容器内路径）
    async sendMediaToQQ(apiUrl, groupId, type, containerPath) {
        try {
            let cqCode;
            if (type === 'picture' || type === 'image') {
                cqCode = `[CQ:image,file=file://${containerPath}]`;
            } else if (type === 'video') {
                cqCode = `[CQ:video,file=file://${containerPath}]`;
            } else if (type === 'voice') {
                // 先发语音条
                cqCode = `[CQ:record,file=file://${containerPath}]`;
                await axios.post(`${apiUrl}/send_group_msg`, {
                    group_id: parseInt(groupId),
                    message: cqCode,
                });
                console.log(`   📤 语音条已发送`);

                // 再上传文件
                const fileName = containerPath.split('/').pop();
                try {
                    await axios.post(`${apiUrl}/upload_group_file`, {
                        group_id: parseInt(groupId),
                        file: containerPath,
                        name: fileName,
                    });
                    console.log(`   📤 语音文件已上传: ${fileName}`);
                } catch (e) {
                    console.log(`   ⚠️ 语音文件上传失败: ${e.message}`);
                }
                return;
            } else {
                return;
            }

            await axios.post(`${apiUrl}/send_group_msg`, {
                group_id: parseInt(groupId),
                message: cqCode,
            });
            console.log(`   📤 媒体已发送: ${type}`);
        } catch (error) {
            console.error(`   ⚠️ 媒体发送失败:`, error.message);
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

    // ============ 启动 ============

    async start(intervalSeconds = 15) {
        this.checkInterval = intervalSeconds * 1000;
        this.isRunning = true;

        console.log('╔══════════════════════════════════════════════╗');
        console.log('║  坂道メッセージ App API リスナー V3          ║');
        console.log('║  成员分组推送 (Discord + QQ)                 ║');
        console.log('╠══════════════════════════════════════════════╣');
        console.log(`║ 検査間隔: ${intervalSeconds}秒`);
        console.log(`║ 監視成員: ${pushConfig.watchMembers.join(', ')}`);
        console.log('║ Ctrl+C で停止');
        console.log('╚══════════════════════════════════════════════╝\n');

        // 认证
        console.log('🔐 認証中...\n');
        for (const siteKey of Object.keys(SITES)) {
            if (this.googleRefreshTokens[siteKey]) {
                const success = await this.authenticate(siteKey);
                console.log(`   ${SITES[siteKey].name}: ${success ? '✅ 準備完了' : '❌ 認証失敗'}`);
            }
        }

        // 定期刷新 token
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
            if (this.isRunning) this.checkAllSites();
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
    const listener = new AppApiListenerV3();
    const intervalSeconds = parseInt(process.argv[2]) || 15;
    listener.start(intervalSeconds);

    process.on('SIGINT', () => {
        listener.stop();
        process.exit(0);
    });
}

module.exports = AppApiListenerV3;
