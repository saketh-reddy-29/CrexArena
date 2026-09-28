const fs = require('fs');

const playersList = fs.readFileSync('missing_faces.txt', 'utf8').split('\n').map(p => p.trim()).filter(p => p);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function findCode(name) {
  try {
    const search = await fetch(
      `https://crex.live/search?q=${encodeURIComponent(name)}`, { headers: HEADERS }
    );
    const searchHtml = await search.text();

    const linkMatch = searchHtml.match(/\/player(?:-profile)?\/([a-z0-9\-]+)/i);
    if (!linkMatch) return { name, code: null, reason: 'no profile link' };

    const profile = await fetch(`https://crex.live/player/${linkMatch[1]}`, { headers: HEADERS });
    const profileHtml = await profile.text();

    const imgMatch = profileHtml.match(
      /cricketvectors\.akamaized\.net\/players\/org\/([A-Za-z0-9\-]+)\.png/
    );
    if (imgMatch) return { name, code: imgMatch[1] };

    const slugParts = linkMatch[1].split('-');
    const lastPart = slugParts[slugParts.length - 1];
    if (lastPart && lastPart.length <= 5) {
      return { name, code: lastPart, reason: 'from slug' };
    }

    return { name, code: null, reason: 'no image url found' };
  } catch (e) {
    return { name, code: null, reason: e.message };
  }
}

(async () => {
  const results = [];
  console.log(`Starting extraction for ${playersList.length} players...`);
  
  // We'll process in chunks of 5 to speed up
  for (let i = 0; i < playersList.length; i += 5) {
    const chunk = playersList.slice(i, i + 5);
    const chunkResults = await Promise.all(chunk.map(name => findCode(name)));
    for (const r of chunkResults) {
      results.push(r);
      console.log(r.code ? `✓ "${r.name}": "${r.code}"` : `✗ "${r.name}": // ${r.reason}`);
    }
    await sleep(500); // 500ms delay between chunks
  }

  const resolved = results.filter(r => r.code);
  const out = resolved.map(r => `  "${r.name}": "${r.code}",`).join('\n');

  fs.writeFileSync('crex-codes-resolved.txt',
    `// ${resolved.length}/${playersList.length} resolved\n${out}\n`);

  console.log(`\nDone: ${resolved.length}/${playersList.length} resolved -> crex-codes-resolved.txt`);
})();
