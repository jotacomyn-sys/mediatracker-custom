// patch_22_aips_swap_colors.js
//
// Swap _AIPS button colors so they match action semantics rather than
// state: green = "going to add" (Marcar en proceso), red = "going to
// remove" (Quitar de en proceso).

;(() => {
const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/*mt-fork:aips-color-swap*/';
if (c.includes(marker)) {
  console.log('aips-color-swap: already patched');
  return;
}

// Anchor on the unique _AIPS color line.
const oldLine = 'var color=active?"#16a34a":"#dc2626";';
if ((c.split(oldLine).length - 1) !== 1) {
  console.error('aips-color-swap: anchor count != 1');
  process.exit(1);
}
const newLine = 'var color=active?"#dc2626":"#16a34a";';
c = c.replace(oldLine, newLine);
c = '/*' + marker.slice(2, -2) + '*/\n' + c;
fs.writeFileSync(bundlePath, c);

try {
  child.execSync('node --check ' + bundlePath, { stdio: 'pipe' });
  console.log('aips-color-swap: applied + syntax OK');
} catch (e) {
  console.error('aips-color-swap: SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
  process.exit(1);
}
})();
