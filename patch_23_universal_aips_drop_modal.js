// patch_23_universal_aips_drop_modal.js
//
// (A) Make _AIPS (series-detail in-progress toggle from patch_14) render
//     for every media type, not just TV. The original gate
//       "tv"===a.mediaType ? r.createElement(_AIPS,...) : null
//     becomes
//       r.createElement(_AIPS, {mediaItem:a})
//     so movies / books / audiobooks / video_game / theater detail pages
//     also get the green/red outline toggle.
//
// (B) Remove the in-progress toggle IIFE from the Progreso popup. It was
//     redundant with the detail-page button and confused the UX (two
//     buttons could disagree until the next refetch). The popup still
//     has 'Marcar como completado', 'Guardar progreso', 'Quitar progreso'
//     and 'Cancel'.

;(() => {
const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/*mt-fork:universal-aips-drop-modal*/';
if (c.includes(marker)) {
  console.log('universal-aips-drop-modal: already patched');
  return;
}

// === (A) Drop the TV gate on _AIPS mount ===
const oldGate = ',"tv"===a.mediaType?r.createElement(_AIPS,{mediaItem:a}):null';
if ((c.split(oldGate).length - 1) !== 1) {
  console.error('universal-aips: gate anchor count != 1');
  process.exit(1);
}
const newGate = ',r.createElement(_AIPS,{mediaItem:a})';
c = c.replace(oldGate, newGate);
console.log('universal-aips: _AIPS gate removed (mounts for all media types)');

// === (B) Remove the popup AIP IIFE ===
// Anchor on the unique 'Boolean(t.inProgress)' (introduced by patch_20).
// The IIFE: ,(function(){var _aip=Boolean(t.inProgress); ... "Marcar en proceso");})()
const iifeStart = ',(function(){var _aip=Boolean(t.inProgress);';
const startIdx = c.indexOf(iifeStart);
if (startIdx < 0) {
  console.error('drop-modal: IIFE start anchor not found');
  process.exit(1);
}
// The IIFE ends with ;})()  before the next ,r.createElement (the Cancel button).
const closeMarker = '"Marcar en proceso");})()';
const closeIdx = c.indexOf(closeMarker, startIdx);
if (closeIdx < 0) {
  console.error('drop-modal: IIFE end anchor not found');
  process.exit(1);
}
const endIdx = closeIdx + closeMarker.length;
// Sanity: must be one IIFE between these markers
const between = c.slice(startIdx, endIdx);
if (between.indexOf('Marcar en proceso') !== between.lastIndexOf('Marcar en proceso')) {
  console.error('drop-modal: multiple Marcar en proceso between markers');
  process.exit(1);
}
c = c.slice(0, startIdx) + c.slice(endIdx);
console.log('drop-modal: progreso popup AIP IIFE removed');

c = marker + '\n' + c;
fs.writeFileSync(bundlePath, c);

try {
  child.execSync('node --check ' + bundlePath, { stdio: 'pipe' });
  console.log('universal-aips-drop-modal: bundle syntax OK');
} catch (e) {
  console.error('universal-aips-drop-modal: SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
  process.exit(1);
}
console.log('universal-aips-drop-modal: complete');
})();
