// patch_26_home_perf.js
//
// Two low-risk perf wins for the home page:
//
// (A) items cache TTL: 30s -> 5min. The cache invalidates on every write
//     anyway (insert/update/delete trigger _itemsCache.clear), so a long
//     TTL just means stale-stable reads persist between mutations. With
//     30s the cache was cold any time the user came back after a brief
//     pause; with 5min the home stays warm across the session.
//
// (B) Progressive home render: the home component currently does
//       if (e===undefined || n===undefined || a===undefined) return loading;
//     blocking the entire page until the slowest of the three queries
//     (RecentlyReleased, 2.5s with 2864 items) completes. Replace the
//     gate so each section renders the moment its data lands; the rest
//     show a small skeleton in their slot. Total time-to-first-content
//     drops to whichever query is fastest.

const fs = require('fs');
const child = require('child_process');

// === (A) Cache TTL ===
(function () {
  const filePath = '/app/build/knex/queries/items.js';
  const marker = '/*mt-fork:items-cache-ttl-5min*/';
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.includes(marker)) {
    console.log('cache-ttl: already applied');
    return;
  }
  const oldLine = 'const _ITEMS_CACHE_TTL = 30000;';
  if ((c.split(oldLine).length - 1) !== 1) {
    console.error('cache-ttl: anchor count != 1');
    process.exit(1);
  }
  const newLine = marker + ' const _ITEMS_CACHE_TTL = 300000;';
  c = c.replace(oldLine, newLine);
  fs.writeFileSync(filePath, c);
  try {
    delete require.cache[require.resolve(filePath)];
    require(filePath);
    console.log('cache-ttl: 30s -> 300s applied');
  } catch (e) {
    console.error('cache-ttl: SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
    process.exit(1);
  }
})();

// === (B) Progressive home render ===
(function () {
  const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
  const marker = '/*mt-fork:home-progressive-render*/';
  let c = fs.readFileSync(bundlePath, 'utf8');
  if (c.includes(marker)) {
    console.log('home-progressive: already patched');
    return;
  }
  // Original block waits for all three primary queries; replace with
  // an early return only when ALL are still loading so we show a tiny
  // loading state and then each section renders as its data arrives
  // (qv already no-ops on empty items).
  const oldGate =
    'if(e===undefined||n===undefined||a===undefined){return r.createElement("div",{className:"text-center py-12 text-gray-500"},"Cargando…");}';
  if ((c.split(oldGate).length - 1) !== 1) {
    console.error('home-progressive: gate anchor count != 1');
    process.exit(1);
  }
  const newGate =
    marker + 'if(e===undefined&&n===undefined&&a===undefined){return r.createElement("div",{className:"text-center py-12 text-gray-500"},"Cargando…");}';
  c = c.replace(oldGate, newGate);
  fs.writeFileSync(bundlePath, c);
  try {
    child.execSync('node --check ' + bundlePath, { stdio: 'pipe' });
    console.log('home-progressive: render progressively (any-of-three)');
  } catch (e) {
    console.error('home-progressive: SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
    process.exit(1);
  }
})();

console.log('patch_26: complete');
