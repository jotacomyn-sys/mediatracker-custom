// patch_24_move_mas_next_to_aips.js
//
// Move _MAS ("Mark as seen" toggle, currently rendered for games below
// the action grid via Ao(a) gate) next to _AIPS, and restyle it to match
// _AIPS's outline appearance (same height/padding, green = add, red =
// remove).

;(() => {
const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/*mt-fork:mas-next-to-aips*/';
if (c.includes(marker)) {
  console.log('mas-next-to-aips: already patched');
  return;
}

// === (A) Restyle _MAS to match _AIPS (outline, action-colored) ===
const oldReturn =
  'return r.createElement("div",{className:"text-sm text-center "+(seen?"btn-red":"btn"),onClick:toggle},r.createElement(Xe,{id:seen?"Stop being seen":"Mark as seen"}))';
if ((c.split(oldReturn).length - 1) !== 1) {
  console.error('mas-next-to-aips: _MAS return anchor count != 1');
  process.exit(1);
}
const newReturn =
  'var _masColor=seen?"#dc2626":"#16a34a";' +
  'var _masStyle={border:"1.5px solid "+_masColor,color:_masColor,borderRadius:"6px",padding:"6px 12px",cursor:"pointer",textAlign:"center",fontWeight:"500",fontSize:"0.875rem",background:"transparent",userSelect:"none",display:"flex",alignItems:"center",justifyContent:"center"};' +
  'return r.createElement("div",{style:_masStyle,onClick:toggle,role:"button"},r.createElement(Xe,{id:seen?"Stop being seen":"Mark as seen"}))';
c = c.replace(oldReturn, newReturn);
console.log('mas-next-to-aips: _MAS restyled to match _AIPS outline');

// === (B) Remove _MAS from its current mount (below action grid) ===
const oldMount = 'Ao(a)&&r.createElement(_MAS,{mediaItem:a}),';
if ((c.split(oldMount).length - 1) !== 1) {
  console.error('mas-next-to-aips: old _MAS mount anchor count != 1');
  process.exit(1);
}
c = c.replace(oldMount, '');
console.log('mas-next-to-aips: removed _MAS from below action grid');

// === (C) Mount _MAS right after _AIPS in the action grid (Ao gate) ===
const aipsMount = ',r.createElement(_AIPS,{mediaItem:a}))';
if ((c.split(aipsMount).length - 1) !== 1) {
  console.error('mas-next-to-aips: _AIPS mount anchor count != 1');
  process.exit(1);
}
const newAipsAndMas = ',r.createElement(_AIPS,{mediaItem:a}),Ao(a)?r.createElement(_MAS,{mediaItem:a}):null)';
c = c.replace(aipsMount, newAipsAndMas);
console.log('mas-next-to-aips: mounted _MAS right after _AIPS (games only)');

c = marker + '\n' + c;
fs.writeFileSync(bundlePath, c);

try {
  child.execSync('node --check ' + bundlePath, { stdio: 'pipe' });
  console.log('mas-next-to-aips: bundle syntax OK');
} catch (e) {
  console.error('mas-next-to-aips: SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
  process.exit(1);
}
})();
