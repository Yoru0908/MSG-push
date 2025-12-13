/**
 * 轮询监听器 - 定期检查消息更新
 * 比WebSocket更可靠，适合大多数场景
 */

require('dotenv').config();
const axios = require('axios');

class MessagePollingListener {
  constructor(site) {
    this.site = site;
    this.token = process.env[`${site.slug.toUpperCase()}_API_TOKEN`];
    this.cookie = process.env[`${site.slug.toUpperCase()}_COOKIE`];
    this.lastMessageId = null;
    this.lastCheckTime = null;
    this.checkInterval = 60000; // 默认60秒检查一次
    this.isRunning = false;
  }

  /**
   * 开始监听
   */
  start(intervalSeconds = 60) {
    this.checkInterval = intervalSeconds * 1000;
    this.isRunning = true;
    
    console.log('🎧 轮询监听器已启动');
    console.log(`⏱️  检查间隔: ${intervalSeconds}秒`);
    console.log('💡 按 Ctrl+C 停止\n');
    
    // 立即执行一次
    this.checkForUpdates();
    
    // 定期检查
    this.intervalId = setInterval(() => {
      this.checkForUpdates();
    }, this.checkInterval);
  }

  /**
   * 检查更新
   */
  async checkForUpdates() {
    try {
      const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo' });
      console.log(`\n🔍 [${now}] 检查消息更新...`);
      
      // 获取最新消息
      const messages = await this.fetchLatestMessages();
      
      if (!messages || messages.length === 0) {
        console.log('📭 暂无新消息');
        return;
      }

      // 检查是否有新消息
      const newMessages = this.filterNewMessages(messages);
      
      if (newMessages.length > 0) {
        console.log(`🎉 发现 ${newMessages.length} 条新消息！`);
        
        // 处理每条新消息
        for (const message of newMessages) {
          await this.handleNewMessage(message);
        }
        
        // 更新最后消息ID
        this.lastMessageId = messages[0].id;
      } else {
        console.log('📭 没有新消息');
      }
      
      this.lastCheckTime = Date.now();
      
    } catch (error) {
      console.error('❌ 检查更新失败:', error.message);
      
      // 如果是Token过期，尝试刷新
      if (error.response?.status === 401) {
        console.log('⚠️  Token可能已过期，需要重新登录');
        await this.refreshToken();
      }
    }
  }

  /**
   * 获取最新消息
   */
  async fetchLatestMessages() {
    const response = await axios.get(
      `https://api.message.${this.site.slug}.com/v2/timeline`,
      {
        headers: {
          'Authorization': this.token,
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        params: {
          limit: 20,
          offset: 0
        }
      }
    );

    return response.data.messages || response.data.data || [];
  }

  /**
   * 过滤新消息
   */
  filterNewMessages(messages) {
    if (!this.lastMessageId) {
      // 第一次运行，只返回最新的一条
      this.lastMessageId = messages[0]?.id;
      return [messages[0]];
    }

    // 找出所有比lastMessageId新的消息
    const newMessages = [];
    for (const message of messages) {
      if (message.id === this.lastMessageId) {
        break;
      }
      newMessages.push(message);
    }

    return newMessages;
  }

  /**
   * 处理新消息
   */
  async handleNewMessage(message) {
    console.log('\n📨 新消息详情:');
    console.log(`   ID: ${message.id}`);
    console.log(`   成员: ${message.member?.name || '未知'}`);
    console.log(`   时间: ${message.created_at}`);
    console.log(`   内容: ${message.content?.substring(0, 100)}...`);
    
    // 推送到Discord
    await this.sendToDiscord(message);
  }

  /**
   * 发送到Discord
   */
  async sendToDiscord(message) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log('⚠️  未配置Discord Webhook');
      return;
    }

    try {
      const member = message.member || {};
      const content = message.content || '';
      
      await axios.post(webhookUrl, {
        embeds: [{
          title: `💌 ${member.name || '未知成员'}的新消息`,
          description: content.length > 2000 ? content.substring(0, 2000) + '...' : content,
          color: 0x5865F2,
          timestamp: message.created_at,
          thumbnail: {
            url: member.avatar_url
          },
          footer: {
            text: this.site.name
          },
          url: `https://message.${this.site.slug}.com/messages/${message.id}`
        }]
      });
      
      console.log('✅ 已推送到Discord');
    } catch (error) {
      console.error('❌ Discord推送失败:', error.message);
    }
  }

  /**
   * 刷新Token
   */
  async refreshToken() {
    console.log('🔄 尝试刷新Token...');
    
    try {
      // 调用自动登录脚本
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout, stderr } = await execAsync('node patchright-flutter-login.js', {
        cwd: __dirname
      });
      
      console.log('✅ Token刷新成功');
      
      // 重新加载环境变量
      delete require.cache[require.resolve('dotenv')];
      require('dotenv').config();
      
      this.token = process.env[`${this.site.slug.toUpperCase()}_API_TOKEN`];
      this.cookie = process.env[`${this.site.slug.toUpperCase()}_COOKIE`];
      
    } catch (error) {
      console.error('❌ Token刷新失败:', error.message);
    }
  }

  /**
   * 停止监听
   */
  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('\n👋 监听器已停止');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const uptime = this.lastCheckTime ? Date.now() - this.lastCheckTime : 0;
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval / 1000,
      lastCheckTime: this.lastCheckTime ? new Date(this.lastCheckTime).toLocaleString() : '未检查',
      lastMessageId: this.lastMessageId,
      uptime: Math.floor(uptime / 1000)
    };
  }
}

// 运行
if (require.main === module) {
  const site = {
    slug: 'hinatazaka46',
    name: '日向坂46'
  };

  const listener = new MessagePollingListener(site);
  
  // 从命令行参数获取检查间隔（秒）
  const intervalSeconds = parseInt(process.argv[2]) || 60;
  
  listener.start(intervalSeconds);

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n\n📊 统计信息:');
    const stats = listener.getStats();
    console.log(`   运行时间: ${stats.uptime}秒`);
    console.log(`   检查间隔: ${stats.checkInterval}秒`);
    console.log(`   最后检查: ${stats.lastCheckTime}`);
    
    listener.stop();
    process.exit(0);
  });

  // 定期显示状态
  setInterval(() => {
    const stats = listener.getStats();
    console.log(`\n💡 状态: 运行中 | 间隔: ${stats.checkInterval}s | 最后检查: ${stats.lastCheckTime}`);
  }, 300000); // 每5分钟显示一次
}

module.exports = MessagePollingListener;
