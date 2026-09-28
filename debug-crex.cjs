/**
 * intercept-search-api.cjs
 * Uses Puppeteer to intercept the exact network call CREX makes
 * when search results load, revealing the search API endpoint.
 */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });

  // Capture ALL goscorer requests
  const captured = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('goscorer')) {
      captured.push({ type: 'req', method: req.method(), url, body: req.postData() });
    }
  });
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('goscorer')) {
      try {
        const body = await res.text();
        captured.push({ type: 'res', url, status: res.status(), body: body.slice(0, 600) });
      } catch (_) {}
    }
  });

  // Load the search results page directly - try different URL patterns
  console.log('Loading crex.com/search?q=...');
  await page.goto('https://crex.com/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // The app is Angular - navigate via the router instead of direct URL
  // Try clicking on the search icon/area
  const clickTargets = [
    '.search', '#search', '[class*="search"]', '[placeholder*="earch"]',
    'button[class*="search"]', 'svg[class*="search"]', '.fa-search',
    '[aria-label*="search"]', 'a[href*="search"]'
  ];

  let found = false;
  for (const sel of clickTargets) {
    const el = await page.$(sel).catch(() => null);
    if (el) {
      console.log('Clicking:', sel);
      await el.click().catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      found = true;
      break;
    }
  }

  // Also try navigating via Angular router by setting location
  await page.evaluate(() => {
    if (window.history) {
      window.history.pushState({}, '', '/search?q=Phil+Salt');
    }
  });
  await new Promise(r => setTimeout(r, 3000));

  // Now type in any input that appears
  const inp = await page.$('input');
  if (inp) {
    console.log('Found input, typing...');
    await inp.click();
    await inp.type('Phil Salt', { delay: 100 });
    await new Promise(r => setTimeout(r, 4000));
  } else {
    // Try XHR intercept by calling Angular's router directly
    await page.evaluate(() => {
      // Try to use Angular's router
      const appRoot = document.querySelector('app-root');
      if (appRoot && appRoot.__ngContext__) {
        console.log('Has angular context');
      }
    });
  }

  // Print all captured goscorer calls
  console.log('\n=== CAPTURED GOSCORER CALLS ===');
  for (const c of captured) {
    if (c.type === 'req') {
      console.log(`[REQ] ${c.method} ${c.url}`);
      if (c.body) console.log(`  Body: ${c.body.slice(0, 200)}`);
    } else {
      console.log(`[RES] ${c.status} ${c.url}`);
      console.log(`  Body: ${c.body.slice(0, 300)}`);
    }
  }

  // Also look at the JS source code embedded in the page for API URLs
  console.log('\n=== SCANNING PAGE SOURCE FOR API CALLS ===');
  const pageSource = await page.evaluate(() => document.documentElement.innerHTML);
  const goScorerRefs = [...pageSource.matchAll(/goscorer[^\s"'<>]{0,100}/g)].map(m => m[0]);
  console.log('goscorer refs in DOM:', [...new Set(goScorerRefs)].slice(0, 20));

  const apiRefs = [...pageSource.matchAll(/api\/v\d\/[a-zA-Z]+/g)].map(m => m[0]);
  console.log('API refs in DOM:', [...new Set(apiRefs)].slice(0, 20));

  await browser.close();
})();
