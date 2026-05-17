// Auto-generated mega-patch: patch_05_perf_seen_items_opt.js
// Bundles 22 original patch_*.js scripts in execution order.
// Each constituent is wrapped in an IIFE so its top-level vars (const fs = ...)
// don't collide; `process.exit(0)` is rewritten to `return` so an early-exit
// idempotency guard inside one constituent doesn't abort the whole mega-patch.

// ===== patch_fetch_runtimes_controller.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/item.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('fetchEpisodeRuntimes')) { console.log('fetch-runtimes controller: already patched'); return /* was process.exit(0) */; }

const method = `  fetchEpisodeRuntimes = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const { mediaItemId } = req.query;
    const item = await _dbconfig.Database.knex('mediaItem').select('id','tmdbId','mediaType').where('id', mediaItemId).first();
    if (!item || item.mediaType !== 'tv' || !item.tmdbId) { res.status(400).json({error:'Item must be a TV show with tmdbId'}); return; }
    // Resolve TMDB key: env var first, then user-stored UI key in /storage/tmdb-key.json.
    let TMDB_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_KEY) {
      try { TMDB_KEY = (JSON.parse(require('fs').readFileSync('/storage/tmdb-key.json','utf8')).apiKey || '').trim() || null; } catch(_) { TMDB_KEY = null; }
    }
    if (!TMDB_KEY) {
      res.status(503).json({ error: 'TMDB API key no configurada. Pégala en Tokens de aplicación (Tokens TMDB) o define TMDB_API_KEY en docker-compose.yml.' });
      return;
    }
    const https = require('https');
    const fetchSeason = (sn) => new Promise((ok, fail) => {
      const url = \`https://api.themoviedb.org/3/tv/\${item.tmdbId}/season/\${sn}?api_key=\${TMDB_KEY}\`;
      let data = '';
      https.get(url, r => {
        r.on('data', d => data += d);
        r.on('end', () => { try { ok(JSON.parse(data)); } catch(e) { ok(null); } });
      }).on('error', () => ok(null));
    });
    const seasonNumbers = (await _dbconfig.Database.knex('episode').distinct('seasonNumber').where('tvShowId', item.id)).map(r => r.seasonNumber);
    let updated = 0, totalSeasons = 0;
    for (const sn of seasonNumbers) {
      const data = await fetchSeason(sn);
      if (!data || !Array.isArray(data.episodes)) continue;
      totalSeasons++;
      for (const ep of data.episodes) {
        if (typeof ep.runtime !== 'number') continue;
        const result = await _dbconfig.Database.knex('episode')
          .update({ runtime: ep.runtime })
          .where('tvShowId', item.id)
          .where('seasonNumber', sn)
          .where('episodeNumber', ep.episode_number);
        if (result > 0) updated++;
      }
    }
    res.json({ ok: true, updated, totalSeasons });
  });
`;
const anchor = '}\nexports.MediaItemController = MediaItemController;';
if (!c.includes(anchor)) { console.error('fetch-runtimes controller: close anchor not found'); process.exit(1); }
c = c.replace(anchor, method + anchor);
fs.writeFileSync(path, c);
console.log('fetch-runtimes controller: added fetchEpisodeRuntimes method');

})();

// ===== patch_fetch_runtimes_routes.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/generated/routes/routes.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("/api/episodes/fetch-runtimes'")) { console.log('fetch-runtimes routes: already patched'); return /* was process.exit(0) */; }

const anchor = "router.put('/api/episode-progress'";
if (!c.includes(anchor)) { console.error('fetch-runtimes routes: anchor not found'); process.exit(1); }

const route = `router.post('/api/episodes/fetch-runtimes', validatorHandler({
  requestQuerySchema: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: { mediaItemId: { type: 'number' } },
    required: ['mediaItemId']
  }
}), _MediaItemController.fetchEpisodeRuntimes);
`;
c = c.replace(anchor, route + anchor);
fs.writeFileSync(path, c);
console.log('fetch-runtimes routes: added POST /api/episodes/fetch-runtimes');

})();

// ===== patch_fetch_runtimes_frontend.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// 1. Add a "Cargar duraciones" button in Ay (season detail) — pulls per-episode runtime from TMDB
//    and stores in episode.runtime. Anchor: just before the rating row in the right-hand column.
const oldAy = 'r.createElement("div",{className:"mt-2"},(Wo(a)||!No(n))&&r.createElement(Yo,{mediaItem:n,season:a}))';
const newAy = 'r.createElement("div",{className:"mt-2"},r.createElement("button",{type:"button",className:"text-sm btn-blue",onClick:function(){fetch("/api/episodes/fetch-runtimes?mediaItemId="+n.id,{method:"POST",credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){alert(d.ok?"Duraciones actualizadas: "+d.updated+" episodios":"Error: "+(d.error||"desconocido"));window.location.reload()}).catch(function(e){alert("Error: "+e.message)})}},"Cargar duraciones desde TMDB")),' + oldAy;

if (c.includes('Cargar duraciones desde TMDB')) {
  console.log('fetch-runtimes frontend: button already added');
} else if (!c.includes(oldAy)) {
  console.error('fetch-runtimes frontend: Ay anchor not found'); process.exit(1);
} else {
  c = c.replace(oldAy, newAy);
  console.log('fetch-runtimes frontend: added "Cargar duraciones" button to season page');
}

// 2. Update _EP component to show duration info if episode.runtime is set
const oldLabelSpan = 'r.createElement("span",{className:"text-xs ml-1 text-gray-400",style:{minWidth:"2.5rem"}},_p,"%")';
const newLabelSpan = 'r.createElement("span",{className:"text-xs ml-1 text-gray-400",style:{minWidth:"4rem"}},_ep.runtime?Math.round(_p/100*_ep.runtime)+"/"+_ep.runtime+"min":_p+"%")';
const oldEP = oldLabelSpan;
const newEP = newLabelSpan;

if (c.includes(newEP)) {
  console.log('fetch-runtimes frontend: _EP label already updated');
} else if (!c.includes(oldEP)) {
  console.error('fetch-runtimes frontend: _EP label anchor not found'); process.exit(1);
} else {
  c = c.replace(oldEP, newEP);
  console.log('fetch-runtimes frontend: _EP now shows minutes when runtime is set');
}

fs.writeFileSync(bundlePath, c);
console.log('fetch-runtimes frontend: complete');

})();

// ===== patch_hltb_controller.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/item.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('hltb =')) { console.log('hltb controller: already patched'); return /* was process.exit(0) */; }

const method = `  hltb = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const { mediaItemId } = req.query;
    const item = await _dbconfig.Database.knex('mediaItem').select('igdbId','title').where('id', mediaItemId).first();
    if (!item || !item.igdbId) { res.json({hastily:null,normally:null,completely:null,count:0}); return; }
    try {
      const { IGDB } = require('../metadata/provider/igdb');
      const igdb = new IGDB();
      const data = await igdb.get('game_time_to_beats', \`fields hastily,normally,completely,count; where game_id = \${item.igdbId};\`);
      if (data && data.length > 0) {
        const t = data[0];
        res.json({
          hastily: t.hastily ? Math.round(t.hastily/60) : null,
          normally: t.normally ? Math.round(t.normally/60) : null,
          completely: t.completely ? Math.round(t.completely/60) : null,
          count: t.count || 0
        });
      } else {
        res.json({hastily:null,normally:null,completely:null,count:0});
      }
    } catch (e) {
      res.status(500).json({error: e.message});
    }
  });
`;
const anchor = '}\nexports.MediaItemController = MediaItemController;';
if (!c.includes(anchor)) { console.error('hltb controller: close anchor not found'); process.exit(1); }
c = c.replace(anchor, method + anchor);
fs.writeFileSync(path, c);
console.log('hltb controller: added hltb method (IGDB time_to_beat lookup)');

})();

