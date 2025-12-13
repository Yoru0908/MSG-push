/**
 * WebSocket监听器 - 实时接收消息更新
 */

require('dotenv').config();
const WebSocket = require('ws');
const axios = require('axios');

class MessageWebSocketListener {
  constructor(site) {
    this.site = site;
    this.ws = null;
    this.token = process.env[`${site.slug.toUpperCase()}_API_TOKEN`];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  /**
   * 连接WebSocket
   */
  connect() {
    console.log('🔌 连接WebSocket...');
    
    // 坂道消息的WebSocket地址（需要确认实际地址）
    const wsUrl = `wss://api.message.${this.site.slug}.com/ws`;
    
    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': this.token,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    });

    this.ws.on('open', () => {
      console.log('✅ WebSocket已连接');
      this.reconnectAttempts = 0;
      
      // 发送心跳
      this.startHeartbeat();
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });

    this.ws.on('error', (error) => {
      console.error('❌ WebSocket错误:', error.message);
    });

    this.ws.on('close', () => {
      console.log('⚠️  WebSocket已断开');
      this.reconnect();
    });
  }

  /**
   * 处理接收到的消息
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      console.log('📨 收到消息:', message);

      // 根据消息类型处理
      switch (message.type) {
        case 'new_message':
          this.onNewMessage(message.data);
          break;
        case 'message_update':
          this.onMessageUpdate(message.data);
          break;
        case 'heartbeat':
          // 心跳响应
          break;
        default:
          console.log('未知消息类型:', message.type);
      }
    } catch (error) {
      console.error('解析消息失败:', error.message);
    }
  }

  /**
   * 新消息处理
   */
  async onNewMessage(data) {
    console.log('🎉 新消息！');
    console.log(`成员: ${data.member_name}`);
    console.log(`内容: ${data.content}`);
    
    // 推送到Discord
    await this.sendToDiscord(data);
  }

  /**
   * 消息更新处理
   */
  async onMessageUpdate(data) {
    console.log('🔄 消息更新');
    // 处理消息更新
  }

  /**
   * 发送到Discord
   */
  async sendToDiscord(message) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      await axios.post(webhookUrl, {
        embeds: [{
          title: `💌 ${message.member_name}的新消息`,
          description: message.content,
          color: 0x5865F2,
          timestamp: new Date().toISOString(),
          thumbnail: {
            url: message.member_avatar
          }
        }]
      });
      console.log('✅ 已推送到Discord');
    } catch (error) {
      console.error('❌ Discord推送失败:', error.message);
    }
  }

  /**
   * 心跳保持连接
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000); // 每30秒发送一次心跳
  }

  /**
   * 重连
   */
  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ 重连次数过多，放弃重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`🔄 ${delay/1000}秒后重连... (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 停止监听
   */
  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 运行
const site = {
  slug: 'hinatazaka46',
  name: '日向坂46'
};

const listener = new MessageWebSocketListener(site);
listener.connect();

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭...');
  listener.stop();
  process.exit(0);
});

console.log('🎧 WebSocket监听器已启动');
console.log('💡 按 Ctrl+C 停止');
