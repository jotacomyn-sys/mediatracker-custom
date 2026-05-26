// patch_25_aips_per_call_invalidation.js
//
// Two related fixes:
//
// (A) Per-fetch invalidation. patch_18 put the three engagement fetches
//     (AIP, watchlist, abandoned) inside a single Promise.all whose .then()
//     runs only when the slowest of the three resolves. With realistic
//     network/DB latency that ends up being ~10s for the watchlist chip
//     to flip after clicking "Marcar en proceso" — even though the
//     watchlist PUT itself returned in ~1s. Fix: invalidate per-fetch.
//
// (B) details.inProgress respects abandoned. When the user clicks
//     "Marcar como abandonada", _AB sets abandoned=1 but doesn't touch
//     AIP, so the server-side inProgress (patch_17 + patch_20) still
//     returns true and _AIPS keeps showing "Quitar de en proceso".
//     Add `!_ab` to both the TV and non-TV branches of the formula so
//     an abandoned item is never inProgress regardless of AIP state.

const fs = require('fs');
const child = require('child_process');

// === (B) controllers/item.js: details.inProgress also gated by !_ab ===
(function () {
  const filePath = '/app/build/controllers/item.js';
  const marker = '/*mt-fork:inprogress-respects-abandoned*/';
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.includes(marker)) {
    console.log('inprogress-respects-abandoned: already applied');
    return;
  }
  const oldTv =
    "details.inProgress = !_aipEx && (\n" +
    "            (_seenEps > 0 && _unseen > 0) ||\n" +
    "            (_fue && _fueProg > 0) ||\n" +
    "            (_onWl && !!_fue) ||\n" +
    "            _aipAc\n" +
    "          );";
  if ((c.split(oldTv).length - 1) !== 1) {
    console.error('inprogress-respects-abandoned: TV anchor count != 1');
    process.exit(1);
  }
  const newTv =
    marker + "\n" +
    "          const _ab = !!details.abandoned;\n" +
    "          details.inProgress = !_aipEx && !_ab && (\n" +
    "            (_seenEps > 0 && _unseen > 0) ||\n" +
    "            (_fue && _fueProg > 0) ||\n" +
    "            (_onWl && !!_fue) ||\n" +
    "            _aipAc\n" +
    "          );";
  c = c.replace(oldTv, newTv);

  const oldNonTv =
    "details.inProgress = !_aipEx && ((_prog > 0 && _prog < 1 && !_hasSeen) || (_aprog > 0 && _aprog < 1 && !_hasSeen) || _aipAc);";
  if ((c.split(oldNonTv).length - 1) !== 1) {
    console.error('inprogress-respects-abandoned: non-TV anchor count != 1');
    process.exit(1);
  }
  const newNonTv =
    "const _abNonTv = !!details.abandoned;\n" +
    "          details.inProgress = !_aipEx && !_abNonTv && ((_prog > 0 && _prog < 1 && !_hasSeen) || (_aprog > 0 && _aprog < 1 && !_hasSeen) || _aipAc);";
  c = c.replace(oldNonTv, newNonTv);

  fs.writeFileSync(filePath, c);
  try {
    delete require.cache[require.resolve(filePath)];
    require(filePath);
    console.log('inprogress-respects-abandoned: applied + syntax OK');
  } catch (e) {
    console.error('inprogress-respects-abandoned: SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
    process.exit(1);
  }
})();

