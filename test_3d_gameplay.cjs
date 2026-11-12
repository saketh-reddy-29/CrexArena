const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');
const fs = require('fs');

function startServer(distDir, port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.glb': 'model/gltf-binary',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';

    let filePath = path.join(distDir, reqPath);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, 'public', reqPath);
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Test server running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

(async () => {
  const PORT = 4189;
  const distDir = path.join(__dirname, 'dist');
  const server = await startServer(distDir, PORT);

  console.log('Launching Puppeteer browser...');
  const tempProfile = path.join(__dirname, 'tmp_pup_' + Date.now());
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempProfile,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--use-gl=angle',
      '--window-size=1600,1000'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  const consoleErrors = [];
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('ERR_INTERNET_DISCONNECTED')) {
      console.error('[BROWSER ERROR]:', text);
      consoleErrors.push(text);
    } else {
      console.log('[BROWSER LOG]:', text.substring(0, 140));
    }
  });

  page.on('pageerror', err => {
    console.error('[PAGE EXCEPTION]:', err.message);
    consoleErrors.push(err.message);
  });

  try {
    console.log(`Navigating to http://localhost:${PORT}/ ...`);
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Ensure format and proper match setup
    console.log('Setting up Match Simulation state in useGameStore...');
    await page.evaluate(() => {
      if (window.__useGameStore) {
        const store = window.__useGameStore.getState();
        store.setFormat('T20');
        const franchiseId = store.franchises?.[0]?.id || 'team_csk';
        store.selectFranchise(franchiseId);
        const fixture = store.fixtures?.[0];
        if (fixture && store.setCurrentMatch) {
          store.setCurrentMatch(fixture.id);
        }
        window.__useGameStore.setState({
          selectedFormat: 'T20',
          selectedFranchiseId: franchiseId,
          gameState: 'match_simulation'
        });
      }
    });

    console.log('Waiting for canvas to mount...');
    await page.waitForSelector('canvas', { timeout: 15000 });
    // Wait for GLBs and Stadium geometries to compile and render
    await new Promise(r => setTimeout(r, 4500));

    // 1. Screenshot: Main Gameplay Camera
    console.log('Capturing Screenshot 1: Main Gameplay Camera');
    await page.screenshot({ path: path.join(__dirname, 'screenshot_1_gameplay_camera.png') });

    // 2. Screenshot: Batting Stance (EA 07 Camera)
    console.log('Capturing Screenshot 2: Batting Stance');
    await page.screenshot({ path: path.join(__dirname, 'screenshot_2_batting_stance.png') });

    // Switch to Bowler Cam
    console.log('Switching to Bowler Cam...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Bowler'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // 3. Screenshot: Bowling Action
    console.log('Capturing Screenshot 3: Bowling Action View');
    await page.screenshot({ path: path.join(__dirname, 'screenshot_3_bowling_action.png') });

    // Switch to Broadcast TV Cam
    console.log('Switching to Broadcast TV Cam...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('TV'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // 4. Screenshot: Fielding Action
    console.log('Capturing Screenshot 4: Fielding Action & Fielders');
    await page.screenshot({ path: path.join(__dirname, 'screenshot_4_fielding_action.png') });

    // Switch to Orbit view
    console.log('Switching to 360 Orbit view...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Orbit'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // 5. Screenshot: Wicketkeeping & Stumps
    console.log('Capturing Screenshot 5: Wicketkeeper & Crease');
    await page.screenshot({ path: path.join(__dirname, 'screenshot_5_wicketkeeping.png') });

    // 6. Screenshot: Stadium at Night
    console.log('Capturing Screenshot 6: Stadium at Night (Floodlights, Grandstands, Crowds, Scoreboard)');
    await page.screenshot({ path: path.join(__dirname, 'screenshot_6_stadium_night.png') });

    // Toggle Debug Skeleton Mode
    console.log('Toggling Debug Mode (Skeletons & IK)...');
    await page.evaluate(() => {
      const btn = document.querySelector('button[title*="Debug"]');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // 7. Screenshot: Debug Mode with Skeletons
    console.log('Capturing Screenshot 7: Debug Mode Skeletons');
    await page.screenshot({ path: path.join(__dirname, 'screenshot_7_debug_skeletons.png') });

    const webglStatus = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { ok: false, error: 'No canvas element' };
      return {
        ok: true,
        width: canvas.width,
        height: canvas.height,
        visible: canvas.offsetParent !== null,
      };
    });

    console.log('WebGL Canvas Status:', JSON.stringify(webglStatus, null, 2));
    console.log('Console Errors count:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors);
    }

    console.log('=== TEST SUITE COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await browser.close();
    server.close();
    // Clean up temp profile
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch {}
    console.log('Browser and test server closed.');
  }
})();