// ===== patch_hltb_routes.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/generated/routes/routes.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("/api/hltb'")) { console.log('hltb routes: already patched'); return /* was process.exit(0) */; }

const anchor = "router.get('/api/watch-providers'";
if (!c.includes(anchor)) { console.error('hltb routes: anchor not found'); process.exit(1); }

const route = `router.get('/api/hltb', validatorHandler({
  requestQuerySchema: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: { mediaItemId: { type: 'number' } },
    required: ['mediaItemId']
  }
}), _MediaItemController.hltb);
`;
c = c.replace(anchor, route + anchor);
fs.writeFileSync(path, c);
console.log('hltb routes: added GET /api/hltb');

})();

// ===== patch_cleanup_controller.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/item.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('cleanupCatalog')) { console.log('cleanup controller: already patched'); return /* was process.exit(0) */; }

const method = `  cleanupCatalog = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const knex = _dbconfig.Database.knex;
    const orphans = await knex('mediaItem')
      .select('id','title','mediaType')
      .whereNotIn('id', knex.select('mediaItemId').from('listItem').whereNotNull('mediaItemId'))
      .whereNotIn('id', knex.select('mediaItemId').from('seen').whereNotNull('mediaItemId'))
      .whereNotIn('id', knex.select('mediaItemId').from('userRating').whereNotNull('mediaItemId'))
      .whereNotIn('id', knex.select('mediaItemId').from('progress').whereNotNull('mediaItemId'));
    const ids = orphans.map(r => r.id);
    if (ids.length === 0) { res.json({ ok: true, deleted: 0, items: [] }); return; }
    // Cascade: episode + season for any TV shows being purged
    await knex('episode').whereIn('tvShowId', ids).delete();
    await knex('season').whereIn('tvShowId', ids).delete();
    await knex('mediaItem').whereIn('id', ids).delete();
    res.json({ ok: true, deleted: ids.length, items: orphans });
  });
`;
const anchor = '}\nexports.MediaItemController = MediaItemController;';
if (!c.includes(anchor)) { console.error('cleanup controller: anchor not found'); process.exit(1); }
c = c.replace(anchor, method + anchor);
fs.writeFileSync(path, c);
console.log('cleanup controller: added cleanupCatalog method');

})();

// ===== patch_cleanup_routes.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/generated/routes/routes.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("/api/catalog/cleanup'")) { console.log('cleanup routes: already patched'); return /* was process.exit(0) */; }

const anchor = "router.get('/api/hltb'";
if (!c.includes(anchor)) { console.error('cleanup routes: anchor not found'); process.exit(1); }

const route = `router.post('/api/catalog/cleanup', validatorHandler({}), _MediaItemController.cleanupCatalog);
`;
c = c.replace(anchor, route + anchor);
fs.writeFileSync(path, c);
console.log('cleanup routes: added POST /api/catalog/cleanup');

})();

// ===== patch_perf_indexes_migration.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/migrations';
const fname = '20260428000004_addPerfIndexes.js';
const dest = path + '/' + fname;
if (fs.existsSync(dest)) { console.log('perf indexes migration: already exists'); return /* was process.exit(0) */; }

const content = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
exports.down = void 0;
async function up(knex) {
  await knex.schema.table('mediaItem', table => {
    table.index('downloaded', 'mediaitem_downloaded_index');
    table.index('audioProgress', 'mediaitem_audioprogress_index');
    table.index('mediaType', 'mediaitem_mediatype_index');
  });
  await knex.schema.table('episode', table => {
    table.index('progress', 'episode_progress_index');
    table.index(['tvShowId', 'seasonNumber'], 'episode_tvshow_season_index');
  });
}
async function down(knex) {
  await knex.schema.table('mediaItem', table => {
    table.dropIndex('downloaded', 'mediaitem_downloaded_index');
    table.dropIndex('audioProgress', 'mediaitem_audioprogress_index');
    table.dropIndex('mediaType', 'mediaitem_mediatype_index');
  });
  await knex.schema.table('episode', table => {
    table.dropIndex('progress', 'episode_progress_index');
    table.dropIndex(['tvShowId', 'seasonNumber'], 'episode_tvshow_season_index');
  });
}
exports.up = up;
exports.down = down;
//# sourceMappingURL=` + fname + `.map
`;

fs.writeFileSync(dest, content);
console.log('perf indexes migration: created', fname);

})();

// ===== patch_perf_indexes_v2_migration.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/migrations';
const fname = '20260428000005_addSeenMediaItemUserIndex.js';
const dest = path + '/' + fname;
// Always overwrite — the v1 of this file used schema.table().index() which is
// not idempotent and crashes startup if the index already exists from a hot-fix.

const content = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
exports.down = void 0;
async function up(knex) {
  // Composite index to speed up "is this mediaItem seen by this user" lookups.
  // The existing seen_userid_index forced a 31k-row scan per outer row in queries
  // like "tv shows in progress" — this drops them from ~9s to ~1ms.
  // Raw SQL with IF NOT EXISTS so this is idempotent across hot-fixes that
  // may have already created the index manually.
  await knex.raw('CREATE INDEX IF NOT EXISTS seen_mediaitem_user_idx ON seen(mediaItemId, userId)');
}
async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS seen_mediaitem_user_idx');
}
exports.up = up;
exports.down = down;
//# sourceMappingURL=` + fname + `.map
`;

fs.writeFileSync(dest, content);
console.log('perf indexes v2 migration: created', fname);

})();

// ===== patch_perf_indexes_v3_migration.js =====
;(() => {
// V3 perf-indexes migration — adds composite indexes that the backup import,
// listItem dedup, and userRating lookups need.
//
// Audit found these queries doing full or near-full table scans:
//   1) backup.importJson: SELECT FROM seen WHERE userId=? AND mediaItemId=? AND episodeId=?
//      → existing single-column indexes don't compose; add (userId, mediaItemId, episodeId).
//   2) userRating dedup: WHERE userId=? AND mediaItemId=? AND (seasonId=? OR seasonId IS NULL) AND (episodeId=? OR episodeId IS NULL)
//      → no composite at all today; add (userId, mediaItemId, seasonId, episodeId).
//   3) listItem dedup: WHERE listId=? AND mediaItemId=? [AND seasonId=? AND episodeId=?]
//      → only single-column indexes; add the full composite.
//
// Idempotent via `IF NOT EXISTS`. Down drops them.

const fs = require('fs');
const path = '/app/build/migrations';
const fname = '20260504010000_addPerfIndexesV3.js';
const dest = path + '/' + fname;

const content = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
exports.down = void 0;
async function up(knex) {
  // seen: covers backup importJson dedup, "is episode N seen by user U" hot-path
  await knex.raw('CREATE INDEX IF NOT EXISTS seen_user_media_episode_idx ON seen(userId, mediaItemId, episodeId)');
  // userRating: covers all rating lookups across season/episode granularity
  await knex.raw('CREATE INDEX IF NOT EXISTS userrating_user_media_season_episode_idx ON userRating(userId, mediaItemId, seasonId, episodeId)');
  // listItem: dedup during list import + watchlist membership checks
  await knex.raw('CREATE INDEX IF NOT EXISTS listitem_list_media_season_episode_idx ON listItem(listId, mediaItemId, seasonId, episodeId)');
}
async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS seen_user_media_episode_idx');
  await knex.raw('DROP INDEX IF EXISTS userrating_user_media_season_episode_idx');
  await knex.raw('DROP INDEX IF EXISTS listitem_list_media_season_episode_idx');
}
exports.up = up;
exports.down = down;
//# sourceMappingURL=` + fname + `.map
`;

fs.writeFileSync(dest, content);
console.log('perf indexes v3 migration: created', fname);

})();

// ===== patch_seen_kind_migration.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/migrations';
const fname = '20260429000001_addSeenKind.js';
const dest = path + '/' + fname;

const content = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
exports.down = void 0;
async function up(knex) {
  // Adds a 'kind' column to seen so we can distinguish "actually played" from
  // "watched only" (e.g. someone watching a gameplay video). Default 'played'
  // preserves prior behavior — every existing row stays 'played'. The "Visto"
  // filter only surfaces items the user has explicitly marked via the
  // "Marcar como visto" button (which inserts kind='watched').
  //
  // (Earlier versions of this migration auto-reclassified rows whose mediaItem
  // was on the watchlist as 'watched'. That conflated being on the watchlist
  // with having been explicitly marked as watched, polluting the Visto filter
  // — removed.)
  await knex.raw("ALTER TABLE seen ADD COLUMN kind TEXT NOT NULL DEFAULT 'played'");
  await knex.raw('CREATE INDEX IF NOT EXISTS seen_kind_index ON seen(kind)');
}
async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS seen_kind_index');
  await knex.raw('ALTER TABLE seen DROP COLUMN kind');
}
exports.up = up;
exports.down = down;
//# sourceMappingURL=` + fname + `.map
`;

fs.writeFileSync(dest, content);
console.log('seen kind migration: created', fname);

})();

