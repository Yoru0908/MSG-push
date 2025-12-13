const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * 认证管理器 - 自动登录和Token刷新
 */
class AuthManager {
  constructor(site, config) {
    this.site = site;
    this.config = config;
    this.tokenFile = path.join(__dirname, '..', 'data', `token-${site.slug}.json`);
  }

  /**
   * 检查Token是否有效
   */
  isTokenValid(token) {
    if (!token) return false;

    try {
      // 解析JWT Token
      const jwtToken = token.replace('Bearer ', '');
      const parts = jwtToken.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      
      if (!payload.exp) return false;

      const expireTime = new Date(payload.exp * 1000);
      const now = new Date();
      
      // 提前10分钟刷新（避免在使用时突然过期）
      const bufferTime = 10 * 60 * 1000;
      
      return (expireTime - now) > bufferTime;
    } catch (error) {
      console.error('⚠️  Token解析失败:', error.message);
      return false;
    }
  }

  /**
   * 自动登录获取新Token
   */
  async login(email, password) {
    console.log(`🔐 ${this.site.name} 正在登录...`);

    try {
      // 根据不同站点使用不同的登录API
      const loginUrl = `${this.config.baseUrl}/auth/sign_in`;
      
      const response = await axios.post(loginUrl, {
        email,
        password
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-talk-app-id': this.config.appId,
          'x-talk-app-platform': this.config.appPlatform
        },
        timeout: 15000
      });

      // 提取Token和Cookie
      const token = response.headers['authorization'];
      const cookies = response.headers['set-cookie'];
      
      if (!token) {
        throw new Error('登录响应中没有Token');
      }

      const cookieString = cookies ? cookies.join('; ') : '';

      console.log(`✅ ${this.site.name} 登录成功`);
      
      // 保存Token信息
      const tokenData = {
        token,
        cookie: cookieString,
        timestamp: new Date().toISOString(),
        email
      };

      await this.saveToken(tokenData);

      return tokenData;

    } catch (error) {
      console.error(`❌ ${this.site.name} 登录失败:`, error.message);
      if (error.response) {
        console.error(`   状态码: ${error.response.status}`);
        console.error(`   响应:`, JSON.stringify(error.response.data).substring(0, 200));
      }
      throw error;
    }
  }

  /**
   * 保存Token到文件
   */
  async saveToken(tokenData) {
    try {
      const dataDir = path.dirname(this.tokenFile);
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(this.tokenFile, JSON.stringify(tokenData, null, 2));
      console.log(`💾 Token已保存: ${this.tokenFile}`);
    } catch (error) {
      console.error('⚠️  Token保存失败:', error.message);
    }
  }

  /**
   * 从文件加载Token
   */
  async loadToken() {
    try {
      const data = await fs.readFile(this.tokenFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取有效的Token（自动刷新）
   */
  async getValidToken(email, password) {
    // 1. 先尝试从环境变量获取
    const envToken = this.config.authorization;
    
    if (this.isTokenValid(envToken)) {
      console.log(`✅ ${this.site.name} Token有效（环境变量）`);
      return {
        token: envToken,
        cookie: this.config.cookie
      };
    }

    console.log(`⚠️  ${this.site.name} Token已过期或即将过期`);

    // 2. 尝试从文件加载
    const savedToken = await this.loadToken();
    if (savedToken && this.isTokenValid(savedToken.token)) {
      console.log(`✅ ${this.site.name} 使用已保存的Token`);
      return savedToken;
    }

    // 3. 自动登录获取新Token
    if (!email || !password) {
      throw new Error(`${this.site.name} 需要登录，但未配置账号密码`);
    }

    console.log(`🔄 ${this.site.name} 自动刷新Token...`);
    return await this.login(email, password);
  }

  /**
   * 更新环境变量文件（可选）
   */
  async updateEnvFile(token, cookie) {
    try {
      const envPath = path.join(__dirname, '..', '.env');
      let envContent = await fs.readFile(envPath, 'utf-8');

      const tokenKey = `${this.site.slug.toUpperCase()}_API_TOKEN`;
      const cookieKey = `${this.site.slug.toUpperCase()}_COOKIE`;

      // 更新Token
      const tokenRegex = new RegExp(`^${tokenKey}=.*$`, 'm');
      if (tokenRegex.test(envContent)) {
        envContent = envContent.replace(tokenRegex, `${tokenKey}=${token}`);
      } else {
        envContent += `\n${tokenKey}=${token}`;
      }

      // 更新Cookie
      const cookieRegex = new RegExp(`^${cookieKey}=.*$`, 'm');
      if (cookieRegex.test(envContent)) {
        envContent = envContent.replace(cookieRegex, `${cookieKey}=${cookie}`);
      } else {
        envContent += `\n${cookieKey}=${cookie}`;
      }

      await fs.writeFile(envPath, envContent);
      console.log(`✅ .env文件已更新`);
    } catch (error) {
      console.error('⚠️  更新.env失败:', error.message);
    }
  }
}

module.exports = AuthManager;
