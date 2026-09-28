// find-archive-series.cjs
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto('https://crex.com/series/archive', { waitUntil: 'networkidle2', timeout: 25000 });
  await new Promise(r => setTimeout(r, 4000));

  const seriesLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/series/"]'))
      .map(a => ({ href: a.getAttribute('href'), text: a.textContent?.trim() }))
      .filter(l => l.href && l.href.includes('/series/'))
  });

  console.log(`Found ${seriesLinks.length} series links on archive page:`);
  seriesLinks.filter(l => l.text && (l.text.includes('World Cup') || l.text.includes('T20') || l.text.includes('tour'))).forEach(l => console.log(`  ${l.href}  |  "${l.text}"`));

  await browser.close();
})();
