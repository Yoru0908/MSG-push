require('dotenv').config();
const translator = require('./src/translator');

async function test() {
    console.log('Testing translation...');
    const text = '今日はミーグリありがとうございました！楽しかった〜';
    const member = '大野 愛実';

    const res = await translator.translate(text, member);
    console.log('Result:\n', res);
}

test();
