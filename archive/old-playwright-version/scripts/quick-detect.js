const { chromium } = require('playwright');
const config = require('../src/config');

/**
 * 快速探测 - 无需登录也能分析API结构
 */
async function quickDetect(siteSlug = 'hinatazaka46') {
  const site = config.sites.find(s => s.slug === siteSlug);
  
  console.log(`\n🔍 快速探测: ${site.name}`);
  console.log(`🌐 URL: ${site.url}\n`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();
  
  const requests = [];
  const responses = [];
  
  // 监听所有请求
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    const headers = request.headers();
    const resourceType = request.resourceType();
    
    requests.push({
      url,
      method,
      resourceType,
      headers: {
        authorization: headers['authorization'],
        'x-api-key': headers['x-api-key'],
        'content-type': headers['content-type'],
      }
    });
    
    // 只打印API相关请求
    if (resourceType === 'xhr' || resourceType === 'fetch' || url.includes('/api/')) {
      console.log(`📡 ${method} ${url}`);
    }
  });
  
  // 监听响应
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    const headers = response.headers();
    
    if (url.includes('/api/') || url.includes('graphql') || 
        headers['content-type']?.includes('application/json')) {
      
      console.log(`📥 ${status} ${url}`);
      
      try {
        const body = await response.text();
        responses.push({
          url,
          status,
          contentType: headers['content-type'],
          bodyPreview: body.substring(0, 500)
        });
        
        // 打印JSON响应预览
        if (headers['content-type']?.includes('json') && body.length < 1000) {
          try {
            const json = JSON.parse(body);
            console.log('   💾', JSON.stringify(json, null, 2).substring(0, 300));
          } catch (e) {
            console.log('   💾', body.substring(0, 200));
          }
        }
      } catch (e) {
        // 忽略
      }
    }
  });
  
  console.log('⏳ 正在加载页面...\n');
  
  try {
    await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.log('⚠️  页面加载超时（正常，因为Flutter需要较长时间）');
  }
  
  // 等待一些额外的网络请求
  await page.waitForTimeout(5000);
  
  // 尝试获取页面内容
  console.log('\n📱 检查页面状态...');
  const pageContent = await page.content();
  
  // 检查是否有登录提示
  const hasLoginButton = pageContent.includes('login') || pageContent.includes('ログイン');
  console.log(`   ${hasLoginButton ? '🔒 检测到登录页面' : '✅ 可能已加载内容'}`);
  
  // 检查localStorage
  const storage = await page.evaluate(() => {
    return {
      localStorage: Object.keys(localStorage),
      sessionStorage: Object.keys(sessionStorage),
    };
  });
  
  console.log('\n📦 本地存储key:', storage.localStorage.join(', ') || '(空)');
  
  // 分析结果
  console.log('\n\n📊 分析结果');
  console.log('='.repeat(60));
  
  const apiRequests = requests.filter(r => 
    r.resourceType === 'xhr' || 
    r.resourceType === 'fetch' || 
    r.url.includes('/api/')
  );
  
  console.log(`\n找到 ${apiRequests.length} 个API请求:\n`);
  
  if (apiRequests.length === 0) {
    console.log('⚠️  未检测到API请求');
    console.log('   可能原因：');
    console.log('   1. 页面完全通过Flutter渲染（需要完整加载）');
    console.log('   2. API请求在登录后才触发');
    console.log('   3. 使用WebSocket或其他协议');
  } else {
    // 分析API模式
    const apiDomains = [...new Set(apiRequests.map(r => new URL(r.url).origin))];
    console.log('🌐 API域名:');
    apiDomains.forEach(d => console.log(`   - ${d}`));
    
    console.log('\n🔑 认证方式分析:');
    const hasAuthHeader = apiRequests.some(r => r.headers.authorization);
    const hasApiKey = apiRequests.some(r => r.headers['x-api-key']);
    
    if (hasAuthHeader) {
      console.log('   ✅ 检测到 Authorization header');
      const authExample = apiRequests.find(r => r.headers.authorization);
      console.log(`   示例: ${authExample.headers.authorization.substring(0, 50)}...`);
    } else if (hasApiKey) {
      console.log('   ✅ 检测到 X-API-Key header');
    } else {
      console.log('   ⚠️  未检测到明显的API认证header');
      console.log('   可能使用Cookie或Session认证');
    }
    
    // 列出所有API端点
    console.log('\n📍 API端点列表:');
    const uniqueEndpoints = [...new Set(apiRequests.map(r => {
      const url = new URL(r.url);
      return `${r.method} ${url.pathname}`;
    }))];
    
    uniqueEndpoints.slice(0, 10).forEach(e => console.log(`   - ${e}`));
    if (uniqueEndpoints.length > 10) {
      console.log(`   ... 还有 ${uniqueEndpoints.length - 10} 个端点`);
    }
  }
  
  // 检查响应中的数据结构
  console.log('\n💡 建议:');
  console.log('='.repeat(60));
  
  if (hasLoginButton) {
    console.log('🔒 该站点需要登录才能访问内容');
    console.log('\n推荐方案：');
    console.log('   1️⃣  方案A：手动运行完整探测');
    console.log('      npm run detect:hinata');
    console.log('      (在浏览器中手动登录，获取完整认证信息)');
    console.log('');
    console.log('   2️⃣  方案B：检查是否有官方API');
    console.log('      有些服务提供开发者API，可以直接使用');
    console.log('');
    console.log('   3️⃣  方案C：抓取登录后的token');
    console.log('      登录后从浏览器开发工具获取token');
  } else {
    console.log('✅ 站点可能不需要登录或已缓存认证');
    console.log('   可以直接实现抓取脚本');
  }
  
  await browser.close();
  
  console.log('\n✨ 探测完成!\n');
}

const siteSlug = process.argv[2] || 'hinatazaka46';
quickDetect(siteSlug).catch(console.error);
