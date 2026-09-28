const fs = require('fs');
function extractIds(file) {
  const code = fs.readFileSync(file, 'utf-8');
  let match;
  const ids = [];
  const regex = /id:\s*['"]([^'"]+)['"]/g;
  while ((match = regex.exec(code)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}
const intlIds = extractIds('src/data/intlPlayers.ts');
const iplIds = extractIds('src/data/players.ts');
const allIds = [...intlIds, ...iplIds];
const duplicates = allIds.filter((item, index) => allIds.indexOf(item) !== index);
console.log([...new Set(duplicates)]);
