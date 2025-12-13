const { chromium } = require('playwright');
const config = require('../src/config');
const AuthManager = require('../src/auth');

/**
 * 寻找Timeline API
 */
async function findAPI(siteSlug = 'hinatazaka46') {
  const site = config.sites.find(s => s.slug === siteSlug);
  
  console.log(`🔍 寻找API: ${site.name}\n`);

  const authManager = new AuthManager(site);
  const browser = await chromium.launch({ headless: false });

  try {
    const context = await authManager.createAuthenticatedContext(browser);
    const page = await context.newPage();

    const apiRequests = [];
    
    // 监听所有网络请求
    page.on('request', request => {
      const url = request.url();
      const method = request.method();
      
      if (url.includes('/api/') || url.includes('timeline') || url.includes('message') || url.includes('talk')) {
        apiRequests.push({
          method,
          url,
          headers: request.headers()
        });
        console.log(`📡 ${method} ${url}`);
      }
    });

    page.on('response', async response => {
      const url = response.url();
      
      if (url.includes('/api/') && response.headers()['content-type']?.includes('json')) {
        try {
          const data = await response.json();
          console.log(`📥 ${response.status()} ${url}`);
          console.log('   数据:', JSON.stringify(data).substring(0, 200));
        } catch (e) {
          // 忽略
        }
      }
    });

    console.log('📱 加载首页...');
    await page.goto(site.loginUrl);
    await page.waitForTimeout(3000);

    // 尝试点击"已使用用户"按钮
    console.log('🖱️  寻找登录入口...');
    
    // 等待页面完全加载
    await page.waitForTimeout(5000);
    
    // 尝试多种方式点击
    const clicked = await page.evaluate(() => {
      // 查找包含特定文本的按钮
      const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
      const targetButton = buttons.find(b => 
        b.textContent?.includes('すでに') || 
        b.textContent?.includes('ご利用') ||
        b.getAttribute('aria-label')?.includes('すでに')
      );
      
      if (targetButton) {
        targetButton.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('✅ 点击了登录按钮');
    } else {
      console.log('⚠️  未找到按钮，尝试直接访问timeline');
    }

    await page.waitForTimeout(3000);

    // 直接访问timeline页面
    console.log('📱 访问timeline页面...');
    await page.goto(site.url);
    
    console.log('⏳ 等待数据加载...');
    await page.waitForTimeout(10000);

    console.log('\n📊 捕获的API请求:');
    apiRequests.forEach(req => {
      console.log(`\n${req.method} ${req.url}`);
      if (req.headers.authorization) {
        console.log(`  Authorization: ${req.headers.authorization.substring(0, 50)}...`);
      }
    });

    console.log('\n⏸️  浏览器将保持打开60秒，请手动操作并观察API请求...');
    await page.waitForTimeout(60000);

    await browser.close();

  } catch (error) {
    console.error('❌ 错误:', error);
    await browser.close();
  }
}

const siteSlug = process.argv[2] || 'hinatazaka46';
findAPI(siteSlug).catch(console.error);
