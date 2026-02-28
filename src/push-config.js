/**
 * 推送配置 - 按成员分组推送
 */

module.exports = {
    // Lagrange/NapCat OneBot API 地址
    lagrangeApi: process.env.LAGRANGE_API || 'http://127.0.0.1:3000',

    // Telegram Bot 配置
    telegram: {
        botToken: '7763241054:AAFaods1TlgwgtxiNysTTtj6mEJ7tdZJBZI',
        enabled: true,
    },

    // Google OAuth Refresh Tokens
    // 用于 /v2/signin 获取 access_token
    authTokens: {
        nogizaka: process.env.NOGIZAKA_REFRESH_TOKEN || '',
        sakurazaka: process.env.SAKURAZAKA_REFRESH_TOKEN || '',
        hinatazaka: process.env.HINATAZAKA_REFRESH_TOKEN || '',
    },

    // APP Refresh Tokens (UUID format)
    // 用于 /v2/update_token 刷新 access_token（不会顶掉手机登录）
    appTokens: {
        nogizaka: process.env.NOGIZAKA_APP_REFRESH_TOKEN || '',
        sakurazaka: process.env.SAKURAZAKA_APP_REFRESH_TOKEN || '',
        hinatazaka: process.env.HINATAZAKA_APP_REFRESH_TOKEN || '',
    },

    // Cloudflare R2 存储配置
    r2: {
        enabled: true,
        accountId: '1cafe874f4db08a7b74be38c8fd09872',
        accessKeyId: 'f61efa0d14e80173e7fa9be696507c4d',
        secretAccessKey: 'b5ec510f41cd648408ab0afce2123638951ed6a83ef54160922f1ef97ce72db0',
        bucket: '4msga',
        publicUrl: 'https://msgmedia.srzwyuu.workers.dev',
    },

    // Discord Webhook (已关闭)
    discordWebhook: '',

    // 翻译失败报警 Webhook
    discordAlertWebhook: 'https://discord.com/api/webhooks/1448890346787438726/B5Ua-DLBcYPfjE7TO2vi1yZIhpZBLT5LCNTfmsum8xxH_G0J5Ek3rhjqhj733JwYRuTy',

    // 成员推送规则
    // key: 成员名（日文）
    // value: { qqGroups: [群号], telegramChats: [chat_id], enabled: bool }
    memberPushRules: {
        // ========== 櫻坂46 四期生 (Telegram + Discord 推送) ==========
        '浅井 恋乃未': {
            telegramChats: ['-1003552370330'],
            discord: 'https://discord.com/api/webhooks/1454484540306489521/D7UdqElWP7Nw0Eu9rdZj0mzOabgoY4384N4uc91DV87FwIGm0-QX-9TjOjeuHs1v3QOP',
            enabled: true,
        },
        '稲熊 ひな': {
            telegramChats: ['-1003552370330'],
            discord: 'https://discord.com/api/webhooks/1454484928959086727/Yf3LbavoK675myiI0b6h1bxS2R2FMQf7gF_LRbQJeHd_4pJHpoFr4q3LLLesdRsqKYNo',
            enabled: true,
        },
        '勝又 春': {
            telegramChats: ['-1003552370330'],
            discord: 'https://discord.com/api/webhooks/1454484654097957079/yOZYAY91-IqrFXMVUAhD9zjvLQJPCC0Icf3szrmuFB8GdNZedqmu5MEym09D-Rxi4AC5',
            enabled: true,
        },
        '佐藤 愛桜': {
            telegramChats: ['-1003552370330'],
            discord: 'https://discord.com/api/webhooks/1454484333900464148/klp8n2VDHd2s_k0ESzb_4fKcwWHUJKvq48X4egxqpUUgr2KbcLIYE0q-efBK8-P88T8d',
            enabled: true,
        },
        '松本 和子': {
            telegramChats: ['-1003552370330'],
            discord: 'https://discord.com/api/webhooks/1454484462472663060/ZgGr2xfEPq9L96mBJydd1cBmWRS3JuzH9G-jQ_fR4dMMkPEv79147GopC_FxaOa2cpeD',
            enabled: true,
        },
        '目黒 陽色': {
            telegramChats: ['-1003552370330'],
            discord: 'https://discord.com/api/webhooks/1454485021829107840/46_vVa8n29dXWIVpO2cCX_bAxf2cAHXIf1-ioFciYBR9MBeqtnVWwaFGgttfSDnn-HcM',
            enabled: true,
        },
        '山田 桃実': {
            telegramChats: ['-1003552370330'],
            discord: 'https://discord.com/api/webhooks/1454484800185307340/5tB4pUVaokCTuKm0TdmEJz5EF1Z4-dMLJtYe6J3MX-A-nfUIA5jp0LnKFXkQa3oGZ2Uz',
            enabled: true,
        },
        '中川 智尋': {
            qqGroups: ['768670254', '1059030628'],
            telegramChats: ['-1003552370330'],
            discord: 'https://discord.com/api/webhooks/1454484196956438579/15zFtRkiEF0RQywZZcPeozm0MYRG-rV46YpIIx0eAdhsiudKVAttT1QIM9C6VKHaLk0U',
            enabled: true,
        },
        '山川 宇衣': {
            qqGroups: ['768670254', '1059030628', '839449823'],
            noTranslateGroups: ['839449823'],  // 只发原文，不翻译
            telegramChats: ['-1003552370330'],
            discord: 'https://discord.com/api/webhooks/1454483995768127539/JD_tDki51tJ_h8gQHaxDWvSHj4StK0EDceAcpkT7rJLhs_27jhi3NYvOHlnpny1frha8',
            enabled: true,
        },

        // ========== 日向坂46 ==========
        '正源司 陽子': {
            qqGroups: ['213658334', '768670254', '1059030628'],
            enabled: true,
        },
        '大野 愛実': {
            qqGroups: ['651181711', '768670254', '1059030628', '814798156'],
            enabled: true,
        },
        '高井 俐香': {
            qqGroups: ['768670254', '1059030628'],
            enabled: true,
        },
        '松尾 桜': {
            qqGroups: ['768670254', '1059030628'],
            enabled: true,
        },
        '佐藤 優羽': {
            qqGroups: ['768670254', '1004024029'],
            enabled: true,
        },

        // ========== 櫻坂46 (其他) ==========
        '山下 瞳月': {
            qqGroups: ['607520034', '768670254', '1059030628'],
            enabled: true,
        },
        '小田倉 麗奈': {
            qqGroups: ['768670254', '1059030628'],
            enabled: true,
        },
        '中嶋 優月': {
            qqGroups: ['768670254', '1059030628'],
            enabled: true,
        },


        // 未来添加
        // '山﨑天': {
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
