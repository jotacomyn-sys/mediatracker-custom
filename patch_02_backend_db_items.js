// Auto-generated mega-patch: patch_02_backend_db_items.js
// Bundles 8 original patch_*.js scripts in execution order.
// Each constituent is wrapped in an IIFE so its top-level vars (const fs = ...)
// don't collide; `process.exit(0)` is rewritten to `return` so an early-exit
// idempotency guard inside one constituent doesn't abort the whole mega-patch.

// ===== patch_version.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/config.js';
let c = fs.readFileSync(path, 'utf8');

// Replace upstream's version with a fork-specific one. Visible in:
//   - server logs at startup ("MediaTracker v0.0.1 escuchando en …")
//   - the About page (Settings → About → version field)
// Bump this when you cut a new "release" of your fork.
const FORK_VERSION = 'v1.1.1';

const old = 'static version = _package.version;';
const fresh = "static version = '" + FORK_VERSION + "';";

if (c.includes("static version = 'v")) { console.log('version: already overridden'); return /* was process.exit(0) */; }
if (!c.includes(old)) {
  // Already patched with the previous suffix-based approach — strip it and re-apply
  c = c.replace(/static version = _package\.version \+ '[^']+';/, fresh);
  if (!c.includes(fresh)) { console.error('version: neither anchor matched'); process.exit(1); }
} else {
  c = c.replace(old, fresh);
}
fs.writeFileSync(path, c);
console.log('version: set to ' + FORK_VERSION);

})();

// ===== patch_auto_restore.js =====
;(() => {
const fs = require('fs');
const path = '/docker/entrypoint.sh';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('# auto-restore-from-backup')) { console.log('auto-restore: already patched'); return /* was process.exit(0) */; }

// Insert restore logic right before the chown lines (so /storage exists but no DB yet).
// If /storage/data.db is missing, copy the most recent /storage/backups/data-*.db to /storage/data.db.
const inject = `
# auto-restore-from-backup: si arrancas en limpio (volumen nuevo, /storage/data.db ausente),
# coge el backup más reciente automáticamente. Disaster recovery sin intervención.
if [ ! -f /storage/data.db ] && [ -d /storage/backups ]; then
  LATEST=$(ls -1t /storage/backups/data-*.db 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    echo "auto-restore: /storage/data.db ausente, restaurando desde $LATEST"
    cp "$LATEST" /storage/data.db
    rm -f /storage/data.db-wal /storage/data.db-shm
    chmod 644 /storage/data.db
  else
    echo "auto-restore: no hay backups disponibles, MT arrancará con BD vacía"
  fi
fi

`;

const anchor = 'chown -R abc:abc /storage';
if (!c.includes(anchor)) { console.error('auto-restore: anchor not found'); process.exit(1); }
c = c.replace(anchor, inject + anchor);
fs.writeFileSync(path, c);
console.log('auto-restore: entrypoint hooked');

})();

// ===== patch_dbconfig.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/dbconfig.js';
let content = fs.readFileSync(path, 'utf8');

const original = 'useNullAsDefault: true,';
const patched  = 'useNullAsDefault: true, pool: { afterCreate: function(conn, done) { try { conn.pragma("journal_mode=WAL"); conn.pragma("mmap_size=268435456"); conn.pragma("cache_size=-65536"); conn.pragma("temp_store=MEMORY"); conn.pragma("synchronous=NORMAL"); conn.pragma("foreign_keys=ON"); } catch(e){} done(null,conn); } },';

if (content.includes(patched)) {
  console.log('dbconfig.js: already patched, skipping');
  return /* was process.exit(0) */;
}

if (!content.includes(original)) {
  console.error('dbconfig.js: anchor not found, aborting');
  process.exit(1);
}

fs.writeFileSync(path, content.replace(original, patched));
console.log('dbconfig.js: SQLite performance pragmas applied');

})();

