const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Go to MI page
  await page.goto('https://crex.live/team/278/mumbai-indians/squad', { waitUntil: 'networkidle2' });
  
  const urls = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img'));
    return images.map(img => img.src).filter(src => src.includes('cricketvectors'));
  });
  
  console.log('Images for MI:', [...new Set(urls)]);
  
  await browser.close();
})();
