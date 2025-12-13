const { chromium } = require('playwright');
const config = require('../src/config');
const AuthManager = require('../src/auth');
const fs = require('fs').promises;
const path = require('path');

/**
 * 拦截并记录所有API请求
 * 这次会更智能地导航
 */
async function interceptAPI(siteSlug = 'hinatazaka46') {
  const site = config.sites.find(s => s.slug === siteSlug);
  
  console.log(`🔍 API拦截器: ${site.name}\n`);

  const authManager = new AuthManager(site);
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--start-maximized']
  });

  try {
    const context = await authManager.createAuthenticatedContext(browser);
    
    // 拦截所有API请求
    const apiLog = [];
    
    await context.route('**/*', async (route, request) => {
      const url = request.url();
      const method = request.method();
      
      // 记录所有API请求
      if (url.includes('/api/') || url.includes('api.message')) {
        const logEntry = {
          timestamp: new Date().toISOString(),
          method,
          url,
          headers: request.headers(),
          postData: request.postData()
        };
        
        apiLog.push(logEntry);
        console.log(`\n📡 ${method} ${url}`);
        
        // 打印重要的headers
        const authHeader = request.headers()['authorization'];
        const cookieHeader = request.headers()['cookie'];
        
        if (authHeader) {
          console.log(`   🔑 Authorization: ${authHeader.substring(0, 50)}...`);
        }
        if (request.postData()) {
          console.log(`   📦 Body: ${request.postData().substring(0, 100)}...`);
        }
      }
      
      // 继续请求
      await route.continue();
    });

    // 监听响应
    context.on('response', async response => {
      const url = response.url();
      
      if (url.includes('/api/') || url.includes('api.message')) {
        const status = response.status();
        console.log(`   📥 Status: ${status}`);
        
        try {
          if (response.headers()['content-type']?.includes('json')) {
            const data = await response.json();
            const preview = JSON.stringify(data).substring(0, 300);
            console.log(`   💾 Response: ${preview}...`);
            
            // 记录完整响应到日志
            const logEntry = apiLog.find(e => e.url === url && !e.response);
            if (logEntry) {
              logEntry.response = {
                status,
                headers: response.headers(),
                body: data
              };
            }
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    });

    const page = await context.newPage();

    console.log('📱 步骤1: 访问首页...');
    await page.goto(site.loginUrl);
    await page.waitForTimeout(5000);

    console.log('📱 步骤2: 尝试导航到timeline...');
    
    // 尝试多种方式进入timeline
    
    // 方式1：直接访问timeline URL
    console.log('   → 方式1: 直接访问timeline URL');
    await page.goto(site.url);
    await page.waitForTimeout(8000);

    // 方式2：尝试点击UI元素
    console.log('   → 方式2: 查找并点击timeline相关按钮');
    
    // 等待页面完全加载
    await page.waitForTimeout(3000);
    
    // 尝试点击各种可能的元素
    const clicked = await page.evaluate(() => {
      // 查找可能的导航元素
      const allElements = Array.from(document.querySelectorAll('*'));
      
      // 查找包含特定文本的元素
      const keywords = ['timeline', 'タイムライン', 'トーク', 'talk', 'メッセージ', 'message'];
      
      for (const el of allElements) {
        const text = el.textContent?.toLowerCase() || '';
        const aria = el.getAttribute('aria-label')?.toLowerCase() || '';
        
        for (const keyword of keywords) {
          if (text.includes(keyword) || aria.includes(keyword)) {
            console.log('找到元素:', text.substring(0, 50), aria);
            el.click();
            return true;
          }
        }
      }
      return false;
    });

    if (clicked) {
      console.log('   ✅ 点击了导航元素');
      await page.waitForTimeout(5000);
    }

    console.log('\n📱 步骤3: 等待API请求...');
    await page.waitForTimeout(10000);

    // 尝试滚动触发更多请求
    console.log('📱 步骤4: 滚动页面触发更多请求...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(3000);

    // 保存所有API日志
    const logFile = path.join(__dirname, '..', 'data', `api-log-${siteSlug}.json`);
    await fs.writeFile(logFile, JSON.stringify(apiLog, null, 2));
    console.log(`\n✅ API日志已保存: ${logFile}`);

    // 分析日志
    console.log('\n\n📊 API统计:');
    console.log('='.repeat(60));
    
    const apiDomains = [...new Set(apiLog.map(log => {
      try {
        return new URL(log.url).origin;
      } catch (e) {
        return log.url;
      }
    }))];
    
    console.log(`\n发现 ${apiLog.length} 个API请求`);
    console.log(`\nAPI域名:`);
    apiDomains.forEach(d => console.log(`  - ${d}`));
    
    console.log(`\nAPI端点:`);
    const endpoints = [...new Set(apiLog.map(log => {
      try {
        const url = new URL(log.url);
        return `${log.method} ${url.pathname}`;
      } catch (e) {
        return log.url;
      }
    }))];
    
    endpoints.forEach(e => console.log(`  - ${e}`));

    // 查找包含消息数据的API
    console.log(`\n🎯 可能的消息API:`);
    const messageAPIs = apiLog.filter(log => {
      const url = log.url.toLowerCase();
      return url.includes('timeline') || 
             url.includes('message') || 
             url.includes('talk') ||
             url.includes('post') ||
             (log.response?.body?.messages) ||
             (log.response?.body?.posts);
    });
    
    if (messageAPIs.length > 0) {
      messageAPIs.forEach(api => {
        console.log(`\n✅ ${api.method} ${api.url}`);
        if (api.response) {
          console.log(`   Status: ${api.response.status}`);
          const bodyKeys = Object.keys(api.response.body || {});
          console.log(`   响应字段: ${bodyKeys.join(', ')}`);
        }
      });
    } else {
      console.log('   ⚠️  未找到明显的消息API');
      console.log('   可能需要手动操作浏览器');
    }

    console.log('\n\n💡 下一步:');
    console.log('='.repeat(60));
    console.log('1. 查看保存的日志文件分析详细信息');
    console.log('2. 在浏览器中手动操作，观察新的API请求');
    console.log('3. 使用Chrome DevTools Network标签');
    console.log('\n⏸️  浏览器将保持打开60秒供你操作...\n');
    
    await page.waitForTimeout(60000);
    await browser.close();

  } catch (error) {
    console.error('❌ 错误:', error);
    await browser.close();
  }
}

const siteSlug = process.argv[2] || 'hinatazaka46';
interceptAPI(siteSlug).catch(console.error);
