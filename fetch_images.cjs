const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

const tsPath = './src/data/intlCrexImages.ts';

// Extract current mapped IDs
let oldTs = fs.readFileSync(tsPath, 'utf8');
const existingMap = {};
const regex = /'([^']+)':\s*'([^']+)'/g;
let match;
while ((match = regex.exec(oldTs)) !== null) {
  existingMap[match[1]] = match[2];
}

const playersTsPath = './src/data/intlPlayers.ts';
const playersTs = fs.readFileSync(playersTsPath, 'utf8');
const playerNames = new Set();
const pRegex = /intlPlayer\('[^']+',\s*'([^']+)'/g;
while ((match = pRegex.exec(playersTs)) !== null) {
  playerNames.add(match[1]);
}

const missingPlayers = [...playerNames].filter(name => !existingMap[name]);
console.log(`Total players: ${playerNames.size}`);
console.log(`Already mapped: ${Object.keys(existingMap).length}`);
console.log(`Missing to fetch: ${missingPlayers.length}`);

(async () => {
  if (missingPlayers.length === 0) {
    console.log('All players already mapped!');
    return;
  }
  
  console.log('Launching stealth browser...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const newMappings = {};
  
  // Test first 5 to see if stealth works
  for (let i = 0; i < Math.min(5, missingPlayers.length); i++) {
    const name = missingPlayers[i];
    console.log(`Fetching [${i+1}/${missingPlayers.length}]: ${name}`);
    const searchUrl = `https://crex.live/search?q=${encodeURIComponent(name)}`;
    
    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 1000));
      
      const html = await page.content();
      const m = html.match(/\/player\/([^"'\s]+)/);
      if (m) {
        const crexId = m[1].split('/')[0];
        console.log(` -> FOUND: ${crexId}`);
        newMappings[name] = crexId;
      } else {
        console.log(` -> NOT FOUND`);
      }
    } catch (e) {
      console.log(` -> ERROR: ${e.message}`);
    }
  }
  
  await browser.close();
  console.log('Found new mappings:', newMappings);
})();
