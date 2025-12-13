const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const AuthManager = require('./auth-manager');

/**
 * 基于API的消息抓取器
 * 不使用Playwright，直接调用API
 * 速度快，资源占用低
 */
class APIMessageScraper {
  constructor(site, apiConfig) {
    this.site = site;
    this.apiConfig = apiConfig;
    this.hashFile = path.join(__dirname, '..', 'data', `hash-${site.slug}.txt`);
    this.dataFile = path.join(__dirname, '..', 'data', `messages-${site.slug}.json`);
    this.authManager = new AuthManager(site, apiConfig);

    // 创建axios客户端（Token会动态更新）
    this.client = null;
    this.initializeClient();
  }

  /**
   * 初始化HTTP客户端
   */
  initializeClient() {
    this.client = axios.create({
      baseURL: this.apiConfig.baseUrl,
      timeout: 15000,
      headers: {
        'accept': 'application/json',
        'authorization': this.apiConfig.authorization,
        'cookie': this.apiConfig.cookie,
        'x-talk-app-id': this.apiConfig.appId,
        'x-talk-app-platform': this.apiConfig.appPlatform
      }
    });
  }

  /**
   * 确保Token有效（自动刷新）
   */
  async ensureValidToken() {
    try {
      // 获取账号密码（移除数字46）
      const siteKey = this.site.slug.replace('46', '').toUpperCase();
      const email = process.env[`${siteKey}_EMAIL`];
      const password = process.env[`${siteKey}_PASSWORD`];

      // 获取有效Token
      const tokenData = await this.authManager.getValidToken(email, password);

      // 更新client的headers
      this.client.defaults.headers['authorization'] = tokenData.token;
      this.client.defaults.headers['cookie'] = tokenData.cookie;

      return true;
    } catch (error) {
      console.error(`⚠️  Token刷新失败:`, error.message);
      return false;
    }
  }

  /**
   * 获取所有成员列表
   */
  async getMembers() {
    try {
      const response = await this.client.get(`/v2/groups/${this.apiConfig.groupId}/members`);
      // API直接返回数组，不是 {members: [...]}
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('⚠️  获取成员列表失败:', error.message);
      return [];
    }
  }

  /**
   * 抓取单个group的消息
   */
  async scrapeGroup(groupId, groupName = null) {
    try {
      const response = await this.client.get(`/v2/groups/${groupId}/timeline`, {
        params: {
          count: 200,
          order: 'desc',
          clear_unread: true
        }
      });

      const messages = this.parseMessages(response.data);
      
      return {
        groupId,
        groupName,
        messages,
        messageCount: messages.length
      };
    } catch (error) {
      console.error(`  ❌ Group ${groupId} 失败:`, error.message);
      return {
        groupId,
        groupName,
        messages: [],
        messageCount: 0,
        error: error.message
      };
    }
  }

  /**
   * 抓取已订阅的Groups的消息
   */
  async scrapeSubscribedGroups() {
    console.log(`\n🌸 开始抓取: ${this.site.name}`);
    console.log(`🌐 API: ${this.apiConfig.baseUrl}\n`);

    // 确保Token有效
    await this.ensureValidToken();

    const subscribedGroups = this.apiConfig.subscribedGroups || [];
    
    if (subscribedGroups.length === 0) {
      console.log('⚠️  未配置已订阅的Groups');
      return {
        site: this.site.slug,
        siteName: this.site.name,
        timestamp: new Date().toISOString(),
        groups: [],
        totalMessages: 0
      };
    }

    console.log(`📋 已订阅 ${subscribedGroups.length} 个Groups: [${subscribedGroups.join(', ')}]\n`);

    try {
      const allResults = [];
      let totalMessages = 0;

      for (const groupId of subscribedGroups) {
        console.log(`📡 [${allResults.length + 1}/${subscribedGroups.length}] Group ${groupId}`);
        
        const result = await this.scrapeGroup(groupId, `Group ${groupId}`);
        allResults.push(result);
        totalMessages += result.messageCount;
        
        console.log(`  ✅ ${result.messageCount} 条消息`);
        
        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`\n📊 总计: ${totalMessages} 条消息`);

      return {
        site: this.site.slug,
        siteName: this.site.name,
        timestamp: new Date().toISOString(),
        groups: allResults,
        totalMessages
      };

    } catch (error) {
      if (error.response) {
        console.error('❌ API错误:', error.response.status, error.response.statusText);
        throw new Error(`API请求失败: ${error.response.status} ${error.response.statusText}`);
      } else if (error.request) {
        console.error('❌ 网络错误: 无响应');
        throw new Error('网络错误: 无法连接到API服务器');
      } else {
        console.error('❌ 错误:', error.message);
        throw error;
      }
    }
  }

