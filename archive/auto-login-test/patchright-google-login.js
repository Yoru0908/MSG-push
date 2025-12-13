/**
 * 使用Patchright绕过Google检测
 * Patchright是Playwright的undetected版本
 * GitHub: https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-nodejs
 */

require('dotenv').config();
const { chromium } = require('patchright');
const { authenticator } = require('otpauth');

class PatchrightGoogleLogin {
  constructor(site) {
    this.site = site;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * 初始化浏览器（使用Patchright）
   */
  async initBrowser() {
    console.log('🚀 启动Patchright浏览器（undetected模式）...');
    
    // Patchright会自动应用所有反检测补丁
    this.browser = await chromium.launch({
      headless: false, // 建议先用非headless测试
      channel: 'chrome' // 使用真实Chrome
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo'
    });

    this.page = await this.context.newPage();
    
    // 监听网络请求
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/token') || url.includes('/auth') || url.includes('message')) {
        console.log(`📡 API响应: ${response.status()} ${url}`);
        
        try {
          const headers = response.headers();
          if (headers.authorization || headers['x-talk-app-id']) {
            console.log(`🔑 发现Token信息!`);
            this.saveTokenInfo(headers, url);
          }
        } catch (e) {
          // 忽略错误
        }
      }
    });

    console.log('✅ Patchright浏览器已启动（已应用反检测补丁）');
  }

  /**
   * 生成2FA验证码
   */
  generate2FACode(secret) {
    try {
      const totp = authenticator.generate({
        secret: secret,
        algorithm: 'SHA1',
        digits: 6,
        period: 30
      });
      return totp;
    } catch (error) {
      console.error('❌ 生成2FA验证码失败:', error.message);
      return null;
    }
  }

  /**
   * 执行Google登录流程
   */
  async performGoogleLogin() {
    const email = process.env[`${this.site.slug.replace('46', '').toUpperCase()}_EMAIL`];
    const password = process.env[`${this.site.slug.replace('46', '').toUpperCase()}_PASSWORD`];
    const otpSecret = process.env.GOOGLE_OTP_SECRET;

    if (!email || !password) {
      throw new Error(`❌ 请在.env文件中配置账号密码`);
    }

    console.log(`\n🔐 开始Google登录流程...`);
    console.log(`📧 邮箱: ${email}`);
    console.log(`🔑 密码: ${'*'.repeat(password.length)}`);
    if (otpSecret) {
      console.log(`🔢 2FA: 已配置`);
    }

    try {
      // 访问登录页面
      console.log('\n🌐 访问登录页面...');
      await this.page.goto('https://message.hinatazaka46.com/welcome', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await this.page.waitForTimeout(3000);

      // Flutter Web应用需要等待完全加载
      console.log('⏳ 等待Flutter应用加载完成...');
      await this.page.waitForTimeout(5000);
      
      // 点击"すでにご利用の方" - Flutter应用使用不同的选择器
      console.log('👆 查找并点击"すでにご利用の方"...');
      
      // 尝试多种方式点击
      const clickAttempts = [
        async () => await this.page.click('text=すでにご利用の方'),
        async () => await this.page.locator('text=すでにご利用の方').click(),
        async () => {
          // 使用坐标点击（Flutter应用的备选方案）
          const element = await this.page.locator('text=すでにご利用の方').first();
          if (element) {
            const box = await element.boundingBox();
            if (box) {
              await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            }
          }
        },
        async () => {
          // 直接通过URL导航
          await this.page.goto('https://message.hinatazaka46.com/terms?type=webSnsLogin');
        }
      ];
      
      let clicked = false;
      for (const attempt of clickAttempts) {
        try {
          await attempt();
          clicked = true;
          console.log('✅ 成功点击');
          break;
        } catch (e) {
          console.log(`⚠️  尝试失败: ${e.message.substring(0, 50)}`);
          continue;
        }
      }
      
      if (!clicked) {
        console.log('💡 直接导航到条款页面...');
        await this.page.goto('https://message.hinatazaka46.com/terms?type=webSnsLogin');
      }
      
      // 等待条款页面
      console.log('⏳ 等待条款页面...');
      await this.page.waitForTimeout(3000);
      console.log('✅ 条款页面已加载');

      // 勾选两个复选框 - Flutter应用可能需要特殊处理
      console.log('✅ 勾选同意条款...');
      
      // 等待复选框出现
      await this.page.waitForTimeout(2000);
      
      // 尝试多种方式勾选
      try {
        const checkboxes = await this.page.$$('input[type="checkbox"]');
        console.log(`📋 找到 ${checkboxes.length} 个复选框`);
        
        for (let i = 0; i < checkboxes.length; i++) {
          try {
            await checkboxes[i].check();
            console.log(`   ✅ 已勾选复选框 ${i + 1}`);
          } catch (e) {
            // 如果check()失败，尝试点击
            console.log(`   ⚠️  check()失败，尝试click()...`);
            await checkboxes[i].click();
            console.log(`   ✅ 已点击复选框 ${i + 1}`);
          }
        }
      } catch (e) {
        console.log(`⚠️  复选框处理失败: ${e.message}`);
      }
      
      await this.page.waitForTimeout(2000);

      // 点击"次へ" - Flutter应用
      console.log('👆 点击"次へ"按钮...');
      
      const nextButtonAttempts = [
        async () => await this.page.click('button:has-text("次へ")'),
        async () => await this.page.locator('text=次へ').click(),
        async () => {
          // 直接导航到登录页面
          await this.page.goto('https://message.hinatazaka46.com/web-sns-login');
        }
      ];
      
      let nextClicked = false;
      for (const attempt of nextButtonAttempts) {
        try {
          await attempt();
          nextClicked = true;
          console.log('✅ 成功点击"次へ"');
          break;
        } catch (e) {
          console.log(`⚠️  尝试失败，继续...`);
          continue;
        }
      }
      
      if (!nextClicked) {
        console.log('💡 直接导航到登录选项页面...');
        await this.page.goto('https://message.hinatazaka46.com/web-sns-login');
      }
      
      // 等待登录选项页面
      console.log('⏳ 等待登录选项页面...');
      await this.page.waitForTimeout(5000);
      console.log('✅ 登录选项页面已加载');

      // 点击Google登录 - Flutter应用
      console.log('\n🔍 点击Google登录按钮...');
      
      const googleButtonAttempts = [
        async () => await this.page.click('button:has-text("Googleでログイン")'),
        async () => await this.page.locator('text=Googleでログイン').click(),
        async () => await this.page.click('text=Google'),
        async () => {
          // 查找包含Google图标的按钮
          const buttons = await this.page.$$('button, [role="button"]');
          for (const btn of buttons) {
            const text = await btn.textContent();
            if (text && text.includes('Google')) {
              await btn.click();
              return;
            }
          }
          throw new Error('未找到Google按钮');
        }
      ];
      
      let googleClicked = false;
      for (const attempt of googleButtonAttempts) {
        try {
          await attempt();
          googleClicked = true;
          console.log('✅ 成功点击Google登录按钮');
          break;
        } catch (e) {
          console.log(`⚠️  尝试失败: ${e.message.substring(0, 50)}`);
          continue;
        }
      }
      
      if (!googleClicked) {
        throw new Error('❌ 无法点击Google登录按钮');
      }
      
      await this.page.waitForTimeout(3000);

      // Google OAuth流程
      console.log('\n🔐 开始Google OAuth流程...');
      console.log('💡 使用Patchright绕过bot检测...');
      
      // 等待Google登录页面
      await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      // 输入邮箱
      console.log('📧 输入Google邮箱...');
      await this.page.fill('input[type="email"]', email);
      await this.page.click('#identifierNext');
      await this.page.waitForTimeout(3000);

      // 输入密码
      console.log('🔑 输入密码...');
      await this.page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await this.page.fill('input[type="password"]', password);
      await this.page.click('#passwordNext');
      await this.page.waitForTimeout(5000);

      // 检查是否出现"不安全"错误
      const pageContent = await this.page.content();
      if (pageContent.includes('安全でない') || pageContent.includes('not be secure')) {
        console.log('❌ 仍然被Google检测为bot');
        console.log('⚠️  Patchright可能无法完全绕过Google的检测');
        return false;
      }

      // 处理2FA
      if (otpSecret) {
        console.log('🔢 处理2FA验证...');
        try {
          await this.page.waitForSelector('input[name="totpPin"]', { timeout: 10000 });
          
          const code = this.generate2FACode(otpSecret);
          if (code) {
            console.log(`🔢 生成的验证码: ${code}`);
            await this.page.fill('input[name="totpPin"]', code);
            await this.page.click('#totpNext');
            await this.page.waitForTimeout(3000);
          }
        } catch (e) {
          console.log('⚠️  可能不需要2FA验证');
        }
      }

      // 等待登录完成
      console.log('\n⏳ 等待登录完成...');
      
      try {
        await this.page.waitForURL(url => 
          url.includes('message.hinatazaka46.com') || 
          url.includes('message.sakurazaka46.com'),
          { timeout: 15000 }
        );
        console.log('✅ 登录成功！已跳转回原网站');
        return true;
      } catch (e) {
        const currentUrl = this.page.url();
        console.log(`📍 当前页面: ${currentUrl}`);
        
        if (currentUrl.includes('accounts.google.com')) {
          console.log('⚠️  仍在Google验证页面');
          
          // 检查页面内容
          const content = await this.page.content();
          if (content.includes('安全でない') || content.includes('not be secure')) {
            console.log('❌ 被Google检测为不安全的浏览器');
            return false;
          }
          
          console.log('💡 可能需要额外验证，等待30秒...');
          await this.page.waitForTimeout(30000);
        }
      }

      // 最终检查
      const finalUrl = this.page.url();
      if (finalUrl.includes('message') && !finalUrl.includes('accounts.google.com')) {
        console.log('🎉 Google登录成功！');
        return true;
      } else {
        console.log('❌ 登录可能失败');
        return false;
      }

    } catch (error) {
      console.error('❌ Google登录过程中出错:', error.message);
      return false;
    }
  }

  /**
   * 保存Token信息
   */
  saveTokenInfo(headers, url) {
    const tokenInfo = {
      timestamp: new Date().toISOString(),
      url,
      authorization: headers.authorization,
      appId: headers['x-talk-app-id'],
      cookie: headers.cookie
    };

    const fs = require('fs');
    const tokenFile = `./patchright-token-${Date.now()}.json`;
    fs.writeFileSync(tokenFile, JSON.stringify(tokenInfo, null, 2));
    console.log(`💾 Token信息已保存: ${tokenFile}`);
  }

  /**
   * 运行完整测试
   */
  async runTest() {
    try {
      console.log('🧪 Patchright Google登录测试');
      console.log('='.repeat(60));
      console.log('📦 使用: patchright (undetected playwright)');
      console.log('🎯 目标: 绕过Google bot检测');
      console.log('='.repeat(60));
      
      await this.initBrowser();
      
      const loginSuccess = await this.performGoogleLogin();
      
      if (loginSuccess) {
        console.log('\n' + '='.repeat(60));
        console.log('✅ 测试成功！Patchright可以绕过Google检测');
        console.log('🎉 可以集成到主项目实现自动Token更新');
        console.log('='.repeat(60));
        
        console.log('\n⏳ 保持页面打开30秒供观察...');
        await this.page.waitForTimeout(30000);
      } else {
        console.log('\n' + '='.repeat(60));
        console.log('❌ 测试失败，Patchright仍然被Google检测');
        console.log('💡 建议尝试LINE登录或手动更新方案');
        console.log('='.repeat(60));
      }

    } catch (error) {
      console.error('❌ 测试过程中出错:', error.message);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 运行测试
const site = {
  slug: 'hinatazaka46',
  name: '日向坂46'
};

const test = new PatchrightGoogleLogin(site);
test.runTest().catch(error => {
  console.error('运行错误:', error.message);
});