// ===== patch_seen_kind_wiring.js =====
;(() => {
const fs = require('fs');

// === 0. entity/seen.js: add 'kind' to seenColumns ===
// The base repository's create() does `_.pick(value, columnNames)` to filter
// allowed fields. Without 'kind' in the array, any kind we pass to create()
// gets silently stripped and the column DEFAULT 'played' kicks in — which is
// exactly why every "Marcar como visto" click was being recorded as kind=played.
{
  const path = '/app/build/entity/seen.js';
  let c = fs.readFileSync(path, 'utf8');
  const oldCols = "['date', 'id', 'mediaItemId', 'episodeId', 'userId', 'duration']";
  const newCols = "['date', 'id', 'mediaItemId', 'episodeId', 'userId', 'duration', 'kind']";
  if (c.includes("'kind'")) {
    console.log('seen kind wiring: entity already includes kind');
  } else if (c.includes(oldCols)) {
    c = c.replace(oldCols, newCols);
    fs.writeFileSync(path, c);
    console.log('seen kind wiring: entity seenColumns now includes kind');
  } else {
    console.error('seen kind wiring: entity seenColumns anchor not found');
    process.exit(1);
  }
}

// === 1. /api/seen handler: accept `kind` from query, default 'played' ===
{
  const path = '/app/build/controllers/seen.js';
  let c = fs.readFileSync(path, 'utf8');

  // 1a. Destructure: add `kind` to req.query unpack inside `add =`
  const destructOld = "const {\n      mediaItemId,\n      seasonId,\n      episodeId,\n      lastSeenAt,\n      lastSeenEpisodeId,\n      duration\n    } = req.query;";
  const destructNew = "const {\n      mediaItemId,\n      seasonId,\n      episodeId,\n      lastSeenAt,\n      lastSeenEpisodeId,\n      duration,\n      kind\n    } = req.query;";
  if (c.includes(destructNew)) {
    // already applied
  } else if (c.includes(destructOld)) {
    c = c.replace(destructOld, destructNew);
    console.log('seen kind wiring: /api/seen destructure now includes kind');
  } else {
    console.error('seen kind wiring: /api/seen destructure anchor not found');
    process.exit(1);
  }

  // 1b. addByExternalId: trx('seen').insert — add `kind` column
  const insOld = "await trx('seen').insert({\n        userId: userId,\n        mediaItemId: mediaItem.id,\n        episodeId: (episode === null || episode === void 0 ? void 0 : episode.id) || null,\n        date: Date.now(),\n        duration: duration\n      });";
  const insNew = "await trx('seen').insert({\n        userId: userId,\n        mediaItemId: mediaItem.id,\n        episodeId: (episode === null || episode === void 0 ? void 0 : episode.id) || null,\n        date: Date.now(),\n        duration: duration,\n        kind: kind || 'played'\n      });";
  if (c.includes(insNew)) {
    // already applied
  } else if (c.includes(insOld)) {
    c = c.replace(insOld, insNew);
    console.log('seen kind wiring: addByExternalId insert stores kind');
  }

  // 1c. addByExternalId: 12-hour dedupe — filter by kind so visto/played dedupe independently
  const dedupeOld = "const previousSeenItem = await trx('seen').where('userId', userId).where('mediaItemId', mediaItem.id).where('episodeId', (episode === null || episode === void 0 ? void 0 : episode.id) || null).where('date', '>', Date.now() - 1000 * 60 * 60 * 12);";
  const dedupeNew = "const previousSeenItem = await trx('seen').where('userId', userId).where('mediaItemId', mediaItem.id).where('episodeId', (episode === null || episode === void 0 ? void 0 : episode.id) || null).where('kind', kind || 'played').where('date', '>', Date.now() - 1000 * 60 * 60 * 12);";
  if (c.includes(dedupeNew)) {
    // already applied
  } else if (c.includes(dedupeOld)) {
    c = c.replace(dedupeOld, dedupeNew);
    console.log('seen kind wiring: addByExternalId dedupe is per-kind');
  }

  // 1d. add handler: non-TV (movies/games/books) seenRepository.create — add kind.
  // This is the path the "Marcar como visto" (_MAS) and "Marcar como completado"
  // buttons hit. Without this edit kind is silently dropped and every row
  // becomes kind='played' (the column DEFAULT).
  const createNonTvOld = "await _seen.seenRepository.create({\n            userId: userId,\n            mediaItemId: mediaItemId,\n            episodeId: null,\n            date: ((_date5 = date) === null || _date5 === void 0 ? void 0 : _date5.getTime()) || null,\n            duration: duration || null\n          });";
  const createNonTvNew = "await _seen.seenRepository.create({\n            userId: userId,\n            mediaItemId: mediaItemId,\n            episodeId: null,\n            date: ((_date5 = date) === null || _date5 === void 0 ? void 0 : _date5.getTime()) || null,\n            duration: duration || null,\n            kind: kind || 'played'\n          });";
  if (c.includes(createNonTvNew)) {
    // already applied
  } else if (c.includes(createNonTvOld)) {
    c = c.replace(createNonTvOld, createNonTvNew);
    console.log('seen kind wiring: add handler non-TV create now stores kind');
  } else {
    console.error('seen kind wiring: add handler non-TV create anchor not found');
    process.exit(1);
  }

  // 1e. add handler: episodeId path — add kind.
  const createEpOld = "await _seen.seenRepository.create({\n          userId: userId,\n          mediaItemId: mediaItemId,\n          episodeId: episodeId,\n          date: ((_date2 = date) === null || _date2 === void 0 ? void 0 : _date2.getTime()) || null\n        });";
  const createEpNew = "await _seen.seenRepository.create({\n          userId: userId,\n          mediaItemId: mediaItemId,\n          episodeId: episodeId,\n          date: ((_date2 = date) === null || _date2 === void 0 ? void 0 : _date2.getTime()) || null,\n          kind: kind || 'played'\n        });";
  if (c.includes(createEpNew)) {
    // already applied
  } else if (c.includes(createEpOld)) {
    c = c.replace(createEpOld, createEpNew);
    console.log('seen kind wiring: add handler episode create now stores kind');
  }

  // 1f. add handler: TV-show, seasonId, lastSeenEpisodeId createMany rows — add kind.
  // The "duration: ..." line appears at three different indents (10/12/14
  // spaces for lastSeenEpisodeId / seasonId / TV-show paths). One pass per
  // indent to preserve formatting.
  const durLine = "duration: episode.runtime * 60 * 1000 || mediaItem.runtime * 60 * 1000";
  const indents = ['          ', '            ', '              ']; // 10, 12, 14
  for (const ind of indents) {
    const oldL = ind + durLine + '\n';
    const newL = ind + durLine + ',\n' + ind + "kind: kind || 'played'\n";
    // Idempotent via the oldL match — once edited, the line ends in "..,\n"
    // and no longer matches oldL (which ends in "..\n").
    if (c.includes(oldL)) {
      c = c.replace(oldL, newL);
      console.log('seen kind wiring: createMany row at indent', ind.length, 'now stores kind');
    }
  }

  // 1g. Watchlist auto-removal: removed entirely. The four states (pendiente /
  // en curso / visto / completado) must be independent toggles — marking any
  // of them should not implicitly mutate the others. The user can clear the
  // watchlist explicitly via the "Quitar de pendientes" button.
  const wlOld = "if (mediaItem.mediaType !== 'tv') {\n        await _listItemRepository.listItemRepository.removeItem({\n          userId: userId,\n          mediaItemId: mediaItemId,\n          watchlist: true\n        });\n      }";
  const wlGate = "if (mediaItem.mediaType !== 'tv' && (kind || 'played') !== 'watched') {\n        await _listItemRepository.listItemRepository.removeItem({\n          userId: userId,\n          mediaItemId: mediaItemId,\n          watchlist: true\n        });\n      }";
  const wlNew = "/* mt-fork: states independent — no implicit watchlist mutation on /api/seen */";
  if (c.includes(wlNew)) {
    // already applied
  } else if (c.includes(wlOld)) {
    c = c.replace(wlOld, wlNew);
    console.log('seen kind wiring: add handler no longer removes from watchlist');
  } else if (c.includes(wlGate)) {
    // upgrade from the kind=watched-only gate
    c = c.replace(wlGate, wlNew);
    console.log('seen kind wiring: add handler no longer removes from watchlist (upgraded)');
  }

  // 1h. removeFromSeenHistory (DELETE /api/seen?mediaItemId=...): accept
  // optional `kind` query param so "Quitar completado" can delete only the
  // 'played' rows without nuking 'watched' rows (and vice-versa).
  const rmOld = "removeFromSeenHistory = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n    const userId = Number(req.user);\n    const {\n      mediaItemId,\n      seasonId,\n      episodeId\n    } = req.query;\n    if (episodeId) {\n      await _seen.seenRepository.delete({\n        userId: userId,\n        episodeId: episodeId\n      });\n    } else if (seasonId) {\n      await _seen.seenRepository.deleteForTvSeason({\n        userId: userId,\n        seasonId: seasonId\n      });\n    } else {\n      await _seen.seenRepository.delete({\n        userId: userId,\n        mediaItemId: mediaItemId\n      });\n    }\n    res.send();\n  });";
  const rmNew = "removeFromSeenHistory = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n    const userId = Number(req.user);\n    const {\n      mediaItemId,\n      seasonId,\n      episodeId,\n      kind\n    } = req.query;\n    if (episodeId) {\n      await _seen.seenRepository.delete({\n        userId: userId,\n        episodeId: episodeId,\n        kind: kind || undefined\n      });\n    } else if (seasonId) {\n      await _seen.seenRepository.deleteForTvSeason({\n        userId: userId,\n        seasonId: seasonId\n      });\n    } else {\n      await _seen.seenRepository.delete({\n        userId: userId,\n        mediaItemId: mediaItemId,\n        kind: kind || undefined\n      });\n    }\n    res.send();\n  });";
  if (c.includes("kind: kind || undefined")) {
    // already applied
  } else if (c.includes(rmOld)) {
    c = c.replace(rmOld, rmNew);
    console.log('seen kind wiring: removeFromSeenHistory accepts kind filter');
  } else {
    console.error('seen kind wiring: removeFromSeenHistory anchor not found');
    process.exit(1);
  }

  fs.writeFileSync(path, c);
}

// === 2. Eye-click _SE: send kind=watched ===
// (Eye on game cards was removed by patch_game_seen.js; this stays as a
// belt-and-braces edit in case the constant survives somewhere.)
{
  const bundlePath = require('child_process').execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
  let c = fs.readFileSync(bundlePath, 'utf8');
  const oldUrl = '"/api/seen?mediaItemId="+e.id+"&lastSeenAt=now"';
  const newUrl = '"/api/seen?mediaItemId="+e.id+"&lastSeenAt=now&kind=watched"';
  if (c.includes('&kind=watched')) {
    console.log('seen kind wiring: eye-click already sends kind=watched');
  } else if (c.includes(oldUrl)) {
    c = c.replace(oldUrl, newUrl);
    fs.writeFileSync(bundlePath, c);
    console.log('seen kind wiring: eye-click _SE now sends kind=watched');
  } else {
    console.log('seen kind wiring: eye-click anchor not found (skipping)');
  }
}

// === 3. items.js: support onlyPlayed and onlyWatched filters (using seen.kind) ===
{
  const path = '/app/build/knex/queries/items.js';
  let c = fs.readFileSync(path, 'utf8');
  // Guard must check the destructure specifically — `onlyPlayed` alone also appears
  // in the count fast-path injected by patch_items_simple_count.js, which would
  // make this whole block a no-op even though the args destructure is missing.
  if (/onlyPlayed,\s*onlyWatched\s*\}\s*=\s*args;/.test(c)) {
    console.log('seen kind wiring: items.js already supports onlyPlayed/onlyWatched');
  } else {
    // Strip prior onlyKind injection if it exists
    c = c.replace(",\n    onlyKind", "");
    c = c.replace(/    if \(onlyKind === 'played' \|\| onlyKind === 'watched'\) \{[\s\S]*?\}\n    /, '    ');
    // Add to args destructure. Order-independent: handles whichever variable
    // happens to be last when this patch runs (onlyDownloaded if items_only_downloaded
    // ran first, otherwise onlyWithProgress). Both anchors live inside getItemsKnexSql
    // — the other `} = args;` in the file is `getItemsKnex`'s `{ page }` destructure.
    if (c.includes("onlyDownloaded\n  } = args;")) {
      c = c.replace("onlyDownloaded\n  } = args;", "onlyDownloaded,\n    onlyPlayed,\n    onlyWatched\n  } = args;");
    } else if (c.includes("onlyWithProgress\n  } = args;")) {
      c = c.replace("onlyWithProgress\n  } = args;", "onlyWithProgress,\n    onlyPlayed,\n    onlyWatched\n  } = args;");
    } else {
      console.error('seen kind wiring: items.js destructure anchor not found');
      process.exit(1);
    }
    // Add filter clauses near onlySeenItems (truthy on string|bool|number)
    const anchor = "if (onlySeenItems === true || onlySeenItems === 'true' || onlySeenItems === 1) {";
    const inject =
      "if (onlyPlayed === true || onlyPlayed === 'true' || onlyPlayed === 1) {\n" +
      "      query.whereExists(function() { this.from('seen').where('seen.userId', userId).where('seen.kind', 'played').whereRaw('seen.mediaItemId = mediaItem.id'); });\n" +
      "    }\n" +
      "    if (onlyWatched === true || onlyWatched === 'true' || onlyWatched === 1) {\n" +
      "      query.whereExists(function() { this.from('seen').where('seen.userId', userId).where('seen.kind', 'watched').whereRaw('seen.mediaItemId = mediaItem.id'); });\n" +
      "    }\n" +
      "    " + anchor;
    if (c.includes(anchor)) c = c.replace(anchor, inject);
    fs.writeFileSync(path, c);
    console.log('seen kind wiring: items.js accepts onlyPlayed and onlyWatched');
  }
}

})();

