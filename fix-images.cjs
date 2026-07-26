const fs = require('fs');
const path = require('path');
const files = [
  'src/components/LiveMatchCenter.tsx', 
  'src/components/SquadPlanner.tsx', 
  'src/components/PreMatch.tsx', 
  'src/components/AuctionRoom.tsx', 
  'src/components/league/TeamsTab.tsx',
  'src/components/TeamSelection.tsx'
];

files.forEach(f => {
  let p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) return;
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(/object-cover/g, 'object-cover object-top');
  c = c.replace(/object-cover object-top object-top/g, 'object-cover object-top');
  fs.writeFileSync(p, c);
});
console.log('Fixed CSS objects');
