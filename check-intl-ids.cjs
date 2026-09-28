const fs = require('fs');
const code = fs.readFileSync('src/data/intlPlayers.ts', 'utf-8');
const regex = /intlPlayer\s*\(\s*['"]([^'"]+)['"]/g;
let match;
const ids = [];
while ((match = regex.exec(code)) !== null) {
  ids.push(match[1]);
}
const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
console.log([...new Set(duplicates)]);