// ===== patch_states_independent.js =====
;(() => {
// The four item states (pendiente / en curso / visto / completado) must be
// independent toggles — clicking one button must not implicitly mutate the
// others. Upstream `addItem` in progress.js auto-adds to the watchlist when
// progress<1 and auto-removes when progress===1; that means "Quitar
// completado" (which sets progress=0) silently adds the item back to
// Pendientes. Strip both branches.

const fs = require('fs');
const path = '/app/build/controllers/progress.js';
let c = fs.readFileSync(path, 'utf8');

const marker = '/* mt-fork: states-independent — no implicit watchlist mutation */';

if (c.includes(marker)) {
  console.log('states-independent: already patched');
  return /* was process.exit(0) */;
}

const oldBlock =
  "  if (args.progress < 1) {\n" +
  "    await _listItemRepository.listItemRepository.addItem({\n" +
  "      userId: args.userId,\n" +
  "      mediaItemId: args.mediaItemId,\n" +
  "      watchlist: true\n" +
  "    });\n" +
  "  } else if (args.progress === 1 && args.episodeId == undefined) {\n" +
  "    await _listItemRepository.listItemRepository.removeItem({\n" +
  "      userId: args.userId,\n" +
  "      mediaItemId: args.mediaItemId,\n" +
  "      watchlist: true\n" +
  "    });\n" +
  "  }";

if (!c.includes(oldBlock)) {
  console.error('states-independent: addItem watchlist anchor not found');
  process.exit(1);
}

c = c.replace(oldBlock, '  ' + marker);
fs.writeFileSync(path, c);
console.log('states-independent: progress.addItem no longer mutates watchlist');

})();

