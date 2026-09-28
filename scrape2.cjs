const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const players = ['Steve Smith', 'David Warner', 'Marnus Labuschagne', 'Glenn Maxwell', 'Adam Zampa', 'Alex Carey', 'Nathan Ellis'];
  for (const player of players) {
    try {
      await page.goto(`https://duckduckgo.com/html/?q=site:crex.live/player-profile+${encodeURIComponent(player)}`);
      await page.waitForSelector('a.result__url', {timeout: 5000});
      const urls = await page.evaluate(() => Array.from(document.querySelectorAll('a.result__url')).map(a => a.href));
      const crexUrl = urls.find(u => u.includes('crex.live/player-profile/'));
      if (crexUrl) {
         const match = decodeURIComponent(crexUrl).match(/player-profile\/[^\/]+-([A-Za-z0-9]+)/);
         if (match) console.log(`FOUND: ${player} -> ${match[1]}`);
         else console.log(`URL format mismatch for ${player}: ${crexUrl}`);
      } else {
         console.log(`Not found for ${player}`);
      }
    } catch(e) {
      console.log(`Error for ${player}: ${e.message}`);
    }
  }
  await browser.close();
})();
