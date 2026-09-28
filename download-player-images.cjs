// download-player-images.cjs
const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_FILE_INTL = path.join(__dirname, 'src/data/intlCrexImages.ts');
const DATA_FILE_IPL = path.join(__dirname, 'src/data/crexImages.ts');
const OUTPUT_DIR = path.join(__dirname, 'public/images/players');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const players = [];
const regex = /"([^"]+)":\s*"([^"]+)"/g;

function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    const rawId = match[2];
    const cleanId = rawId.split('/')[0];
    if (cleanId) {
      players.push({ name: match[1], id: cleanId });
    }
  }
}

parseFile(DATA_FILE_INTL);
parseFile(DATA_FILE_IPL);

console.log(`Found ${players.length} players to download.`);

async function downloadImage(id, destPath) {
  const url = `https://cricketvectors.akamaized.net/players/org/${id}.png`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      } else if (res.statusCode === 403 || res.statusCode === 404) {
        // Some might not exist, that's okay
        resolve(false);
      } else {
        res.resume(); // Consume response data to free up memory
        reject(new Error(`Status Code: ${res.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Download with concurrency limit
const CONCURRENCY = 10;
let inFlight = 0;
let completed = 0;
let failed = 0;
let skipped = 0;
let index = 0;

async function processQueue() {
  if (index >= players.length) return;
  
  const player = players[index++];
  inFlight++;
  
  const destPath = path.join(OUTPUT_DIR, `${player.id}.png`);
  
  if (fs.existsSync(destPath)) {
    skipped++;
    inFlight--;
    processQueue();
    return;
  }
  
  try {
    const success = await downloadImage(player.id, destPath);
    if (success) {
      completed++;
      if (completed % 50 === 0) console.log(`Downloaded ${completed}/${players.length}`);
    } else {
      failed++;
    }
  } catch (e) {
    console.error(`Failed ${player.name} (${player.id}):`, e.message);
    failed++;
  }
  
  inFlight--;
  processQueue();
}

(async () => {
  console.log(`Starting download to ${OUTPUT_DIR}`);
  
  const promises = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    promises.push(processQueue());
  }
  
  await Promise.all(promises);
  console.log(`\nDownload complete!`);
  console.log(`- Successfully downloaded: ${completed}`);
  console.log(`- Skipped (already exist): ${skipped}`);
  console.log(`- Failed/Not found: ${failed}`);
})();
