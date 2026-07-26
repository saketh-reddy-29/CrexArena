const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://crex.live/team/286/chennai-super-kings/squad', { waitUntil: 'networkidle2' });
  const html = await page.content();
  const urls = html.match(/https:\/\/cricketvectors[^"'\s()]+/g);
  console.log([...new Set(urls)].join('\n'));
  await browser.close();
})();
