// patch_19_flag_sync_event.js
//
// Make sibling toggles re-render when one of them mutates state. Before
// this patch, clicking "Marcar en proceso" or "Add to watchlist" on a
// series that was abandoned ran the right DB mutations but the _AB toggle
// on the same detail page kept showing "Reanudar" — its useState was
// initialized on mount and nothing notified it the abandoned row was gone.
//
// Changes:
//   1. window._mtBustItemFlags now also dispatches a window CustomEvent
//      "mt-item-flags-changed" with detail={id}, so any flag-driven
//      component can subscribe and re-fetch.
//   2. _AB (abandoned toggle) listens for that event and re-runs its
//      flag fetch when ev.detail.id matches its mi.id.
//   3. _AIPS (patch_14 series toggle) syncs its local state to
//      mi.inProgress whenever the prop changes — so when the details
//      query refetches with fresh inProgress, the button label/color
//      updates without a click.
//   4. _AIPS toggle and ig (Add to watchlist) call _mtBustItemFlags
//      after their API mutations so _AB re-reads the abandoned flag.

;(() => {
const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/*mt-fork:flag-sync-event*/';
if (c.includes(marker)) {
  console.log('flag-sync-event: already patched');
  return;
}

// === 1. window._mtBustItemFlags emits CustomEvent ===
const oldBust = 'window._mtBustItemFlags=function(id){if(window._mtItemFlags)delete window._mtItemFlags[id]};';
if ((c.split(oldBust).length - 1) !== 1) {
  console.error('flag-sync-event: _mtBustItemFlags anchor count != 1');
  process.exit(1);
}
const newBust = 'window._mtBustItemFlags=function(id){if(window._mtItemFlags)delete window._mtItemFlags[id];try{window.dispatchEvent(new CustomEvent("mt-item-flags-changed",{detail:{id:id}}));}catch(_){}};';
c = c.replace(oldBust, newBust);
console.log('flag-sync-event: _mtBustItemFlags now dispatches event');

// === 2. _AB listens for the event ===
// Insert a second useEffect right after the existing r.useEffect(load,[mi.id]);
const abAnchor = '_AB=function(e){var mi=e.mediaItem;var _s=r.useState(mi.abandoned!=null?!!mi.abandoned:null),abandoned=_s[0],setA=_s[1];var load=function(){window._mtFetchItemFlags(mi.id).then(function(d){setA(!!d.abandoned)})};r.useEffect(load,[mi.id]);';
if ((c.split(abAnchor).length - 1) !== 1) {
  console.error('flag-sync-event: _AB anchor count != 1');
  process.exit(1);
}
const abInjection =
  'r.useEffect(function(){' +
    'var _h=function(ev){if(ev&&ev.detail&&ev.detail.id===mi.id){' +
      'window._mtBustItemFlags&&delete window._mtItemFlags[mi.id];' +
      'load();' +
    '}};' +
    'window.addEventListener("mt-item-flags-changed",_h);' +
    'return function(){window.removeEventListener("mt-item-flags-changed",_h);};' +
  '},[mi.id]);';
c = c.replace(abAnchor, abAnchor + abInjection);
console.log('flag-sync-event: _AB now listens for flag-change events');

// === 3. _AIPS syncs local state with mi.inProgress on prop change ===
const aipsAnchor = '/*mt-fork:aip-series-button*/var mi=e.mediaItem;var _s=r.useState(!!mi.inProgress),active=_s[0],setA=_s[1];';
if ((c.split(aipsAnchor).length - 1) !== 1) {
  console.error('flag-sync-event: _AIPS anchor count != 1');
  process.exit(1);
}
const aipsInjection = 'r.useEffect(function(){setA(!!mi.inProgress);},[mi.inProgress]);';
c = c.replace(aipsAnchor, aipsAnchor + aipsInjection);
console.log('flag-sync-event: _AIPS syncs with mi.inProgress prop');

// === 4a. _AIPS toggle also calls _mtBustItemFlags ===
const aipsToggleAnchor = '/*mt-fork:aip-series-button*/var mi=e.mediaItem;var _s=r.useState(!!mi.inProgress),active=_s[0],setA=_s[1];r.useEffect(function(){setA(!!mi.inProgress);},[mi.inProgress]);var toggle=function(){var url="/api/actively-in-progress/"+mi.id;var method=active?"DELETE":"PUT";var _extra=active?[]:[fetch("/api/watchlist?mediaItemId="+mi.id,{method:"PUT",credentials:"same-origin"}).catch(function(){}),fetch("/api/abandoned/"+mi.id,{method:"DELETE",credentials:"same-origin"}).catch(function(){})];Promise.all([fetch(url,{method:method,credentials:"same-origin"}).then(function(r){return r.json()})].concat(_extra)).then(function(){setA(!active);';
if ((c.split(aipsToggleAnchor).length - 1) !== 1) {
  console.error('flag-sync-event: _AIPS toggle anchor count != 1');
  process.exit(1);
}
const aipsToggleInjection = 'window._mtBustItemFlags&&window._mtBustItemFlags(mi.id);';
c = c.replace(aipsToggleAnchor, aipsToggleAnchor + aipsToggleInjection);
console.log('flag-sync-event: _AIPS toggle now busts flags');

// === 4c. _AB toggle: "Reanudar" (un-abandon) also adds to watchlist ===
// Symmetric to the existing abandon -> remove-from-watchlist branch.
const abWlAnchor = 'if(willAbandon){fetch("/api/watchlist?mediaItemId="+mi.id,{method:"DELETE",credentials:"same-origin"}).catch(function(){})}';
if ((c.split(abWlAnchor).length - 1) !== 1) {
  console.error('flag-sync-event: _AB watchlist branch anchor count != 1');
  process.exit(1);
}
const abWlNew = 'if(willAbandon){fetch("/api/watchlist?mediaItemId="+mi.id,{method:"DELETE",credentials:"same-origin"}).catch(function(){})}else{fetch("/api/watchlist?mediaItemId="+mi.id,{method:"PUT",credentials:"same-origin"}).catch(function(){})}';
c = c.replace(abWlAnchor, abWlNew);
console.log('flag-sync-event: _AB toggle: Resume now re-adds to watchlist');

// === 4b. ig (Add to watchlist) calls _mtBustItemFlags ===
const igAnchor = ',ig=function(e){var t=e.mediaItem,n=e.season,a=e.episode;return r.createElement("div",{className:"text-sm btn-blue ",onClick:function(){fetch("/api/abandoned/"+t.id,{method:"DELETE",credentials:"same-origin"}).catch(function(){});return sn({mediaItem:t,season:n,episode:a})}}';
if ((c.split(igAnchor).length - 1) !== 1) {
  console.error('flag-sync-event: ig anchor count != 1');
  process.exit(1);
}
const igReplaced = ',ig=function(e){var t=e.mediaItem,n=e.season,a=e.episode;return r.createElement("div",{className:"text-sm btn-blue ",onClick:function(){fetch("/api/abandoned/"+t.id,{method:"DELETE",credentials:"same-origin"}).catch(function(){}).finally(function(){window._mtBustItemFlags&&window._mtBustItemFlags(t.id);});return sn({mediaItem:t,season:n,episode:a})}}';
c = c.replace(igAnchor, igReplaced);
console.log('flag-sync-event: ig (Add to watchlist) now busts flags');

c = marker + '\n' + c;
fs.writeFileSync(bundlePath, c);

try {
  child.execSync('node --check ' + bundlePath, { stdio: 'pipe' });
  console.log('flag-sync-event: bundle syntax OK');
} catch (e) {
  console.error('flag-sync-event: SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
  process.exit(1);
}
console.log('flag-sync-event: complete');
})();
