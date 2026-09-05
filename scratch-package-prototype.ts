import fs from 'fs';
import { execSync } from 'child_process';

const html = fs.readFileSync('prototype/index.html', 'utf8');
const css = fs.readFileSync('prototype/styles.css', 'utf8');
const js = fs.readFileSync('prototype/script.js', 'utf8');

// Build standalone single-file HTML
let standalone = html;
standalone = standalone.replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`);
standalone = standalone.replace('<script src="script.js"></script>', `<script>\n${js}\n</script>`);

fs.writeFileSync('prototype.html', standalone);
console.log(`Created prototype.html (size: ${(fs.statSync('prototype.html').size / 1024).toFixed(1)} KB)`);

// Create ZIP using PowerShell Compress-Archive
try {
  if (fs.existsSync('prototype.zip')) fs.unlinkSync('prototype.zip');
  execSync('powershell Compress-Archive -Path prototype\\* -DestinationPath prototype.zip -Force');
  console.log(`Created prototype.zip (size: ${(fs.statSync('prototype.zip').size / 1024).toFixed(1)} KB)`);
} catch (e: any) {
  console.error('ZIP error:', e.message);
}
