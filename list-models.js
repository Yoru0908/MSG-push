require('dotenv').config();
const axios = require('axios');

async function listModels() {
    try {
        const res = await axios.get('https://openrouter.ai/api/v1/models');
        const models = res.data.data;
        console.log('Found models:', models.length);

        const deepseekModels = models.filter(m => m.id.includes('deepseek') || m.id.includes('tng'));
        deepseekModels.forEach(m => {
            console.log(`- ${m.id} (${m.pricing.prompt === '0' ? 'FREE' : 'PAID'})`);
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
}

listModels();
