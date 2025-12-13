/**
 * 运行所有自动化登录测试
 */

const { spawn } = require('child_process');
const path = require('path');

class TestRunner {
  constructor() {
    this.testDir = __dirname;
    this.results = [];
  }

  /**
   * 运行单个测试
   */
  async runTest(testName, scriptFile) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 运行测试: ${testName}`);
    console.log(`📁 脚本: ${scriptFile}`);
    console.log(`${'='.repeat(60)}\n`);
    
    return new Promise((resolve) => {
      const child = spawn('node', [scriptFile], {
        cwd: this.testDir,
        stdio: 'inherit'
      });
      
      child.on('close', (code) => {
        console.log(`\n📊 测试完成: ${testName} (退出码: ${code})`);
        this.results.push({
          name: testName,
          script: scriptFile,
          exitCode: code,
          success: code === 0
        });
        resolve(code === 0);
      });
      
      child.on('error', (error) => {
        console.error(`❌ 测试运行错误: ${error.message}`);
        this.results.push({
          name: testName,
          script: scriptFile,
          error: error.message,
          success: false
        });
        resolve(false);
      });
    });
  }

  /**
   * 显示测试菜单
   */
  showMenu() {
    console.log('🧪 自动化登录测试套件');
    console.log('='.repeat(60));
    console.log('');
    console.log('可选测试:');
    console.log('1. Cookie/Token有效性测试');
    console.log('2. Google登录自动化测试');
    console.log('3. LINE登录自动化测试');
    console.log('4. 运行所有测试');
    console.log('5. 退出');
    console.log('');
    console.log('💡 建议：先运行测试1，检查当前Token状态');
    console.log('');
  }

  /**
   * 交互式运行
   */
  async runInteractive() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    while (true) {
      this.showMenu();
      
      const choice = await new Promise(resolve => {
        rl.question('请选择测试 (1-5): ', answer => {
          resolve(answer.trim());
        });
      });
      
      let success = false;
      
      switch (choice) {
        case '1':
          success = await this.runTest('Cookie有效性测试', './cookie-validity-test.js');
          break;
          
        case '2':
          success = await this.runTest('Google登录自动化测试', './github-auto-login-test.js');
          break;
          
        case '3':
          success = await this.runTest('LINE登录自动化测试', './line-login-test.js');
          break;
          
        case '4':
          console.log('🚀 运行所有测试...\n');
          await this.runAllTests();
          break;
          
        case '5':
          console.log('👋 退出测试');
          rl.close();
          return;
          
        default:
          console.log('❌ 无效选择，请输入1-5');
          break;
      }
      
      if (choice !== '4' && choice !== '5') {
        console.log('\n按回车键继续...');
        await new Promise(resolve => {
          rl.question('', () => resolve());
        });
      }
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    const tests = [
      { name: 'Cookie有效性测试', script: './cookie-validity-test.js' },
      { name: 'Google登录自动化测试', script: './github-auto-login-test.js' },
      { name: 'LINE登录自动化测试', script: './line-login-test.js' }
    ];
    
    console.log('🎯 测试策略:');
    console.log('1. 先检查当前Token/Cookie状态');
    console.log('2. 如果无效，尝试自动化获取');
    console.log('3. Google和LINE都尝试，找到可行方案\n');
    
    for (const test of tests) {
      await this.runTest(test.name, test.script);
      
      // 询问是否继续
      if (test.name.includes('有效性')) {
        console.log('\n💡 如果Token无效，继续测试自动化登录方案...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log('\n⏳ 等待3秒后继续下一个测试...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    this.showSummary();
  }

  /**
   * 显示测试总结
   */
  showSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试总结');
    console.log('='.repeat(60));
    
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    
    console.log(`\n✅ 成功: ${successful.length} 个测试`);
    console.log(`❌ 失败: ${failed.length} 个测试`);
    
    if (successful.length > 0) {
      console.log('\n🎉 成功的测试:');
      successful.forEach(result => {
        console.log(`   ✅ ${result.name}`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\n⚠️  失败的测试:');
      failed.forEach(result => {
        console.log(`   ❌ ${result.name} ${result.error ? `(${result.error})` : ''}`);
      });
    }
    
    console.log('\n💡 建议:');
    
    if (successful.some(r => r.name.includes('有效性'))) {
      console.log('✅ 当前Token/Cookie有效，可以继续使用');
      console.log('💡 建议设置定时任务定期检查有效性');
    }
    
    if (successful.some(r => r.name.includes('Google'))) {
      console.log('🎉 Google自动化登录可行！');
      console.log('💡 可以集成到主项目，实现自动Token更新');
    }
    
    if (successful.some(r => r.name.includes('LINE'))) {
      console.log('🎉 LINE自动化登录可行！');
      console.log('💡 LINE登录可能比Google更稳定');
    }
    
    if (successful.length === 0) {
      console.log('❌ 所有自动化方案都失败了');
      console.log('💡 建议使用手机助手工具手动更新Token');
      console.log('💡 或者考虑长期Cookie方案');
    }
    
    console.log('\n📁 相关文件:');
    console.log('📄 测试结果保存在当前目录的JSON文件中');
    console.log('📄 可以查看详细的Token信息和网络请求');
  }
}

// 运行测试
const runner = new TestRunner();

// 如果有命令行参数，直接运行指定测试
const args = process.argv.slice(2);
if (args.length > 0) {
  const test = args[0];
  switch (test) {
    case 'cookie':
      runner.runTest('Cookie有效性测试', './cookie-validity-test.js');
      break;
    case 'google':
      runner.runTest('Google登录自动化测试', './github-auto-login-test.js');
      break;
    case 'line':
      runner.runTest('LINE登录自动化测试', './line-login-test.js');
      break;
    case 'all':
      runner.runAllTests();
      break;
    default:
      console.log('用法: node run-all-tests.js [cookie|google|line|all]');
  }
} else {
  // 交互式运行
  runner.runInteractive().catch(error => {
    console.error('运行错误:', error.message);
  });
}
