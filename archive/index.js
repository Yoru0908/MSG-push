const config = require('../src/config');
const APIMessageScraper = require('./api-scraper'); // 使用新的API版本
const APIDiscordNotifier = require('./api-discord'); // 使用API版本的Discord推送

/**
 * 主程序：抓取所有站点并推送新消息
 */
async function main() {
  console.log('🚀 坂道消息推送系统');
  console.log('='.repeat(60));
  console.log(`⏰ 运行时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo' })}`);
  console.log('');

  const discord = new APIDiscordNotifier();
  const results = [];

  // 遍历所有配置的站点
  for (const site of config.sites) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📱 处理站点: ${site.name}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // 获取API配置
      const apiConfig = config.api[site.slug];
      if (!apiConfig || !apiConfig.authorization || !apiConfig.cookie) {
        throw new Error(`缺少${site.name}的API认证配置，请检查.env文件中的 ${site.slug.toUpperCase()}_API_TOKEN 和 ${site.slug.toUpperCase()}_COOKIE`);
      }

      const scraper = new APIMessageScraper(site, apiConfig);
      const result = await scraper.scrapeAndCheck();

      if (result.hasNew) {
        console.log('🆕 发现新消息，准备推送...');
        
        // 推送到Discord
        const sent = await discord.sendMessage(site, result.data.messages);
        
        results.push({
          site: site.slug,
          success: true,
          hasNew: true,
          messageCount: result.data.messages.length,
          sent
        });
      } else {
        console.log('✅ 无新消息');
        results.push({
          site: site.slug,
          success: true,
          hasNew: false
        });
      }

    } catch (error) {
      console.error(`❌ ${site.name} 处理失败:`, error.message);
      
      // 发送错误通知
      await discord.sendError(site, error);
      
      results.push({
        site: site.slug,
        success: false,
        error: error.message
      });
    }
  }

  // 输出总结
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 执行总结');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const withNewContent = results.filter(r => r.hasNew).length;
  const totalMessages = results.reduce((sum, r) => sum + (r.messageCount || 0), 0);

  console.log(`✅ 成功: ${successful}/${results.length}`);
  console.log(`🆕 有新内容: ${withNewContent}`);
  console.log(`📬 推送消息: ${totalMessages} 条`);

  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const status = result.hasNew ? '🆕 新内容' : '⚪ 无更新';
    console.log(`${icon} ${result.site}: ${status}`);
  });

  console.log('\n✨ 任务完成!\n');

  return results;
}

// 运行主程序
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('\n💥 程序异常:', error);
      process.exit(1);
    });
}

module.exports = main;
