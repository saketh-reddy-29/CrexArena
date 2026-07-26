const https = require('https');
const fs = require('fs');

const fetchUrl = (url) => new Promise((resolve) => {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve(data));
  });
});

(async () => {
  const html = await fetchUrl('https://crex.live/team/286/chennai-super-kings');
  const jsFiles = html.match(/\/_[^"'\s]+\.js/g) || [];
  
  const allUrls = new Set();
  for (const js of jsFiles) {
    const jsContent = await fetchUrl(`https://crex.live${js}`);
    const urls = jsContent.match(/https:\/\/cricketvectors\.akamaized\.net[^"'\s()]+/g) || [];
    urls.forEach(u => allUrls.add(u));
  }
  
  console.log(Array.from(allUrls).join('\n'));
})();
