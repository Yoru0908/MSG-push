/**
 * Patchright + Flutter Web 专用登录脚本
 * 直接跳过Flutter应用的复杂交互，直接导航到登录页面
 */

require('dotenv').config();
const { chromium } = require('patchright');
const { authenticator } = require('otpauth');

class PatchrightFlutterLogin {
  constructor(site) {
    this.site = site;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async initBrowser() {
    console.log('🚀 启动Patchright浏览器（undetected模式）...');
    
    this.browser = await chromium.launch({
      headless: false,
      channel: 'chrome'
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo'
    });

    this.page = await this.context.newPage();
    
    // 监听Token
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/token') || url.includes('/auth') || url.includes('message')) {
        console.log(`📡 ${response.status()} ${url.split('?')[0]}`);
        
        try {
          const headers = response.headers();
          if (headers.authorization || headers['x-talk-app-id']) {
            console.log(`🔑 发现Token!`);
            this.saveTokenInfo(headers, url);
          }
        } catch (e) {}
      }
    });

    console.log('✅ Patchright浏览器已启动');
  }

  generate2FACode(secret) {
    try {
      return authenticator.generate({
        secret: secret,
        algorithm: 'SHA1',
        digits: 6,
        period: 30
      });
    } catch (error) {
      return null;
    }
  }

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

    try {
      // 策略：直接跳过Flutter应用，直接访问登录页面
      console.log('\n💡 策略：直接导航到登录页面（跳过Flutter应用）');
      
      // 方法1：直接访问登录选项页面
      console.log('🌐 直接访问登录选项页面...');
      await this.page.goto('https://message.hinatazaka46.com/web-sns-login', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      console.log('⏳ 等待页面加载...');
      await this.page.waitForTimeout(8000);

      // 检查是否成功到达登录页面
      const currentUrl = this.page.url();
      console.log(`📍 当前URL: ${currentUrl}`);

      if (!currentUrl.includes('web-sns-login')) {
        console.log('⚠️  未到达登录页面，尝试完整流程...');
        
        // 如果被重定向，尝试完整流程
        await this.page.goto('https://message.hinatazaka46.com/terms?type=webSnsLogin', {
          waitUntil: 'networkidle',
          timeout: 30000
        });
        
        await this.page.waitForTimeout(5000);
        
        // 尝试勾选复选框并点击"次へ"
        console.log('✅ 尝试处理条款页面...');
        
        try {
          // 查找并点击所有可能的复选框
          await this.page.evaluate(() => {
            // 查找所有input元素
            const inputs = document.querySelectorAll('input, flt-semantics[role="checkbox"]');
            inputs.forEach(input => {
              try {
                input.click();
              } catch (e) {}
            });
          });
          
          await this.page.waitForTimeout(2000);
          
          // 查找并点击"次へ"按钮
          await this.page.evaluate(() => {
            const buttons = document.querySelectorAll('button, flt-semantics[role="button"], [role="button"]');
            buttons.forEach(btn => {
              const text = btn.textContent || btn.innerText || '';
              if (text.includes('次') || text.includes('へ')) {
                try {
                  btn.click();
                } catch (e) {}
              }
            });
          });
          
          console.log('✅ 已尝试点击');
          await this.page.waitForTimeout(5000);
          
        } catch (e) {
          console.log('⚠️  条款处理失败，继续...');
        }
      }

      // 现在应该在登录选项页面
      console.log('\n🔍 准备Google登录...');
      
      // ⚠️ 关键：在任何点击之前就开始监听popup
      console.log('⏳ 开始监听popup窗口（在点击之前）...');
      const popupPromise = this.context.waitForEvent('page');
      
      console.log('💡 查找Google登录按钮...');
      
      // 尝试多种方式点击Google登录
      const googleLoginAttempts = [
        // 方法1：使用evaluate直接在页面中查找并点击
        async () => {
          await this.page.evaluate(() => {
            const elements = document.querySelectorAll('*');
            for (const el of elements) {
              const text = el.textContent || el.innerText || '';
              if (text.includes('Google') && text.includes('ログイン')) {
                el.click();
                return true;
              }
            }
            return false;
          });
        },
        
        // 方法2：查找包含Google图标的元素
        async () => {
          await this.page.evaluate(() => {
            const imgs = document.querySelectorAll('img');
            for (const img of imgs) {
              if (img.src && img.src.includes('google')) {
                // 点击图片的父元素
                let parent = img.parentElement;
                while (parent && parent !== document.body) {
                  if (parent.tagName === 'BUTTON' || parent.getAttribute('role') === 'button') {
                    parent.click();
                    return true;
                  }
                  parent = parent.parentElement;
                }
              }
            }
            return false;
          });
        },
        
        // 方法3：使用坐标点击（假设Google按钮在特定位置）
        async () => {
          // Google按钮通常在页面中上部
          await this.page.mouse.click(640, 300);
        }
      ];

      let googleClicked = false;
      for (let i = 0; i < googleLoginAttempts.length; i++) {
        try {
          console.log(`   尝试方法 ${i + 1}...`);
          await googleLoginAttempts[i]();
          await this.page.waitForTimeout(3000);
          
          // 检查是否跳转到Google登录页面
          const url = this.page.url();
          if (url.includes('accounts.google.com')) {
            console.log('✅ 成功跳转到Google登录页面！');
            googleClicked = true;
            break;
          }
        } catch (e) {
          console.log(`   ⚠️  方法 ${i + 1} 失败`);
        }
      }

      // popup监听已经在前面创建了
      console.log('\n🔐 开始Google OAuth流程...');
      console.log('💡 使用Patchright绕过bot检测...');
      
      if (!googleClicked) {
        console.log('⚠️  未能自动点击Google按钮');
        console.log('💡 请手动点击Google登录按钮...');
        console.log('💡 脚本会自动检测popup窗口并继续');
      }

      // 等待popup窗口出现
      console.log('⏳ 等待popup窗口打开...');
      
      let googlePage = this.page;
      
      try {
        // 等待popup（使用之前创建的popupPromise）
        const popup = await popupPromise;
        console.log('✅ 检测到popup窗口！');
        googlePage = popup;
        
        // 等待popup加载
        await googlePage.waitForLoadState('domcontentloaded', { timeout: 10000 });
        console.log('✅ popup窗口已加载');
        
        // 等待一下确保页面完全加载
        await googlePage.waitForTimeout(2000);
      } catch (e) {
        console.log('❌ 未检测到popup窗口');
        console.log('💡 可能需要手动完成整个流程');
        return false;
      }
      
      // 等待Google登录页面
      try {
        await googlePage.waitForSelector('input[type="email"]', { timeout: 10000 });
        console.log('✅ Google登录页面已加载');
      } catch (e) {
        console.log('⚠️  未检测到Google登录页面');
        console.log('💡 可能需要手动操作，等待10秒...');
        await googlePage.waitForTimeout(10000);
      }
      
      // 输入邮箱
      console.log('📧 输入Google邮箱...');
      await googlePage.fill('input[type="email"]', email);
      
      // 点击"次へ"
      console.log('👆 点击"次へ"...');
      try {
        await googlePage.click('#identifierNext');
      } catch (e) {
        try {
          await googlePage.click('button:has-text("次へ")');
        } catch (e2) {
          // 尝试查找任何包含"次へ"的按钮
          await googlePage.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
              if (btn.textContent.includes('次')) {
                btn.click();
                break;
              }
            }
          });
        }
      }
      
      console.log('⏳ 等待跳转到密码页面...');
      await googlePage.waitForTimeout(5000);

      // 输入密码
      console.log('🔑 输入密码...');
      await googlePage.waitForSelector('input[type="password"]', { timeout: 15000 });
      await googlePage.fill('input[type="password"]', password);
      
      // 点击"次へ"
      try {
        await googlePage.click('#passwordNext');
      } catch (e) {
        await googlePage.click('button:has-text("次へ")');
      }
      
      await googlePage.waitForTimeout(5000);

      // 检查是否被检测（在popup窗口中检查）
      const pageContent = await googlePage.content();
      if (pageContent.includes('安全でない') || pageContent.includes('not be secure')) {
        console.log('❌ 被Google检测为bot');
        return false;
      }

      console.log('✅ 成功通过Google验证！');
      
      // 处理Passkey验证（如果出现）
      console.log('⏳ 检查是否需要额外验证...');
      await googlePage.waitForTimeout(3000);
      
      const currentContent = await googlePage.content();
      if (currentContent.includes('パスキー') || currentContent.includes('Passkey') || currentContent.includes('保存した')) {
        console.log('🔐 检测到Passkey验证界面');
        
        // 尝试使用备用验证码
        const backupCodes = process.env.GOOGLE_BACKUP_CODES;
        if (backupCodes) {
          console.log('💡 尝试使用备用验证码...');
          
          try {
            // 查找"その他のデバイス"或"別の方法を試す"
            const otherOptions = [
              'text=その他のデバイス',
              'text=別の方法を試す',
              'text=その他のオプション',
              'button:has-text("キャンセル")'
            ];
            
            for (const selector of otherOptions) {
              try {
                await googlePage.click(selector, { timeout: 3000 });
                console.log('✅ 点击了其他选项');
                await googlePage.waitForTimeout(2000);
                break;
              } catch (e) {
                continue;
              }
            }
            
            // 查找备用验证码选项
            const backupOptions = [
              'text=バックアップ',
              'text=backup',
              'text=コード'
            ];
            
            for (const selector of backupOptions) {
              try {
                await googlePage.click(selector, { timeout: 3000 });
                console.log('✅ 选择了备用验证码选项');
                await googlePage.waitForTimeout(2000);
                break;
              } catch (e) {
                continue;
              }
            }
            
            // 输入备用验证码
            const codes = backupCodes.split(',');
            const code = codes[0].trim(); // 使用第一个验证码
            
            console.log(`🔢 输入备用验证码: ${code}`);
            
            // 查找输入框
            const inputSelectors = [
              'input[type="text"]',
              'input[name="backupCode"]',
              'input[placeholder*="コード"]'
            ];
            
            for (const selector of inputSelectors) {
              try {
                await googlePage.fill(selector, code, { timeout: 3000 });
                console.log('✅ 已输入备用验证码');
                
                // 点击下一步
                await googlePage.click('button:has-text("次へ"), button[type="submit"]');
                await googlePage.waitForTimeout(3000);
                break;
              } catch (e) {
                continue;
              }
            }
            
          } catch (e) {
            console.log('⚠️  自动处理备用验证码失败');
            console.log('💡 请手动完成Passkey验证');
          }
        } else {
          console.log('⚠️  未配置备用验证码');
          console.log('💡 请手动完成Passkey验证，或在.env中配置GOOGLE_BACKUP_CODES');
        }
        
        // 等待用户完成验证
        console.log('⏳ 等待验证完成（30秒）...');
        await googlePage.waitForTimeout(30000);
      }

      // 处理2FA（在popup窗口中）
      if (otpSecret) {
        console.log('🔢 处理2FA验证...');
        try {
          await googlePage.waitForSelector('input[name="totpPin"]', { timeout: 5000 });
          
          const code = this.generate2FACode(otpSecret);
          if (code) {
            console.log(`🔢 验证码: ${code}`);
            await googlePage.fill('input[name="totpPin"]', code);
            await googlePage.click('#totpNext');
            await googlePage.waitForTimeout(3000);
          }
        } catch (e) {
          console.log('⚠️  可能不需要2FA');
        }
      }

      // 等待登录完成 - popup窗口会自动关闭
      console.log('\n⏳ 等待登录完成...');
      console.log('💡 popup窗口会自动关闭并返回主页面');
      
      try {
        // 等待popup窗口关闭
        await googlePage.waitForEvent('close', { timeout: 20000 });
        console.log('✅ popup窗口已关闭');
      } catch (e) {
        console.log('⚠️  popup窗口未关闭');
      }
      
      // 切换回主页面
      await this.page.waitForTimeout(3000);
      
      // 检查主页面是否登录成功
      try {
        await this.page.waitForURL(url => 
          url.includes('message.hinatazaka46.com') || 
          url.includes('message.sakurazaka46.com'),
          { timeout: 20000 }
        );
        
        const finalUrl = this.page.url();
        console.log(`📍 最终URL: ${finalUrl}`);
        
        if (finalUrl.includes('message') && !finalUrl.includes('web-sns-login')) {
          console.log('✅ 登录成功！');
          return true;
        }
      } catch (e) {
        console.log('⚠️  等待超时');
      }
      
      // 最终检查
      const finalUrl = this.page.url();
      console.log(`📍 当前URL: ${finalUrl}`);
      
      if (finalUrl.includes('message') && !finalUrl.includes('web-sns-login') && !finalUrl.includes('accounts.google.com')) {
        console.log('✅ 登录成功！');
        return true;
      } else {
        console.log('💡 可能需要额外验证或手动完成');
        console.log('⏳ 等待30秒观察...');
        await this.page.waitForTimeout(30000);
        
        const lastUrl = this.page.url();
        if (lastUrl.includes('message') && !lastUrl.includes('web-sns-login')) {
          console.log('✅ 登录成功！');
          return true;
        }
        return false;
      }

    } catch (error) {
      console.error('❌ 登录过程出错:', error.message);
      return false;
    }
  }

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
    console.log(`💾 Token已保存: ${tokenFile}`);
  }

  async runTest() {
    try {
      console.log('🧪 Patchright Flutter登录测试');
      console.log('='.repeat(60));
      console.log('💡 策略：跳过Flutter应用，直接访问登录页面');
      console.log('='.repeat(60));
      
      await this.initBrowser();
      const success = await this.performGoogleLogin();
      
      if (success) {
        console.log('\n' + '='.repeat(60));
        console.log('✅ 测试成功！Patchright绕过了Google检测');
        console.log('🎉 可以集成到主项目实现自动Token更新');
        console.log('='.repeat(60));
        
        console.log('\n⏳ 保持页面打开30秒...');
        await this.page.waitForTimeout(30000);
      } else {
        console.log('\n' + '='.repeat(60));
        console.log('❌ 测试未完全成功');
        console.log('💡 请查看浏览器窗口，可能需要手动完成某些步骤');
        console.log('='.repeat(60));
      }

    } catch (error) {
      console.error('❌ 测试出错:', error.message);
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

const test = new PatchrightFlutterLogin(site);
test.runTest().catch(error => {
  console.error('运行错误:', error.message);
});
