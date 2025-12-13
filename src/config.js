/**
 * 多站点配置
 * 支持日向坂46和櫻坂46同时抓取
 */

// 加载环境变量
require('dotenv').config();

module.exports = {
  sites: [
    {
      name: '日向坂46',
      slug: 'hinatazaka46',
      url: 'https://message.hinatazaka46.com/organization/1/talk/timeline/70?mode=normal',
      loginUrl: 'https://message.hinatazaka46.com',
      color: '#00a0de', // Discord embed颜色
      icon: '🌸',
    },
    {
      name: '櫻坂46',
      slug: 'sakurazaka46',
      url: 'https://message.sakurazaka46.com/organization/1/talk/timeline/72?mode=normal',
      loginUrl: 'https://message.sakurazaka46.com',
      color: '#e95595', // Discord embed颜色
      icon: '🌸',
    }
  ],
  
  // Discord webhook配置
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    username: '坂道メッセージBot',
    avatarUrl: 'https://i.imgur.com/AfFp7pu.png' // 可选
  },
  
  // 认证配置
  auth: {
    // 如果使用token方式
    tokens: {
      hinatazaka46: process.env.HINATAZAKA_TOKEN,
      sakurazaka46: process.env.SAKURAZAKA_TOKEN,
    },
    // 如果使用自动登录
    credentials: {
      hinatazaka46: {
        email: process.env.HINATAZAKA_EMAIL,
        password: process.env.HINATAZAKA_PASSWORD,
      },
      sakurazaka46: {
        email: process.env.SAKURAZAKA_EMAIL,
        password: process.env.SAKURAZAKA_PASSWORD,
      }
    }
  },
  
  // 抓取配置
  scraper: {
    timeout: 30000, // 30秒超时
    headless: true, // 生产环境使用无头模式
    retries: 3, // 失败重试次数
  },

  // API配置（新版：直接调用API，不使用Playwright）
  api: {
    hinatazaka46: {
      baseUrl: 'https://api.message.hinatazaka46.com',
      // 已订阅的Groups列表
      subscribedGroups: [34, 76, 70, 43, 78], 
      // 34: 金村美玖 (付费)
      // 76: 山下葉留花 (付费)
      // 70: 正源司陽子 (付费)
      // 43: 日向坂46官方 (免费)
      // 78: 四期生ライブ (免费)
      authorization: process.env.HINATAZAKA_API_TOKEN, // Bearer token
      cookie: process.env.HINATAZAKA_COOKIE, // 完整的Cookie字符串
      appId: 'jp.co.sonymusic.communication.keyakizaka 2.5',
      appPlatform: 'web',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
    },
    sakurazaka46: {
      baseUrl: 'https://api.message.sakurazaka46.com',
      // 已订阅的Groups列表
      subscribedGroups: [56, 63, 64, 67, 72, 33, 73],
      // 56: 大園玲 (付费)
      // 63: 遠藤理子 (付费)
      // 64: 小田倉麗奈 (付费)
      // 67: 中嶋優月 (付费)
      // 72: 山下瞳月 (付费)
      // 33: 櫻坂46官方 (免费)
      // 73: 新参者 三期生 (免费)
      authorization: process.env.SAKURAZAKA_API_TOKEN, // Bearer token
      cookie: process.env.SAKURAZAKA_COOKIE, // 完整的Cookie字符串
      appId: 'jp.co.sonymusic.communication.sakurazaka 2.5',
      appPlatform: 'web',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
    }
  }
};