// ===== patch_items_dedupe_lastseen.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('// lastseen-deduped')) { console.log('items dedupe lastSeen: already patched'); return /* was process.exit(0) */; }

// 1. Drop the redundant leftJoin for `lastSeen2` — it's a byte-for-byte copy of
//    `lastSeen` (same SELECT, same WHERE, same GROUP BY) yet SQLite materializes
//    AND scan-joins each one separately. With 24k mediaItems × 3k seen rows, that
//    second join costs ~5s on this DB.
const oldLeftJoin = ".leftJoin(qb => qb.select('mediaItemId').max('date', {\n    as: 'date'\n  }).from('seen').where('userId', userId).groupBy('mediaItemId').as('lastSeen2'), 'lastSeen2.mediaItemId', 'mediaItem.id')";
if (!c.includes(oldLeftJoin)) {
  console.error('items dedupe lastSeen: leftJoin anchor not found'); process.exit(1);
}
c = c.replace(oldLeftJoin, ' // lastseen-deduped (was redundant lastSeen2 join)');

// 2. Redirect every read of lastSeen2.mediaItemId to lastSeen.mediaItemId
c = c.split("'lastSeen2.mediaItemId': 'lastSeen2.mediaItemId'").join("'lastSeen2.mediaItemId': 'lastSeen.mediaItemId'");
c = c.split("'lastSeen2.mediaItemId'").join("'lastSeen.mediaItemId'");
c = c.split("row['lastSeen2.mediaItemId']").join("row['lastSeen.mediaItemId']");
c = c.split("query.whereNotNull('lastSeen2.mediaItemId')").join("query.whereNotNull('lastSeen.mediaItemId')");

fs.writeFileSync(path, c);
console.log('items dedupe lastSeen: removed redundant lastSeen2 join (~50% query speedup on movies)');

})();

// ===== patch_game_watched_card_icon.js =====
;(() => {
// Show an eye icon (visibility) on game cards when the item has at least one
// kind='watched' seen row, positioned at top-right just next to (left of) the
// existing "Completado" check_circle. Two icons can show simultaneously when
// the game is both played and watched.
//
// Edits:
//   1. controllers/queries/items.js: add a `seenWatched` flag to each row by
//      joining a subquery of distinct (userId, mediaItemId) pairs from seen
//      where kind='watched'. Cheap: one subquery, indexed on seen_kind_index.
//   2. main bundle: insert a conditional createElement for the eye icon next
//      to the existing check_circle anchor.

const fs = require('fs');
const child = require('child_process');

// ===== Backend: items.js =====
{
  const path = '/app/build/knex/queries/items.js';
  let c = fs.readFileSync(path, 'utf8');
  if (c.includes('// mt-fork: seenWatched-flag')) {
    console.log('game watched card icon: items.js already patched');
  } else {
    // Anchor: the existing leftJoin for `lastSeen` (introduced upstream).
    // Place the new join right after it so the alias `seenWatched` is in scope
    // before the row map.
    const joinAnchor =
      "}).from('seen').where('userId', userId).groupBy('mediaItemId').as('lastSeen'), 'lastSeen.mediaItemId', 'mediaItem.id')";
    if (!c.includes(joinAnchor)) {
      console.error('game watched card icon: lastSeen join anchor not found');
      process.exit(1);
    }
    const newJoin =
      joinAnchor +
      "\n    // mt-fork: seenWatched-flag\n" +
      "    .leftJoin(qb => qb.select('mediaItemId').from('seen').where('userId', userId).where('kind', 'watched').groupBy('mediaItemId').as('seenWatched'), 'seenWatched.mediaItemId', 'mediaItem.id')";
    c = c.replace(joinAnchor, newJoin);

    // Add seenWatched.mediaItemId to the main .select({...}) — without this
    // the column isn't materialized in the result rows (knex only returns
    // what's explicitly selected even when the join is wired up).
    const selectAnchor =
      "    'lastSeen.mediaItemId': 'lastSeen.mediaItemId',";
    if (!c.includes(selectAnchor)) {
      console.error('game watched card icon: select lastSeen anchor not found');
      process.exit(1);
    }
    const selectNew = selectAnchor +
      "\n    'seenWatched.mediaItemId': 'seenWatched.mediaItemId',";
    c = c.replace(selectAnchor, selectNew);

    // Anchor: the row map `seen: row[...] === 'tv' ? ... : Boolean(...)`.
    // Add `seenWatched: Boolean(row['seenWatched.mediaItemId'])` right after.
    const seenLine =
      "seen: row['mediaItem.mediaType'] === 'tv' ? row.numberOfEpisodes > 0 && !row.unseenEpisodesCount : Boolean(row['lastSeen.mediaItemId']),";
    if (!c.includes(seenLine)) {
      console.error('game watched card icon: row.seen anchor not found');
      process.exit(1);
    }
    const seenLineNew =
      seenLine + "\n    seenWatched: Boolean(row['seenWatched.mediaItemId']),";
    c = c.replace(seenLine, seenLineNew);
    fs.writeFileSync(path, c);
    console.log('game watched card icon: items.js exposes seenWatched per item');
  }
}

// ===== Frontend: insert eye icon outside the s-gated Fragment =====
// The audiobook/check_circle/book icons live inside the `s && Fragment(...)`
// non-TV branch, so they only render when the parent Zv passes a non-empty
// `gridItemAppearance`. The _GVS split sub-sections pass `gridItemAppearance:{}`,
// which would hide the eye there. Anchor on the play_circle element which sits
// at the SAME tree level as `s && Fragment(...)` (outside the gate) so the eye
// shows on every page that lists game cards regardless of appearance config.
{
  const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
  let c = fs.readFileSync(bundlePath, 'utf8');
  const marker = '/*mt-fork:game-watched-card-icon*/';
  if (c.includes(marker)) {
    console.log('game watched card icon: bundle already patched');
  } else {
    // Anchor: the "Jugando" play_circle, which is at the s-ungated level,
    // sibling of `s && Fragment(...)`.
    const anchor =
      'Ao(t)&&t.progress>0&&!t.seen&&r.createElement("div",{className:"absolute inline-flex pointer-events-auto foo top-1 right-1"},r.createElement(Fv,null,r.createElement("i",{className:"flex text-white select-none material-icons",title:"Jugando"},"play_circle_outline")))';
    if (!c.includes(anchor)) {
      console.error('game watched card icon: play_circle (s-ungated) anchor not found');
      process.exit(1);
    }
    // Eye icon: shown for games when seenWatched is true. Stacked BELOW the
    // check_circle (same right-1 anchor, top:2.5rem). For pages where the
    // check_circle isn't drawn (s={}), the eye still appears alone at this
    // offset — fine, since the user only cares it's *there*.
    const eye =
      '"video_game"===t.mediaType&&t.seenWatched&&r.createElement("div",{className:"absolute inline-flex pointer-events-auto foo right-1",style:{top:"2.5rem"}' + marker + '},r.createElement(Fv,null,r.createElement("span",{className:"flex material-icons",title:"Visto"},"visibility"))),';
    c = c.replace(anchor, eye + anchor);
    fs.writeFileSync(bundlePath, c);
    console.log('game watched card icon: eye injected outside s-gated Fragment (visible on all pages)');
  }
}

})();

