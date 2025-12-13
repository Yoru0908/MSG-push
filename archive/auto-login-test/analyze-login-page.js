/**
 * 分析登录页面结构
 * 查看实际可用的登录选项
 */

require('dotenv').config();
const { chromium } = require('playwright');

class LoginPageAnalyzer {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * 分析登录页面
   */
  async analyzeLoginPage(site) {
    console.log(`🔍 分析 ${site.name} 登录页面...`);
    
    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();

    try {
      // 访问登录页面
      console.log('🌐 访问登录页面...');
      await this.page.goto('https://message.hinatazaka46.com/welcome', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await this.page.waitForTimeout(3000);

      // 点击"すでにご利用の方"
      console.log('👆 点击"すでにご利用の方"...');
      try {
        await this.page.click('text=すでにご利用の方');
        await this.page.waitForTimeout(3000);
      } catch (e) {
        console.log('⚠️  可能已经显示了登录选项');
      }

      // 分析页面结构
      console.log('\n📊 页面结构分析:');
      
      const pageAnalysis = await this.page.evaluate(() => {
        const analysis = {
          buttons: [],
          links: [],
          forms: [],
          images: [],
          textContent: []
        };

        // 分析所有按钮
        const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]');
        buttons.forEach((btn, index) => {
          const text = btn.textContent?.trim() || btn.value || btn.title || '';
          const className = btn.className || '';
          const id = btn.id || '';
          
          if (text || className.includes('login') || className.includes('auth')) {
            analysis.buttons.push({
              index,
              text: text.substring(0, 50),
              className: className.substring(0, 50),
              id,
              visible: btn.offsetParent !== null
            });
          }
        });

        // 分析所有链接
        const links = document.querySelectorAll('a');
        links.forEach((link, index) => {
          const text = link.textContent?.trim() || '';
          const href = link.href || '';
          
          if (text && (text.includes('ログイン') || text.includes('Login') || href.includes('oauth'))) {
            analysis.links.push({
              index,
              text: text.substring(0, 50),
              href: href.substring(0, 100),
              visible: link.offsetParent !== null
            });
          }
        });

        // 分析表单
        const forms = document.querySelectorAll('form');
        forms.forEach((form, index) => {
          const action = form.action || '';
          const method = form.method || '';
          
          analysis.forms.push({
            index,
            action: action.substring(0, 100),
            method,
            visible: form.offsetParent !== null
          });
        });

        // 分析图片（特别是QR码）
        const images = document.querySelectorAll('img');
        images.forEach((img, index) => {
          const src = img.src || '';
          const alt = img.alt || '';
          
          if (src.includes('qr') || alt.includes('QR') || alt.includes('code')) {
            analysis.images.push({
              index,
              src: src.substring(0, 100),
              alt: alt.substring(0, 50),
              visible: img.offsetParent !== null
            });
          }
        });

        // 获取页面主要文本内容
        const bodyText = document.body.textContent || '';
        const loginKeywords = ['Google', 'LINE', 'Apple', 'ログイン', 'login', 'サインイン'];
        
        loginKeywords.forEach(keyword => {
          if (bodyText.includes(keyword)) {
            analysis.textContent.push(keyword);
          }
        });

        return analysis;
      });

      // 显示分析结果
      console.log('\n🔘 按钮:');
      if (pageAnalysis.buttons.length === 0) {
        console.log('   未找到相关按钮');
      } else {
        pageAnalysis.buttons.forEach(btn => {
          console.log(`   ${btn.index}. "${btn.text}" (class: "${btn.className}", id: "${btn.id}", visible: ${btn.visible})`);
        });
      }

      console.log('\n🔗 链接:');
      if (pageAnalysis.links.length === 0) {
        console.log('   未找到相关链接');
      } else {
        pageAnalysis.links.forEach(link => {
          console.log(`   ${link.index}. "${link.text}" -> ${link.href} (visible: ${link.visible})`);
        });
      }

      console.log('\n📝 表单:');
      if (pageAnalysis.forms.length === 0) {
        console.log('   未找到表单');
      } else {
        pageAnalysis.forms.forEach(form => {
          console.log(`   ${form.index}. ${form.method} -> ${form.action} (visible: ${form.visible})`);
        });
      }

      console.log('\n📸 图片 (QR码相关):');
      if (pageAnalysis.images.length === 0) {
        console.log('   未找到QR码图片');
      } else {
        pageAnalysis.images.forEach(img => {
          console.log(`   ${img.index}. ${img.alt} -> ${img.src} (visible: ${img.visible})`);
        });
      }

      console.log('\n📄 页面包含的关键词:');
      if (pageAnalysis.textContent.length === 0) {
        console.log('   未找到登录相关关键词');
      } else {
        pageAnalysis.textContent.forEach(keyword => {
          console.log(`   ✅ ${keyword}`);
        });
      }

      // 尝试查找可能的登录元素
      console.log('\n🎯 尝试查找登录元素:');
      
      const possibleSelectors = [
        'button:has-text("Google")',
        'button:has-text("LINE")',
        'button:has-text("Apple")',
        'button:has-text("ログイン")',
        'a:has-text("Google")',
        'a:has-text("LINE")',
        'a:has-text("Apple")',
        '[class*="google"]',
        '[class*="line"]',
        '[class*="apple"]',
        '[id*="google"]',
        '[id*="line"]',
        '[id*="apple"]'
      ];

      for (const selector of possibleSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            const text = await element.textContent();
            console.log(`   ✅ 找到: ${selector} -> "${text?.substring(0, 50)}"`);
          }
        } catch (e) {
          // 忽略
        }
      }

      // 等待用户查看
      console.log('\n⏳ 页面将保持打开30秒供手动检查...');
      console.log('💡 请手动查看页面，确认有哪些登录选项可用');
      
      await this.page.waitForTimeout(30000);

    } catch (error) {
      console.error('❌ 分析过程中出错:', error.message);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  /**
   * 运行分析
   */
  async run() {
    console.log('🔍 登录页面结构分析工具');
    console.log('='.repeat(50));
    
    const sites = [
      { name: '日向坂46', url: 'https://message.hinatazaka46.com/welcome' },
      { name: '樱坂46', url: 'https://message.sakurazaka46.com/welcome' }
    ];

    for (const site of sites) {
      await this.analyzeLoginPage(site);
      
      console.log('\n' + '='.repeat(50));
      console.log('按回车键继续下一个站点分析...');
      
      // 简单等待（非交互式）
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🎯 分析完成！');
    console.log('💡 根据分析结果，我们可以确定实际可用的登录方式');
  }
}

// 运行分析
const analyzer = new LoginPageAnalyzer();
analyzer.run().catch(error => {
  console.error('运行错误:', error.message);
});
