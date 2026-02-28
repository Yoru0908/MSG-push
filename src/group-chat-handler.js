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

        console.log(`📨 收到群消息 [群${event.group_id}] @机器人: ${isAtMe}`);

        if (!isAtMe) return;

        // 提取文本内容用于检查关键字
        const textContent = message
            .filter(seg => seg.type === 'text')
            .map(seg => seg.data.text)
            .join(' ');

        // 检查是否有图片（优先当前消息，其次引用消息）
        let imageSeg = message.find(seg => seg.type === 'image');

        // 如果当前消息没有图片，检查是否有引用消息包含图片
        if (!imageSeg) {
            const replySeg = message.find(seg => seg.type === 'reply');
            if (replySeg) {
                console.log(`   📎 检测到引用消息，尝试获取原消息图片...`);
                // 尝试通过 API 获取引用的原消息
                try {
                    const originalMsg = await this.getMessageById(replySeg.data.id);
                    if (originalMsg && originalMsg.message) {
                        imageSeg = originalMsg.message.find(seg => seg.type === 'image');
                        if (imageSeg) {
                            console.log(`   ✅ 从引用消息中找到图片`);
                        }
                    }
                } catch (e) {
                    console.log(`   ⚠️ 获取引用消息失败: ${e.message}`);
                }
            }
        }

        if (imageSeg) {
            // 有图片，需要包含"识别"关键字才触发 OCR
            if (textContent.includes('识别')) {
                // 同时包含"翻译"才进行 OCR + 翻译，否则只做 OCR
                const shouldTranslate = textContent.includes('翻译');
                await this.handleImageMessage(event, imageSeg, shouldTranslate);
            }
            // 不包含"识别"则不响应
        } else {
            // 没有图片，进行文字翻译（handleTextMessage 内部会检查"翻译"关键字）
            await this.handleTextMessage(event, message);
        }
    }

    /**
     * 处理文字消息 - 需要包含"翻译"关键字才执行
     */
    async handleTextMessage(event, message) {
        // 提取文本内容（去掉 @ 部分）
        const textParts = message
            .filter(seg => seg.type === 'text')
            .map(seg => seg.data.text.trim())
            .filter(text => text.length > 0);

        const userText = textParts.join(' ').trim();

        // 检查是否包含"翻译"关键字
        if (!userText.includes('翻译')) {
            // 不包含翻译关键字，不响应
            return;
        }

        // 移除"翻译"关键字，获取要翻译的内容
        const contentToTranslate = userText.replace(/翻译/g, '').trim();

        if (!contentToTranslate) {
            await this.sendReply(event, '请在"翻译"后面加上日文内容哦~\n例如: @bot 翻译 こんにちは');
            return;
        }

        console.log(`📩 收到翻译请求 [群${event.group_id}]: ${contentToTranslate.substring(0, 50)}...`);

        try {
            const translated = await translator.translate(contentToTranslate, '用户提问');

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
     * 处理图片消息 - OCR (可选翻译)
     * @param {boolean} shouldTranslate - 是否翻译 OCR 结果
     */
    async handleImageMessage(event, imageSeg, shouldTranslate = false) {
        const imageUrl = imageSeg.data.url || imageSeg.data.file;

        if (!imageUrl) {
            await this.sendReply(event, '无法获取图片，请重试~');
            return;
        }

        console.log(`🖼️ 收到图片 OCR 请求 [群${event.group_id}] (翻译: ${shouldTranslate ? '是' : '否'})`);

        // 发送处理中提示
        await this.sendReply(event, shouldTranslate ? '🔍 正在识别并翻译图片文字...' : '🔍 正在识别图片文字...');

        try {
            // OCR 识别
            const ocrText = await ocr.recognizeImageFromUrl(imageUrl);

            if (!ocrText || ocrText.trim().length === 0) {
                await this.sendReply(event, '未能识别到图片中的文字~');
                return;
            }

            console.log(`   📝 识别到文字: ${ocrText.substring(0, 50)}...`);

            if (shouldTranslate) {
                // 需要翻译：使用 OCR 专用翻译（双语对照输出）
                const translated = await translator.translateForOcr(ocrText, '图片OCR');

                if (translated) {
                    await this.sendReply(event, translated);
                    console.log(`✅ OCR + 翻译成功`);
                } else {
                    // 翻译失败，只返回 OCR 结果
                    await this.sendReply(event, `📝 识别结果:\n${ocrText}\n\n(翻译失败)`);
                }
            } else {
                // 只做 OCR，不翻译
                await this.sendReply(event, `📝 识别结果:\n${ocrText}`);
                console.log(`✅ OCR 成功 (无翻译)`);
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

    /**
     * 通过消息 ID 获取消息详情
     */
    async getMessageById(messageId) {
        try {
            const response = await axios.post(`${this.napCatApi}/get_msg`, {
                message_id: messageId
            });
            return response.data?.data;
        } catch (error) {
            console.error('❌ 获取消息失败:', error.message);
            return null;
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

