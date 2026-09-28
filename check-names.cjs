const fs = require('fs');
function extractNames(file) {
  const code = fs.readFileSync(file, 'utf-8');
  let match;
  const names = [];
  const regex = /name:\s*['"]([^'"]+)['"]/g;
  while ((match = regex.exec(code)) !== null) {
    names.push(match[1]);
  }
  return names;
}
const intlNames = extractNames('src/data/intlPlayers.ts');
const iplNames = extractNames('src/data/players.ts');
const allNames = [...intlNames, ...iplNames];
const duplicates = allNames.filter((item, index) => allNames.indexOf(item) !== index);
console.log([...new Set(duplicates)].length + ' duplicate names found');
console.log([...new Set(duplicates)].slice(0, 5));
