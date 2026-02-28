/**
 * Cloudflare R2 存储模块
 * 用于上传媒体文件到 R2，获取公开 URL
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const path = require('path');
const crypto = require('crypto');

let pushConfig = require('./push-config');

// 创建 S3 客户端（R2 兼容）
function getS3Client() {
    const r2Config = pushConfig.r2;
    if (!r2Config?.enabled) return null;

    return new S3Client({
        region: 'auto',
        endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: r2Config.accessKeyId,
            secretAccessKey: r2Config.secretAccessKey,
        },
    });
}

/**
 * 上传媒体到 R2
 * @param {string} fileUrl - 源文件 URL
 * @param {string} memberName - 成员名
 * @param {string} mediaType - 媒体类型 (image/video/voice)
 * @returns {string|null} - 公开 URL 或 null
 */
async function uploadToR2(fileUrl, memberName, mediaType) {
    const r2Config = pushConfig.r2;
    if (!r2Config?.enabled) {
        console.log('   ⚠️ R2 未启用');
        return null;
    }

    try {
        const s3Client = getS3Client();
        if (!s3Client) return null;

        // 下载文件
        console.log(`   📥 下载媒体: ${fileUrl.substring(0, 50)}...`);
        const response = await axios.get(fileUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
        });

        // 确定文件扩展名和 Content-Type
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        let ext = '.bin';
        if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) ext = '.jpg';
        else if (contentType.includes('image/png')) ext = '.png';
        else if (contentType.includes('image/gif')) ext = '.gif';
        else if (contentType.includes('image/webp')) ext = '.webp';
        else if (contentType.includes('video/mp4')) ext = '.mp4';
        else if (contentType.includes('video/quicktime')) ext = '.mov';
        else if (contentType.includes('audio/mpeg')) ext = '.mp3';
        else if (contentType.includes('audio/mp4')) ext = '.m4a';
        else if (contentType.includes('audio/aac')) ext = '.aac';

        // 生成唯一文件名
        const hash = crypto.createHash('md5').update(fileUrl).digest('hex').substring(0, 8);
        const timestamp = Date.now();
        const safeMemberName = memberName.replace(/\s+/g, '_');
        const fileName = `${safeMemberName}/${timestamp}_${hash}${ext}`;

        // 上传到 R2
        console.log(`   📤 上传到 R2: ${fileName}`);
        const command = new PutObjectCommand({
            Bucket: r2Config.bucket,
            Key: fileName,
            Body: Buffer.from(response.data),
            ContentType: contentType,
        });

        await s3Client.send(command);

        // 返回公开 URL
        const publicUrl = `${r2Config.publicUrl}/${fileName}`;
        console.log(`   ✅ R2 上传成功: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error(`   ❌ R2 上传失败:`, error.message);
        return null;
    }
}

const avatarCache = {}; // 内存缓存

/**
 * 上传头像到 R2 (转为 JPG)
 * @param {string} fileUrl - 源头像 URL
 * @param {string} memberName - 成员名
 * @returns {string|null} - R2 URL
 */
async function uploadAvatar(fileUrl, memberName) {
    const r2Config = pushConfig.r2;
    if (!r2Config?.enabled) return fileUrl;

    // 如果已经是支持的格式，直接返回
    if (!fileUrl.endsWith('.jfif')) return fileUrl;

    // 检查缓存
    if (avatarCache[fileUrl]) return avatarCache[fileUrl];

    try {
        const s3Client = getS3Client();
        if (!s3Client) return fileUrl;

        // 生成固定文件名 (avatars/Name.jpg)
        const safeMemberName = memberName.replace(/\s+/g, '_');
        const fileName = `avatars/${safeMemberName}.jpg`;
        const publicUrl = `${r2Config.publicUrl}/${fileName}`;

        // 检查缓存（为了避免重复上传，我们假设如果生成过就不再传，或者由调用者控制）
        // 这里简化：每次重启 APP 后首次遇到都会上传覆盖一次

        console.log(`   📥 转存头像: ${memberName} -> R2`);
        const response = await axios.get(fileUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const command = new PutObjectCommand({
            Bucket: r2Config.bucket,
            Key: fileName,
            Body: Buffer.from(response.data),
            ContentType: 'image/jpeg', // 强制 JPG
            CacheControl: 'max-age=86400' // 缓存一天
        });

        await s3Client.send(command);
        console.log(`   ✅ 头像已转存: ${publicUrl}`);

        avatarCache[fileUrl] = publicUrl;
        return publicUrl;
    } catch (error) {
        console.error(`   ❌ 头像转存失败:`, error.message);
        return fileUrl; // 失败回退到原 URL
    }
}

// 定期重新加载配置
setInterval(() => {
    try {
        const configPath = require.resolve('./push-config');
        delete require.cache[configPath];
        pushConfig = require('./push-config');
    } catch (e) {
        // 忽略
    }
}, 5 * 60 * 1000);

module.exports = {
    uploadToR2,
    uploadAvatar,
};
