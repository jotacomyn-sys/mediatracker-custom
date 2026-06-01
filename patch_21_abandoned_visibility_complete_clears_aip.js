// patch_21_abandoned_visibility_complete_clears_aip.js
//
// Two fixes:
//
// (A) items.js base filter — abandoned-only items were silently excluded.
//     Line 229 had an unconditional base filter:
//       query.where(qb => qb.whereNotNull('listItem.mediaItemId').orWhereNotNull('lastSeen.mediaItemId'));
//     Items must be on the watchlist OR have at least one seen row, otherwise
//     they're filtered out of every items query (including /abandonados).
//     For an item that was on watchlist -> marked in-progress -> abandoned
//     (the _AB toggle removes the watchlist row), the result is: row exists
//     in `abandoned` but watchlist/seen are both empty, so /abandonados
//     returned 0 items. Confirmed: getItemsKnex with mediaType=movie,
//     onlyAbandoned=true returned total=0 while the raw SELECT found 2.
//
//     Fix: add an OR branch to the base filter that also accepts items
//     with an abandoned row. "Items the user has interacted with" now
//     includes abandoned-only items.
//
// (B) Bundle _markCompleted — clicking "Marcar como completado" inserted
//     a seen row and optionally removed the watchlist row, but never
//     touched AIP. After patch_20 made AIP-manual a universal force-include,
//     completing a non-TV item with an existing AIP excluded=0 row left
//     it pinned in /in-progress. Fix: also fire DELETE /api/actively-in-progress
//     so completion implies "no longer in progress".

const fs = require('fs');
const child = require('child_process');

// === (A) items.js base filter accepts abandoned items ===
(function () {
  const filePath = '/app/build/knex/queries/items.js';
  const marker = '/*mt-fork:base-filter-includes-abandoned*/';
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.includes(marker)) {
    console.log('base-filter (items.js): already applied');
    return;
  }
  const oldFilter = "query.where(qb => qb.whereNotNull('listItem.mediaItemId').orWhereNotNull('lastSeen.mediaItemId'));";
  if ((c.split(oldFilter).length - 1) !== 1) {
    console.error('base-filter (items.js): anchor count != 1');
    process.exit(1);
  }
  const newFilter =
    marker + "\n" +
    "    query.where(qb => qb.whereNotNull('listItem.mediaItemId').orWhereNotNull('lastSeen.mediaItemId').orWhereExists(function() { this.from('abandoned').where('abandoned.userId', userId).whereRaw('abandoned.mediaItemId = mediaItem.id'); }));";
  c = c.replace(oldFilter, newFilter);
  fs.writeFileSync(filePath, c);
  try {
    delete require.cache[require.resolve(filePath)];
    require(filePath);
    console.log('base-filter (items.js): applied + syntax OK');
  } catch (e) {
    console.error('base-filter (items.js): SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
    process.exit(1);
  }
})();

// === (B) Bundle _markCompleted also DELETE AIP ===
(function () {
  const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
  const marker = '/*mt-fork:markcompleted-clears-aip*/';
  let c = fs.readFileSync(bundlePath, 'utf8');
  if (c.includes(marker)) {
    console.log('markcompleted-clears-aip: already applied');
    return;
  }
  // Anchor: the promises array initialization in _markCompleted's _go.
  const oldInit = 'var promises=[fetch(url,{method:"PUT",credentials:"same-origin"})];';
  if ((c.split(oldInit).length - 1) !== 1) {
    console.error('markcompleted-clears-aip: anchor count != 1');
    process.exit(1);
  }
  const newInit =
    'var promises=[fetch(url,{method:"PUT",credentials:"same-origin"})];if(!_tvEp){promises.push(fetch("/api/actively-in-progress/"+t.id,{method:"DELETE",credentials:"same-origin"}).catch(function(){}));}';
  c = c.replace(oldInit, newInit);
  c = '/*' + marker.slice(2, -2) + '*/\n' + c;
  fs.writeFileSync(bundlePath, c);
  try {
    child.execSync('node --check ' + bundlePath, { stdio: 'pipe' });
    console.log('markcompleted-clears-aip: bundle syntax OK');
  } catch (e) {
    console.error('markcompleted-clears-aip: SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
    process.exit(1);
  }
})();

console.log('patch_21: complete');