// ===== patch_items_query_cache.js =====
;(() => {
// React-Query default staleTime is 0, so every Zv mount re-fetches /api/items
// even when the same args were just fetched. On the games "Visto" filter the
// page renders three Zv instances (parent + two split sections) and a quick
// re-render pulls 3 sets of network requests + image reflows that look like
// covers "updating multiple times".
//
// Bump staleTime to 60s and cacheTime to 5 min so revisits within that window
// hit the cache. keepPreviousData stays so filter/page changes don't blank
// the grid while loading.

const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/*mt-fork:items-query-cache*/';
if (c.includes(marker)) {
  console.log('items-query-cache: already patched');
  return /* was process.exit(0) */;
}

// Anchor: dg's useQuery options object — appears immediately after
// `Se.items.paginated(e)` in the await wrapper.
const old = 'Se.items.paginated(e));case 1:case"end":return t.stop()}}),t)}))),{keepPreviousData:!0})';
const fresh = 'Se.items.paginated(e));case 1:case"end":return t.stop()}}),t)}))),{keepPreviousData:!0,staleTime:60000,cacheTime:300000}' + marker + ')';

if (!c.includes(old)) {
  console.error('items-query-cache: dg useQuery anchor not found'); process.exit(1);
}
c = c.replace(old, fresh);
fs.writeFileSync(bundlePath, c);
console.log('items-query-cache: dg useQuery now has staleTime=60s, cacheTime=5m');

})();

// ===== patch_items_short_circuit_seen_episodes.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('// seenEpisodes-short-circuited')) { console.log('items short-circuit seenEpisodes: already patched'); return /* was process.exit(0) */; }

// Short-circuit the seenEpisodes inner subquery for non-tv mediaTypes. The subquery
// scans all 31k seen rows + episode joins + groups twice. For movies/books/games
// it produces zero useful rows but still pays the materialization cost (~1.5s).
const old = "qb => qb.select('mediaItemId').from('seen').where('userId', userId).whereNotNull('episodeId').groupBy('mediaItemId', 'episodeId').leftJoin('episode', 'episode.id', 'seen.episodeId').whereNot('episode.isSpecialEpisode', true).as('seen')";
const fresh = "qb => qb.select('mediaItemId').from('seen').modify(function(qq){if(typeof mediaType!=='undefined'&&mediaType&&mediaType!=='tv')qq.whereRaw('1=0')}).where('userId', userId).whereNotNull('episodeId').groupBy('mediaItemId', 'episodeId').leftJoin('episode', 'episode.id', 'seen.episodeId').whereNot('episode.isSpecialEpisode', true).as('seen') /* seenEpisodes-short-circuited */";

if (!c.includes(old)) { console.error('items short-circuit seenEpisodes: anchor not found'); process.exit(1); }
c = c.replace(old, fresh);
fs.writeFileSync(path, c);
console.log('items short-circuit seenEpisodes: skip 31k-row materialization for non-tv mediaTypes');

})();

// ===== patch_items_force_index.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('INDEXED BY mediaitem_mediatype_index')) { console.log('items force index: already patched'); return /* was process.exit(0) */; }

// SQLite's planner picks `mediaitem_goodreadsid_mediatype_unique` instead of the
// plain `mediaitem_mediatype_index` for the items query — 100× slower (5400ms vs
// 46ms). Force the right index via INDEXED BY hint by replacing knex's
// `.from('mediaItem')` with a raw FROM clause.
const old = ".from('mediaItem')";
const fresh = ".from(_dbconfig.Database.knex.raw('`mediaItem` INDEXED BY mediaitem_mediatype_index'))";

if (!c.includes(old)) { console.error('items force index: anchor not found'); process.exit(1); }
// Only the OUTER from('mediaItem') — there are nested .from('seen'), .from('episode'), etc.
// Replace just the first/outermost (the chain pattern uses .from('mediaItem').leftJoin(...))
const idx = c.indexOf(old + '.leftJoin');
if (idx < 0) { console.error('items force index: outer from anchor not found'); process.exit(1); }
c = c.slice(0, idx) + fresh + c.slice(idx + old.length);

fs.writeFileSync(path, c);
console.log('items force index: forced mediaitem_mediatype_index (fixes 5400ms→46ms planner regression)');

})();

// ===== patch_items_simple_count.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('// simple-count-fast-path')) { console.log('items simple count: already patched'); return /* was process.exit(0) */; }

