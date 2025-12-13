/**
 * 简单的Token更新工具
 * 打开浏览器让你登录，自动提取Token
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function updateToken() {
  console.log('🔐 Token更新工具');
  console.log('='.repeat(60));
  console.log('');
  console.log('📋 操作步骤:');
  console.log('  1. 浏览器会自动打开网站');
  console.log('  2. 请使用谷歌账号登录');
  console.log('  3. 登录后随便点击一下消息');
  console.log('  4. 脚本会自动捕获Token并保存');
  console.log('');
  console.log('⏳ 启动浏览器...\n');

  const sites = [
    {
      name: '日向坂46',
      slug: 'hinatazaka46',
      url: 'https://message.hinatazaka46.com',
      apiUrl: 'https://api.message.hinatazaka46.com',
      appId: 'jp.co.sonymusic.communication.keyakizaka 2.5'
    },
    {
      name: '櫻坂46',
      slug: 'sakurazaka46',
      url: 'https://message.sakurazaka46.com',
      apiUrl: 'https://api.message.sakurazaka46.com',
      appId: 'jp.co.sonymusic.communication.sakurazaka 2.5'
    }
  ];

  const browser = await chromium.launch({ 
    headless: false,
    args: ['--start-maximized']
  });

  for (const site of sites) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📱 ${site.name}`);
    console.log('='.repeat(60));

    const context = await browser.newContext({
      viewport: null,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15'
    });

    const page = await context.newPage();

    let capturedToken = null;
    let capturedCookie = null;

    // 监听API请求
    page.on('request', request => {
      const url = request.url();
      if (url.includes(site.apiUrl)) {
        const headers = request.headers();
        if (headers['authorization'] && !capturedToken) {
          capturedToken = headers['authorization'];
          console.log('✅ Token已捕获!');
        }
      }
    });

    console.log(`🌐 打开 ${site.url}`);
    await page.goto(site.url);

    console.log('\n💡 请在浏览器中:');
    console.log('   1. 完成谷歌登录');
    console.log('   2. 点击任意消息或刷新页面');
    console.log('   3. 等待自动捕获Token...\n');

    // 等待用户操作和Token捕获
    let waited = 0;
    while (!capturedToken && waited < 120) {
      await page.waitForTimeout(1000);
      waited++;
      
      if (waited % 10 === 0) {
        console.log(`⏳ 等待中... (${waited}秒)`);
      }
    }

    if (capturedToken) {
      // 获取所有cookies
      const cookies = await context.cookies();
      capturedCookie = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // 保存到.env格式
      const envKey = site.slug.replace('46', '').toUpperCase();
      console.log(`\n📝 ${site.name} 新Token:`);
      console.log('─'.repeat(60));
      console.log(`${envKey}_API_TOKEN=${capturedToken}`);
      console.log('');
      console.log(`${envKey}_COOKIE=${capturedCookie.substring(0, 100)}...`);
      console.log('─'.repeat(60));

      // 保存到.env文件
      const envPath = path.join(__dirname, '..', '.env');
      let envContent = await fs.readFile(envPath, 'utf-8');

      // 更新Token
      const tokenRegex = new RegExp(`^${envKey}_API_TOKEN=.*$`, 'm');
      if (tokenRegex.test(envContent)) {
        envContent = envContent.replace(tokenRegex, `${envKey}_API_TOKEN=${capturedToken}`);
      } else {
        envContent += `\n${envKey}_API_TOKEN=${capturedToken}`;
      }

      // 更新Cookie
      const cookieRegex = new RegExp(`^${envKey}_COOKIE=.*$`, 'm');
      if (cookieRegex.test(envContent)) {
        envContent = envContent.replace(cookieRegex, `${envKey}_COOKIE=${capturedCookie}`);
      } else {
        envContent += `\n${envKey}_COOKIE=${capturedCookie}`;
      }

      await fs.writeFile(envPath, envContent);
      console.log('✅ 已自动更新到 .env 文件\n');

      // 也保存到独立文件
      const tokenData = {
        token: capturedToken,
        cookie: capturedCookie,
        timestamp: new Date().toISOString(),
        site: site.name
      };

      const tokenFile = path.join(__dirname, '..', 'data', `token-${site.slug}.json`);
      await fs.mkdir(path.dirname(tokenFile), { recursive: true });
      await fs.writeFile(tokenFile, JSON.stringify(tokenData, null, 2));
      console.log(`✅ 已保存到 data/token-${site.slug}.json\n`);

    } else {
      console.log(`\n⚠️  ${site.name} 未能捕获Token，跳过`);
    }

    await context.close();
    
    // 短暂等待
    await page.waitForTimeout(2000);
  }

  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log('✅ Token更新完成！');
  console.log('='.repeat(60));
  console.log('\n💡 下次Token过期时，再运行这个脚本即可:');
  console.log('   npm run update-token\n');
}

updateToken().catch(error => {
  console.error('\n💥 错误:', error.message);
  process.exit(1);
});
