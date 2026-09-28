const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting puppeteer...');
  try {
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.goto('https://crex.live/search?q=Virat+Kohli', { waitUntil: 'networkidle2' });
      const html = await page.content();
      console.log(html.substring(0, 300));
      
      const match = html.match(/\/player\/([^"'\s]+)/);
      if (match) {
        console.log('FOUND:', match[1]);
      } else {
        console.log('NOT FOUND');
      }
      await browser.close();
  } catch (e) {
      console.log('ERROR:', e.message);
  }
})();
