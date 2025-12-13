const config = require('../src/config');
const AuthManager = require('../src/auth');

/**
 * 登录工具 - 用于首次设置或更新认证
 */
async function login() {
  const siteArg = process.argv[2] || 'hinatazaka46';
  
  const site = config.sites.find(s => s.slug === siteArg);
  
  if (!site) {
    console.error('❌ 未知站点:', siteArg);
    console.log('可用站点:', config.sites.map(s => s.slug).join(', '));
    process.exit(1);
  }

  console.log('🔐 登录工具');
  console.log('='.repeat(60));
  console.log(`站点: ${site.name}`);
  console.log(`URL: ${site.url}`);
  console.log('');

  const authManager = new AuthManager(site);
  const credentials = config.auth.credentials[site.slug];

  console.log('💡 提示:');
  console.log('   1. 浏览器会自动打开');
  console.log('   2. 请在浏览器中完成登录');
  console.log('   3. 登录成功后，认证信息会自动保存');
  console.log('   4. 下次运行时将自动使用保存的认证');
  console.log('');

  const success = await authManager.login(credentials);

  if (success) {
    console.log('\n✅ 登录成功！');
    console.log('');
    console.log('📝 后续步骤:');
    console.log('   1. 运行测试: npm run scrape:' + siteArg.split('46')[0]);
    console.log('   2. 设置GitHub Secrets（用于Actions）');
    console.log('   3. 推送到GitHub开始自动抓取');
    console.log('');
    console.log('🔒 认证文件已保存到: data/cookies-' + site.slug + '.json');
    console.log('   （请勿将此文件提交到git，已在.gitignore中）');
  } else {
    console.log('\n❌ 登录失败');
    console.log('');
    console.log('💡 可能的原因:');
    console.log('   1. 网络连接问题');
    console.log('   2. 登录凭据错误');
    console.log('   3. 网站需要验证码');
    console.log('   4. 登录超时（60秒）');
    console.log('');
    console.log('🔧 解决方法:');
    console.log('   1. 检查网络连接');
    console.log('   2. 确认账号密码正确');
    console.log('   3. 手动完成验证码');
    console.log('   4. 再次运行此脚本');
    process.exit(1);
  }
}

login().catch(error => {
  console.error('\n💥 程序异常:', error);
  process.exit(1);
});
