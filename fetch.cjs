const https = require('https');
https.get('https://crex.live/team/286/chennai-super-kings', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const urls = data.match(/https:\/\/cricketvectors\.akamaized\.net[^"'\s]*(?:jersey|team|logo|Series\/Jersey)[^"'\s]*/gi);
    console.log(Array.from(new Set(urls)).join('\n'));
  });
});
