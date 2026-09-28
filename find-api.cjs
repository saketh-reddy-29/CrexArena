// find-api-endpoint.cjs - Discover search API by reading the CREX JS bundle
const https = require('https');

function get(url) {
  return new Promise((res, rej) => {
    const opts = new URL(url);
    const req = https.get({
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Origin': 'https://crex.com',
        'Referer': 'https://crex.com/',
      }
    }, r => {
      let data = '';
      r.on('data', chunk => data += chunk);
      r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: data }));
    });
    req.on('error', rej);
    req.end();
  });
}

(async () => {
  console.log('Fetching crex.com homepage...');
  const home = await get('https://crex.com/');
  console.log('Status:', home.status);
  
  // Find JS scripts
  const scriptMatches = home.body.match(/src="([^"]+\.js[^"]*)"/g) || [];
  console.log('Script tags found:', scriptMatches.length);
  
  const scriptUrls = scriptMatches
    .map(s => s.replace(/src="/, '').replace(/"$/, ''))
    .filter(s => s.startsWith('http') || s.startsWith('/'));
  
  console.log('Script URLs:', scriptUrls.slice(0, 10));
  
  // Fetch the main bundle and search for API endpoints
  for (const url of scriptUrls.slice(0, 5)) {
    const fullUrl = url.startsWith('http') ? url : `https://crex.com${url}`;
    try {
      console.log(`\nFetching: ${fullUrl}`);
      const script = await get(fullUrl);
      // Search for goscorer API calls
      const apiMatches = script.body.match(/goscorer[^\s"']+/g) || [];
      const searchMatches = script.body.match(/['"](\/api\/v[^'"]+search[^'"]*)['"]/gi) || [];
      const playerMatches = script.body.match(/['"](\/api\/v[^'"]+player[^'"]*)['"]/gi) || [];
      console.log('goscorer refs:', [...new Set(apiMatches)].slice(0, 5));
      console.log('search API refs:', [...new Set(searchMatches)].slice(0, 5));
      console.log('player API refs:', [...new Set(playerMatches)].slice(0, 5));
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
  
  // Also try common goscorer endpoints we haven't tried
  const moreEndpoints = [
    'https://api.goscorer.com/api/v3/getSearchData?query=Phil+Salt',
    'https://api.goscorer.com/api/v3/globalSearch?query=Phil+Salt',
    'https://api.goscorer.com/api/v3/getTypeSearch?query=Phil+Salt&type=player',
    'https://api.goscorer.com/api/v3/searchPlayer?name=Phil+Salt',
    'https://api.goscorer.com/api/v4/search?q=Phil+Salt',
    'https://api.goscorer.com/api/v3/getPlayerDetails?name=Phil+Salt',
    'https://api.goscorer.com/api/v3/getAllSearch?query=Phil+Salt',
  ];
  
  console.log('\n\nTrying more endpoint guesses...');
  for (const url of moreEndpoints) {
    try {
      const r = await get(url);
      console.log(`${url} -> ${r.status}: ${r.body.slice(0, 150)}`);
    } catch (e) {
      console.log(`${url} -> ERROR: ${e.message}`);
    }
  }
})();
