# 🧪 自动化Google登录测试

基于GitHub上找到的项目进行测试：
- [playwright-google-auth-2fa](https://github.com/playwrightsolutions/playwright-google-auth-2fa)
- [continue-with-google](https://github.com/the-type-founders/continue-with-google)

## 📁 文件结构

```
auto-login-test/
├── github-auto-login-test.js    # 主要测试脚本
├── auth-manager.js             # 复制的认证管理器
├── .env                        # 环境配置
├── package.json                # 依赖配置
└── scripts/                    # 复制的脚本目录
```

## 🚀 运行测试

### 1. 配置环境变量

编辑 `.env` 文件，添加：

```bash
# Google账号信息
GOOGLE_EMAIL=你的@gmail.com
GOOGLE_PASSWORD=你的密码
GOOGLE_OTP_SECRET=你的2FA密钥（可选）

# 坂道账号信息
HINATAZAKA_EMAIL=你的@gmail.com
HINATAZAKA_PASSWORD=你的密码
SAKURAZAKA_EMAIL=你的@gmail.com
SAKURAZAKA_PASSWORD=你的密码
```

### 2. 获取2FA密钥（如果需要）

1. 在Google账号中启用2FA
2. 安装Google Authenticator
3. 导出QR码：设置 → Google Authenticator → 导出账号
4. 扫描QR码获取secret：`otpauth://totp/Google%3A{email}?secret={secret}&issuer=Google`
5. 将secret添加到 `GOOGLE_OTP_SECRET`

### 3. 运行测试

```bash
cd auto-login-test
npm install
node github-auto-login-test.js
```

## 🎯 测试目标

### 主要测试点

1. **Stealth模式效果**
   - 是否能绕过Google的bot检测
   - 是否会出现"This browser or app may not be secure"错误

2. **自动化流程**
   - 邮箱输入
   - 密码输入
   - 2FA验证（如果配置）
   - 跳转回原网站

3. **Token获取**
   - 是否能成功获取官方API Token
   - Token格式是否正确

### 成功标准

- ✅ 完成Google OAuth流程
- ✅ 成功跳转回坂道消息网站
- ✅ 捕获到有效的API Token
- ✅ Token可以用于调用官方API

### 失败处理

- ❌ 被Google检测为bot
- ❌ 需要额外的设备验证
- ❌ 无法获取Token
- ❌ Token无效

## 📊 测试结果

### 预期结果

基于GitHub项目的反馈，预期：

- 🟡 **50%成功率** - Google检测越来越严格
- 🟡 **可能需要手动干预** - 设备验证等步骤
- 🔴 **可能随时失效** - Google可能更新检测机制

### 备选方案

如果测试失败，按优先级：

1. **LINE登录自动化** - QR码可能更容易处理
2. **Apple ID登录** - 应用专用密码可能可行
3. **长期Cookie方案** - 测试Cookie有效期
4. **手动更新** - 使用手机助手工具

## 🔍 调试信息

测试脚本会输出详细的调试信息：

- 🌐 页面访问日志
- 🔐 登录步骤进度
- 📡 网络请求监控
- 🔑 Token捕获信息
- ⚠️ 错误和警告

## 📝 注意事项

### 安全风险

- ⚠️ 不要在代码中硬编码密码
- ⚠️ 2FA密钥要妥善保管
- ⚠️ Google账号可能被限制使用

### 技术限制

- ⚠️ headless模式成功率更低
- ⚠️ 需要稳定的网络环境
- ⚠️ Google可能随时更新检测机制

### 合规性

- ✅ 仅用于个人学习和测试
- ✅ 不违反服务条款（模拟正常用户行为）
- ❌ 不要用于商业用途或大规模爬取

## 🚀 下一步

如果测试成功：

1. 集成到主项目
2. 添加错误重试机制
3. 实现定时自动更新
4. 添加监控和通知

如果测试失败：

1. 尝试其他登录方式（LINE/Apple）
2. 优化stealth配置
3. 考虑使用真实浏览器配置
4. 回退到手动更新方案
