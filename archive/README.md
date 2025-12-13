# 旧版代码归档

## 📁 目录说明

这个文件夹包含已弃用的旧版本代码，仅作归档参考。

## 🗂️ old-playwright-version/

基于Playwright的旧版本实现（已弃用）

### 为什么弃用？

| 问题 | 描述 |
|-----|------|
| **速度慢** | 30-60秒才能完成一次抓取 |
| **资源占用高** | 需要启动完整浏览器，占用~200MB内存 |
| **不稳定** | 依赖页面结构，Flutter渲染难以解析 |
| **维护困难** | Canvas内容无法提取，选择器易失效 |

### 新版本优势

| 特性 | 新版API | 旧版Playwright |
|-----|---------|---------------|
| 速度 | **<2秒** ⚡ | 30-60秒 |
| 内存 | **<10MB** 💾 | ~200MB |
| 稳定性 | **直接API** ✅ | 依赖页面 |
| 多成员 | **支持** ✨ | 不支持 |

### 包含文件

- `scraper.js` - 旧版Playwright scraper
- `auth.js` - Playwright认证管理
- `scripts/` - 各种调试和查找API的脚本
  - `debug-page.js`
  - `find-api.js`
  - `intercept-api.js`
  - `quick-detect.js`
  - `direct-api-test.js`
  - 等

这些文件仅供参考，**不再维护**。

## 🚀 使用新版本

新版本位于项目根目录：

```bash
# 测试API连接
npm test

# 启动监控
npm start
```

详见项目根目录的 `README.md`
