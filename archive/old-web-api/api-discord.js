const axios = require('axios');
const config = require('./config');
const fs = require('fs');
const path = require('path');

/**
 * Discord推送管理器 - API版本
 * 适配新的API消息格式
 */
class APIDiscordNotifier {
  constructor(webhookUrl = config.discord.webhookUrl) {
    this.webhookUrl = webhookUrl;
    
    // 加载成员信息（用于显示成员名字）
    try {
      const memberDataPath = path.join(__dirname, '..', 'member-api-endpoints.json');
      const memberData = JSON.parse(fs.readFileSync(memberDataPath, 'utf-8'));
      this.memberMap = this.buildMemberMap(memberData);
    } catch (error) {
      console.warn('⚠️  无法加载成员信息，将使用Member ID显示');
      this.memberMap = {};
    }
  }

  /**
   * 构建成员ID到名字的映射
   */
  buildMemberMap(memberData) {
    const map = {};
    
    for (const siteKey in memberData.sites) {
      const site = memberData.sites[siteKey];
      for (const memberName in site.members) {
        const member = site.members[memberName];
        map[member.id] = {
          name: member.name,
          thumbnail: member.thumbnail
        };
      }
    }
    
    return map;
  }

  /**
   * 发送消息到Discord
   */
  async sendMessage(site, messages) {
    if (!this.webhookUrl) {
      console.error('❌ Discord webhook URL未配置');
      return false;
    }

    console.log(`📤 推送到Discord: ${site.name}`);

    try {
      // 构建Discord embed
      const embeds = this.buildEmbeds(site, messages);

      if (embeds.length === 0) {
        console.log('ℹ️  没有消息需要推送');
        return true;
      }

      // 分批发送（Discord限制每次最多10个embeds）
      const batches = this.chunkArray(embeds, 10);

      for (const batch of batches) {
        await axios.post(this.webhookUrl, {
          username: config.discord.username || '坂道メッセージBot',
          avatar_url: config.discord.avatarUrl,
          embeds: batch
        });

        // 避免触发rate limit
        if (batches.length > 1) {
          await this.sleep(1000);
        }
      }

      console.log(`✅ 推送成功: ${embeds.length} 条消息`);
      return true;

    } catch (error) {
      console.error('❌ Discord推送失败:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * 构建Discord embeds（适配API格式）
   */
  buildEmbeds(site, messages) {
    return messages.map(msg => {
      // 获取成员信息
      const member = this.memberMap[msg.memberId] || { 
        name: `Member ${msg.memberId}` 
      };

      // 格式化时间
      const publishTime = this.formatTime(msg.publishedAt);

      // 构建embed
      const embed = {
        author: {
          name: member.name,
          icon_url: member.thumbnail
        },
        description: msg.text ? this.truncate(msg.text, 2000) : '_（无文字内容）_',
        color: parseInt(site.color.replace('#', ''), 16),
        timestamp: msg.publishedAt,
        footer: {
          text: `${site.name} • ID: ${msg.id}`,
        },
        fields: []
      };

      // 添加消息类型标识
      const typeEmoji = {
        'text': '💬',
        'picture': '📷',
        'video': '🎥',
        'image': '📷'
      };
      
      if (msg.type && typeEmoji[msg.type]) {
        embed.fields.push({
          name: '类型',
          value: `${typeEmoji[msg.type]} ${msg.type}`,
          inline: true
        });
      }

      // 添加发布时间
      if (publishTime) {
        embed.fields.push({
          name: '发布时间',
          value: publishTime,
          inline: true
        });
      }

      // 添加图片（如果有）
      if (msg.imageUrl) {
        embed.image = { url: msg.imageUrl };
      }

      // 如果是收藏的消息，添加标记
      if (msg.isFavorite) {
        embed.fields.push({
          name: '⭐',
          value: '已收藏',
          inline: true
        });
      }

      return embed;
    });
  }

  /**
   * 发送简单文本消息
   */
  async sendText(content) {
    if (!this.webhookUrl) {
      console.error('❌ Discord webhook URL未配置');
      return false;
    }

    try {
      await axios.post(this.webhookUrl, {
        username: config.discord.username || '坂道メッセージBot',
        content
      });
      return true;
    } catch (error) {
      console.error('❌ Discord推送失败:', error.message);
      return false;
    }
  }

  /**
   * 发送错误通知
   */
  async sendError(site, error) {
    const embed = {
      title: '❌ 抓取失败',
      description: `站点: ${site?.name || '未知'}\n错误: ${error.message}`,
      color: 0xff0000, // 红色
      timestamp: new Date().toISOString()
    };

    try {
      await axios.post(this.webhookUrl, {
        username: config.discord.username || '坂道メッセージBot',
        embeds: [embed]
      });
    } catch (e) {
      console.error('❌ 错误通知发送失败:', e.message);
    }
  }

  /**
   * 格式化时间
   */
  formatTime(isoString) {
    if (!isoString) return null;
    
    try {
      const date = new Date(isoString);
      // 转换为日本时间 (UTC+9)
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstDate = new Date(date.getTime() + jstOffset);
      
      const year = jstDate.getUTCFullYear();
      const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(jstDate.getUTCDate()).padStart(2, '0');
      const hours = String(jstDate.getUTCHours()).padStart(2, '0');
      const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes} JST`;
    } catch (error) {
      return isoString;
    }
  }

  /**
   * 工具方法：截断文本
   */
  truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * 工具方法：数组分批
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 工具方法：延迟
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = APIDiscordNotifier;
