/**
 * 解析JWT Token，查看过期时间
 */

require('dotenv').config();

function decodeJWT(token) {
  try {
    // 移除 "Bearer " 前缀
    const jwtToken = token.replace('Bearer ', '');
    
    // JWT格式: header.payload.signature
    const parts = jwtToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    // 解码payload (Base64)
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
    const data = JSON.parse(payload);
    
    return data;
  } catch (error) {
    console.error('❌ 解析失败:', error.message);
    return null;
  }
}

function analyzeToken(name, token) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${name}`);
  console.log('='.repeat(60));
  
  const payload = decodeJWT(token);
  if (!payload) {
    console.log('⚠️  无法解析Token\n');
    return;
  }
  
  console.log('\n📊 Token信息:');
  console.log(JSON.stringify(payload, null, 2));
  
  if (payload.exp) {
    const expireTime = new Date(payload.exp * 1000);
    const now = new Date();
    const remainingMs = expireTime - now;
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    
    console.log(`\n⏰ 过期时间: ${expireTime.toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo' })}`);
    console.log(`⏱️  当前时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo' })}`);
    
    if (remainingMs > 0) {
      console.log(`✅ 剩余时间: ${remainingHours}小时 ${remainingMinutes}分钟`);
      console.log(`📅 有效期: 约${Math.floor(remainingMs / (1000 * 60 * 60 * 24))}天`);
    } else {
      console.log(`❌ 已过期: ${Math.abs(remainingHours)}小时 ${Math.abs(remainingMinutes)}分钟前`);
    }
  }
  
  if (payload.sub) {
    console.log(`\n👤 用户ID: ${payload.sub}`);
  }
}

console.log('🔍 Token过期时间分析\n');

// 分析日向坂46
const hinatazakaToken = process.env.HINATAZAKA_API_TOKEN;
if (hinatazakaToken) {
  analyzeToken('日向坂46 Token', hinatazakaToken);
} else {
  console.log('⚠️  未找到日向坂46 Token');
}

// 分析櫻坂46
const sakurazakaToken = process.env.SAKURAZAKA_API_TOKEN;
if (sakurazakaToken) {
  analyzeToken('櫻坂46 Token', sakurazakaToken);
} else {
  console.log('⚠️  未找到櫻坂46 Token');
}

console.log('\n' + '='.repeat(60));
console.log('💡 建议:');
console.log('='.repeat(60));
console.log(`
如果Token频繁过期（<24小时），需要实现自动登录机制：

1. 使用账号密码自动登录
2. 获取新的Token和Cookie
3. 在Token即将过期前自动刷新

或者：
- 使用长期有效的Token（如果API支持）
- 定期手动更新Token（不推荐）
`);
