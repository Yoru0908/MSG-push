/**
 * 智能监听器 - 自适应检查间隔
 * 根据消息活跃度动态调整检查频率
 */

require('dotenv').config();
const MessagePollingListener = require('./polling-listener');

class SmartMessageListener extends MessagePollingListener {
  constructor(site) {
    super(site);
    
    // 智能间隔配置
    this.minInterval = 30;    // 最小间隔30秒（活跃时）
    this.maxInterval = 300;   // 最大间隔5分钟（不活跃时）
    this.currentInterval = 60; // 当前间隔
    
    // 活跃度追踪
    this.recentMessages = [];
    this.activityWindow = 3600000; // 1小时窗口
  }

  /**
   * 启动智能监听
   */
  start() {
    console.log('🧠 智能监听器已启动');
    console.log(`⏱️  间隔范围: ${this.minInterval}s - ${this.maxInterval}s`);
    console.log('💡 会根据消息活跃度自动调整检查频率\n');
    
    this.isRunning = true;
    this.scheduleNextCheck();
  }

  /**
   * 调度下一次检查
   */
  scheduleNextCheck() {
    if (!this.isRunning) return;
    
    // 计算下一次检查的间隔
    const interval = this.calculateInterval();
    
    console.log(`⏰ 下次检查: ${interval}秒后`);
    
    this.timeoutId = setTimeout(async () => {
      await this.checkForUpdates();
      this.scheduleNextCheck();
    }, interval * 1000);
  }

  /**
   * 计算检查间隔
   */
  calculateInterval() {
    // 获取最近1小时的消息数量
    const now = Date.now();
    const recentCount = this.recentMessages.filter(
      time => now - time < this.activityWindow
    ).length;

    // 根据活跃度调整间隔
    if (recentCount >= 5) {
      // 非常活跃：每30秒检查一次
      this.currentInterval = this.minInterval;
      console.log('📈 活跃度: 高（最近1小时有5+条消息）');
    } else if (recentCount >= 2) {
      // 中等活跃：每1分钟检查一次
      this.currentInterval = 60;
      console.log('📊 活跃度: 中（最近1小时有2-4条消息）');
    } else if (recentCount >= 1) {
      // 低活跃：每2分钟检查一次
      this.currentInterval = 120;
      console.log('📉 活跃度: 低（最近1小时有1条消息）');
    } else {
      // 不活跃：每5分钟检查一次
      this.currentInterval = this.maxInterval;
      console.log('💤 活跃度: 无（最近1小时无消息）');
    }

    // 特殊时段调整
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 6) {
      // 凌晨0-6点，降低频率
      this.currentInterval = Math.min(this.currentInterval * 2, this.maxInterval);
      console.log('🌙 凌晨时段，降低检查频率');
    } else if (hour >= 18 && hour < 23) {
      // 晚上6-11点，提高频率（成员可能更活跃）
      this.currentInterval = Math.max(this.currentInterval / 2, this.minInterval);
      console.log('🌆 晚间时段，提高检查频率');
    }

    return this.currentInterval;
  }

  /**
   * 处理新消息（重写）
   */
  async handleNewMessage(message) {
    // 记录消息时间
    this.recentMessages.push(Date.now());
    
    // 清理旧记录
    const now = Date.now();
    this.recentMessages = this.recentMessages.filter(
      time => now - time < this.activityWindow
    );

    // 调用父类方法
    await super.handleNewMessage(message);
  }

  /**
   * 停止监听（重写）
   */
  stop() {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    console.log('\n👋 智能监听器已停止');
  }

  /**
   * 获取统计信息（重写）
   */
  getStats() {
    const baseStats = super.getStats();
    const now = Date.now();
    const recentCount = this.recentMessages.filter(
      time => now - time < this.activityWindow
    ).length;

    return {
      ...baseStats,
      currentInterval: this.currentInterval,
      recentMessagesCount: recentCount,
      activityLevel: this.getActivityLevel(recentCount)
    };
  }

  /**
   * 获取活跃度等级
   */
  getActivityLevel(count) {
    if (count >= 5) return '高';
    if (count >= 2) return '中';
    if (count >= 1) return '低';
    return '无';
  }
}

// 运行
if (require.main === module) {
  const site = {
    slug: 'hinatazaka46',
    name: '日向坂46'
  };

  const listener = new SmartMessageListener(site);
  listener.start();

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n\n📊 统计信息:');
    const stats = listener.getStats();
    console.log(`   当前间隔: ${stats.currentInterval}秒`);
    console.log(`   活跃度: ${stats.activityLevel}`);
    console.log(`   最近消息数: ${stats.recentMessagesCount}`);
    console.log(`   最后检查: ${stats.lastCheckTime}`);
    
    listener.stop();
    process.exit(0);
  });

  // 定期显示详细状态
  setInterval(() => {
    const stats = listener.getStats();
    console.log(`\n💡 [状态报告]`);
    console.log(`   运行状态: ${stats.isRunning ? '✅ 运行中' : '❌ 已停止'}`);
    console.log(`   当前间隔: ${stats.currentInterval}秒`);
    console.log(`   活跃度: ${stats.activityLevel}`);
    console.log(`   最近1小时消息: ${stats.recentMessagesCount}条`);
    console.log(`   最后检查: ${stats.lastCheckTime}`);
  }, 600000); // 每10分钟显示一次
}

module.exports = SmartMessageListener;
