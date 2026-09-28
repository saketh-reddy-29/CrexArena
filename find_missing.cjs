const fs = require('fs');
const path = require('path');

const playersTs = fs.readFileSync(path.join(__dirname, 'src/data/players.ts'), 'utf-8');
const intlPlayersTs = fs.readFileSync(path.join(__dirname, 'src/data/intlPlayers.ts'), 'utf-8');
const crexImagesTs = fs.readFileSync(path.join(__dirname, 'src/data/crexImages.ts'), 'utf-8');
const intlCrexImagesTs = fs.readFileSync(path.join(__dirname, 'src/data/intlCrexImages.ts'), 'utf-8');

const allPlayers = new Set();

let match;
const nameRegex = /(?:createPlayer|intlPlayer)\([^,]+,\s*['"]([^'"]+)['"]/g;
while ((match = nameRegex.exec(playersTs)) !== null) {
  allPlayers.add(match[1]);
}

while ((match = nameRegex.exec(intlPlayersTs)) !== null) {
  allPlayers.add(match[1]);
}

const mappedPlayers = new Set();
const keyRegex = /['"]([^'"]+)['"]:\s*['"][^'"]+['"]/g;
while ((match = keyRegex.exec(crexImagesTs)) !== null) {
  mappedPlayers.add(match[1]);
}

while ((match = keyRegex.exec(intlCrexImagesTs)) !== null) {
  mappedPlayers.add(match[1]);
}

const missing = [];
for (const player of allPlayers) {
  if (!mappedPlayers.has(player)) {
    missing.push(player);
  }
}

console.log('Total players:', allPlayers.size);
console.log('Mapped players:', mappedPlayers.size);
console.log('Missing faces count:', missing.length);

fs.writeFileSync('missing_faces.txt', missing.join('\n'));
