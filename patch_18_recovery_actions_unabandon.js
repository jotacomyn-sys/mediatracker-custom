// patch_18_recovery_actions_unabandon.js
//
// Make "engagement" actions also unmark abandoned (and, for the
// in-progress mark, also add to watchlist):
//
//   1) _addAip (the green "Marcar en proceso" inside the Progreso popup
//      below the poster bar)  -> also PUT /api/watchlist + DELETE
//      /api/abandoned/:id alongside the existing PUT actively-in-progress.
//
//   2) _AIPS (the series-detail toggle from patch_14) -> when going from
//      inactive -> active (PUT), also PUT watchlist + DELETE abandoned.
//      Going active -> inactive (DELETE) is unchanged: it only touches AIP.
//
//   3) og ("Add to watchlist" blue chip) -> onClick also fires DELETE
//      /api/abandoned/:id so adding to watchlist from /abandonados pulls
//      the series back to active tracking in one click.
//
// Why: reported 2026-05-26. From /abandonados, clicking "Marcar en proceso"
// or "Add to watchlist" left the series stuck as abandoned (and, for the
// in-progress case, off the watchlist), forcing the user to click multiple
// buttons in sequence to recover a series.

;(() => {
const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/*mt-fork:recovery-unabandon*/';
if (c.includes(marker)) {
  console.log('recovery-unabandon: already patched');
  return;
}

// === 1) _addAip in the Progreso popup ===
const oldAddAip =
  'var _addAip=function(){fetch("/api/actively-in-progress/"+t.id,{method:"PUT",credentials:"same-origin"}).finally(function(){window._mtBustItemFlags&&window._mtBustItemFlags(t.id);HW.refetchQueries(en(t.id));HW.refetchQueries(["items"]);n();});};';
if ((c.split(oldAddAip).length - 1) !== 1) {
  console.error('recovery-unabandon: _addAip anchor count != 1');
  process.exit(1);
}
const newAddAip =
  'var _addAip=function(){Promise.all([' +
    'fetch("/api/actively-in-progress/"+t.id,{method:"PUT",credentials:"same-origin"}),' +
    'fetch("/api/watchlist?mediaItemId="+t.id,{method:"PUT",credentials:"same-origin"}).catch(function(){}),' +
    'fetch("/api/abandoned/"+t.id,{method:"DELETE",credentials:"same-origin"}).catch(function(){})' +
  ']).finally(function(){window._mtBustItemFlags&&window._mtBustItemFlags(t.id);HW.refetchQueries(en(t.id));HW.refetchQueries(["items"]);n();});};';
c = c.replace(oldAddAip, newAddAip);
console.log('recovery-unabandon: _addAip (popup) updated');

// === 2) _AIPS toggle, only when activating (PUT) ===
// Anchor on the patch_14 marker so we hit _AIPS only (not the unmounted _AIP
// which uses an almost-identical toggle string).
const oldAipsToggle =
  '/*mt-fork:aip-series-button*/var mi=e.mediaItem;var _s=r.useState(!!mi.inProgress),active=_s[0],setA=_s[1];var toggle=function(){var url="/api/actively-in-progress/"+mi.id;var method=active?"DELETE":"PUT";fetch(url,{method:method,credentials:"same-origin"}).then(function(r){return r.json()}).then(function(){setA(!active);';
if ((c.split(oldAipsToggle).length - 1) !== 1) {
  console.error('recovery-unabandon: _AIPS toggle anchor count != 1');
  process.exit(1);
}
const newAipsToggle =
  '/*mt-fork:aip-series-button*/var mi=e.mediaItem;var _s=r.useState(!!mi.inProgress),active=_s[0],setA=_s[1];var toggle=function(){var url="/api/actively-in-progress/"+mi.id;var method=active?"DELETE":"PUT";' +
  'var _extra=active?[]:[' +
    'fetch("/api/watchlist?mediaItemId="+mi.id,{method:"PUT",credentials:"same-origin"}).catch(function(){}),' +
    'fetch("/api/abandoned/"+mi.id,{method:"DELETE",credentials:"same-origin"}).catch(function(){})' +
  '];' +
  'Promise.all([fetch(url,{method:method,credentials:"same-origin"}).then(function(r){return r.json()})].concat(_extra)).then(function(){setA(!active);';
c = c.replace(oldAipsToggle, newAipsToggle);
console.log('recovery-unabandon: _AIPS toggle (detail page) updated');

// === 3) ig "Add to watchlist" chip (note: og is the Remove-from-watchlist
// red counterpart; we only patch the additive one).
const oldIg =
  ',ig=function(e){var t=e.mediaItem,n=e.season,a=e.episode;return r.createElement("div",{className:"text-sm btn-blue ",onClick:function(){return sn({mediaItem:t,season:n,episode:a})}}';
if ((c.split(oldIg).length - 1) !== 1) {
  console.error('recovery-unabandon: ig anchor count != 1');
  process.exit(1);
}
const newIg =
  ',ig=function(e){var t=e.mediaItem,n=e.season,a=e.episode;return r.createElement("div",{className:"text-sm btn-blue ",onClick:function(){fetch("/api/abandoned/"+t.id,{method:"DELETE",credentials:"same-origin"}).catch(function(){});return sn({mediaItem:t,season:n,episode:a})}}';
c = c.replace(oldIg, newIg);
console.log('recovery-unabandon: ig (Add to watchlist) updated');

c = marker + '\n' + c;
fs.writeFileSync(bundlePath, c);

try {
  child.execSync('node --check ' + bundlePath, { stdio: 'pipe' });
  console.log('recovery-unabandon: bundle syntax OK');
} catch (e) {
  console.error('recovery-unabandon: SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
  process.exit(1);
}
console.log('recovery-unabandon: complete');
})();
