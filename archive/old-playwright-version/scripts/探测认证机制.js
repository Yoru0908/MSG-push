const { chromium } = require('playwright');
const config = require('../src/config');

/**
 * 探测坂道消息网站的认证机制
 * 支持：日向坂46 和 櫻坂46
 * 目标：找出是用API token还是cookies
 */
async function detectAuthMechanism(siteSlug = 'hinatazaka46') {
  const site = config.sites.find(s => s.slug === siteSlug);
  
  if (!site) {
    console.error('❌ 未知站点:', siteSlug);
    console.log('可用站点:', config.sites.map(s => s.slug).join(', '));
    process.exit(1);
  }
  
  console.log(`\n🎯 探测站点: ${site.name} (${site.slug})`);
  console.log(`🌐 URL: ${site.url}\n`);
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // 记录所有网络请求
  const apiCalls = [];
  
  page.on('request', request => {
    const url = request.url();
    const headers = request.headers();
    
    // 记录API请求
    if (url.includes('api') || url.includes('graphql')) {
      apiCalls.push({
        url,
        method: request.method(),
        headers: {
          authorization: headers['authorization'],
          'x-api-key': headers['x-api-key'],
          cookie: headers['cookie']
        }
      });
      console.log('📡 API请求:', request.method(), url);
      console.log('🔑 认证头:', headers['authorization'] || headers['x-api-key'] || '无');
    }
  });
  
  page.on('response', async response => {
    const url = response.url();
    
    // 分析响应头中的认证信息
    if (url.includes('login') || url.includes('auth') || url.includes('token')) {
      const headers = response.headers();
      console.log('🔐 认证响应:', url);
      console.log('   Set-Cookie:', headers['set-cookie'] || '无');
      
      try {
        const body = await response.text();
        console.log('   响应体预览:', body.substring(0, 200));
      } catch (e) {
        // 忽略二进制响应
      }
    }
  });
  
  console.log('🌐 打开网站...');
  await page.goto(site.url);
  
  console.log('\n⏳ 等待30秒，请手动登录...');
  console.log('💡 登录后，脚本会记录所有认证相关的请求\n');
  
  await page.waitForTimeout(30000);
  
  // 分析收集到的数据
  console.log('\n\n📊 分析结果:');
  console.log('============================================');
  
  if (apiCalls.length > 0) {
    console.log(`\n找到 ${apiCalls.length} 个API请求:\n`);
    apiCalls.forEach((call, i) => {
      console.log(`${i + 1}. ${call.method} ${call.url}`);
      if (call.headers.authorization) {
        console.log(`   ✅ Authorization: ${call.headers.authorization.substring(0, 50)}...`);
      }
      if (call.headers['x-api-key']) {
        console.log(`   ✅ X-API-Key: ${call.headers['x-api-key']}`);
      }
    });
  }
  
  // 检查localStorage/sessionStorage
  const storage = await page.evaluate(() => {
    return {
      localStorage: Object.keys(localStorage).map(key => ({
        key,
        value: localStorage.getItem(key).substring(0, 100)
      })),
      sessionStorage: Object.keys(sessionStorage).map(key => ({
        key,
        value: sessionStorage.getItem(key).substring(0, 100)
      }))
    };
  });
  
  console.log('\n📦 本地存储:');
  console.log('localStorage:', storage.localStorage);
  console.log('sessionStorage:', storage.sessionStorage);
  
  // 获取cookies
  const cookies = await page.context().cookies();
  console.log('\n🍪 Cookies:', cookies.map(c => c.name));
  
  console.log('\n\n💡 建议:');
  console.log('============================================');
  
  const hasAuthHeader = apiCalls.some(c => c.headers.authorization);
  const hasApiKey = apiCalls.some(c => c.headers['x-api-key']);
  const hasTokenInStorage = storage.localStorage.some(s => 
    s.key.toLowerCase().includes('token') || 
    s.key.toLowerCase().includes('auth')
  );
  
  if (hasAuthHeader) {
    console.log('✅ 检测到Authorization header - 可以使用API token方案');
    console.log('   → 存储token到GitHub Secrets');
    console.log('   → 每次请求带上Authorization header');
  } else if (hasApiKey) {
    console.log('✅ 检测到API Key - 可以使用API key方案');
  } else if (hasTokenInStorage) {
    console.log('⚠️  Token存储在localStorage中');
    console.log('   → 需要先登录获取token');
    console.log('   → 然后直接注入localStorage使用');
  } else {
    console.log('⚠️  可能需要使用Cookie方案');
    console.log('   → 定期用Playwright自动登录');
    console.log('   → 或手动更新cookies');
  }
  
  await browser.close();
}

// 从命令行参数获取站点
const siteSlug = process.argv[2] || 'hinatazaka46';

console.log('🔍 坂道消息认证机制探测器');
console.log('====================================\n');

detectAuthMechanism(siteSlug).catch(console.error);
