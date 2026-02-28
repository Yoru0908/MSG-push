/**
 * 坂道消息 App API 监听器 V3
 * 支持按成员分组推送到 Discord + QQ
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
// pushConfig 改为动态加载，支持热重载
let pushConfig = require('./push-config');
const translator = require('./translator');
const { uploadToR2, uploadAvatar } = require('./r2-storage');

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
        this.lastMessageIds = this.loadState();  // 从文件加载
        this.processedMessageIds = this.loadProcessedIds();  // 已处理的消息ID集合
        this.isRunning = false;
        this.checkInterval = 15000;
        this.memberGroups = {};  // 缓存成员 group 信息
        this.isFirstRun = {};    // 跟踪每个成员是否首次轮询
        this.failedMembers = {}; // 跟踪推送失败的成员
        this.failedPushes = this.loadFailedPushes();  // 从文件加载失败的推送任务队列
        this.retryCooldown = 1 * 60 * 1000; // 失败后等待1分钟重试
        this.isProcessing = {};  // 防止同一成员并发处理
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

    // 加载失败重试队列
    loadFailedPushes() {
        const stateFile = path.join(__dirname, '../.state/failed-pushes.json');
        try {
            if (fs.existsSync(stateFile)) {
                return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            }
        } catch (e) {
            console.error('⚠️ 加载失败重试队列失败:', e.message);
        }
        return [];
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

    // 保存失败重试队列
    saveFailedPushes() {
        const stateDir = path.join(__dirname, '../.state');
        const stateFile = path.join(stateDir, 'failed-pushes.json');
        try {
            if (!fs.existsSync(stateDir)) {
                fs.mkdirSync(stateDir, { recursive: true });
            }
            fs.writeFileSync(stateFile, JSON.stringify(this.failedPushes, null, 2));
        } catch (e) {
            console.error('⚠️ 保存失败重试队列失败:', e.message);
        }
    }

    // 加载已处理的消息ID
    loadProcessedIds() {
        const stateFile = path.join(__dirname, '../.state/processed-ids.json');
        try {
            if (fs.existsSync(stateFile)) {
                const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
                return new Set(data);
            }
        } catch (e) {
            console.error('⚠️ 加载已处理消息ID失败:', e.message);
        }
        return new Set();
    }

    // 保存已处理的消息ID（只保留最近1000条）
    saveProcessedIds() {
        const stateDir = path.join(__dirname, '../.state');
        const stateFile = path.join(stateDir, 'processed-ids.json');
        try {
            if (!fs.existsSync(stateDir)) {
                fs.mkdirSync(stateDir, { recursive: true });
            }
            // 只保留最近1000条，防止文件过大
            const idsArray = Array.from(this.processedMessageIds).slice(-1000);
            fs.writeFileSync(stateFile, JSON.stringify(idsArray, null, 2));
        } catch (e) {
            console.error('⚠️ 保存已处理消息ID失败:', e.message);
        }
    }

    // ============ 认证 ============

    // 使用 /v2/update_token 直接刷新 (新方式，不会顶掉手机登录)
    async authenticateByUpdateToken(siteKey) {
        const site = SITES[siteKey];
        const refreshToken = pushConfig.appTokens?.[siteKey];

        if (!refreshToken) {
            console.log(`⚠️ ${site.name}: 未配置 APP refresh_token`);
            return false;
        }

        try {
            const response = await axios.post(
                `${site.baseUrl}/v2/update_token`,
                { refresh_token: refreshToken },
                {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Talk-App-ID': site.appId,
                        'Accept-Language': 'ja-JP',
                        'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 6.0; Samsung Galaxy S7 for keyaki messages Build/MRA58K)',
                        'Connection': 'Keep-Alive',
                        'Accept-Encoding': 'gzip',
                        'TE': 'gzip, deflate; q=0.5',
                    },
                    timeout: 30000,
                }
            );

            this.tokens[siteKey] = response.data.access_token;

            // 如果服务器返回了新的 refresh_token，记录下来（需要手动更新配置）
            if (response.data.refresh_token && response.data.refresh_token !== refreshToken) {
                console.log(`   ⚠️ ${site.name}: 服务器返回了新的 refresh_token: ${response.data.refresh_token}`);
            }

            console.log(`✅ ${site.name}: 認証成功 (/v2/update_token)`);
            return true;
        } catch (error) {
            console.error(`❌ ${site.name}: 認証失敗 (/v2/update_token):`, error.response?.data || error.message);
            return false;
        }
    }

    // Google OAuth 认证 (旧方式，目前可能已失效)
    async getGoogleIdToken(siteKey) {
        const clientId = GOOGLE_CLIENT_IDS[siteKey];
        const refreshToken = pushConfig.authTokens?.[siteKey];

        if (!refreshToken) {
            console.log(`⚠️ ${SITES[siteKey].name}: 未配置 refresh_token`);
            return null;
        }

        try {
            const response = await axios.post('https://oauth2.googleapis.com/token', {
                client_id: clientId,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            });

            return response.data.id_token;
        } catch (error) {
            console.error(`❌ Google token 获取失败:`, error.response?.data || error.message);
            return null;
        }
    }

    async authenticateByGoogleOAuth(siteKey) {
        const site = SITES[siteKey];
        const idToken = await this.getGoogleIdToken(siteKey);

        if (!idToken) return false;

        try {
            const response = await axios.post(
                `${site.baseUrl}/v2/signin`,
                {
                    token: idToken,
                    auth_type: 'google'
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

            this.tokens[siteKey] = response.data.access_token;
            console.log(`✅ ${site.name}: 認証成功 (Google OAuth)`);
            return true;
        } catch (error) {
            console.error(`❌ ${site.name}: 認証失敗 (Google OAuth):`, error.response?.data || error.message);
            return false;
        }
    }

    async authenticate(siteKey) {
        // 混合认证模式: 先尝试 Google OAuth，失败则回退到 APP Token
        const site = SITES[siteKey];

        // 1. 先尝试 Google OAuth (对于有效的 Google refresh_token)
        if (pushConfig.authTokens?.[siteKey]) {
            const googleSuccess = await this.authenticateByGoogleOAuth(siteKey);
            if (googleSuccess) return true;
        }

        // 2. Google OAuth 失败，尝试 APP Token 刷新
        if (pushConfig.appTokens?.[siteKey]) {
            const appSuccess = await this.authenticateByUpdateToken(siteKey);
            if (appSuccess) return true;
        }

        console.log(`   ${site.name}: ❌ 認証失敗`);
        return false;
    }

    // ============ APP Token 刷新 (备用，目前禁用) ============
    // 使用 /v2/update_token 刷新 access_token，理论上不会顶掉手机登录
    // 设置 useAppTokenRefresh = true 启用此方式

    async refreshAppToken(siteKey) {
        const useAppTokenRefresh = true; // 开关：设为 true 启用
        if (!useAppTokenRefresh) return false;

        const site = SITES[siteKey];
        const appRefreshToken = pushConfig.appTokens?.[siteKey];  // 使用 appTokens 而不是 appRefreshTokens

        if (!appRefreshToken) {
            console.log(`⚠️ ${site.name}: 未配置 APP refresh_token`);
            return false;
        }

        try {
            const response = await axios.post(
                `${site.baseUrl}/v2/update_token`,
                { refresh_token: appRefreshToken },
                {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Talk-App-ID': site.appId,
                        'Accept-Language': 'ja-JP',
                        'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 6.0; Samsung Galaxy S7 for keyaki messages Build/MRA58K)',
                        'Connection': 'Keep-Alive',
                        'Accept-Encoding': 'gzip',
                        'TE': 'gzip, deflate; q=0.5',
                    }
                }
            );

            this.tokens[siteKey] = response.data.access_token;
            if (response.data.refresh_token && response.data.refresh_token !== appRefreshToken) {
                console.log(`📝 ${site.name}: 收到新的 refresh_token，请更新配置！`);
            }
            console.log(`✅ ${site.name}: APP Token 刷新成功`);
            return true;
        } catch (error) {
            console.error(`❌ ${site.name}: APP Token 刷新失败:`, error.response?.data || error.message);
            return false;
        }
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
            if (!pushConfig.authTokens?.[siteKey]) continue;
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

        // 无论成功还是移除，都保存队列状态
        this.saveFailedPushes();
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
                    imageUrl: group.thumbnail,
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

                    // 【去重】检查消息ID是否已处理过（ID不用于排序，只用于去重）
                    if (this.processedMessageIds.has(message.id)) {
                        console.log(`   ⏭️ ${memberName}: 跳过已处理消息`);
                        continue;
                    }

                    // 立即标记为已处理
                    this.processedMessageIds.add(message.id);
                    this.saveProcessedIds();

                    // 更新时间戳
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
                // 检查该群是否在 noTranslateGroups 中
                const skipTranslation = memberRule.noTranslateGroups?.includes(groupId);
                const textToSend = skipTranslation ? null : translatedText;
                const result = await this.sendToQQGroup(groupId, siteKey, group, message, textToSend);
                if (result) anySuccess = true;
            }
        } else if (defaultRule && defaultRule.enabled && defaultRule.qqGroups) {
            for (const groupId of defaultRule.qqGroups) {
                const result = await this.sendToQQGroup(groupId, siteKey, group, message, translatedText);
                if (result) anySuccess = true;
            }
        }

        // 推送到 Telegram
        if (memberRule && memberRule.enabled && memberRule.telegramChats && pushConfig.telegram?.enabled) {
            for (const chatId of memberRule.telegramChats) {
                const result = await this.sendToTelegram(chatId, group, message, translatedText);
                if (result) anySuccess = true;
            }
        }

        // 推送到 Discord (成员专属 webhook)
        if (memberRule && memberRule.enabled && memberRule.discord) {
            const result = await this.sendToDiscordWebhook(memberRule.discord, siteKey, group, message, translatedText);
            if (result) anySuccess = true;
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
                thumbnail: { url: group.thumbnail },
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

    // 成员专属 Discord Webhook 推送（支持 R2 媒体上传）
    async sendToDiscordWebhook(webhookUrl, siteKey, group, message, translatedText = null) {
        try {
            // 构建描述内容
            let description = '';
            if (message.text) {
                description = message.text;
                if (translatedText) {
                    description += `\n\n**翻译**：${translatedText}`;
                }
            }

            // 处理头像格式 (Discord 不支持 JFIF，需转存 R2)
            let iconUrl = group.thumbnail;
            if (pushConfig.r2?.enabled && iconUrl?.endsWith('.jfif')) {
                iconUrl = await uploadAvatar(iconUrl, group.name);
            }

            const embed = {
                author: {
                    name: group.name,
                    icon_url: iconUrl
                },
                description: description || undefined,
                color: this.getSiteColor(siteKey),
                timestamp: message.published_at,
                footer: { text: SITES[siteKey].name }
            };

            // 如果有媒体文件，下载并上传到 Discord
            if (message.file && typeof message.file === 'string') {
                const isImage = message.type === 'picture' || message.type === 'image';
                const isVideo = message.type === 'video';
                const isVoice = message.type === 'voice';

                // 下载媒体文件
                const localPath = await this.downloadMedia(group.name, message);

                if (localPath && fs.existsSync(localPath)) {
                    const filename = path.basename(localPath);
                    const fileSize = fs.statSync(localPath).size;

                    // Discord 文件大小限制 (25MB for free servers)
                    const MAX_FILE_SIZE = 25 * 1024 * 1024;

                    if (fileSize < MAX_FILE_SIZE) {
                        // 使用 FormData 上传文件
                        const FormData = require('form-data');
                        const form = new FormData();

                        // 图片可以嵌入到 embed 中
                        if (isImage) {
                            embed.image = { url: `attachment://${filename}` };
                        }

                        // 添加 embed 作为 payload_json
                        form.append('payload_json', JSON.stringify({
                            embeds: [embed]
                        }));

                        // 添加文件
                        form.append('file', fs.createReadStream(localPath), filename);

                        await axios.post(webhookUrl, form, {
                            headers: form.getHeaders()
                        });

                        console.log(`   ✅ Discord 推送成功 (文件上传: ${filename})`);
                        return true;
                    } else {
                        // 文件太大，回退到 R2 链接方式
                        console.log(`   ⚠️ 文件太大 (${(fileSize / 1024 / 1024).toFixed(1)}MB)，使用链接方式`);

                        if (pushConfig.r2?.enabled) {
                            const r2Url = await uploadToR2(message.file, group.name, message.type);
                            if (r2Url) {
                                if (isImage) {
                                    embed.image = { url: r2Url };
                                }
                                await axios.post(webhookUrl, { embeds: [embed] });
                                if (isVideo || isVoice) {
                                    await axios.post(webhookUrl, { content: `${isVideo ? '🎬' : '🎤'} ${r2Url}` });
                                }
                            }
                        }
                        console.log('   ✅ Discord Webhook 推送成功 (链接方式)');
                        return true;
                    }
                }
            }

            // 无媒体文件，只发送 embed
            await axios.post(webhookUrl, { embeds: [embed] });
            console.log('   ✅ Discord Webhook 推送成功');
            return true;
        } catch (error) {
            console.error('   ❌ Discord Webhook 推送失败:', error.message);
            return false;
        }
    }

    // ============ Telegram 推送 ============

    async sendToTelegram(chatId, group, message, translatedText = null) {
        const botToken = pushConfig.telegram?.botToken;
        if (!botToken) {
            console.log('   ⚠️ Telegram Bot Token 未配置');
            return false;
        }

        const apiUrl = `https://api.telegram.org/bot${botToken}`;

        try {
            // 格式化时间
            const msgTime = new Date(message.published_at);
            const timeStr = msgTime.toLocaleString('ja-JP', {
                timeZone: 'Asia/Tokyo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            // 构建消息文本
            let text = `*${group.name}* ${timeStr}\n━━━━━━━━━━`;
            if (message.text) {
                text += `\n${message.text}`;
                if (translatedText) {
                    text += `\n\n${translatedText}`;
                }
            }

            // 判断消息类型
            const hasMedia = message.file && typeof message.file === 'string';
            const isImage = message.type === 'picture' || message.type === 'image';
            const isVideo = message.type === 'video';

            if (hasMedia && isImage) {
                // 发送图片
                await axios.post(`${apiUrl}/sendPhoto`, {
                    chat_id: chatId,
                    photo: message.file,
                    caption: text,
                    parse_mode: 'Markdown'
                });
            } else if (hasMedia && isVideo) {
                // 发送视频
                await axios.post(`${apiUrl}/sendVideo`, {
                    chat_id: chatId,
                    video: message.file,
                    caption: text,
                    parse_mode: 'Markdown'
                });
            } else {
                // 发送纯文本
                await axios.post(`${apiUrl}/sendMessage`, {
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'Markdown'
                });
            }

            console.log(`   ✅ Telegram ${chatId} 推送成功`);
            return true;
        } catch (error) {
            console.error(`   ❌ Telegram ${chatId} 推送失败:`, error.response?.data?.description || error.message);
            return false;
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
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            // 构建消息头
            const header = `${group.name} ${timeStr}`;

            // 判断消息类型
            const hasMedia = message.file && typeof message.file === 'string';
            const isImage = message.type === 'picture' || message.type === 'image';
            const isVideo = message.type === 'video';
            const isVoice = message.type === 'voice';

            if (hasMedia && isImage) {
                // 图片消息：标题 + 图片 合并发送（QQ支持）
                const localPath = await this.downloadMedia(group.name, message);
                if (localPath) {
                    let msgContent = `${header}\n[CQ:image,file=file://${localPath}]`;

                    // 如果有文字内容，加在图片后面
                    if (message.text) {
                        if (translatedText) {
                            msgContent += `\n${message.text}\n\n${translatedText}`;
                        } else {
                            msgContent += `\n${message.text}`;
                        }
                    }

                    const response = await axios.post(`${apiUrl}/send_group_msg`, {
                        group_id: parseInt(groupId),
                        message: msgContent,
                    });

                    if (response.data && response.data.status === 'failed') {
                        console.error(`   ❌ QQ群 ${groupId} 推送失败:`, response.data.message || 'API返回失败');
                        return false;
                    }
                } else {
                    // 下载失败，发送文字提示
                    const fallbackMsg = `${header}\n━━━━━━━━━━\n[图片下载失败]`;
                    await axios.post(`${apiUrl}/send_group_msg`, {
                        group_id: parseInt(groupId),
                        message: fallbackMsg,
                    });
                }
            } else if (hasMedia && isVideo) {
                // 视频消息：先发标题，再发视频（QQ不支持视频和文字合并）
                const localPath = await this.downloadMedia(group.name, message);
                if (localPath) {
                    // 先发标题
                    await axios.post(`${apiUrl}/send_group_msg`, {
                        group_id: parseInt(groupId),
                        message: `${header}\n━━━━━━━━━━`,
                    });
                    // 再发视频
                    await this.sendMediaToQQ(apiUrl, groupId, message.type, localPath);
                } else {
                    // 下载失败，发送文字提示
                    const fallbackMsg = `${header}\n━━━━━━━━━━\n[视频下载失败]`;
                    await axios.post(`${apiUrl}/send_group_msg`, {
                        group_id: parseInt(groupId),
                        message: fallbackMsg,
                    });
                }
            } else if (hasMedia && isVoice) {
                // 语音消息：标题 + 语音条
                const localPath = await this.downloadMedia(group.name, message);
                if (localPath) {
                    // 先发标题
                    await axios.post(`${apiUrl}/send_group_msg`, {
                        group_id: parseInt(groupId),
                        message: `${header}\n━━━━━━━━━━`,
                    });
                    // 再发语音
                    await this.sendMediaToQQ(apiUrl, groupId, message.type, localPath);
                }
            } else {
                // 纯文本消息
                let msgContent = `${header}\n`;
                msgContent += `━━━━━━━━━━\n`;

                if (message.text) {
                    if (translatedText) {
                        msgContent += message.text + `\n\n${translatedText}`;
                    } else {
                        msgContent += message.text;
                    }
                } else {
                    msgContent += `[${message.type || '未知类型'}]`;
                }

                const response = await axios.post(`${apiUrl}/send_group_msg`, {
                    group_id: parseInt(groupId),
                    message: msgContent,
                });

                if (response.data && response.data.status === 'failed') {
                    console.error(`   ❌ QQ群 ${groupId} 推送失败:`, response.data.message || 'API返回失败');
                    return false;
                }
            }

            console.log(`   ✅ QQ群 ${groupId} 推送成功`);
            return true;
        } catch (error) {
            console.error(`   ❌ QQ群 ${groupId} 推送失败:`, error.message);

            // 构建用于重试的消息内容
            const msgTime = new Date(message.published_at);
            const timeStr = msgTime.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
            let msgContent = `${group.name} ${timeStr}\n━━━━━━━━━━\n`;
            if (message.text) {
                msgContent += translatedText ? message.text + `\n\n${translatedText}` : message.text;
            } else {
                msgContent += `[${message.type || '媒体'}]`;
            }

            // 将失败的任务加入重试队列
            this.failedPushes.push({
                groupId,
                memberName: group.name,
                msgContent,
                message,
                failedAt: Date.now(),
                retryCount: 1,
            });

            this.saveFailedPushes();
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

            // 从 URL 提取扩展名
            const urlPath = new URL(message.file).pathname;
            const originalFileName = path.basename(urlPath.split('?')[0]);
            const ext = path.extname(originalFileName) || '.bin';

            // 使用消息时间生成文件名：成员名_YYYYMMDD_HH:mm:ss.ext
            const msgTime = new Date(message.published_at);
            const dateStr = msgTime.toISOString().slice(0, 10).replace(/-/g, '');  // YYYYMMDD
            const timeStr = msgTime.toISOString().slice(11, 19).replace(/:/g, '-'); // HH-mm-ss (用连字符替代冒号，避免文件名问题)
            const displayName = memberName; // 保留原始名字含空格
            const fileName = `${displayName}_${dateStr}_${timeStr}${ext}`;
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
            if (pushConfig.authTokens?.[siteKey]) {
                const success = await this.authenticate(siteKey);
                console.log(`   ${SITES[siteKey].name}: ${success ? '✅ 準備完了' : '❌ 認証失敗'}`);
            }
        }

        // 定期刷新 token
        setInterval(async () => {
            console.log('\n🔄 定期更新 token...');
            for (const siteKey of Object.keys(SITES)) {
                if (pushConfig.authTokens?.[siteKey]) {
                    await this.authenticate(siteKey);
                }
            }
        }, 30 * 60 * 1000);

        // 每5分钟热加载配置
        setInterval(() => {
            try {
                const configPath = require.resolve('./push-config');
                delete require.cache[configPath];
                pushConfig = require('./push-config');
                console.log('🔄 配置已热加载');
            } catch (e) {
                console.error('⚠️ 配置热加载失败:', e.message);
            }
        }, 5 * 60 * 1000);

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
