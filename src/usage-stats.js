/**
 * API 使用统计模块
 * 追踪翻译 API 调用次数和 Token 使用量
 * 每天 23:50 发送日报到 Discord
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');

// Discord Webhook 用于发送日报
const DISCORD_REPORT_WEBHOOK = 'https://discord.com/api/webhooks/1448890349610205336/6PVw5FYwwR0hJC6wB7nl_57Oaj0QItnDal0R4YyCRsMVCIE0ta286jSFBnJ9kLIkOKZL';

// 统计数据文件路径
const STATS_FILE = path.join(__dirname, '../data/usage-stats.json');

// 当日统计
let todayStats = {
    date: new Date().toISOString().split('T')[0],
    translateCalls: 0,
    translateOcrCalls: 0,
    ocrCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    cachedTokens: 0,  // 缓存命中的 Token
    errors: 0,
};

// 历史统计
let allTimeStats = {
    totalTranslateCalls: 0,
    totalTranslateOcrCalls: 0,
    totalOcrCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,  // 累计缓存命中 Token
    startDate: new Date().toISOString().split('T')[0],
};

/**
 * 加载统计数据
 */
function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
            allTimeStats = data.allTimeStats || allTimeStats;

            // 检查是否是同一天
            const today = new Date().toISOString().split('T')[0];
            if (data.todayStats && data.todayStats.date === today) {
                todayStats = data.todayStats;
            } else {
                // 新的一天，重置今日统计
                todayStats.date = today;
                todayStats.translateCalls = 0;
                todayStats.translateOcrCalls = 0;
                todayStats.ocrCalls = 0;
                todayStats.totalInputTokens = 0;
                todayStats.totalOutputTokens = 0;
                todayStats.cachedTokens = 0;
                todayStats.errors = 0;
            }
        }
    } catch (e) {
        console.error('⚠️ 加载统计数据失败:', e.message);
    }
}

/**
 * 保存统计数据
 */
function saveStats() {
    try {
        const dir = path.dirname(STATS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(STATS_FILE, JSON.stringify({ todayStats, allTimeStats }, null, 2));
    } catch (e) {
        console.error('⚠️ 保存统计数据失败:', e.message);
    }
}

/**
 * 记录翻译调用
 * @param {string} type - 'translate' | 'translateOcr' | 'ocr'
 * @param {number} inputTokens - 输入 token 数
 * @param {number} outputTokens - 输出 token 数
 * @param {boolean} success - 是否成功
 * @param {number} cachedTokens - 缓存命中的 token 数
 */
function recordCall(type, inputTokens = 0, outputTokens = 0, success = true, cachedTokens = 0) {
    // 检查是否是新的一天
    const today = new Date().toISOString().split('T')[0];
    if (todayStats.date !== today) {
        // 新的一天，重置今日统计
        todayStats = {
            date: today,
            translateCalls: 0,
            translateOcrCalls: 0,
            ocrCalls: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            cachedTokens: 0,
            errors: 0,
        };
    }

    // 更新今日统计
    if (type === 'translate') {
        todayStats.translateCalls++;
        allTimeStats.totalTranslateCalls++;
    } else if (type === 'translateOcr') {
        todayStats.translateOcrCalls++;
        allTimeStats.totalTranslateOcrCalls++;
    } else if (type === 'ocr') {
        todayStats.ocrCalls++;
        allTimeStats.totalOcrCalls++;
    }

    if (!success) {
        todayStats.errors++;
    }

    todayStats.totalInputTokens += inputTokens;
    todayStats.totalOutputTokens += outputTokens;
    todayStats.cachedTokens += cachedTokens;
    allTimeStats.totalInputTokens += inputTokens;
    allTimeStats.totalOutputTokens += outputTokens;
    allTimeStats.totalCachedTokens += cachedTokens;

    saveStats();
}

/**
 * 发送日报到 Discord
 */
async function sendDailyReport() {
    try {
        const totalCalls = todayStats.translateCalls + todayStats.translateOcrCalls;
        const totalTokens = todayStats.totalInputTokens + todayStats.totalOutputTokens;
        const cacheHitRate = todayStats.totalInputTokens > 0
            ? ((todayStats.cachedTokens / todayStats.totalInputTokens) * 100).toFixed(1)
            : '0.0';

        const embed = {
            title: `📊 API 使用日报 - ${todayStats.date}`,
            color: 0x5865F2,
            fields: [
                {
                    name: '📨 消息翻译',
                    value: `${todayStats.translateCalls} 次`,
                    inline: true,
                },
                {
                    name: '🖼️ OCR 翻译',
                    value: `${todayStats.translateOcrCalls} 次`,
                    inline: true,
                },
                {
                    name: '🔍 OCR 识别',
                    value: `${todayStats.ocrCalls} 次`,
                    inline: true,
                },
                {
                    name: '📊 今日 Token',
                    value: `输入: ${todayStats.totalInputTokens.toLocaleString()}\n输出: ${todayStats.totalOutputTokens.toLocaleString()}\n合计: ${totalTokens.toLocaleString()}`,
                    inline: true,
                },
                {
                    name: '📦 缓存命中',
                    value: `${todayStats.cachedTokens.toLocaleString()} tokens\n命中率: ${cacheHitRate}%`,
                    inline: true,
                },
                {
                    name: '❌ 错误次数',
                    value: `${todayStats.errors} 次`,
                    inline: true,
                },
                {
                    name: '📈 总计调用',
                    value: `${(allTimeStats.totalTranslateCalls + allTimeStats.totalTranslateOcrCalls).toLocaleString()} 次\n(自 ${allTimeStats.startDate})`,
                    inline: true,
                },
            ],
            footer: {
                text: `累计 Token: ${(allTimeStats.totalInputTokens + allTimeStats.totalOutputTokens).toLocaleString()} | 累计缓存: ${allTimeStats.totalCachedTokens.toLocaleString()}`,
            },
            timestamp: new Date().toISOString(),
        };

        await axios.post(DISCORD_REPORT_WEBHOOK, { embeds: [embed] });
        console.log(`📊 [${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}] 日报已发送`);
    } catch (e) {
        console.error('⚠️ 发送日报失败:', e.message);
    }
}

/**
 * 启动定时任务（每天 23:50 东京时间）
 */
function startScheduler() {
    // node-schedule 使用服务器本地时间，服务器设置为东京时间
    const job = schedule.scheduleJob('50 23 * * *', async () => {
        console.log('⏰ 触发日报任务...');
        await sendDailyReport();
    });

    console.log('📅 日报定时任务已启动 (每天 23:50)');
    return job;
}

/**
 * 获取当前统计
 */
function getStats() {
    return { todayStats, allTimeStats };
}

// 初始化时加载统计数据
loadStats();

module.exports = {
    recordCall,
    sendDailyReport,
    startScheduler,
    getStats,
};
