const { chromium } = require('playwright');
const config = require('../src/config');
const AuthManager = require('../src/auth');

/**
 * 调试脚本 - 检查页面实际结构
 */
async function debugPage(siteSlug = 'hinatazaka46') {
  const site = config.sites.find(s => s.slug === siteSlug);
  
  console.log(`🔍 调试页面: ${site.name}`);
  console.log(`🌐 URL: ${site.url}\n`);

  const authManager = new AuthManager(site);
  const browser = await chromium.launch({ headless: false });

  try {
    const context = await authManager.createAuthenticatedContext(browser);
    const page = await context.newPage();

    console.log('📱 正在加载页面...');
    await page.goto(site.url, { waitUntil: 'networkidle', timeout: 60000 });
    
    console.log('⏳ 等待页面渲染...');
    await page.waitForTimeout(10000);

    // 获取页面完整HTML结构
    console.log('\n📄 获取页面结构...');
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    
    // 保存到文件
    const fs = require('fs').promises;
    const path = require('path');
    const htmlFile = path.join(__dirname, '..', 'data', `page-structure-${siteSlug}.html`);
    await fs.writeFile(htmlFile, bodyHTML);
    console.log(`✅ 页面结构已保存: ${htmlFile}`);

    // 尝试查找各种可能的元素
    console.log('\n🔍 搜索可能的消息元素...\n');

    const selectors = [
      'flt-semantics',
      '[role="article"]',
      '[role="listitem"]',
      'div[class*="message"]',
      'div[class*="post"]',
      'div[class*="timeline"]',
      'div[class*="content"]',
      'div[class*="card"]',
      'li',
      'article',
      'div[data-message-id]',
      'div[data-post-id]'
    ];

    for (const selector of selectors) {
      const count = await page.$$eval(selector, els => els.length).catch(() => 0);
      if (count > 0) {
        console.log(`✅ ${selector}: ${count} 个元素`);
        
        // 获取第一个元素的内容示例
        const sample = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          return {
            outerHTML: el.outerHTML.substring(0, 500),
            textContent: el.textContent.substring(0, 200),
            className: el.className,
            tagName: el.tagName
          };
        }, selector).catch(() => null);
        
        if (sample) {
          console.log(`   示例: ${sample.tagName} className="${sample.className}"`);
          console.log(`   文本: ${sample.textContent.substring(0, 100)}...`);
        }
      }
    }

    // 查找Flutter特有的元素
    console.log('\n🎯 检查Flutter元素...\n');
    
    const flutterInfo = await page.evaluate(() => {
      // 查找flt-semantics元素
      const semantics = document.querySelectorAll('flt-semantics');
      
      return {
        semanticsCount: semantics.length,
        hasFlutterView: !!document.querySelector('flt-glass-pane'),
        bodyClasses: document.body.className,
        sampleSemantics: Array.from(semantics).slice(0, 5).map(el => ({
          role: el.getAttribute('role'),
          ariaLabel: el.getAttribute('aria-label'),
          text: el.textContent?.substring(0, 100)
        }))
      };
    });

    console.log('Flutter信息:', JSON.stringify(flutterInfo, null, 2));

    // 截图
    const screenshotFile = path.join(__dirname, '..', 'data', `screenshot-${siteSlug}.png`);
    await page.screenshot({ path: screenshotFile, fullPage: true });
    console.log(`\n📸 截图已保存: ${screenshotFile}`);

    console.log('\n💡 建议:');
    console.log('   1. 查看保存的HTML文件分析结构');
    console.log('   2. 查看截图确认页面内容');
    console.log('   3. 根据找到的选择器更新scraper.js');
    console.log('\n⏸️  浏览器将保持打开30秒供你检查...');
    
    await page.waitForTimeout(30000);
    await browser.close();

  } catch (error) {
    console.error('❌ 调试失败:', error);
    await browser.close();
  }
}

const siteSlug = process.argv[2] || 'hinatazaka46';
debugPage(siteSlug).catch(console.error);