// === (A) Bundle: _AIPS toggle per-fetch invalidation ===
;(() => {
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/*mt-fork:aips-per-call-invalidation*/';
if (c.includes(marker)) {
  console.log('aips-per-call-invalidation: already patched');
  return;
}

// Anchor on the full toggle body installed by patch_18 + patch_19 + patch_17.
// This is the only `var toggle=function(){var url="/api/actively-in-progress/"...`
// preceded by the patch_14 marker, so it uniquely identifies _AIPS.
const aipsMarkerAndState =
  '/*mt-fork:aip-series-button*/var mi=e.mediaItem;var _s=r.useState(!!mi.inProgress),active=_s[0],setA=_s[1];r.useEffect(function(){setA(!!mi.inProgress);},[mi.inProgress]);';
if ((c.split(aipsMarkerAndState).length - 1) !== 1) {
  console.error('aips-per-call-invalidation: _AIPS preamble anchor count != 1');
  process.exit(1);
}

const oldToggle =
  'var toggle=function(){var url="/api/actively-in-progress/"+mi.id;var method=active?"DELETE":"PUT";var _extra=active?[]:[fetch("/api/watchlist?mediaItemId="+mi.id,{method:"PUT",credentials:"same-origin"}).catch(function(){}),fetch("/api/abandoned/"+mi.id,{method:"DELETE",credentials:"same-origin"}).catch(function(){})];Promise.all([fetch(url,{method:method,credentials:"same-origin"}).then(function(r){return r.json()})].concat(_extra)).then(function(){setA(!active);window._mtBustItemFlags&&window._mtBustItemFlags(mi.id);try{HW.removeQueries(["items"])}catch(_){}; try{HW.invalidateQueries(["items"])}catch(_){}; try{HW.removeQueries(["details",mi.id])}catch(_){}; try{HW.invalidateQueries(["details",mi.id])}catch(_){}; try{HW.refetchQueries(["details",mi.id])}catch(_){};})};';

if ((c.split(oldToggle).length - 1) !== 1) {
  console.error('aips-per-call-invalidation: toggle anchor count != 1');
  process.exit(1);
}

const newToggle =
  'var toggle=function(){' +
    'var url="/api/actively-in-progress/"+mi.id;' +
    'var method=active?"DELETE":"PUT";' +
    'var willActivate=!active;' +
    // Main AIP fetch — drives local state + primary cache invalidations.
    'fetch(url,{method:method,credentials:"same-origin"}).then(function(r){return r.json()}).then(function(){' +
      'setA(willActivate);' +
      'window._mtBustItemFlags&&window._mtBustItemFlags(mi.id);' +
      'try{HW.invalidateQueries(["items"])}catch(_){}; ' +
      'try{HW.invalidateQueries(["details",mi.id])}catch(_){};' +
    '}).catch(function(){});' +
    // Side effects only when activating: each fetch invalidates on its own
    // completion so the chip/list views flip as soon as that specific
    // mutation lands, not when the slowest of the three resolves.
    'if(willActivate){' +
      'fetch("/api/watchlist?mediaItemId="+mi.id,{method:"PUT",credentials:"same-origin"}).then(function(){' +
        'try{HW.invalidateQueries(["details",mi.id])}catch(_){}; ' +
        'try{HW.invalidateQueries(["items"])}catch(_){}; ' +
        'try{HW.invalidateQueries(["list"])}catch(_){}; ' +
        'try{HW.invalidateQueries(["lists"])}catch(_){}; ' +
        'try{HW.invalidateQueries(["listItems"])}catch(_){};' +
      '}).catch(function(){});' +
      'fetch("/api/abandoned/"+mi.id,{method:"DELETE",credentials:"same-origin"}).then(function(){' +
        'window._mtBustItemFlags&&window._mtBustItemFlags(mi.id);' +
        'try{HW.invalidateQueries(["items"])}catch(_){}; ' +
        'try{HW.invalidateQueries(["details",mi.id])}catch(_){};' +
      '}).catch(function(){});' +
    '}' +
  '};';

c = c.replace(oldToggle, newToggle);
console.log('aips-per-call-invalidation: _AIPS toggle now invalidates per-fetch');

c = marker + '\n' + c;
fs.writeFileSync(bundlePath, c);

try {
  child.execSync('node --check ' + bundlePath, { stdio: 'pipe' });
  console.log('aips-per-call-invalidation: bundle syntax OK');
} catch (e) {
  console.error('aips-per-call-invalidation: SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
  process.exit(1);
}
})();
