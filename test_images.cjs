const https = require('https');
const ids = ['8E', '8C', '8D', '16T', '1C', '31C', '1K0', '5F9', '20O'];
let pending = ids.length;
ids.forEach(id => {
  https.request({
    method: 'HEAD',
    hostname: 'cricketvectors.akamaized.net',
    path: '/players/org/' + id + '.png'
  }, res => {
    console.log(id + ' -> ' + res.statusCode);
    if (--pending === 0) process.exit(0);
  }).end();
});
