// fuzzy-match.cjs
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

const MISSING = [
  "Phil Salt", "Varun Chakravarthy", "Matthew Renshaw", "Matt Short",
  "Imam-ul-Haq", "Aamer Jamal", "Oshada Fernando", "Soumay Sarker",
  "Mohammed Saif Hassan", "Jaker Ali Anik", "Quazi Nurul Hasan Sohan",
  "Tanzid Hasan Tamim", "Shamim Patwari", "Nurul Hasan Sohan",
  "AM Ghazanfar", "Naveen-ul-Haq", "Nick Welch", "PJ Moor",
  "Josh Little", "Benjamin White"
];

(async () => {
  console.log('Downloading player.xml...');
  const xml = await new Promise((resolve, reject) => {
    https.get('https://crex.com/crex_sitemap/player.xml', { headers: { 'Accept-Encoding': 'gzip' } }, res => {
      let stream = res.headers['content-encoding'] === 'gzip' ? res.pipe(zlib.createGunzip()) : res;
      let d = '';
      stream.on('data', c => d += c);
      stream.on('end', () => resolve(d));
    }).on('error', reject);
  });

  const urls = [...xml.matchAll(/<loc>(https:\/\/crex\.com\/player\/[^<]+)<\/loc>/g)].map(m => m[1]);
  
  const allSlugs = urls.map(u => {
    const parts = u.replace('https://crex.com/player/', '').split('-');
    return { 
      id: parts.pop(), 
      words: parts, 
      text: parts.join(' ') 
    };
  });

  console.log('Fuzzy matching...');

  for (const name of MISSING) {
    const norm = name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    const nameWords = norm.split(' ');
    
    // Find all slugs that share at least the last name or a significant part
    const matches = allSlugs.filter(slug => {
      // e.g. "phil salt" -> "philip salt"
      // "am ghazanfar" -> "allah ghazanfar"
      const lastName = nameWords[nameWords.length - 1];
      const firstName = nameWords[0];
      
      return slug.words.includes(lastName) || slug.words.includes(firstName);
    });

    // Score matches
    matches.forEach(m => {
      let score = 0;
      nameWords.forEach(w => {
        if (m.words.includes(w)) score += 2;
        else if (m.words.some(sw => sw.includes(w) || w.includes(sw))) score += 1;
      });
      m.score = score;
    });

    const best = matches.sort((a, b) => b.score - a.score).slice(0, 5);
    console.log(`\n--- ${name} ---`);
    best.forEach(b => console.log(`  [Score ${b.score}] ${b.text} -> ${b.id}`));
  }
})();