// ===== patch_items_v2.js =====
;(() => {
// items.js v2: short-circuit the heavy episode subqueries when mediaType !== 'tv'.
// Each episode subquery scans the whole `episode` table even for book/movie/game listings.
// Adding `whereRaw('1=0')` when mediaType is not 'tv' makes SQLite return immediately and
// preserves the SELECT references (no "no such column" error).
const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

// Backup once
const bak = path + '.bak';
if (!fs.existsSync(bak)) { fs.writeFileSync(bak, c); }

if (c.includes('/* PERF_V2_APPLIED */')) { console.log('items v2: already patched'); return /* was process.exit(0) */; }

// Helper: extra clause to inject in each episode subquery
const skip = "${(mediaType && mediaType !== 'tv') ? '.whereRaw(\\'1=0\\')' : ''}";

// We need to patch each `from('episode')` chained subquery by injecting the skip clause
// after `from('episode')`. Use a regex.
const before = c.length;

// Find all `from('episode')` followed by chained calls. Inject `.whereRaw('1=0')` conditionally.
// Knex chains are normally on a single line in compiled output. Use a token marker to make patches idempotent.

// Approach: wrap each subquery callback to apply the where 1=0 conditionally.
// We do textual substitution on the raw code. Each pattern is `qb.<select|...>().from('episode')`
// and we add the conditional whereRaw after the from.

// Simpler textual injection: replace literal `.from('episode')` with `.from('episode')${skip}` template.
// But knex chains need actual JS, not template strings. So do a runtime version: wrap the subquery callbacks.

// Strategy: find each `qb => qb.select|count|min|max(...).from('episode').whereNot(...)`. Replace
// each `.from('episode').` with `.from('episode')${skip}.` where `${skip}` evaluates to either
// `whereRaw('1=0').` or empty.

const escapedSkip = ".modify(function(qq){if(typeof mediaType!=='undefined'&&mediaType&&mediaType!=='tv')qq.whereRaw('1=0')})";

const pattern = ".from('episode')";
const replacement = pattern + escapedSkip;

// Count occurrences and do a controlled replacement only inside the items() function context
// to avoid touching unrelated calls.
// Patch the getItemsKnexSql function only — that's where the heavy episode subqueries live.
const itemsFnStart = c.indexOf("const getItemsKnexSql = async");
if (itemsFnStart < 0) {
  console.error('items v2: getItemsKnexSql function not found');
  process.exit(1);
}
// End: find the `};` followed by `const generateColumnNames` (next top-level declaration)
const itemsFnEnd = c.indexOf("\nconst generateColumnNames", itemsFnStart);
if (itemsFnEnd < 0) {
  console.error('items v2: function end not found');
  process.exit(1);
}

const before2 = c.slice(0, itemsFnStart);
const fnBody = c.slice(itemsFnStart, itemsFnEnd);
const after2 = c.slice(itemsFnEnd);

const patchedFn = fnBody.split(pattern).join(replacement);
const replacements = patchedFn === fnBody ? 0 : (patchedFn.length - fnBody.length) / escapedSkip.length;

c = before2 + patchedFn + after2 + '\n/* PERF_V2_APPLIED */\n';
fs.writeFileSync(path, c);
console.log('items v2:', replacements, "subquery short-circuits added");

// Sanity check: file still loads as JS
try {
  delete require.cache[require.resolve(path)];
  require(path);
  console.log('items v2: syntax OK');
} catch (e) {
  console.error('items v2: SYNTAX ERROR ->', e.message.slice(0, 200));
  fs.writeFileSync(path, fs.readFileSync(bak, 'utf8'));
  console.error('items v2: rolled back to backup');
  process.exit(1);
}

})();

// ===== patch_items_disambiguate.js =====
;(() => {
// Disambiguate "progress" references in items.js after we added episode.progress
// (which made `progress` column ambiguous between progress.progress and the
// joined episode tables' progress column).
const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("/* PROGRESS_DISAMBIGUATED */")) {
  console.log('items disambiguate: already patched'); return /* was process.exit(0) */;
}

// Specifically replace `whereNotNull('progress')` with `whereNotNull('progress.mediaItemId')`
const old = "whereNotNull('progress')";
const fresh = "whereNotNull('progress.mediaItemId')";
if (!c.includes(old)) {
  console.error('items disambiguate: anchor not found'); process.exit(1);
}
const cnt = c.split(old).length - 1;
c = c.split(old).join(fresh);
c += '\n/* PROGRESS_DISAMBIGUATED */\n';
fs.writeFileSync(path, c);
console.log('items disambiguate:', cnt, 'whereNotNull(progress) -> whereNotNull(progress.mediaItemId)');

})();

// ===== patch_tv_episode_progress_in_items.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

// Add `progress` to the firstUnwatchedEpisode object in the items result mapping
const old = "isSpecialEpisode: Boolean(row['firstUnwatchedEpisode.isSpecialEpisode']),\n      userRating: undefined,";
const fresh = "isSpecialEpisode: Boolean(row['firstUnwatchedEpisode.isSpecialEpisode']),\n      progress: row['firstUnwatchedEpisode.progress'],\n      userRating: undefined,";

if (c.includes("progress: row['firstUnwatchedEpisode.progress']")) {
  console.log('tv-episode-progress: already in result mapping');
} else if (!c.includes(old)) {
  console.error('tv-episode-progress: anchor not found'); process.exit(1);
} else {
  c = c.replace(old, fresh);
  fs.writeFileSync(path, c);
  console.log('tv-episode-progress: added progress to firstUnwatchedEpisode result mapping');
}

})();