// Replace the heavy COUNT query (which clones all joins → 5.4s on movies) with
// a fast-path simple count when there are no filters that depend on the joined
// tables. The total is still consistent for the common "browse the tab" case
// because none of those filters are active. Falls through to the heavy count
// only when a join-based filter is actually requested.
const old = "const sqlCountQuery = query.clone().clearOrder().clearSelect().count('*', {\n    as: 'count'\n  });";
const fresh = `const _knex = _dbconfig.Database.knex;
  const _applyMt = qb => { if (mediaType) qb.where('mediaType', mediaType); if (mediaItemIds) qb.whereIn('id', mediaItemIds); };
  let sqlCountQuery;
  if (filter) {
    sqlCountQuery = query.clone().clearOrder().clearSelect().count('*', { as: 'count' });
  } else if (onlyOnWatchlist) {
    sqlCountQuery = _knex('mediaItem').modify(_applyMt).whereIn('id',
      _knex('listItem').select('mediaItemId')
        .join('list', 'list.id', 'listItem.listId')
        .where('list.userId', userId).where('list.isWatchlist', true)
    ).count('* as count');
  } else if (onlyWithProgress) {
    // For TV: must have at least one seen episode AND at least one aired non-special
    // episode still unwatched. The orig fast-path was missing the "still unwatched"
    // condition, counting completed series as "in progress" (303 vs real 61).
    // For non-TV: also covers audiobooks/listening progress on books (audioProgress
    // strictly between 0 and 1, including a re-listen after the book was finished).
    sqlCountQuery = _knex('mediaItem').modify(_applyMt).where(qb => qb
      .whereExists(qbb => qbb.from('progress').whereRaw('progress.mediaItemId = mediaItem.id').where('progress.userId', userId).where('progress.progress', '<', 1))
      .orWhere(qb2 => qb2.where('mediaItem.mediaType', 'tv')
        .whereExists(qbb => qbb.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId))
        .whereExists(qbe => qbe.from('episode').whereRaw('episode.tvShowId = mediaItem.id')
          .where('episode.isSpecialEpisode', false)
          .whereNotNull('episode.releaseDate')
          .where('episode.releaseDate', '<=', currentDateString)
          .whereNotExists(qbs => qbs.from('seen').whereRaw('seen.episodeId = episode.id').where('seen.userId', userId))
        ))
      .orWhere(qb3 => qb3.whereNot('mediaItem.mediaType', 'tv').where('mediaItem.audioProgress', '>', 0).where('mediaItem.audioProgress', '<', 1))
    ).count('* as count');
  } else if (onlyWithNextAiring) {
    sqlCountQuery = _knex('mediaItem').modify(_applyMt).where(qb => qb
      .where(qb1 => qb1.whereNot('mediaType', 'tv').where('releaseDate', '>', currentDateString))
      .orWhere(qb2 => qb2.where('mediaType', 'tv').whereExists(qbb => qbb.from('episode').whereRaw('episode.tvShowId = mediaItem.id').where('episode.isSpecialEpisode', false).where('episode.releaseDate', '>', currentDateString)))
    ).count('* as count');
  } else if (onlyWithNextEpisodesToWatch) {
    sqlCountQuery = _knex('mediaItem').where('mediaType', 'tv')
      .whereExists(qb => qb.from('episode').whereRaw('episode.tvShowId = mediaItem.id')
        .where('episode.isSpecialEpisode', false)
        .where('episode.releaseDate', '<=', currentDateString)
        .whereNotExists(qbb => qbb.from('seen').whereRaw('seen.episodeId = episode.id').where('seen.userId', userId))
      ).count('* as count');
  } else if (onlySeenItems) {
    sqlCountQuery = _knex('mediaItem').modify(_applyMt)
      .whereExists(qb => qb.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId))
      .count('* as count');
  } else if (onlyWithUserRating) {
    sqlCountQuery = _knex('mediaItem').modify(_applyMt)
      .whereExists(qb => qb.from('userRating').whereRaw('userRating.mediaItemId = mediaItem.id').where('userRating.userId', userId).whereNotNull('userRating.rating'))
      .count('* as count');
  } else if (onlyWithoutUserRating) {
    sqlCountQuery = _knex('mediaItem').modify(_applyMt)
      .whereNotExists(qb => qb.from('userRating').whereRaw('userRating.mediaItemId = mediaItem.id').where('userRating.userId', userId).whereNotNull('userRating.rating'))
      .count('* as count');
  } else if (onlyPlayed) {
    sqlCountQuery = _knex('mediaItem').modify(_applyMt)
      .whereExists(qb => qb.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId).where('seen.kind', 'played'))
      .count('* as count');
  } else if (onlyWatched) {
    sqlCountQuery = _knex('mediaItem').modify(_applyMt)
      .whereExists(qb => qb.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId).where('seen.kind', 'watched'))
      .count('* as count');
  } else {
    sqlCountQuery = _knex('mediaItem').modify(_applyMt).count('* as count');
  } // count-fast-path`;

// Make this idempotent: strip any previous count-fast-path block, then inject the new one
c = c.replace(/const _knex = _dbconfig\.Database\.knex;\n  const _applyMt = qb => \{[\s\S]*?\} \/\/ count-fast-path/, old);
if (!c.includes(old)) { console.error('items simple count: anchor not found'); process.exit(1); }
c = c.replace(old, fresh);
fs.writeFileSync(path, c);
console.log('items simple count: heavy COUNT skipped when no join filters');

})();

// ===== patch_only_seen_items_truthy.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('// only-seen-truthy')) { console.log('only-seen truthy: already patched'); return /* was process.exit(0) */; }

// Original:  if (onlySeenItems === true) { query.whereNotNull('lastSeen.mediaItemId'); }
// Bug: query string params arrive as strings ("true"), so === true is always false
// → filter never applies → data returns ALL items, only count shows correct N.
const old = "    if (onlySeenItems === true) {\n      query.whereNotNull('lastSeen.mediaItemId');\n    }";
const fresh = "    if (onlySeenItems === true || onlySeenItems === 'true' || onlySeenItems === 1) { // only-seen-truthy\n      query.whereNotNull('lastSeen.mediaItemId');\n    }";
if (!c.includes(old)) { console.error('only-seen truthy: anchor not found'); process.exit(1); }
c = c.replace(old, fresh);

fs.writeFileSync(path, c);
console.log('only-seen truthy: filter now accepts "true"/1 string-form too');

})();

// ===== patch_games_seen_filter.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Final mapping using the seen.kind column:
//   Jugado/Listened/Read/Watched (label depending on mediaType) → onlyPlayed (kind='played')
//   Visto/Seen → onlyWatched (kind='watched')
const original = '{all:xo._("All"),onlyWithUserRating:xo._("Rated"),onlyWithoutUserRating:xo._("Unrated"),onlyOnWatchlist:xo._("On watchlist"),onlySeenItems:jo(e)?xo._("Listened"):Do(e)?xo._("Read"):Ao(e)?xo._("Played"):xo._("Watched")}';
const intermediate = '{all:xo._("All"),onlyWithUserRating:xo._("Rated"),onlyWithoutUserRating:xo._("Unrated"),onlyOnWatchlist:xo._("On watchlist"),onlyWithProgress:jo(e)?xo._("Listened"):Do(e)?xo._("Read"):Ao(e)?xo._("Played"):xo._("In progress"),onlySeenItems:Ao(e)?xo._("Seen"):jo(e)?xo._("Listened"):Do(e)?xo._("Read"):xo._("Watched")}';
const fresh = '{all:xo._("All"),onlyWithUserRating:xo._("Rated"),onlyWithoutUserRating:xo._("Unrated"),onlyOnWatchlist:xo._("On watchlist"),onlyPlayed:jo(e)?xo._("Listened"):Do(e)?xo._("Read"):Ao(e)?xo._("Played"):xo._("Watched"),onlyWatched:Ao(e)?xo._("Seen"):xo._("Just watched")}';
if (c.includes('onlyPlayed:jo(e)?xo._("Listened")')) {
  console.log('games seen filter: already patched (onlyPlayed/onlyWatched)');
} else if (c.includes(intermediate)) {
  c = c.replace(intermediate, fresh);
  console.log('games seen filter: upgraded from intermediate to onlyPlayed/onlyWatched');
} else if (c.includes(original)) {
  c = c.replace(original, fresh);
  console.log('games seen filter: applied onlyPlayed/onlyWatched mapping');
} else {
  console.error('games seen filter: anchor not found'); process.exit(1);
}

fs.writeFileSync(bundlePath, c);
console.log('games seen filter: complete');

})();

