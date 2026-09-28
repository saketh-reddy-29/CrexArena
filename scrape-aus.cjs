const puppeteer = require('puppeteer');

const URLS = [
  'https://crex.live/series/australia-tour-of-england-2025-275/team-squad',
  'https://crex.live/series/pakistan-tour-of-australia-2025-27H/team-squad',
  'https://crex.live/series/icc-mens-t20-world-cup-2024-1Z4/team-squad',
  'https://crex.live/series/icc-cricket-world-cup-2023-1KY/team-squad'
];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const ids = {};
  
  for (const url of URLS) {
    console.log('Scraping: ' + url);
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));
      
      const result = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/player/"]'));
        const players = {};
        links.forEach(link => {
          const href = link.getAttribute('href');
          let name = link.textContent?.trim();
          const img = link.querySelector('img');
          const imgSrc = img?.src || '';
          const idMatch = imgSrc.match(/\/org\/([^\.]+)\.png/);
          
          if (idMatch && name) {
             name = name.split('\n')[0].trim();
             players[name] = idMatch[1];
          }
        });
        return players;
      });
      
      for (const [name, id] of Object.entries(result)) {
        if (!ids[name]) ids[name] = id;
      }
    } catch(e) {
      console.log('Error: ' + e.message);
    }
  }
  
  console.log(JSON.stringify(ids, null, 2));
  await browser.close();
  process.exit(0);
})();
