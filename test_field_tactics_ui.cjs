const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser to test Cricket Arena Field Tactics UI...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR:', msg.text());
    } else {
      console.log('PAGE LOG:', msg.text());
    }
  });

  try {
    console.log('Navigating to http://localhost:3000/ ...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });

    // Ensure state is initialized and set to match_simulation
    await page.evaluate(() => {
      if (window.__useGameStore) {
        const store = window.__useGameStore.getState();
        console.log('Current gameState:', store.gameState);
        
        // If not in a match, ensure we have teams/fixtures and set match_simulation
        const fixtureId = store.fixtures?.[0]?.id || 'fixture_1';
        if (store.setGameState) {
          window.__useGameStore.setState({
            currentMatchId: fixtureId,
            currentMatchToss: {
              winnerId: store.franchises?.[0]?.id || 'team_1',
              decision: 'Bat',
            },
            gameState: 'match_simulation'
          });
        }
      }
    });

    await new Promise(r => setTimeout(r, 2000));
    let screenshotPath = 'field_tactics_live_match.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot: ${screenshotPath}`);

    // Inspect elements rendered by CricketActionVisualizer
    const uiReport = await page.evaluate(() => {
      const text = document.body.innerText;
      const brandingFound = text.includes('CRICKET ARENA') && text.includes('FIELD TACTICS');
      const formatSelectors = Array.from(document.querySelectorAll('button'))
        .map(b => b.textContent?.trim() || '')
        .filter(t => ['T20', 'ODI', 'TEST'].includes(t));
      
      const tacticsPanel = text.includes('Bowling Plan') && text.includes('Tactical Intent');
      const bottomTabs = ['FIELD MAP', 'BOWLER PLAN', 'SCORING ZONES'].map(tab => ({
        tab,
        found: text.includes(tab)
      }));
      const fieldStatus = text.includes('FIELD READY') || text.includes('FIELD IN MOTION') || text.includes('FIELD CHANGING');
      const deliveryStatus = text.includes('DELIVERY LOCKED') || text.includes('READY FOR NEXT DELIVERY') || text.includes('READY FOR DELIVERY');
      
      const svg = document.querySelector('svg[viewBox="0 0 600 600"]');
      const svgElements = {
        hasSvg: Boolean(svg),
        rects: svg ? svg.querySelectorAll('rect').length : 0,
        circles: svg ? svg.querySelectorAll('circle').length : 0,
        lines: svg ? svg.querySelectorAll('line').length : 0,
        texts: svg ? svg.querySelectorAll('text').length : 0,
      };

      return {
        brandingFound,
        formatSelectors,
        tacticsPanel,
        bottomTabs,
        fieldStatus,
        deliveryStatus,
        svgElements
      };
    });

    console.log('UI Inspection Report:', JSON.stringify(uiReport, null, 2));

    // Test clicking format buttons (e.g. switch to TEST)
    console.log('Testing clicking TEST format button...');
    const testFormatBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent?.trim() === 'TEST');
    });

    if (testFormatBtn && testFormatBtn.asElement()) {
      await testFormatBtn.asElement().click();
      console.log('Clicked TEST format button. Waiting 1.5s for field repositioning...');
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: 'field_tactics_test_format.png' });
      console.log('Saved screenshot: field_tactics_test_format.png');
    }

    // Test clicking SCORING ZONES tab
    console.log('Testing clicking SCORING ZONES tab...');
    const scoringZonesTab = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent?.trim().toUpperCase() === 'SCORING ZONES');
    });

    if (scoringZonesTab && scoringZonesTab.asElement()) {
      await scoringZonesTab.asElement().click();
      console.log('Clicked SCORING ZONES tab. Waiting 1s...');
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: 'field_tactics_scoring_zones.png' });
      console.log('Saved screenshot: field_tactics_scoring_zones.png');
    }

    // Test clicking BOWLER PLAN tab
    console.log('Testing clicking BOWLER PLAN tab...');
    const bowlerPlanTab = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent?.trim().toUpperCase() === 'BOWLER PLAN');
    });

    if (bowlerPlanTab && bowlerPlanTab.asElement()) {
      await bowlerPlanTab.asElement().click();
      console.log('Clicked BOWLER PLAN tab. Waiting 1s...');
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: 'field_tactics_bowler_plan.png' });
      console.log('Saved screenshot: field_tactics_bowler_plan.png');
    }

    // Test clicking a tactical preset (e.g., Aggressive Slips)
    console.log('Testing clicking Aggressive Slips preset...');
    const presetBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent?.includes('Aggressive Slips'));
    });

    if (presetBtn && presetBtn.asElement()) {
      await presetBtn.asElement().click();
      console.log('Clicked Aggressive Slips preset. Capturing movement...');
      await new Promise(r => setTimeout(r, 400));
      await page.screenshot({ path: 'field_tactics_movement_in_action.png' });
      console.log('Saved screenshot: field_tactics_movement_in_action.png');
      await new Promise(r => setTimeout(r, 1600));
      await page.screenshot({ path: 'field_tactics_movement_settled.png' });
      console.log('Saved screenshot: field_tactics_movement_settled.png');
    }

    console.log('All browser verification steps completed successfully!');
  } catch (err) {
    console.error('Puppeteer verification failed:', err);
  } finally {
    await browser.close();
  }
})();
