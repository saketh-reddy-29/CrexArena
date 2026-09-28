// match-from-sitemap.cjs
// Download the player sitemap and match it against our missing players
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MISSING_FILE = path.join(__dirname, 'still-missing.txt');
const OUTPUT_TS = path.join(__dirname, 'src/data/intlCrexImages.ts');

if (!fs.existsSync(MISSING_FILE)) {
  console.log('No missing players found.');
  process.exit(0);
}

const MISSING = new Set(
  fs.readFileSync(MISSING_FILE, 'utf8').split('\n').map(p => p.trim().replace(/^- /, '')).filter(p => p)
);
console.log(`Looking for ${MISSING.size} missing players...`);

function loadExisting() {
  if (!fs.existsSync(OUTPUT_TS)) return {};
  const content = fs.readFileSync(OUTPUT_TS, 'utf8');
  const existing = {};
  const re = /"([^"]+)":\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(content)) !== null) existing[m[1]] = m[2];
  return existing;
}

function writeOutput(merged) {
  const sorted = Object.entries(merged).sort((a, b) => a[0].localeCompare(b[0]));
  const entries = sorted.map(([n, id]) => `  "${n}": "${id}"`).join(',\n');
  fs.writeFileSync(OUTPUT_TS, `// International players CREX IDs (auto-scraped)\nexport const INTL_PLAYER_CREX_IDS: Record<string, string> = {\n${entries}\n};\n`);
}

const MISSING_NORM = new Map();
for (const name of MISSING) {
  const norm = name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  MISSING_NORM.set(norm, name);
}

function findMatch(slugWords, id) {
  const slugSet = new Set(slugWords);
  for (const [norm, original] of MISSING_NORM) {
    const words = norm.split(' ');
    // Exact word match
    if (words.every(w => slugSet.has(w))) return { matched: original, id };
    // Initials / first and last name match
    if (words.length >= 2 && slugSet.has(words[0]) && slugSet.has(words[words.length - 1])) {
      return { matched: original, id };
    }
  }
  return null;
}

(async () => {
  console.log('Downloading player.xml...');
  
  const xml = await new Promise((resolve, reject) => {
    https.get('https://crex.com/crex_sitemap/player.xml', { headers: { 'Accept-Encoding': 'gzip' } }, res => {
      let stream = res;
      if (res.headers['content-encoding'] === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      }
      let d = '';
      stream.on('data', c => d += c);
      stream.on('end', () => resolve(d));
      stream.on('error', reject);
    }).on('error', reject);
  });

  console.log(`Downloaded ${xml.length} bytes. Parsing...`);
  
  // Extract all player URLs
  const urls = [...xml.matchAll(/<loc>(https:\/\/crex\.com\/player\/[^<]+)<\/loc>/g)].map(m => m[1]);
  console.log(`Found ${urls.length} player URLs in sitemap.`);

  let foundCount = 0;
  const allFound = {};
  const existing = loadExisting();

  for (const url of urls) {
    const path = url.replace('https://crex.com/player/', '');
    const parts = path.split('-');
    if (parts.length < 2) continue;
    
    const id = parts[parts.length - 1];
    const words = parts.slice(0, -1);
    
    const match = findMatch(words, id);
    if (match && !allFound[match.matched]) {
      allFound[match.matched] = match.id;
      foundCount++;
      console.log(`✅ "${match.matched}" -> "${match.id}" (from ${path})`);
      
      // Stop early if we found everyone
      if (foundCount === MISSING.size) {
        console.log('Found all missing players!');
        break;
      }
    }
  }

  console.log(`\nFound ${foundCount} out of ${MISSING.size} missing players.`);
  
  if (foundCount > 0) {
    const merged = { ...existing, ...allFound };
    writeOutput(merged);
    console.log(`Updated intlCrexImages.ts. Total mapped: ${Object.keys(merged).length}`);
    
    const stillMissing = [...MISSING].filter(n => !allFound[n]);
    if (stillMissing.length > 0) {
      fs.writeFileSync(MISSING_FILE, stillMissing.map(n => `- ${n}`).join('\n'));
      console.log(`${stillMissing.length} players still missing.`);
    } else {
      fs.unlinkSync(MISSING_FILE);
      console.log('No more missing players!');
    }
  }
})();
