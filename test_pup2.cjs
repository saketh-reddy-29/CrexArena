const puppeteer = require('puppeteer');

(async () => {
  try {
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.goto('https://crex.live/series/icc-champions-trophy-2025-26Y/team-squad', { waitUntil: 'networkidle2' });
      const html = await page.content();
      console.log(html.substring(0, 300));
      await browser.close();
  } catch (e) {
      console.log('ERROR:', e.message);
  }
})();
