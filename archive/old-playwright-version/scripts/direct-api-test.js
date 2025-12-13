const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * 直接测试API端点 - 不用浏览器
 * 使用已保存的cookies
 */
async function directAPITest(siteSlug = 'hinatazaka46') {
  console.log('🔍 直接API测试\n');

  // 读取保存的cookies
  const cookieFile = path.join(__dirname, '..', 'data', `cookies-${siteSlug}.json`);
  
  try {
    const cookiesData = await fs.readFile(cookieFile, 'utf-8');
    const cookies = JSON.parse(cookiesData);
    
    // 转换cookies为字符串
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    console.log('✅ 已加载cookies\n');

    // 可能的API端点列表
    const endpoints = [
      // Timeline相关
      'https://api.message.hinatazaka46.com/v2/timeline/70',
      'https://api.message.hinatazaka46.com/v2/timelines/70',
      'https://api.message.hinatazaka46.com/v2/organizations/1/timeline/70',
      'https://api.message.hinatazaka46.com/v2/organizations/1/talks/70',
      'https://api.message.hinatazaka46.com/v2/organizations/1/talks/70/messages',
      
      // Talk相关
      'https://api.message.hinatazaka46.com/v2/talks/70',
      'https://api.message.hinatazaka46.com/v2/talks/70/messages',
      'https://api.message.hinatazaka46.com/v2/talks/70/posts',
      
      // Messages相关
      'https://api.message.hinatazaka46.com/v2/messages',
      'https://api.message.hinatazaka46.com/v2/posts',
      
      // 用户相关
      'https://api.message.hinatazaka46.com/v2/users/me',
      'https://api.message.hinatazaka46.com/v2/me',
      'https://api.message.hinatazaka46.com/v2/profile',
      
      // 组织相关
      'https://api.message.hinatazaka46.com/v2/organizations/1',
      'https://api.message.hinatazaka46.com/v2/organizations/1/talks',
      'https://api.message.hinatazaka46.com/v2/organizations/1/members',
    ];

    console.log('🧪 测试API端点...\n');

    const results = [];

    for (const endpoint of endpoints) {
      try {
        console.log(`📡 GET ${endpoint}`);
        
        const response = await axios.get(endpoint, {
          headers: {
            'Cookie': cookieString,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            'Origin': 'https://message.hinatazaka46.com',
            'Referer': 'https://message.hinatazaka46.com/',
          },
          timeout: 10000,
          validateStatus: () => true // 接受所有状态码
        });

        const status = response.status;
        const statusText = response.statusText;
        
        if (status === 200) {
          console.log(`   ✅ ${status} ${statusText}`);
          
          const data = response.data;
          const dataPreview = JSON.stringify(data).substring(0, 200);
          console.log(`   💾 ${dataPreview}...`);
          
          // 检查是否包含消息数据
          const hasMessages = JSON.stringify(data).toLowerCase().includes('message');
          const hasPosts = JSON.stringify(data).toLowerCase().includes('post');
          const hasContent = JSON.stringify(data).toLowerCase().includes('content');
          
          if (hasMessages || hasPosts || hasContent) {
            console.log(`   🎯 可能包含消息数据！`);
          }
          
          results.push({
            endpoint,
            status,
            success: true,
            dataKeys: Object.keys(data || {}),
            data: data
          });
        } else if (status === 401) {
          console.log(`   ⚠️  ${status} 认证失败`);
        } else if (status === 404) {
          console.log(`   ⚠️  ${status} 端点不存在`);
        } else {
          console.log(`   ⚠️  ${status} ${statusText}`);
        }
        
        console.log('');
        
      } catch (error) {
        if (error.response) {
          console.log(`   ❌ ${error.response.status} ${error.response.statusText}`);
        } else {
          console.log(`   ❌ ${error.message}`);
        }
        console.log('');
      }
    }

    // 保存结果
    const resultFile = path.join(__dirname, '..', 'data', `api-test-results-${siteSlug}.json`);
    await fs.writeFile(resultFile, JSON.stringify(results, null, 2));
    
    console.log('\n📊 测试总结');
    console.log('='.repeat(60));
    console.log(`成功的端点: ${results.filter(r => r.success).length}/${endpoints.length}`);
    console.log(`结果已保存: ${resultFile}\n`);
    
    if (results.filter(r => r.success).length > 0) {
      console.log('✅ 成功的端点:');
      results.filter(r => r.success).forEach(r => {
        console.log(`\n${r.endpoint}`);
        console.log(`  字段: ${r.dataKeys.join(', ')}`);
      });
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    
    if (error.code === 'ENOENT') {
      console.log('\n💡 提示: 请先运行 npm run login:hinata 获取cookies');
    }
  }
}

const siteSlug = process.argv[2] || 'hinatazaka46';
directAPITest(siteSlug).catch(console.error);
