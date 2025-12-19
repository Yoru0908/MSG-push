/**
 * 群消息回复模块
 * 监听 NapCat WebSocket 事件，处理 @机器人 的翻译请求
 * 支持文字翻译和图片 OCR + 翻译
 */

const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const translator = require('./translator');
const ocr = require('./ocr');
const pushConfig = require('./push-config');

class GroupChatHandler {
    constructor() {
        this.ws = null;
        this.botQQ = null;  // 机器人 QQ 号，启动时获取
        this.napCatApi = pushConfig.lagrangeApi;
        this.wsUrl = 'ws://127.0.0.1:3001';  // NapCat WebSocket 地址
        this.reconnectInterval = 5000;
        this.tempDir = '/tmp/ocr_images';

        // 确保临时目录存在
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async start() {
        // 获取机器人 QQ 号
        await this.getBotInfo();

        // 连接 WebSocket
        this.connect();
    }

    async getBotInfo() {
        try {
            const response = await axios.get(`${this.napCatApi}/get_login_info`);
            if (response.data.status === 'ok') {
                this.botQQ = response.data.data.user_id;
                console.log(`🤖 群聊模块启动，机器人 QQ: ${this.botQQ}`);
                console.log(`   - 支持文字翻译`);
                console.log(`   - 支持图片 OCR + 翻译`);
            }
        } catch (error) {
            console.error('❌ 获取机器人信息失败:', error.message);
        }
    }

    connect() {
        console.log(`🔌 连接 NapCat WebSocket: ${this.wsUrl}`);

        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
            console.log('✅ WebSocket 连接成功');
        });

        this.ws.on('message', async (data) => {
            try {
                const event = JSON.parse(data.toString());
                await this.handleEvent(event);
            } catch (error) {
                // 忽略解析错误
            }
        });

        this.ws.on('close', () => {
            console.log('⚠️ WebSocket 连接断开，5秒后重连...');
            setTimeout(() => this.connect(), this.reconnectInterval);
        });

        this.ws.on('error', (error) => {
            console.error('❌ WebSocket 错误:', error.message);
        });
    }

    async handleEvent(event) {
        // 只处理群消息
        if (event.post_type !== 'message' || event.message_type !== 'group') {
            return;
        }

        // 检查是否 @机器人
        const message = event.message || [];
        const isAtMe = message.some(seg =>
            seg.type === 'at' && String(seg.data.qq) === String(this.botQQ)
        );

        if (!isAtMe) return;

        // 检查是否有图片
        const imageSeg = message.find(seg => seg.type === 'image');

        if (imageSeg) {
            // 有图片，进行 OCR + 翻译
            await this.handleImageMessage(event, imageSeg);
        } else {
            // 没有图片，进行文字翻译
            await this.handleTextMessage(event, message);
        }
    }

    /**
     * 处理文字消息 - 直接翻译
     */
    async handleTextMessage(event, message) {
        // 提取文本内容（去掉 @ 部分）
        const textParts = message
            .filter(seg => seg.type === 'text')
            .map(seg => seg.data.text.trim())
            .filter(text => text.length > 0);

        const userText = textParts.join(' ').trim();

        if (!userText) {
            await this.sendReply(event, '请发送日文内容或图片，我会帮你翻译哦~');
            return;
        }

        console.log(`📩 收到翻译请求 [群${event.group_id}]: ${userText.substring(0, 50)}...`);

        try {
            const translated = await translator.translate(userText, '用户提问');

            if (translated) {
                await this.sendReply(event, translated);
                console.log(`✅ 翻译回复成功`);
            } else {
                await this.sendReply(event, '翻译失败了，请稍后再试~');
            }
        } catch (error) {
            console.error('❌ 翻译出错:', error.message);
            await this.sendReply(event, '翻译出错了，请稍后再试~');
        }
    }

    /**
     * 处理图片消息 - OCR + 翻译
     */
    async handleImageMessage(event, imageSeg) {
        const imageUrl = imageSeg.data.url || imageSeg.data.file;

        if (!imageUrl) {
            await this.sendReply(event, '无法获取图片，请重试~');
            return;
        }

        console.log(`🖼️ 收到图片 OCR 请求 [群${event.group_id}]`);

        // 发送处理中提示
        await this.sendReply(event, '🔍 正在识别图片文字...');

        try {
            // OCR 识别
            const ocrText = await ocr.recognizeImageFromUrl(imageUrl);

            if (!ocrText || ocrText.trim().length === 0) {
                await this.sendReply(event, '未能识别到图片中的文字~');
                return;
            }

            console.log(`   📝 识别到文字: ${ocrText.substring(0, 50)}...`);

            // 使用 OCR 专用翻译（双语对照输出）
            const translated = await translator.translateForOcr(ocrText, '图片OCR');

            if (translated) {
                // translateForOcr 已经返回双语对照格式，直接发送
                await this.sendReply(event, translated);
                console.log(`✅ OCR + 翻译成功`);
            } else {
                // 翻译失败，只返回 OCR 结果
                await this.sendReply(event, `📝 识别结果:\n${ocrText}\n\n(翻译失败)`);
            }
        } catch (error) {
            console.error('❌ OCR 处理出错:', error.message);
            await this.sendReply(event, 'OCR 识别出错了，请稍后再试~');
        }
    }

    async sendReply(event, text) {
        try {
            // 使用引用回复
            const replyMsg = `[CQ:reply,id=${event.message_id}]${text}`;

            await axios.post(`${this.napCatApi}/send_group_msg`, {
                group_id: event.group_id,
                message: replyMsg,
            });
        } catch (error) {
            console.error('❌ 发送回复失败:', error.message);
        }
    }

    stop() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

module.exports = GroupChatHandler;

// 如果直接运行此文件
if (require.main === module) {
    require('dotenv').config();
    const handler = new GroupChatHandler();
    handler.start();
}