// ===== patch_in_progress_filter.js =====
;(() => {
// "En proceso" (onlyWithProgress) filter:
//
//   * Auto-include if any of these is true (the five "default" cláusulas):
//     1. Non-TV with progress entry (started but not finished)
//     2. TV with at least 1 episode seen and 1 unseen
//     3. TV with the first-unwatched episode partially watched (progress > 0)
//     4. Item on the watchlist whose release has already happened
//          - non-TV: mediaItem.releaseDate <= today AND no seen entry at all.
//          - TV: at least one already-aired unwatched episode.
//     5. Non-TV with audioProgress strictly between 0 and 1 (audiobook /
//        listening in progress, including "second re-listen" after finishing).
//   * Hard-include override: user clicked "Marcar como en proceso" (row in
//     activelyInProgress with excluded=0) → always show.
//   * Hard-exclude override: user clicked "Quitar de en proceso" (row in
//     activelyInProgress with excluded=1) → never show, even if cláusulas 1-5
//     would have matched.
//
// SQL shape:
//   WHERE (
//     NOT EXISTS (activelyInProgress where excluded=1)
//     AND (clause1 OR clause2 OR clause3 OR clause4 OR clause5)
//   ) OR EXISTS (activelyInProgress where excluded=0)
const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

const upstream = "query.where(qb => qb.where(qb => qb.whereNot('mediaItem.mediaType', 'tv').whereNotNull('progress.mediaItemId')).orWhere(qb => qb.where('mediaItem.mediaType', 'tv').where('seenEpisodesCount', '>', 0).andWhere('unseenEpisodesCount', '>', 0)));";

// v4 — without audioProgress clause (kept as a recognized shape so re-applies
// over a v4-installed bundle bump cleanly to v5 without re-running build from
// scratch).
const v4 = "query.where(qb => qb.where(sub => sub.whereNotExists(function() { this.from('activelyInProgress').whereRaw('activelyInProgress.mediaItemId = mediaItem.id').where('activelyInProgress.userId', userId).where('activelyInProgress.excluded', true); }).andWhere(inner => inner.where(qb => qb.whereNot('mediaItem.mediaType', 'tv').whereNotNull('progress.mediaItemId')).orWhere(qb => qb.where('mediaItem.mediaType', 'tv').where('seenEpisodesCount', '>', 0).andWhere('unseenEpisodesCount', '>', 0)).orWhere(qb => qb.where('mediaItem.mediaType', 'tv').andWhere('firstUnwatchedEpisode.progress', '>', 0)).orWhere(qb => qb.whereNotNull('listItem.mediaItemId').andWhere(s2 => s2.where(qb => qb.whereNot('mediaItem.mediaType', 'tv').whereNotNull('mediaItem.releaseDate').whereNot('mediaItem.releaseDate', '').where('mediaItem.releaseDate', '<=', currentDateString).whereNull('lastSeen.mediaItemId')).orWhere(qb => qb.where('mediaItem.mediaType', 'tv').whereNotNull('firstUnwatchedEpisode.tvShowId')))))).orWhere(qb => qb.whereExists(function() { this.from('activelyInProgress').whereRaw('activelyInProgress.mediaItemId = mediaItem.id').where('activelyInProgress.userId', userId).where('activelyInProgress.excluded', false); })));";

// v5 — adds clause 5 (audioProgress between 0 and 1, non-tv) so audiobooks /
// listening progress on books surface on /in-progress and re-appear on a
// second listen even if a 'watched' seen row already exists.
const fresh = "query.where(qb => qb.where(sub => sub.whereNotExists(function() { this.from('activelyInProgress').whereRaw('activelyInProgress.mediaItemId = mediaItem.id').where('activelyInProgress.userId', userId).where('activelyInProgress.excluded', true); }).andWhere(inner => inner.where(qb => qb.whereNot('mediaItem.mediaType', 'tv').whereNotNull('progress.mediaItemId')).orWhere(qb => qb.where('mediaItem.mediaType', 'tv').where('seenEpisodesCount', '>', 0).andWhere('unseenEpisodesCount', '>', 0)).orWhere(qb => qb.where('mediaItem.mediaType', 'tv').andWhere('firstUnwatchedEpisode.progress', '>', 0)).orWhere(qb => qb.whereNotNull('listItem.mediaItemId').andWhere(s2 => s2.where(qb => qb.whereNot('mediaItem.mediaType', 'tv').whereNotNull('mediaItem.releaseDate').whereNot('mediaItem.releaseDate', '').where('mediaItem.releaseDate', '<=', currentDateString).whereNull('lastSeen.mediaItemId')).orWhere(qb => qb.where('mediaItem.mediaType', 'tv').whereNotNull('firstUnwatchedEpisode.tvShowId')))).orWhere(qb => qb.whereNot('mediaItem.mediaType', 'tv').where('mediaItem.audioProgress', '>', 0).where('mediaItem.audioProgress', '<', 1)))).orWhere(qb => qb.whereExists(function() { this.from('activelyInProgress').whereRaw('activelyInProgress.mediaItemId = mediaItem.id').where('activelyInProgress.userId', userId).where('activelyInProgress.excluded', false); })));";

if (c.includes(fresh)) {
  console.log('in-progress filter: already at v5 (audioProgress clause)');
} else if (c.includes(v4)) {
  c = c.replace(v4, fresh);
  fs.writeFileSync(path, c);
  console.log('in-progress filter: bumped v4 → v5 (audioProgress clause)');
} else if (c.includes(upstream)) {
  c = c.replace(upstream, fresh);
  fs.writeFileSync(path, c);
  console.log('in-progress filter: applied v5 over upstream');
} else {
  console.error('in-progress filter: neither v4 nor upstream anchor found'); process.exit(1);
}

})();

