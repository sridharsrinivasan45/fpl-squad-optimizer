import fs from 'fs';

const file = './src/utils/pointsProjection.ts';

console.log('========================================');
console.log('PRODUCTION PROJECTION MODEL INSPECTION');
console.log('========================================');

if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const source = fs.readFileSync(file, 'utf8');

console.log('\n--- FILE ---');
console.log(file);

console.log('\n--- EXPORTED FUNCTIONS ---');

const exports = [...source.matchAll(
  /export\s+(?:function|const|class)\s+([A-Za-z0-9_]+)/g
)].map(m => m[1]);

console.log(exports.length ? exports.join('\n') : 'No named exports detected');

console.log('\n--- FUNCTION SIGNATURES ---');

const signatures = [...source.matchAll(
  /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g
)];

for (const match of signatures) {
  console.log(`${match[1]}(${match[2]})`);
}

console.log('\n--- calculateProjectedPoints REFERENCES ---');

const lines = source.split(/\r?\n/);

lines.forEach((line, i) => {
  if (line.includes('calculateProjectedPoints')) {
    console.log(`${i + 1}: ${line}`);
  }
});

console.log('\n--- IMPORTS ---');

lines
  .filter(line => line.trim().startsWith('import '))
  .forEach(line => console.log(line));

console.log('\n========================================');
console.log('INSPECTION COMPLETE');
console.log('========================================');
