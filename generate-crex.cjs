const fs = require('fs');

const input = fs.readFileSync('player_urls.txt', 'utf-8');
const lines = input.split('\n');
const mapping = {};

for (const line of lines) {
    if (line.startsWith('- ')) {
        const parts = line.replace('- ', '').split(': ');
        if (parts.length === 2) {
            const name = parts[0].trim();
            const url = parts[1].trim();
            const match = url.match(/\/org\/([^.]+)\.png/);
            if (match && match[1]) {
                mapping[name] = match[1];
            }
        }
    }
}

const fileContent = `export const PLAYER_CREX_IDS: Record<string, string> = ${JSON.stringify(mapping, null, 2)};\n`;

fs.writeFileSync('src/data/crexImages.ts', fileContent);
console.log('Successfully generated src/data/crexImages.ts with ' + Object.keys(mapping).length + ' players.');