// ===== patch_items_progress_sort_ambiguous.js =====
;(() => {
// Fix `ambiguous column name: progress` SQL error when sorting by orderBy=progress.
//
// Items query joins `progress` table aliased `progress` AND selects
// `progress.progress AS progress` (the column). The orderBy ELSE branch
// references bare `"progress"` which SQLite can't disambiguate → query fails
// with "ambiguous column name: progress" → frontend goes blank.
//
// Fix: qualify with `"progress"."progress"`.

const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

const marker = '/* mt-fork: progress-sort-disambig */';
if (c.includes(marker)) { console.log('progress sort disambig: already patched'); return /* was process.exit(0) */; }

const oldExpr = 'WHEN "mediaItem"."mediaType" = \'tv\' THEN "unseenEpisodesCount"\n                            ELSE "progress"';
const newExpr = 'WHEN "mediaItem"."mediaType" = \'tv\' THEN "unseenEpisodesCount"\n                            ELSE "progress"."progress"';

if (!c.includes(oldExpr)) {
  console.error('progress sort disambig: anchor not found');
  process.exit(1);
}
c = c.replace(oldExpr, newExpr);
c = '// ' + marker + '\n' + c;
fs.writeFileSync(path, c);
console.log('progress sort disambig: applied');

})();

// ===== patch_pagination_out_of_range.js =====
// Bug: getItemsKnex throws "Invalid page number" (HTTP 500 -> blank page) when
// the requested page is beyond the last available page. Reproduces by being on
// /movie?page=3 and then applying a filter ("Lista de seguimiento") whose
// result set fits in fewer pages — the frontend re-uses the URL `page`, the
// server throws, the SPA crashes to white. Replace the throw with a graceful
// clamp: re-run the query at the last valid page so the response carries the
// real last page's data and totalPages, and the UI re-renders coherently.
;(() => {
const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');
const marker = '/* PAGINATION_OOR_CLAMP_V1 */';
if (c.includes(marker)) { console.log('pagination out-of-range: already patched'); return; }
const old =
  "    if (from > total) {\n" +
  "      throw new Error('Invalid page number');\n" +
  "    }";
const fresh =
  "    if (from >= total && total > 0) {\n" +
  "      " + marker + "\n" +
  "      // Stale page (URL/state preserved across a filter change that\n" +
  "      // shrunk the result set). Re-execute on the last valid page so the\n" +
  "      // UI doesn't crash with a 500 and the paginator stays coherent.\n" +
  "      const clamped = Math.max(1, totalPages);\n" +
  "      const reArgs = Object.assign({}, args, { page: clamped });\n" +
  "      const reSql = await getItemsKnexSql(reArgs);\n" +
  "      const reRes = await reSql.sqlPaginationQuery;\n" +
  "      const reFrom = itemsPerPage * (clamped - 1);\n" +
  "      const reTo = Math.min(total, itemsPerPage * clamped);\n" +
  "      return {\n" +
  "        from: reFrom,\n" +
  "        to: reTo,\n" +
  "        data: reRes.map(mapRawResult),\n" +
  "        total: total,\n" +
  "        page: clamped,\n" +
  "        totalPages: totalPages\n" +
  "      };\n" +
  "    }";
if (!c.includes(old)) {
  console.error('pagination out-of-range: anchor not found');
  process.exit(1);
}
c = c.replace(old, fresh);
fs.writeFileSync(path, c);
try {
  delete require.cache[require.resolve(path)];
  require(path);
  console.log('pagination out-of-range: items.js patched + syntax OK');
} catch (e) {
  console.error('pagination out-of-range: SYNTAX ERROR ->', e.message.slice(0, 300));
  process.exit(1);
}
})();