  /**
   * 抓取消息（抓取已订阅的Groups）
   */
  async scrape(scrapeAll = true) {
    // 直接抓取已订阅的Groups
    return await this.scrapeSubscribedGroups();
  }

  /**
   * 解析API返回的消息数据
   */
  parseMessages(data) {
    const messages = data.messages || [];
    
    return messages.map(msg => {
      // 提取基本信息
      const parsed = {
        id: msg.id,
        memberId: msg.member_id,
        groupId: msg.group_id,
        type: msg.type,
        text: msg.text || '',
        publishedAt: msg.published_at,
        updatedAt: msg.updated_at,
        isFavorite: msg.is_favorite || false,
        state: msg.state
      };

      // 处理图片消息 - 字段名是 'file'，不是 'image_url'！
      if (msg.type === 'picture' || msg.type === 'image') {
        parsed.imageUrl = msg.file; // 主要使用 file 字段
        parsed.thumbnail = msg.thumbnail; // 缩略图
      }

      // 处理视频消息
      if (msg.type === 'video') {
        parsed.videoUrl = msg.file || msg.video_url;
        parsed.thumbnail = msg.thumbnail;
      }
      
      // 处理语音消息
      if (msg.type === 'voice') {
        parsed.voiceUrl = msg.file || msg.voice_url;
      }
      
      // 兼容旧版API：有些消息可能直接有 image_url 字段
      if (msg.image_url && !parsed.imageUrl) {
        parsed.imageUrl = msg.image_url;
      }

      return parsed;
    });
  }

  /**
   * 计算内容hash
   */
  calculateHash(data) {
    const content = JSON.stringify(data);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 检查是否有新内容
   */
  async hasNewContent(data) {
    const newHash = this.calculateHash(data);

    try {
      const oldHash = await fs.readFile(this.hashFile, 'utf-8');
      return oldHash.trim() !== newHash;
    } catch (e) {
      // 文件不存在，视为有新内容
      return true;
    }
  }

  /**
   * 保存hash和数据
   */
  async saveData(data) {
    const hash = this.calculateHash(data);
    
    await fs.mkdir(path.dirname(this.hashFile), { recursive: true });
    await fs.writeFile(this.hashFile, hash);
    await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));

    console.log(`💾 数据已保存: ${this.dataFile}`);
  }

  /**
   * 获取最新的N条消息（用于Discord推送）
   */
  getLatestMessages(messages, limit = 5) {
    // 按时间排序，取最新的N条
    return messages
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, limit);
  }

  /**
   * 提取所有消息用于检查
   */
  extractAllMessages(data) {
    if (data.groups) {
      // 多Groups模式
      const allMessages = [];
      for (const group of data.groups) {
        allMessages.push(...group.messages);
      }
      return allMessages;
    } else {
      // 单Group模式
      return data.messages || [];
    }
  }

  /**
   * 完整的抓取流程：抓取 -> 检查变化 -> 保存
   */
  async scrapeAndCheck(scrapeAll = true) {
    const data = await this.scrape(scrapeAll);
    const allMessages = this.extractAllMessages(data);
    const hasNew = await this.hasNewContent(allMessages);

    if (hasNew) {
      console.log('🆕 检测到新内容！');
      await this.saveData(allMessages);
      
      // 只推送最新的5条消息到Discord
      const latestMessages = this.getLatestMessages(allMessages, 5);
      
      return { 
        hasNew: true, 
        data: {
          ...data,
          messages: latestMessages // 用于推送的最新消息
        }
      };
    } else {
      console.log('✅ 无新内容');
      return { hasNew: false, data: null };
    }
  }
}

module.exports = APIMessageScraper;