// ===== patch_items_only_downloaded.js =====
;(() => {
const fs = require('fs');

// 1. Add `onlyDownloaded` to the controller's destructure + pass-through
const ctrlPath = '/app/build/controllers/items.js';
let ctrl = fs.readFileSync(ctrlPath, 'utf8');
if (!ctrl.includes('onlyDownloaded')) {
  // Two destructure lines (paginated + non-paginated) — patch both
  ctrl = ctrl.replace(/onlyWithProgress\n    \} = req\.query;/g, 'onlyWithProgress,\n      onlyDownloaded\n    } = req.query;');
  ctrl = ctrl.replace(/onlyWithProgress: onlyWithProgress\n    /g, 'onlyWithProgress: onlyWithProgress,\n      onlyDownloaded: onlyDownloaded\n    ');
  fs.writeFileSync(ctrlPath, ctrl);
  console.log('items only-downloaded: controller wired');
} else {
  console.log('items only-downloaded: controller already wired');
}

// 2. Add `onlyDownloaded` to items query (filter clause + count fast-path)
const qPath = '/app/build/knex/queries/items.js';
let q = fs.readFileSync(qPath, 'utf8');
if (q.includes('onlyDownloaded')) {
  console.log('items only-downloaded: query already patched');
  return /* was process.exit(0) */;
}

// Add to args destructure. Order-independent: if patch_seen_kind_wiring.js already
// extended the destructure with onlyPlayed/onlyWatched, the original anchor won't
// match — fall back to inserting after onlyWatched. Otherwise insert after onlyWithProgress.
if (q.includes("onlyWatched\n  } = args;")) {
  q = q.replace(
    "onlyWatched\n  } = args;",
    "onlyWatched,\n    onlyDownloaded\n  } = args;"
  );
} else if (q.includes("onlyWithProgress\n  } = args;")) {
  q = q.replace(
    "onlyWithProgress\n  } = args;",
    "onlyWithProgress,\n    onlyDownloaded\n  } = args;"
  );
} else {
  console.error('items only-downloaded: query destructure anchor not found');
  process.exit(1);
}

// Add filter clause near the other filter blocks. Insert after onlyWithProgress block.
const filterAnchor = "if (onlyWithProgress) {";
const idx = q.indexOf(filterAnchor);
if (idx < 0) { console.error('items only-downloaded: filter anchor not found'); process.exit(1); }
// Find end of the block (matching brace)
let depth = 0, end = idx + filterAnchor.length;
for (; end < q.length; end++) {
  if (q[end] === '{') depth++;
  else if (q[end] === '}') { if (depth === 0) { end++; break; } depth--; }
}
const inject = "\n      if (onlyDownloaded) {\n        query.where('mediaItem.downloaded', true);\n      }";
q = q.slice(0, end) + inject + q.slice(end);

// Add count fast-path
const countAnchor = "} else if (onlyWithProgress) {";
const countIdx = q.indexOf(countAnchor);
if (countIdx < 0) { console.error('items only-downloaded: count anchor not found'); process.exit(1); }
const countInject = "} else if (onlyDownloaded) {\n    sqlCountQuery = _knex('mediaItem').modify(_applyMt).where('downloaded', true).count('* as count');\n  ";
q = q.slice(0, countIdx) + countInject + q.slice(countIdx);

fs.writeFileSync(qPath, q);
console.log('items only-downloaded: filter + count fast-path added');

})();

// ===== patch_items_response_cache.js =====
// Backend-side cache for getItemsKnex output, keyed by (userId, JSON.stringify(args)),
// TTL=30s. The 5 home-page useQuery hooks (Upcoming, Recently released, Unrated,
// Next-episode, statistics-summary) hit the API in parallel but better-sqlite3 is
// synchronous so they serialise on the Node event loop — total wall-clock ~5s on
// cold load. With this cache:
//   - First load:    still ~5s (cache miss for each).
//   - Repeat loads:  ~0ms within the TTL window — instant re-renders.
//   - Page nav:      back-to-home is instant if within 30s.
// Invalidation: a knex `query-response` listener clears the entire cache on any
// INSERT/UPDATE/DELETE so mutations are immediately reflected (no stale reads).
// Memory cap: 256 entries (oldest evicted) — args strings are short, payloads
// ~30–60 KB, so worst-case ~15 MB which is fine for a single-user instance.
;(() => {
const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');
const marker = '/* ITEMS_RESPONSE_CACHE_V1 */';
if (c.includes(marker)) { console.log('items response cache: already patched'); return; }

// Anchor: the exported wrapper exactly.
const old = "const getItemsKnex = async args => {";
const fresh =
  "// " + marker + "\n" +
  "const _itemsCache = new Map();\n" +
  "const _ITEMS_CACHE_TTL = 30000;\n" +
  "const _ITEMS_CACHE_MAX = 256;\n" +
  "let _itemsCacheHookInstalled = false;\n" +
  "function _installItemsCacheInvalidationHook() {\n" +
  "  if (_itemsCacheHookInstalled) return;\n" +
  "  try {\n" +
  "    const _kx = _dbconfig.Database.knex;\n" +
  "    if (!_kx || typeof _kx.on !== 'function') return;\n" +
  "    _kx.on('query-response', function (_resp, q) {\n" +
  "      try {\n" +
  "        const sql = q && q.sql ? String(q.sql) : '';\n" +
  "        if (/^\\s*(INSERT|UPDATE|DELETE|REPLACE)\\b/i.test(sql)) {\n" +
  "          _itemsCache.clear();\n" +
  "        }\n" +
  "      } catch (_) {}\n" +
  "    });\n" +
  "    _itemsCacheHookInstalled = true;\n" +
  "  } catch (_) {}\n" +
  "}\n" +
  "const _getItemsKnexUncached = async args => {";
if (!c.includes(old)) { console.error('items response cache: anchor not found'); process.exit(1); }
c = c.replace(old, fresh);

// Now find the closing }; of getItemsKnex and inject the wrapper just after it.
// The function ends with `};\nexports.getItemsKnex = getItemsKnex;` — split there.
const exportLine = "exports.getItemsKnex = getItemsKnex;";
const exportIdx = c.indexOf(exportLine);
if (exportIdx < 0) { console.error('items response cache: export anchor not found'); process.exit(1); }
const cacheWrapper =
  "const getItemsKnex = async args => {\n" +
  "  _installItemsCacheInvalidationHook();\n" +
  "  // Key includes userId so users never see each other's data.\n" +
  "  const key = String((args && args.userId) || 0) + '|' + JSON.stringify(args || {});\n" +
  "  const hit = _itemsCache.get(key);\n" +
  "  if (hit && (Date.now() - hit.at) < _ITEMS_CACHE_TTL) return hit.payload;\n" +
  "  const payload = await _getItemsKnexUncached(args);\n" +
  "  _itemsCache.set(key, { at: Date.now(), payload: payload });\n" +
  "  if (_itemsCache.size > _ITEMS_CACHE_MAX) {\n" +
  "    // Evict ~25% oldest entries.\n" +
  "    const entries = Array.from(_itemsCache.entries());\n" +
  "    entries.sort(function (a, b) { return a[1].at - b[1].at; });\n" +
  "    for (let i = 0; i < Math.floor(_ITEMS_CACHE_MAX / 4); i++) _itemsCache.delete(entries[i][0]);\n" +
  "  }\n" +
  "  return payload;\n" +
  "};\n";
c = c.slice(0, exportIdx) + cacheWrapper + c.slice(exportIdx);
fs.writeFileSync(path, c);
try {
  delete require.cache[require.resolve(path)];
  require(path);
  console.log('items response cache: installed with TTL=30s, invalidation on write');
} catch (e) {
  console.error('items response cache: SYNTAX ERROR ->', e.message.slice(0, 300));
  process.exit(1);
}
})();
