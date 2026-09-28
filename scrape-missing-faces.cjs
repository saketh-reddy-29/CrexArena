/**
 * scrape-missing-faces.cjs (v5 - Correct modern series + coordinate-based tab clicking)
 *
 * Key lessons learned:
 * 1. Squad tabs are at top ~300-350px on the page
 * 2. Need to click the team name DIV at top=315 (not the footer link at top=1576)
 * 3. Series IDs must be current/correct
 * 4. After clicking, wait 2s for squad to render then grab player hrefs
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const MISSING = new Set(
  fs.readFileSync(path.join(__dirname, 'missing_faces.txt'), 'utf8')
    .split('\n').map(p => p.trim()).filter(p => p)
);

const PROGRESS_FILE = path.join(__dirname, 'crex-scrape-progress.json');
const OUTPUT_TS = path.join(__dirname, 'src/data/intlCrexImages.ts');

// Modern series pages - each covers specific teams
const SERIES_PAGES = [
  // ENG + SL (has Brook, Duckett, Root, Woakes, Stokes etc. + SL players)
  'https://crex.com/series/sri-lanka-tour-of-england-2026-1WT/team-squad',
  // ENG + PAK (has all PAK players + ENG)
  'https://crex.com/series/pakistan-tour-of-england-2026-1WS/team-squad',
  // AUS + SA (has AUS players: Renshaw, Philippe etc. + SA: Bavuma etc.)
  'https://crex.com/series/australia-tour-of-south-africa-2026-2EW/team-squad',
  // BAN + AUS (Bangladesh players)
  'https://crex.com/series/bangladesh-tour-of-australia-2026-2BG/team-squad',
  // IND + WI (West Indies players)
  'https://crex.com/series/west-indies-tour-of-india-2026-2FZ/team-squad',
  // AFG + IRE (Afghanistan + Ireland players)
  'https://crex.com/series/afghanistan-tour-of-ireland-2026-2FQ/team-squad',
  // AUS + ZIM (Zimbabwe players)
  'https://crex.com/series/australia-tour-of-zimbabwe-2026-2GK/team-squad',
  // IND + SL (Sri Lanka players)
  'https://crex.com/series/india-tour-of-sri-lanka-2026-2AS/team-squad',
  // IND + BAN
  'https://crex.com/series/india-tour-of-bangladesh-2026-1SL/team-squad',
  // WTC (has all Test teams including NZ)
  'https://crex.com/series/world-test-championship-2025-27-1QK/team-squad',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let progress = {};
if (fs.existsSync(PROGRESS_FILE)) {
  try { progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch (e) {}
  console.log(`📂 Resuming with ${Object.keys(progress).length} already mapped`);
}

function saveProgress() { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2)); }

function loadExisting() {
  if (!fs.existsSync(OUTPUT_TS)) return {};
  const content = fs.readFileSync(OUTPUT_TS, 'utf8');
  const existing = {};
  const re = /"([^"]+)":\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(content)) !== null) existing[m[1]] = m[2];
  return existing;
}

function writeOutput(merged) {
  const sorted = Object.entries(merged).sort((a, b) => a[0].localeCompare(b[0]));
  const entries = sorted.map(([n, id]) => `  "${n}": "${id}"`).join(',\n');
  fs.writeFileSync(OUTPUT_TS, `// International players CREX IDs (auto-scraped)\nexport const INTL_PLAYER_CREX_IDS: Record<string, string> = {\n${entries}\n};\n`);
}

const MISSING_NORM = new Map();
for (const name of MISSING) {
  const norm = name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  MISSING_NORM.set(norm, name);
}

function slugToInfo(href) {
  const parts = href.replace(/^\/player\//, '').split('-');
  if (parts.length < 2) return null;
  return { id: parts[parts.length - 1], words: parts.slice(0, -1) };
}

function findMatch(slugWords, id) {
  const slugSet = new Set(slugWords);
  for (const [norm, original] of MISSING_NORM) {
    const words = norm.split(' ');
    if (words.every(w => slugSet.has(w))) return { matched: original, id };
    if (words.length >= 2 && slugSet.has(words[0]) && slugSet.has(words[words.length - 1])) {
      return { matched: original, id };
    }
  }
  return null;
}

// Get all player hrefs currently visible on the page
async function getPlayerLinks(page) {
  return page.evaluate(() => {
    const seen = new Set();
    const out = [];
    document.querySelectorAll('a[href*="/player/"]').forEach(a => {
      const href = a.getAttribute('href');
      if (href && href.startsWith('/player/') && !href.includes('/news') && !seen.has(href)) {
        seen.add(href);
        const img = a.querySelector('img');
        const imgId = img?.src?.match(/\/org\/([A-Za-z0-9\-]+)\.png/)?.[1] || null;
        out.push({ href, imgId });
      }
    });
    return out;
  });
}

// Find and click squad team tabs (positioned in top 400px of page)
async function clickAllTeamTabs(page, allHrefs) {
  // Get all clickable team-name elements in the squad area (top < 400px)
  const teamTabs = await page.evaluate(() => {
    const tabs = [];
    document.querySelectorAll('*').forEach(el => {
      const text = el.textContent?.trim();
      if (!text || text.length > 30 || el.children.length > 0) return;
      const rect = el.getBoundingClientRect();
      if (rect.top > 100 && rect.top < 450 && rect.width > 20 && rect.height > 5) {
        tabs.push({ text: text.slice(0, 30), top: rect.top, left: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
    });
    return [...new Map(tabs.map(t => [t.text, t])).values()]; // dedupe by text
  });

  console.log(`   Tabs in squad area: ${teamTabs.map(t => `"${t.text}"`).join(', ')}`);

  for (const tab of teamTabs) {
    // Skip if it's just a number or common UI word
    if (/^\d+$/.test(tab.text) || ['Bat', 'Bowl', 'AR', 'WK', 'All Rounder', 'Batsman', 'Bowler', 'Wicketkeeper', 'Overview', 'Matches', 'News', 'Squads', 'Series Stats', 'Players'].includes(tab.text)) continue;

    try {
      await page.mouse.click(tab.left, tab.y);
      await sleep(2000);
      const fresh = await getPlayerLinks(page);
      let newOnes = 0;
      fresh.forEach(p => {
        if (!allHrefs.has(p.href)) {
          allHrefs.set(p.href, p.imgId);
          newOnes++;
        }
      });
      if (newOnes > 0) console.log(`   "${tab.text}": +${newOnes} players (total: ${allHrefs.size})`);
    } catch (_) {}
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });

  let totalFound = 0;
  const allFound = { ...progress };

  for (const seriesUrl of SERIES_PAGES) {
    const remaining = [...MISSING].filter(n => !allFound[n]);
    if (remaining.length === 0) { console.log('✅ All found!'); break; }

    console.log(`\n📋 [${Object.keys(allFound).length} found | ${remaining.length} missing]`);
    console.log(`   → ${seriesUrl}`);

    try {
      await page.goto(seriesUrl, { waitUntil: 'networkidle2', timeout: 25000 });
      await sleep(4000);

      const allHrefs = new Map();

      // Grab initial player links
      const initial = await getPlayerLinks(page);
      initial.forEach(p => { if (!allHrefs.has(p.href)) allHrefs.set(p.href, p.imgId); });
      console.log(`   Initial links: ${allHrefs.size}`);

      // Click all team tabs using coordinates (top 400px)
      await clickAllTeamTabs(page, allHrefs);

      console.log(`   Total unique player hrefs: ${allHrefs.size}`);

      // Match all found hrefs
      let foundOnPage = 0;
      for (const [href, imgId] of allHrefs) {
        const info = slugToInfo(href);
        if (!info) continue;
        const crexId = imgId || info.id;
        const match = findMatch(info.words, crexId);
        if (match && !allFound[match.matched]) {
          allFound[match.matched] = match.id;
          foundOnPage++;
          totalFound++;
          console.log(`   ✅ "${match.matched}" → "${match.id}"`);
        }
      }

      console.log(`   → ${foundOnPage} new matches`);
      Object.assign(progress, allFound);
      saveProgress();
      writeOutput({ ...loadExisting(), ...allFound });

    } catch (err) {
      console.log(`   ❌ ${err.message.slice(0, 100)}`);
    }
    await sleep(1500);
  }

  await browser.close();

  const stillMissing = [...MISSING].filter(n => !allFound[n]);
  console.log('\n═══════════════════════════════════════════');
  console.log(`  ✅ Found this run:  ${totalFound}`);
  console.log(`  ✅ Total mapped:    ${Object.keys(allFound).length}`);
  console.log(`  ❌ Still missing:   ${stillMissing.length}`);
  console.log('═══════════════════════════════════════════');
  if (stillMissing.length) {
    fs.writeFileSync('still-missing.txt', stillMissing.join('\n'));
    stillMissing.forEach(n => console.log(`  - ${n}`));
  }
  writeOutput({ ...loadExisting(), ...allFound });
  console.log(`\n📁 intlCrexImages.ts updated`);
})();
