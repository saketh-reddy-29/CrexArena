const puppeteer = require('puppeteer');
const fs = require('fs');

// On CREX, international team squads are on series pages, not team pages.
// Player link format: /player/{player-name}-{ID}
// Image CDN: https://cricketvectors.akamaized.net/players/org/{ID}.png
//
// Strategy: Visit recent series squad pages and extract player names + CREX IDs
// from the player links (href="/player/virat-kohli-4I" → name="Virat Kohli", id="4I")

const SERIES_SQUAD_URLS = [
  // Recent series that have full squads for many teams
  'https://crex.live/series/west-indies-tour-of-india-2026-2FZ/team-squad',
  'https://crex.live/series/icc-champions-trophy-2025-26Y/team-squad',
  'https://crex.live/series/icc-cricket-world-cup-2023-1KY/team-squad',
  'https://crex.live/series/icc-mens-t20-world-cup-2024-1Z4/team-squad',
  'https://crex.live/series/australia-tour-of-england-2025-275/team-squad',
  'https://crex.live/series/south-africa-tour-of-india-2025-26L/team-squad',
  'https://crex.live/series/new-zealand-tour-of-india-2024-26X/team-squad',
  'https://crex.live/series/pakistan-tour-of-australia-2025-27H/team-squad',
  'https://crex.live/series/sri-lanka-tour-of-england-2024-25O/team-squad',
  'https://crex.live/series/bangladesh-tour-of-india-2024-255/team-squad',
  'https://crex.live/series/afghanistan-tour-of-india-2024-21X/team-squad',
  'https://crex.live/series/ireland-tour-of-england-2025-27F/team-squad',
  'https://crex.live/series/zimbabwe-tour-of-india-2024-26W/team-squad',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractNameFromSlug(slug) {
  // "/player/virat-kohli-4I" → "Virat Kohli"
  // Remove leading /player/
  const parts = slug.replace('/player/', '').split('-');
  // Last part is the ID, rest is the name
  // But IDs can contain hyphens too... we use the pattern that IDs are alphanumeric codes
  // The player name parts are lowercase words, ID is the last segment
  
  // Better approach: split by -, take all except last, capitalize
  if (parts.length < 2) return null;
  
  const id = parts[parts.length - 1];
  const nameParts = parts.slice(0, -1);
  
  const name = nameParts.map(part => 
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join(' ');
  
  return { name, crexId: id };
}

(async () => {
  console.log('🏏 Starting international player scraping from CREX series pages...\n');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const allPlayerCrexIds = {}; // name -> crexId
  const teamLogos = {}; // will extract team logos too
  
  for (const seriesUrl of SERIES_SQUAD_URLS) {
    console.log(`\n📋 Scraping: ${seriesUrl}`);
    const page = await browser.newPage();
    
    try {
      await page.goto(seriesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(3000);
      
      // Extract player data from links and images
      const result = await page.evaluate(() => {
        const players = [];
        
        // Method 1: Extract from player links
        const links = Array.from(document.querySelectorAll('a[href*="/player/"]'));
        links.forEach(link => {
          const href = link.getAttribute('href');
          if (!href || !href.startsWith('/player/')) return;
          
          // Get player name from link text or nearby elements
          let name = link.textContent?.trim();
          
          // Also check for img inside the link
          const img = link.querySelector('img');
          const imgSrc = img?.src || '';
          
          const idMatch = imgSrc.match(/\/org\/([^.]+)\.png/);
          const hrefIdMatch = href.match(/\/player\/(.+)/);
          
          if (hrefIdMatch) {
            players.push({
              href: href,
              name: name || '',
              imgSrc: imgSrc,
              imgId: idMatch ? idMatch[1] : null,
            });
          }
        });
        
        // Method 2: Extract all cricketvectors player images
        const allImgs = Array.from(document.querySelectorAll('img'));
        const playerImgs = allImgs
          .filter(img => img.src?.includes('cricketvectors.akamaized.net/players/org/'))
          .map(img => img.src);
          
        // Team logos
        const logos = allImgs
          .filter(img => img.src?.includes('cricketvectors.akamaized.net/Teams/'))
          .map(img => img.src);
        
        return { players, playerImgs: [...new Set(playerImgs)], logos: [...new Set(logos)] };
      });
      
      console.log(`   Found ${result.players.length} player links`);
      console.log(`   Found ${result.playerImgs.length} player images`);
      console.log(`   Found ${result.logos.length} team logos`);
      
      // Extract CREX IDs from player hrefs
      for (const p of result.players) {
        const extracted = extractNameFromSlug(p.href);
        if (extracted && extracted.name.length > 2) {
          // Prefer the image ID if available, otherwise extract from href
          const crexId = p.imgId || extracted.crexId;
          if (crexId && !allPlayerCrexIds[extracted.name]) {
            allPlayerCrexIds[extracted.name] = crexId;
          }
        }
      }
      
      // Also try clicking on different team tabs if available
      const teamTabs = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('[class*="team"], [class*="tab"]'));
        return tabs
          .filter(t => t.textContent?.trim().length > 2 && t.textContent?.trim().length < 25)
          .map(t => ({ text: t.textContent?.trim(), index: Array.from(t.parentElement?.children || []).indexOf(t) }))
          .slice(0, 10);
      });
      
      console.log(`   Team tabs found: ${teamTabs.map(t => t.text).join(', ')}`);
      
      // Click each team tab and extract their players
      for (let i = 0; i < Math.min(teamTabs.length, 6); i++) {
        try {
          const tabElements = await page.$$('[class*="team"] a, [class*="tab"] a, [role="tab"]');
          if (tabElements[i]) {
            await tabElements[i].click();
            await sleep(1500);
            
            const moreResult = await page.evaluate(() => {
              const links = Array.from(document.querySelectorAll('a[href*="/player/"]'));
              return links.map(link => ({
                href: link.getAttribute('href') || '',
                name: link.textContent?.trim() || '',
                imgId: (() => {
                  const img = link.querySelector('img');
                  const m = img?.src?.match(/\/org\/([^.]+)\.png/);
                  return m ? m[1] : null;
                })()
              }));
            });
            
            for (const p of moreResult) {
              const extracted = extractNameFromSlug(p.href);
              if (extracted && extracted.name.length > 2) {
                const crexId = p.imgId || extracted.crexId;
                if (crexId && !allPlayerCrexIds[extracted.name]) {
                  allPlayerCrexIds[extracted.name] = crexId;
                }
              }
            }
          }
        } catch (e) {
          // Tab click failed, continue
        }
      }
      
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    } finally {
      await page.close();
    }
    
    await sleep(2000);
  }
  
  await browser.close();
  
  // ─── Results ───────────────────────────────────────────────────────
  
  console.log('\n\n═══════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════\n');
  
  const totalPlayers = Object.keys(allPlayerCrexIds).length;
  console.log(`Total unique players with CREX IDs: ${totalPlayers}\n`);
  
  // Sort alphabetically
  const sorted = Object.entries(allPlayerCrexIds).sort((a, b) => a[0].localeCompare(b[0]));
  sorted.forEach(([name, id]) => console.log(`  ${name}: ${id}`));
  
  // Save as JSON
  fs.writeFileSync('intl_crex_ids.json', JSON.stringify(allPlayerCrexIds, null, 2));
  console.log('\n📁 Saved to intl_crex_ids.json');
  
  // Generate TypeScript additions for crexImages.ts
  const tsEntries = sorted.map(([name, id]) => `  "${name}": "${id}"`).join(',\n');
  const tsContent = `// International players CREX IDs (auto-scraped)\nexport const INTL_PLAYER_CREX_IDS: Record<string, string> = {\n${tsEntries}\n};\n`;
  fs.writeFileSync('src/data/intlCrexImages.ts', tsContent);
  console.log('📁 Saved to src/data/intlCrexImages.ts');
  
  console.log('\n✅ Scraping complete!');
})();
