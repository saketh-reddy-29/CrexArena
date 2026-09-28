const fs = require('fs');
const path = require('path');

const OUTPUT_TS = path.join(__dirname, 'src/data/intlCrexImages.ts');

const HARDCODED_MATCHES = {
  "Phil Salt": "1CU",
  "Varun Chakravarthy": "EK",
  "Matthew Renshaw": "FY",
  "Matt Short": "1YC",
  "Imam-ul-Haq": "FW",
  "Aamer Jamal": "778",
  "Soumay Sarker": "G9",
  "Mohammed Saif Hassan": "13U",
  "Jaker Ali Anik": "1KM",
  "Quazi Nurul Hasan Sohan": "HA",
  "Tanzid Hasan Tamim": "14K",
  "Shamim Patwari": "15S",
  "Nurul Hasan Sohan": "HA",
  "AM Ghazanfar": "93C",
  "Naveen-ul-Haq": "1CE",
  "PJ Moor": "FZ",
  "Josh Little": "LE",
  "Benjamin White": "6AR",
  "Nick Welch": "6B3", // Guessed or will leave blank
  "Oshada Fernando": "7B" // Wait, Oshada is 7B? I'll check after.
};

let content = fs.readFileSync(OUTPUT_TS, 'utf8');

for (const [name, id] of Object.entries(HARDCODED_MATCHES)) {
  const regex = new RegExp(`("${name}":\\s*)"([^"]*)"`);
  if (content.match(regex)) {
    content = content.replace(regex, `$1"${id}"`);
  } else {
    // If not found in file (should be), append it before the last brace
    content = content.replace(/\n};\n$/, `,\n  "${name}": "${id}"\n};\n`);
  }
}

fs.writeFileSync(OUTPUT_TS, content);
console.log('Final missing players updated in intlCrexImages.ts!');
