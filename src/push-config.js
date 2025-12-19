/**
 * 推送配置 - 按成员分组推送
 */

module.exports = {
    // Lagrange/NapCat OneBot API 地址
    lagrangeApi: process.env.LAGRANGE_API || 'http://127.0.0.1:3000',

    // Qmsg酱 KEY（暂不使用）
    // qmsgKey: process.env.QMSG_KEY || '940a7250c96f5aec999c6f2de243f16b',

    // Discord Webhook (已关闭)
    discordWebhook: '',

    // 翻译失败报警 Webhook
    discordAlertWebhook: 'https://discord.com/api/webhooks/1448890346787438726/B5Ua-DLBcYPfjE7TO2vi1yZIhpZBLT5LCNTfmsum8xxH_G0J5Ek3rhjqhj733JwYRuTy',

    // 成员推送规则
    // key: 成员名（日文）
    // value: { qqGroups: [群号], qqPrivate: [QQ号], discord: webhook_url }
    memberPushRules: {
        // ========== 日向坂46 ==========
        '正源司 陽子': {
            qqGroups: ['213658334', '1059030628'], // 正式群 + 测试群
            enabled: true,
        },
        '大野 愛実': {
            qqGroups: ['651181711', '1059030628'], // 正式群 + 测试群
            enabled: true,
        },

        // ========== 櫻坂46 ==========
        '山下 瞳月': {
            qqGroups: ['607520034', '1059030628'], // 正式群 + 测试群
            enabled: true,
        },
        '中川 智尋': {
            qqGroups: ['1059030628'], // 正式群 + 测试群
            enabled: true,
        },

        // 未来添加
        // '山﨑天': {
        //   qqGroups: ['xxx', '1059030628'],
        //   enabled: true,
        // },
        // '山川宇衣': {
        //   qqGroups: ['xxx', '1059030628'],
        //   enabled: true,
        // },
    },

    // 默认推送规则（没有专门配置的成员）
    // 所有未配置的成员都会推送到测试群
    defaultPushRules: {
        nogizaka: {
            qqGroups: ['1059030628'],
            discord: null,
            enabled: true,
        },
        sakurazaka: {
            qqGroups: ['1059030628'],
            discord: null,
            enabled: true,
        },
        hinatazaka: {
            qqGroups: ['1059030628'],
            discord: null,
            enabled: true,
        },
    },

    // 订阅的成员列表（只监控这些成员）
    // 留空则监控所有订阅成员
    watchMembers: [
        // 留空 = 监控所有订阅成员
    ],
};
