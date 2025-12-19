/**
 * PaddleOCR-VL 图片文字识别模块
 * 使用百度 AI Studio 托管的 OCR API
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// PaddleOCR-VL API 配置
const API_URL = process.env.PADDLEOCR_API_URL || 'https://rbpfmbf2f7s5gadd.aistudio-app.com/layout-parsing';
const TOKEN = process.env.PADDLEOCR_TOKEN || '905c6985c71e7e57547cca13a7c579ca067744c4';

/**
 * 识别图片中的文字
 * @param {string} imagePath - 本地图片路径
 * @returns {Promise<string>} - 识别出的文字内容
 */
async function recognizeImage(imagePath) {
    if (!fs.existsSync(imagePath)) {
        throw new Error(`图片文件不存在: ${imagePath}`);
    }

    try {
        // 读取图片并转为 base64
        const imageData = fs.readFileSync(imagePath);
        const base64Data = imageData.toString('base64');

        // 调用 API
        const response = await axios.post(API_URL, {
            file: base64Data,
            fileType: 1,  // 1=图片, 0=PDF
            useDocOrientationClassify: false,
            useDocUnwarping: false,
            useChartRecognition: false,
        }, {
            headers: {
                'Authorization': `token ${TOKEN}`,
                'Content-Type': 'application/json',
            },
            timeout: 60000,  // 60秒超时
        });

        if (response.status !== 200) {
            throw new Error(`OCR API 返回错误: ${response.status}`);
        }

        const result = response.data.result;

        if (!result || !result.layoutParsingResults || result.layoutParsingResults.length === 0) {
            return '';
        }

        // 提取识别的文字（Markdown 格式）
        const text = result.layoutParsingResults
            .map(res => res.markdown?.text || '')
            .join('\n')
            .trim();

        return text;
    } catch (error) {
        console.error('   ⚠️ OCR 识别失败:', error.message);
        if (error.response) {
            console.error('   响应:', JSON.stringify(error.response.data));
        }
        return '';
    }
}

/**
 * 从 URL 下载图片并识别
 * @param {string} imageUrl - 图片 URL
 * @returns {Promise<string>} - 识别出的文字内容
 */
async function recognizeImageFromUrl(imageUrl) {
    try {
        // 下载图片
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
        });

        // 转为 base64
        const base64Data = Buffer.from(response.data).toString('base64');

        // 调用 API
        const ocrResponse = await axios.post(API_URL, {
            file: base64Data,
            fileType: 1,
            useDocOrientationClassify: false,
            useDocUnwarping: false,
            useChartRecognition: false,
        }, {
            headers: {
                'Authorization': `token ${TOKEN}`,
                'Content-Type': 'application/json',
            },
            timeout: 60000,
        });

        if (ocrResponse.status !== 200) {
            throw new Error(`OCR API 返回错误: ${ocrResponse.status}`);
        }

        const result = ocrResponse.data.result;

        if (!result || !result.layoutParsingResults || result.layoutParsingResults.length === 0) {
            return '';
        }

        const text = result.layoutParsingResults
            .map(res => res.markdown?.text || '')
            .join('\n')
            .trim();

        return text;
    } catch (error) {
        console.error('   ⚠️ OCR 识别失败:', error.message);
        return '';
    }
}

/**
 * 从 base64 数据识别
 * @param {string} base64Data - 图片的 base64 数据
 * @returns {Promise<string>} - 识别出的文字内容
 */
async function recognizeImageFromBase64(base64Data) {
    try {
        const response = await axios.post(API_URL, {
            file: base64Data,
            fileType: 1,
            useDocOrientationClassify: false,
            useDocUnwarping: false,
            useChartRecognition: false,
        }, {
            headers: {
                'Authorization': `token ${TOKEN}`,
                'Content-Type': 'application/json',
            },
            timeout: 60000,
        });

        if (response.status !== 200) {
            throw new Error(`OCR API 返回错误: ${response.status}`);
        }

        const result = response.data.result;

        if (!result || !result.layoutParsingResults || result.layoutParsingResults.length === 0) {
            return '';
        }

        const text = result.layoutParsingResults
            .map(res => res.markdown?.text || '')
            .join('\n')
            .trim();

        return text;
    } catch (error) {
        console.error('   ⚠️ OCR 识别失败:', error.message);
        return '';
    }
}

module.exports = {
    recognizeImage,
    recognizeImageFromUrl,
    recognizeImageFromBase64,
};

// 如果直接运行此文件，进行测试
if (require.main === module) {
    const testImagePath = process.argv[2];
    if (testImagePath) {
        recognizeImage(testImagePath).then(text => {
            console.log('识别结果:');
            console.log(text);
        });
    } else {
        console.log('用法: node ocr.js <图片路径>');
    }
}
