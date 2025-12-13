/**
 * API测试脚本
 * 用于测试新的API scraper是否正常工作
 */

require('dotenv').config();
const config = require('./src/config');
const APIMessageScraper = require('./src/api-scraper');

async function testAPI() {
  const siteArg = process.argv[2] || 'hinatazaka46';
  
  console.log('🧪 API Scraper 测试工具');
  console.log('='.repeat(60));
  console.log(`测试站点: ${siteArg}\n`);

  // 查找站点配置
  const site = config.sites.find(s => s.slug === siteArg);
  if (!site) {
    console.error('❌ 未知站点:', siteArg);
    console.log('可用站点:', config.sites.map(s => s.slug).join(', '));
    process.exit(1);
  }

  // 获取API配置
  const apiConfig = config.api[site.slug];
  
  // 检查配置
  console.log('📋 配置检查:');
  console.log(`  Base URL: ${apiConfig.baseUrl}`);
  console.log(`  Endpoint: ${apiConfig.endpoint}`);
  console.log(`  Authorization: ${apiConfig.authorization ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`  Cookie: ${apiConfig.cookie ? '✅ 已配置' : '❌ 未配置'}`);
  console.log('');

  if (!apiConfig.authorization || !apiConfig.cookie) {
    console.error('❌ 缺少认证配置！');
    console.log('\n请在.env文件中配置：');
    console.log(`  ${site.slug.toUpperCase()}_API_TOKEN=Bearer xxx`);
    console.log(`  ${site.slug.toUpperCase()}_COOKIE=xxx`);
    console.log('\n获取方法：');
    console.log('  1. 打开Chrome DevTools (F12)');
    console.log('  2. 切换到Network标签');
    console.log(`  3. 访问 ${site.url}`);
    console.log('  4. 找到timeline请求');
    console.log('  5. 复制Request Headers中的authorization和cookie');
    process.exit(1);
  }

  try {
    console.log('🚀 开始测试...\n');
    
    // 创建scraper实例
    const scraper = new APIMessageScraper(site, apiConfig);
    
    // 测试抓取（默认抓取所有成员）
    const scrapeAll = process.argv[3] !== 'single';
    console.log(`模式: ${scrapeAll ? '所有成员' : '单个主Group'}\n`);
    
    const data = await scraper.scrape(scrapeAll);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 测试成功！');
    console.log('='.repeat(60));
    console.log(`站点: ${data.siteName}`);
    console.log(`时间戳: ${data.timestamp}`);
    
    if (data.members) {
      // 多成员模式
      console.log(`成员数: ${data.members.length}`);
      console.log(`总消息数: ${data.totalMessages}`);
      
      console.log('\n📊 成员消息统计:');
      data.members.slice(0, 10).forEach((member, idx) => {
        const status = member.error ? '❌' : '✅';
        console.log(`  ${status} ${member.groupName || 'Group ' + member.groupId}: ${member.messageCount} 条`);
      });
      
      if (data.members.length > 10) {
        console.log(`  ... 还有 ${data.members.length - 10} 位成员`);
      }
      
      // 显示一些消息样例
      const allMessages = [];
      for (const member of data.members) {
        allMessages.push(...member.messages);
      }
      
      if (allMessages.length > 0) {
        console.log('\n📬 最新消息预览:');
        const latest = allMessages
          .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
          .slice(0, 3);
        latest.forEach((msg, idx) => {
          console.log(`\n${idx + 1}. 消息 #${msg.id}`);
          console.log(`   成员ID: ${msg.memberId}`);
          console.log(`   类型: ${msg.type}`);
          console.log(`   时间: ${msg.publishedAt}`);
          if (msg.text) {
            const preview = msg.text.length > 100 
              ? msg.text.substring(0, 100) + '...' 
              : msg.text;
            console.log(`   内容: ${preview}`);
          }
        });
      }
    } else {
      // 单成员模式
      console.log(`消息数量: ${data.messages.length}`);
      
      if (data.messages.length > 0) {
        console.log('\n📬 最新消息预览:');
        const latest = data.messages.slice(0, 3);
        latest.forEach((msg, idx) => {
          console.log(`\n${idx + 1}. 消息 #${msg.id}`);
          console.log(`   成员ID: ${msg.memberId}`);
          console.log(`   类型: ${msg.type}`);
          console.log(`   时间: ${msg.publishedAt}`);
          if (msg.text) {
            const preview = msg.text.length > 100 
              ? msg.text.substring(0, 100) + '...' 
              : msg.text;
            console.log(`   内容: ${preview}`);
          }
        });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 API配置正确，可以开始使用！');
    console.log('='.repeat(60));
    console.log('\n运行命令：');
    console.log('  npm start           # 启动监控（默认所有成员）');
    console.log('  npm test single     # 测试单个主Group');
    console.log('  npm test            # 测试所有成员');

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ 测试失败');
    console.error('='.repeat(60));
    console.error('错误信息:', error.message);
    
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.log('\n💡 可能的原因：');
    console.log('  1. Bearer Token已过期，需要重新获取');
    console.log('  2. Cookie已过期，需要重新获取');
    console.log('  3. 网络连接问题');
    console.log('  4. API服务暂时不可用');
    
    console.log('\n🔧 解决方法：');
    console.log('  1. 在浏览器中重新登录');
    console.log('  2. F12获取最新的Request Headers');
    console.log('  3. 更新.env文件中的认证信息');
    
    process.exit(1);
  }
}

testAPI();
