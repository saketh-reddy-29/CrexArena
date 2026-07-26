const fs = require('fs');
const html = fs.readFileSync('crex_csk.html', 'utf8');
const urls = html.match(/https?:\/\/[^"'\s]+\.(?:png|jpg|webp|svg)/gi) || [];
console.log(Array.from(new Set(urls)).join('\n'));
