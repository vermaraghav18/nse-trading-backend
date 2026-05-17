const fs = require('fs');
const path = require('path');

// Try to find the trades file
const possiblePaths = [
  './paper-trades.json',
  './cache/paper-trades.json',
  './data/paper-trades.json',
  './dist/cache/paper-trades.json'
];

let tradesPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    tradesPath = p;
    break;
  }
}

if (!tradesPath) {
  console.log('❌ Could not find paper-trades.json file');
  console.log('📁 Searched in:', possiblePaths);
  console.log('\n✅ This is OK if you have no trades yet!');
  console.log('The new field will be added automatically when you close new trades.');
  process.exit(0);
}

console.log(`📁 Found trades file: ${tradesPath}`);

// Read the file
const trades = JSON.parse(fs.readFileSync(tradesPath, 'utf8'));

console.log(`📊 Total trades: ${trades.length}`);

// Add exitReasonDetailed field to all trades
let updated = 0;
for (const trade of trades) {
  if (!trade.hasOwnProperty('exitReasonDetailed')) {
    trade.exitReasonDetailed = null;
    updated++;
  }
}

// Save back
fs.writeFileSync(tradesPath, JSON.stringify(trades, null, 2));

console.log(`✅ Migration complete! Updated ${updated} trades.`);
console.log('🎉 Your trades file is now compatible with the new detailed exit reasons!');