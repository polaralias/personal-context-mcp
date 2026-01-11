const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'public');
const destDir = path.join(__dirname, '..', 'dist', 'public');

if (!fs.existsSync(srcDir)) {
  throw new Error(`Missing public assets at ${srcDir}`);
}

fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(srcDir, destDir, { recursive: true });
console.log(`Copied public assets to ${destDir}`);
