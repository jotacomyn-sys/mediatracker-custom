// Auto-generated mega-patch: patch_09_abandoned_inprogress_counts.js
// Bundles 22 original patch_*.js scripts in execution order.
// Each constituent is wrapped in an IIFE so its top-level vars (const fs = ...)
// don't collide; `process.exit(0)` is rewritten to `return` so an early-exit
// idempotency guard inside one constituent doesn't abort the whole mega-patch.

// ===== patch_abandoned_migration.js =====
;(() => {
const fs = require('fs');
const path = require('path');

// Add a knex migration that creates a per-user `abandoned` table. Each row marks
// (userId, mediaItemId) as "stopped consuming on purpose" — used by the
// /in-progress (Pendiente) filter to exclude these items, and by a new
// /abandoned page that lists them.

const dir = '/app/build/migrations';
const file = path.join(dir, '20260501000001_mtForkAbandoned.js');

if (fs.existsSync(file)) {
  console.log('abandoned migration: file already exists');
  return /* was process.exit(0) */;
}

const content =
  '"use strict";\n' +
  'Object.defineProperty(exports, "__esModule", { value: true });\n' +
  'exports.up = void 0;\n' +
  'exports.down = void 0;\n' +
  'async function up(knex) {\n' +
  '  // mt-fork: per-user "I gave up on this" flag. Excluded from Pendiente, listed\n' +
  '  // separately on /abandonados. Composite PK so toggling on/off is idempotent.\n' +
  '  await knex.raw(`\n' +
  '    CREATE TABLE IF NOT EXISTS abandoned (\n' +
  '      userId INTEGER NOT NULL,\n' +
  '      mediaItemId INTEGER NOT NULL,\n' +
  '      date BIGINT NOT NULL,\n' +
  '      PRIMARY KEY (userId, mediaItemId),\n' +
  '      FOREIGN KEY (userId) REFERENCES user(id),\n' +
  '      FOREIGN KEY (mediaItemId) REFERENCES mediaItem(id)\n' +
  '    )\n' +
  '  `);\n' +
  '  await knex.raw(\'CREATE INDEX IF NOT EXISTS abandoned_userid_index ON abandoned(userId)\');\n' +
  '  await knex.raw(\'CREATE INDEX IF NOT EXISTS abandoned_mediaitemid_index ON abandoned(mediaItemId)\');\n' +
  '}\n' +
  'async function down(knex) {\n' +
  '  await knex.raw(\'DROP INDEX IF EXISTS abandoned_userid_index\');\n' +
  '  await knex.raw(\'DROP INDEX IF EXISTS abandoned_mediaitemid_index\');\n' +
  '  await knex.raw(\'DROP TABLE IF EXISTS abandoned\');\n' +
  '}\n' +
  'exports.up = up;\n' +
  'exports.down = down;\n';

fs.writeFileSync(file, content);
console.log('abandoned migration: wrote ' + path.basename(file));

})();

// ===== patch_reset_outlier_game_runtimes.js =====
;(() => {
const fs = require('fs');
const path = require('path');

// One-shot migration: zero out video_game runtimes > 500h (= 30000 min). The
// previous build (v0.1.6) had no cap, so endless games like Star Citizen and
// MMOs polluted mediaItem.runtime with absurd values from IGDB. The auto-refresh
// path now caps at 500h, so we just need to invalidate the existing rows for
// the auto-refresh to re-fetch them with the cap applied.

const dir = '/app/build/migrations';
const file = path.join(dir, '20260501000002_mtForkResetOutlierGameRuntimes.js');

if (fs.existsSync(file)) {
  console.log('reset outlier game runtimes: file already exists');
  return /* was process.exit(0) */;
}

const content =
  '"use strict";\n' +
  'Object.defineProperty(exports, "__esModule", { value: true });\n' +
  'exports.up = void 0;\n' +
  'exports.down = void 0;\n' +
  'async function up(knex) {\n' +
  '  // 30000 min = 500h. Anything above that is IGDB telling us the game is\n' +
  '  // effectively endless (MMOs, sandbox, live-service) — skip from the total.\n' +
  '  await knex.raw(`UPDATE mediaItem SET runtime = NULL WHERE mediaType = ? AND runtime > ?`, [\'video_game\', 30000]);\n' +
  '}\n' +
  'async function down(knex) {\n' +
  '  // No-op — old values are gone; re-fetch via the IGDB time-to-beat refresh.\n' +
  '}\n' +
  'exports.up = up;\n' +
  'exports.down = down;\n';

fs.writeFileSync(file, content);
console.log('reset outlier game runtimes: wrote ' + path.basename(file));

})();

// ===== patch_abandoned_controller.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/item.js';
let c = fs.readFileSync(path, 'utf8');

// Three endpoints for managing per-user abandoned items:
//   PUT    /api/abandoned/:mediaItemId   → mark as abandoned (idempotent)
//   DELETE /api/abandoned/:mediaItemId   → unmark
//   GET    /api/abandoned                → list mediaItemIds for current user
//
// Also extend the items query support: items.js destructure already includes
// new filters added by other patches; we add `excludeAbandoned` / `onlyAbandoned`
// in patch_abandoned_filter.js.

if (c.includes('abandonedAdd =')) {
  console.log('abandoned controller: already patched');
  return /* was process.exit(0) */;
}

const methods =
  "  abandonedAdd = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
  "    const userId = Number(req.user);\n" +
  "    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return; }\n" +
  "    const mediaItemId = Number(req.params.mediaItemId);\n" +
  "    if (!mediaItemId) { res.status(400).json({ error: 'mediaItemId requerido' }); return; }\n" +
  "    const knex = _dbconfig.Database.knex;\n" +
  "    const mi = await knex('mediaItem').where('id', mediaItemId).first('id');\n" +
  "    if (!mi) { res.status(404).json({ error: 'mediaItem no encontrado' }); return; }\n" +
  "    await knex.raw('INSERT OR IGNORE INTO abandoned (userId, mediaItemId, date) VALUES (?, ?, ?)', [userId, mediaItemId, Date.now()]);\n" +
  "    res.json({ ok: true });\n" +
  "  });\n" +
  "  abandonedRemove = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
  "    const userId = Number(req.user);\n" +
  "    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return; }\n" +
  "    const mediaItemId = Number(req.params.mediaItemId);\n" +
  "    if (!mediaItemId) { res.status(400).json({ error: 'mediaItemId requerido' }); return; }\n" +
  "    const knex = _dbconfig.Database.knex;\n" +
  "    await knex('abandoned').where({ userId, mediaItemId }).delete();\n" +
  "    res.json({ ok: true });\n" +
  "  });\n" +
  "  abandonedList = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
  "    const userId = Number(req.user);\n" +
  "    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return; }\n" +
  "    const knex = _dbconfig.Database.knex;\n" +
  "    const rows = await knex('abandoned').where('userId', userId).select('mediaItemId', 'date');\n" +
  "    res.json({ items: rows.map(r => r.mediaItemId), full: rows });\n" +
  "  });\n";

const anchor = '}\nexports.MediaItemController = MediaItemController;';
if (!c.includes(anchor)) { console.error('abandoned controller: anchor not found'); process.exit(1); }
c = c.replace(anchor, methods + anchor);
fs.writeFileSync(path, c);
console.log('abandoned controller: added abandonedAdd / abandonedRemove / abandonedList');

})();

// ===== patch_abandoned_routes.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/generated/routes/routes.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("/api/abandoned'")) {
  console.log('abandoned routes: already patched');
  return /* was process.exit(0) */;
}

// Anchor on a stable upstream route that exists from the start (independent
// of patch ordering relative to the rest of the custom routes).
const anchor = "router.post('/api/catalog/cleanup'";
if (!c.includes(anchor)) { console.error('abandoned routes: anchor not found'); process.exit(1); }

const route =
  "router.put('/api/abandoned/:mediaItemId', validatorHandler({}), _MediaItemController.abandonedAdd);\n" +
  "router.delete('/api/abandoned/:mediaItemId', validatorHandler({}), _MediaItemController.abandonedRemove);\n" +
  "router.get('/api/abandoned', validatorHandler({}), _MediaItemController.abandonedList);\n";

c = c.replace(anchor, route + anchor);
fs.writeFileSync(path, c);
console.log('abandoned routes: registered 3 endpoints');

})();

// ===== patch_abandoned_filter.js =====
;(() => {
const fs = require('fs');

// Add `excludeAbandoned` and `onlyAbandoned` filters to the items query.
// - excludeAbandoned: drops items where the user has an `abandoned` row.
//   Used by the Pendiente page so abandoned items don't show.
// - onlyAbandoned: keeps only those items. Used by the new /abandonados page.
//
// Also patch the controller's req.query destructure so the params reach the
// query function.

// === 1. items.js: add filters to destructure + apply WHERE clauses ===
{
  const p = '/app/build/knex/queries/items.js';
  let c = fs.readFileSync(p, 'utf8');

  if (c.includes('// mt-fork: abandoned-filter')) {
    console.log('abandoned filter (items.js): already patched');
  } else {
    // Add to args destructure. Last var depends on patch order (onlyWatched if
    // seen_kind_wiring ran first, onlyDownloaded otherwise).
    if (c.includes("onlyDownloaded\n  } = args;")) {
      c = c.replace(
        "onlyDownloaded\n  } = args;",
        "onlyDownloaded,\n    excludeAbandoned,\n    onlyAbandoned\n  } = args;"
      );
    } else if (c.includes("onlyWatched\n  } = args;")) {
      c = c.replace(
        "onlyWatched\n  } = args;",
        "onlyWatched,\n    excludeAbandoned,\n    onlyAbandoned\n  } = args;"
      );
    } else {
      console.error('abandoned filter: items.js destructure anchor not found');
      process.exit(1);
    }

    // Apply WHERE clauses. Insert after the onlyDownloaded block.
    const filterAnchor =
      "      if (onlyDownloaded) {\n" +
      "        query.where('mediaItem.downloaded', true);\n" +
      "      }";
    const filterInjection = filterAnchor +
      "\n      // mt-fork: abandoned-filter\n" +
      "      if (excludeAbandoned === true || excludeAbandoned === 'true' || excludeAbandoned === 1) {\n" +
      "        query.whereNotExists(function() { this.from('abandoned').where('abandoned.userId', userId).whereRaw('abandoned.mediaItemId = mediaItem.id'); });\n" +
      "      }\n" +
      "      if (onlyAbandoned === true || onlyAbandoned === 'true' || onlyAbandoned === 1) {\n" +
      "        query.whereExists(function() { this.from('abandoned').where('abandoned.userId', userId).whereRaw('abandoned.mediaItemId = mediaItem.id'); });\n" +
      "      }";

    if (!c.includes(filterAnchor)) {
      console.error('abandoned filter: filter-anchor (onlyDownloaded block) not found');
      process.exit(1);
    }
    c = c.replace(filterAnchor, filterInjection);
    fs.writeFileSync(p, c);
    console.log('abandoned filter (items.js): destructure + WHERE clauses added');
  }
}

// === 2. controllers/items.js: pass-through from req.query ===
{
  const p = '/app/build/controllers/items.js';
  let c = fs.readFileSync(p, 'utf8');

  if (c.includes('excludeAbandoned')) {
    console.log('abandoned filter (controllers/items.js): already patched');
  } else {
    // Two destructure lines (paginated + non-paginated). Add excludeAbandoned + onlyAbandoned to both.
    c = c.replace(/onlyDownloaded\n    \} = req\.query;/g, 'onlyDownloaded,\n      excludeAbandoned,\n      onlyAbandoned\n    } = req.query;');
    c = c.replace(/onlyDownloaded: onlyDownloaded\n    /g, 'onlyDownloaded: onlyDownloaded,\n      excludeAbandoned: excludeAbandoned,\n      onlyAbandoned: onlyAbandoned\n    ');
    fs.writeFileSync(p, c);
    console.log('abandoned filter (controllers/items.js): added excludeAbandoned + onlyAbandoned pass-through');
  }
}

})();

// ===== patch_abandoned_frontend.js =====
;(() => {
const fs = require('fs');
const child = require('child_process');

// Frontend wiring for the "Dropped / Abandonados" feature:
//   1. _AB component: a toggle button on the detail page (Marcar como abandonada
//      ↔ Reanudar) that hits PUT/DELETE /api/abandoned/:mediaItemId.
//   2. _ABS component: a /abandonados page that mirrors the Pendiente layout
//      (collapsible per-mediaType sections) but filters by onlyAbandoned.
//   3. Pendiente sections gain `excludeAbandoned: true` so abandoned items
//      don't show there anymore.
//   4. /abandonados route + hamburger menu entry.

const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/*mt-fork:abandoned-frontend*/';
if (c.includes(marker)) {
  console.log('abandoned frontend: already patched');
  return /* was process.exit(0) */;
}

// === 1. _AB toggle component (detail-page button) ===
const abDef = '_AB=function(e){' +
  'var mi=e.mediaItem;' +
  'var _s=r.useState(null),abandoned=_s[0],setA=_s[1];' +
  'var load=function(){' +
    'fetch("/api/abandoned",{credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){setA((d.items||[]).indexOf(mi.id)>=0)}).catch(function(){setA(false)})' +
  '};' +
  'r.useEffect(load,[mi.id]);' +
  'if(abandoned===null)return null;' +
  'var toggle=function(){' +
    'var url="/api/abandoned/"+mi.id;' +
    'var method=abandoned?"DELETE":"PUT";' +
    'var willAbandon=!abandoned;' +
    'fetch(url,{method:method,credentials:"same-origin"}).then(function(r){return r.json()}).then(function(){' +
      'setA(!abandoned);' +
      // When marking as abandoned (not the reverse), also remove from
      // watchlist — abandoned items don\'t belong on the watchlist.
      'if(willAbandon){fetch("/api/watchlist?mediaItemId="+mi.id,{method:"DELETE",credentials:"same-origin"}).catch(function(){})}' +
      'try{HW.invalidateQueries(["items"])}catch(_){}; try{HW.invalidateQueries(["details",mi.id])}catch(_){};' +
    '})' +
  '};' +
  // Use the same className+style pattern as "Marcar como completado" (plain
  // `text-sm btn` + inline-style override for the destructive color) instead
  // of toggling between btn / btn-red — that toggling produced a row-height
  // mismatch in the 2-col action grid (the abandoned cell rendered noticeably
  // taller than its peers).
  // Outline rojo (borde + texto), sin relleno — coherente con los botones
  // del modal de progreso (text-red-500 + btn). Se mantiene `text-sm btn`
  // para no romper la altura de las filas del grid de acciones.
  'var _destStyle={color:"#dc2626",borderColor:"#dc2626"};' +
  'return r.createElement("div",{className:"text-sm btn",style:abandoned?{}:_destStyle,onClick:toggle},' +
    'r.createElement(Xe,{id:abandoned?"Resume":"Mark as dropped"})' +
  ')' +
'},';

// === 2. _ABS page component — matches _IPS layout (no _GamesSection sub-dropdowns) ===
const absDef = '_ABS=function(){' +
  'var _Section=function(props){' +
    'var st=r.useState(false),open=st[0],setOpen=st[1];' +
    'return r.createElement("div",{className:"mb-3 border border-slate-300 dark:border-slate-700 rounded overflow-hidden"},' +
      'r.createElement("button",{onClick:function(){setOpen(!open)},className:"w-full text-left text-xl font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-2"},' +
        'r.createElement("i",{className:"material-icons"},open?"expand_more":"chevron_right"),' +
        'props.label' +
      '),' +
      'open&&r.createElement("div",{className:"p-2"},' +
        'r.createElement(Zv,{args:Object.assign({orderBy:"title",sortOrder:"asc"},props.args),showSortOrderControls:!1,showSearch:!1,gridItemAppearance:{showRating:!0,topBar:{showFirstUnwatchedEpisodeBadge:!0,showOnWatchlistIcon:!0,showUnwatchedEpisodesCount:!0}}})' +
      ')' +
    ')' +
  '};' +
  'return r.createElement("div",{className:"p-2"},' +
    'r.createElement("h2",{className:"text-2xl mb-4 px-2"},r.createElement(Xe,{id:"Dropped"})),' +
    'r.createElement(_Section,{label:xo._("Movies"),args:{mediaType:"movie",onlyAbandoned:!0}}),' +
    'r.createElement(_Section,{label:xo._("Tv"),args:{mediaType:"tv",onlyAbandoned:!0}}),' +
    'r.createElement(_Section,{label:xo._("Games"),args:{mediaType:"video_game",onlyAbandoned:!0}}),' +
    'r.createElement(_Section,{label:xo._("Books"),args:{mediaType:"book",onlyAbandoned:!0}})' +
  ')' +
'},';

// Inject both component definitions before _v (same anchor as other custom components).
const compAnchor = '_v=function(e){';
if (!c.includes(compAnchor)) { console.error('abandoned frontend: _v anchor not found'); process.exit(1); }
c = c.replace(compAnchor, abDef + absDef + compAnchor);
console.log('abandoned frontend: injected _AB + _ABS components');

// === 3. Detail-page: render _AB next to the watchlist toggle ===
// Anchor: the watchlist toggle ternary `…onWatchlist}(a)?r.createElement(<x>,{mediaItem:a}):r.createElement(<y>,{mediaItem:a})`.
// Match ends at the closing `)` of the ternary's else branch. The minified
// component vars (og/ig) are bundle-specific, so use \w+ for both.
const dpAnchor = /e\.onWatchlist\}\(a\)\?r\.createElement\(\w+,\{mediaItem:a\}\):r\.createElement\(\w+,\{mediaItem:a\}\)/;
const dpMatch = c.match(dpAnchor);
if (!dpMatch) {
  console.error('abandoned frontend: detail-page watchlist anchor not found');
  process.exit(1);
}
c = c.replace(dpAnchor, dpMatch[0] + ',r.createElement(_AB,{mediaItem:a})');
console.log('abandoned frontend: mounted _AB on detail page');

// === 4. /in-progress (Pendiente): add excludeAbandoned to all sections ===
// Pendiente has 4 _Section calls with onlyWithProgress:!0. Append excludeAbandoned:!0 to each.
const pendArgsRe = /args:\{mediaType:"(movie|tv|video_game|book)",onlyWithProgress:!0\}/g;
const pendMatches = (c.match(pendArgsRe) || []).length;
if (pendMatches < 4) {
  console.error('abandoned frontend: expected 4 Pendiente section args, found ' + pendMatches);
  process.exit(1);
}
c = c.replace(pendArgsRe, 'args:{mediaType:"$1",onlyWithProgress:!0,excludeAbandoned:!0}');
console.log('abandoned frontend: Pendiente sections now exclude abandoned (' + pendMatches + ' updated)');

// === 5. Register /abandonados route ===
const routeAnchor = 'r.createElement(Q,{path:"/in-progress",element:r.createElement(_IPS,null)})';
const routePatched = routeAnchor + ',r.createElement(Q,{path:"/abandonados",element:r.createElement(_ABS,null)})';
if (c.includes('path:"/abandonados"')) {
  console.log('abandoned frontend: route already added');
} else if (!c.includes(routeAnchor)) {
  console.error('abandoned frontend: /in-progress route anchor not found'); process.exit(1);
} else {
  c = c.replace(routeAnchor, routePatched);
  console.log('abandoned frontend: /abandonados route registered');
}

// === 6. Add hamburger menu entry next to "In progress" ===
// Idempotency guard checks for the menu entry's specific shape (path + name),
// since the route registration above also contains `path:"/abandonados"` and
// would falsely trigger a generic includes check.
const menuAnchor = '{path:"/in-progress",name:xo._("In progress")}';
const menuPatched = menuAnchor + ',{path:"/abandonados",name:xo._("Dropped")}';
if (c.includes('path:"/abandonados",name:xo._("Dropped")')) {
  console.log('abandoned frontend: menu entry already added');
} else if (!c.includes(menuAnchor)) {
  console.error('abandoned frontend: menu anchor not found'); process.exit(1);
} else {
  c = c.replace(menuAnchor, menuPatched);
  console.log('abandoned frontend: added Abandonados menu entry');
}

// === 7. Add /abandonados to _DD hamburger SIDE_PATHS whitelist ===
// patch_menu_split.js filters ty() by SIDE_PATHS so only specific paths render
// in the dropdown. Without this step the entry exists but the dropdown hides it.
// Use a tolerant regex so we don't break if other patches (eg. downloaded_tab)
// have already extended the array.
const sideRe = /\["\/in-progress"[^\]]*"\/lists"[^\]]*\]|\["\/upcoming"[^\]]*"\/watchlist"[^\]]*\]/;
const sideMatch = c.match(sideRe);
if (!sideMatch) {
  console.error('abandoned frontend: SIDE_PATHS array not found'); process.exit(1);
} else if (sideMatch[0].includes('"/abandonados"')) {
  console.log('abandoned frontend: /abandonados already in SIDE_PATHS');
} else {
  // Insert ,"/abandonados" right before the closing ]
  const replaced = sideMatch[0].slice(0, -1) + ',"/abandonados"]';
  c = c.replace(sideMatch[0], replaced);
  console.log('abandoned frontend: added /abandonados to _DD side dropdown filter');
}

c = marker + c;
fs.writeFileSync(bundlePath, c);
console.log('abandoned frontend: complete');

})();

// ===== patch_actively_in_progress_backend.js =====
;(() => {
// Backend for the "Marcar como en proceso" feature.
//   - Schema: tiny table with (userId, mediaItemId, createdAt). Unique per pair.
//   - Endpoints: PUT/DELETE /api/actively-in-progress/:mediaItemId, GET list.
//   - Items query: leftJoin so the API returns mediaItem.activelyInProgress bool
//     for the frontend to display the badge.
//
// Why the separate table instead of just creating a `progress` row?  Because
// progress rows are also used by Plex/scrobbling; mixing the two flags makes
// it impossible to tell "I clicked the button" from "I started watching".
// This flag is purely a user-visible category.

const fs = require('fs');

// ===== 1. Migrations =====
{
  const dir = '/app/build/migrations';
  // 1a. Original table.
  const fname1 = '20260502120000_mtForkActivelyInProgress.js';
  const path1 = dir + '/' + fname1;
  if (!fs.existsSync(path1)) {
    fs.writeFileSync(path1,
      "exports.up = async knex => {\n" +
      "  const exists = await knex.schema.hasTable('activelyInProgress');\n" +
      "  if (exists) return;\n" +
      "  await knex.schema.createTable('activelyInProgress', t => {\n" +
      "    t.increments('id').primary();\n" +
      "    t.integer('userId').notNullable().references('id').inTable('user');\n" +
      "    t.integer('mediaItemId').notNullable().references('id').inTable('mediaItem');\n" +
      "    t.float('createdAt').notNullable();\n" +
      "    t.unique(['userId', 'mediaItemId']);\n" +
      "    t.index('userId');\n" +
      "    t.index('mediaItemId');\n" +
      "  });\n" +
      "};\n" +
      "exports.down = async knex => {\n" +
      "  await knex.schema.dropTableIfExists('activelyInProgress');\n" +
      "};\n");
    console.log('actively-in-progress migration: written ' + fname1);
  } else {
    console.log('actively-in-progress migration: ' + fname1 + ' already present');
  }
  // 1b. Add `excluded` column for "force-hide from /in-progress" semantics.
  const fname2 = '20260502160000_mtForkActivelyInProgressExcluded.js';
  const path2 = dir + '/' + fname2;
  if (!fs.existsSync(path2)) {
    fs.writeFileSync(path2,
      "exports.up = async knex => {\n" +
      "  const has = await knex.schema.hasColumn('activelyInProgress', 'excluded');\n" +
      "  if (has) return;\n" +
      "  await knex.schema.alterTable('activelyInProgress', t => {\n" +
      "    t.boolean('excluded').notNullable().defaultTo(false);\n" +
      "  });\n" +
      "};\n" +
      "exports.down = async knex => {\n" +
      "  const has = await knex.schema.hasColumn('activelyInProgress', 'excluded');\n" +
      "  if (!has) return;\n" +
      "  await knex.schema.alterTable('activelyInProgress', t => { t.dropColumn('excluded'); });\n" +
      "};\n");
    console.log('actively-in-progress migration: written ' + fname2);
  } else {
    console.log('actively-in-progress migration: ' + fname2 + ' already present');
  }
}

// ===== 2. Controller (mount on item.js MediaItemController) =====
{
  const path = '/app/build/controllers/item.js';
  let c = fs.readFileSync(path, 'utf8');

  // Strip prior versions for idempotency on rebuild.
  ['activelyInProgressAdd', 'activelyInProgressRemove', 'activelyInProgressList'].forEach(name => {
    const re = new RegExp('  ' + name + ' = \\(0, _typescriptRoutesToOpenapiServer\\.createExpressRoute\\)\\(async \\(req, res\\) => \\{[\\s\\S]*?\\n  \\}\\);\\n', 'g');
    c = c.replace(re, '');
  });

  // Upsert helper: same userId/mediaItemId pair toggles between included
  // (excluded=0) and excluded (excluded=1) in a single row. PUT inserts/updates
  // to excluded=0; DELETE inserts/updates to excluded=1 (overrides the 4 default
  // cláusulas so the user can force-hide an item from /in-progress).
  const methods =
    "  activelyInProgressAdd = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
    "    const userId = Number(req.user);\n" +
    "    const mediaItemId = Number(req.params.mediaItemId);\n" +
    "    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return; }\n" +
    "    if (!mediaItemId) { res.status(400).json({ error: 'mediaItemId requerido' }); return; }\n" +
    "    const knex = _dbconfig.Database.knex;\n" +
    "    const existing = await knex('activelyInProgress').where({ userId, mediaItemId }).first();\n" +
    "    if (existing) {\n" +
    "      await knex('activelyInProgress').where({ id: existing.id }).update({ excluded: false });\n" +
    "    } else {\n" +
    "      await knex('activelyInProgress').insert({ userId, mediaItemId, excluded: false, createdAt: Date.now() });\n" +
    "    }\n" +
    "    res.json({ ok: true });\n" +
    "  });\n" +
    "  activelyInProgressRemove = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
    "    const userId = Number(req.user);\n" +
    "    const mediaItemId = Number(req.params.mediaItemId);\n" +
    "    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return; }\n" +
    "    if (!mediaItemId) { res.status(400).json({ error: 'mediaItemId requerido' }); return; }\n" +
    "    const knex = _dbconfig.Database.knex;\n" +
    "    const existing = await knex('activelyInProgress').where({ userId, mediaItemId }).first();\n" +
    "    if (existing) {\n" +
    "      await knex('activelyInProgress').where({ id: existing.id }).update({ excluded: true });\n" +
    "    } else {\n" +
    "      await knex('activelyInProgress').insert({ userId, mediaItemId, excluded: true, createdAt: Date.now() });\n" +
    "    }\n" +
    "    res.json({ ok: true });\n" +
    "  });\n" +
    "  activelyInProgressList = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
    "    const userId = Number(req.user);\n" +
    "    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return; }\n" +
    "    const rows = await _dbconfig.Database.knex('activelyInProgress').where({ userId }).select('mediaItemId', 'excluded');\n" +
    "    const included = rows.filter(r => !r.excluded).map(r => r.mediaItemId);\n" +
    "    const excluded = rows.filter(r => r.excluded).map(r => r.mediaItemId);\n" +
    "    res.json({ included, excluded, items: included });\n" +
    "  });\n";

  const anchor = '}\nexports.MediaItemController = MediaItemController;';
  if (!c.includes(anchor)) { console.error('actively-in-progress controller: anchor not found'); process.exit(1); }
  c = c.replace(anchor, methods + anchor);
  fs.writeFileSync(path, c);
  console.log('actively-in-progress controller: 3 endpoints attached');
}

// ===== 3. Routes =====
{
  const path = '/app/build/generated/routes/routes.js';
  let c = fs.readFileSync(path, 'utf8');
  if (c.includes("/api/actively-in-progress'")) {
    console.log('actively-in-progress routes: already present');
  } else {
    const anchor = "router.post('/api/catalog/cleanup'";
    if (!c.includes(anchor)) { console.error('actively-in-progress routes: anchor not found'); process.exit(1); }
    const route =
      "router.put('/api/actively-in-progress/:mediaItemId', validatorHandler({}), _MediaItemController.activelyInProgressAdd);\n" +
      "router.delete('/api/actively-in-progress/:mediaItemId', validatorHandler({}), _MediaItemController.activelyInProgressRemove);\n" +
      "router.get('/api/actively-in-progress', validatorHandler({}), _MediaItemController.activelyInProgressList);\n";
    c = c.replace(anchor, route + anchor);
    fs.writeFileSync(path, c);
    console.log('actively-in-progress routes: registered 3 endpoints');
  }
}

// ===== 4. items.js (knex query): leftJoin + return field =====
{
  const path = '/app/build/knex/queries/items.js';
  let c = fs.readFileSync(path, 'utf8');
  if (c.includes('// mt-fork: actively-in-progress-join')) {
    console.log('actively-in-progress (items.js): already patched');
  } else {
    // 4a. Inject leftJoin right after the .leftJoin(...progress)... chain.
    // We anchor on the progress join's terminating semicolon ".leftJoin(qb => qb.from('progress')..." ends a chain that closes with `);`.
    const joinAnchor = ".leftJoin(qb => qb.from('progress').where('userId', userId).whereNull('episodeId').whereNot('progress', 1).as('progress'), 'progress.mediaItemId', 'mediaItem.id');";
    if (!c.includes(joinAnchor)) {
      console.error('actively-in-progress (items.js): join anchor not found'); process.exit(1);
    }
    const joinExtra = joinAnchor +
      "\n  // mt-fork: actively-in-progress-join\n" +
      "  query.leftJoin(qb => qb.from('activelyInProgress').where('userId', userId).as('activelyInProgress'), 'activelyInProgress.mediaItemId', 'mediaItem.id');\n" +
      "  query.select(_dbconfig.Database.knex.raw(\"CASE WHEN \\\"activelyInProgress\\\".\\\"id\\\" IS NOT NULL AND COALESCE(\\\"activelyInProgress\\\".\\\"excluded\\\", 0) = 0 THEN 1 ELSE 0 END AS \\\"activelyInProgressFlag\\\"\"));\n" +
      "  query.select(_dbconfig.Database.knex.raw(\"CASE WHEN COALESCE(\\\"activelyInProgress\\\".\\\"excluded\\\", 0) = 1 THEN 1 ELSE 0 END AS \\\"activelyInProgressExcludedFlag\\\"\"));";
    c = c.replace(joinAnchor, joinExtra);

    // 4b. Add `activelyInProgress` + `activelyInProgressExcluded` to the per-item return object.
    const fieldAnchor = "onWatchlist: Boolean(row['listItem.id']),";
    if (!c.includes(fieldAnchor)) {
      console.error('actively-in-progress (items.js): field anchor not found'); process.exit(1);
    }
    c = c.replace(fieldAnchor, fieldAnchor + "\n    activelyInProgress: Boolean(row.activelyInProgressFlag),\n    activelyInProgressExcluded: Boolean(row.activelyInProgressExcludedFlag),");

    fs.writeFileSync(path, c);
    console.log('actively-in-progress (items.js): join + return field added');
  }
}

// Sanity-check syntax of the two JS files we modified at runtime.
for (const p of ['/app/build/controllers/item.js', '/app/build/knex/queries/items.js']) {
  try {
    delete require.cache[require.resolve(p)];
    require(p);
    console.log('actively-in-progress: syntax OK -> ' + p);
  } catch (e) {
    console.error('actively-in-progress: SYNTAX ERROR in ' + p + ' -> ' + e.message.slice(0, 300));
    process.exit(1);
  }
}

})();

// ===== patch_actively_in_progress_frontend.js =====
;(() => {
// Frontend for "Marcar como en proceso":
//   - _AIP component: a toggle button on the detail page (▶ Marcar como en proceso
//     ↔ Quitar de en proceso) that hits PUT/DELETE /api/actively-in-progress/:mediaItemId.
//     Mounted right after _AB ("Marcar como abandonada") in the detail-page button row.
//   - Card border: when item.activelyInProgress is true, render a purple ring on
//     the card so it's visually distinguishable from "watchlist + already released"
//     items in /in-progress.

const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/*mt-fork:actively-in-progress*/';
if (c.includes(marker)) {
  console.log('actively-in-progress frontend: already patched');
  return /* was process.exit(0) */;
}

// === 1. _AIP toggle component ===
// Embed the marker inside the function body so c.includes(marker) is a reliable
// idempotency check (otherwise re-running the patch would inject _AIP twice).
const aipDef = '_AIP=function(e){' + marker +
  'var mi=e.mediaItem;' +
  'var _s=r.useState(null),active=_s[0],setA=_s[1];' +
  // Active = "force-include" state. Excluded items don't count as active.
  'var load=function(){' +
    'fetch("/api/actively-in-progress",{credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){setA((d.included||d.items||[]).indexOf(mi.id)>=0)}).catch(function(){setA(false)})' +
  '};' +
  'r.useEffect(load,[mi.id]);' +
  'if(active===null)return null;' +
  'var toggle=function(){' +
    'var url="/api/actively-in-progress/"+mi.id;' +
    'var method=active?"DELETE":"PUT";' +
    'fetch(url,{method:method,credentials:"same-origin"}).then(function(r){return r.json()}).then(function(){' +
      'setA(!active);' +
      // Be aggressive: removeQueries drops cached pages so the next visit to
      // /in-progress (or any items list) refetches with the new flag state.
      // invalidateQueries is the gentle equivalent but doesn't always trigger
      // a refetch if the consumer isn't currently mounted.
      'try{HW.removeQueries(["items"])}catch(_){}; try{HW.invalidateQueries(["items"])}catch(_){}; try{HW.removeQueries(["details",mi.id])}catch(_){};' +
    '})' +
  '};' +
  // White button (`btn` = neutral) when not active = "Marcar como en proceso";
  // red (`btn-red`) when active = "Quitar de en proceso" (destructive intent).
  // text-center forces the inner Xe label to center inside the box even when
  // the parent flex/grid stretches the button.
  'return r.createElement("div",{className:"text-sm text-center "+(active?"btn-red":"btn"),onClick:toggle},' +
    'r.createElement(Xe,{id:active?"Stop being in progress":"Mark as in progress"})' +
  ')' +
'},';

// Inject the component before _v (same pattern other custom components use).
const compAnchor = '_v=function(e){';
if (!c.includes(compAnchor)) { console.error('actively-in-progress: _v anchor not found'); process.exit(1); }
c = c.replace(compAnchor, aipDef + compAnchor);
console.log('actively-in-progress: injected _AIP component');

// === 2. Mount layout for the detail-page button row:
//   - _AIP is NOT mounted in the action grid — the green "Lo estoy viendo /
//     leyendo / escuchando / jugando" button (which opens the Progreso modal
//     with percentage + complete/cancel) covers the same in-progress
//     semantics in a richer way, and the user reported the dual buttons as
//     duplicate UX. The _AIP component definition is kept (above) because
//     other patches (item-flags-combined, details-includes-flags) still
//     reference it.
//   - "Update metadata" (sg) is moved out of its original row-1 position to
//     a new slot immediately after _AB ("Marcar como abandonada"). Removing
//     the original row-1 slot also drops the dropdown that would have lived
//     in _AIP's place, so the grid reduces to 5 children laid out as:
//        row 1 = Marcar como completado | Gp (Add to list)
//        row 2 = og/ig (watchlist add/remove) | _AB (abandonada)
//        row 3 = sg (Update metadata) | (empty)
const sgAnchor = 'function(e){var t;return["igdb","tmdb","openlibrary","audible"].includes(null===(t=e.source)||void 0===t?void 0:t.toLowerCase())}(a)?r.createElement(sg,{mediaItem:a}):r.createElement("div")';
if (!c.includes(sgAnchor + ',')) {
  console.error('actively-in-progress: sg (Update metadata) anchor not found'); process.exit(1);
}
const sgConditional = sgAnchor; // re-use as the moved markup
// Drop the row-1 slot entirely (the trailing comma too, so the chain stays well-formed).
c = c.replace(sgAnchor + ',', '');
console.log('actively-in-progress: dropped row-1 sg slot (no _AIP mount)');

// Move the (intact) Update-metadata conditional to the right of _AB.
const abMount = ',r.createElement(_AB,{mediaItem:a})';
if (!c.includes(abMount)) {
  console.error('actively-in-progress: _AB mount anchor not found for sg relocation'); process.exit(1);
}
c = c.replace(abMount, abMount + ',' + sgConditional);
console.log('actively-in-progress: relocated Update metadata to the right of _AB');

fs.writeFileSync(bundlePath, c);
console.log('actively-in-progress frontend: complete (button mounted)');

})();

// ===== patch_item_flags_combined.js =====
;(() => {
// Combined endpoint + shared in-flight cache so _AB and _AIP render together
// instead of popping in one after the other on the detail page.
//
//   - Backend: GET /api/item-flags/:mediaItemId returns
//       { abandoned, activelyInProgress, activelyInProgressExcluded }
//     Single round trip instead of two parallel ones.
//   - Frontend: window._mtItemFlags[mediaItemId] caches the in-flight Promise
//     so the second component to mount reuses the first one's request.
//   - _AB and _AIP read from this combined fetch instead of their old
//     per-component endpoints.

const fs = require('fs');
const child = require('child_process');

// ===== Backend: controller =====
{
  const path = '/app/build/controllers/item.js';
  let c = fs.readFileSync(path, 'utf8');

  if (c.includes('itemFlagsCombined =')) {
    console.log('item-flags combined: controller already patched');
  } else {
    const method =
      "  itemFlagsCombined = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
      "    const userId = Number(req.user);\n" +
      "    const mediaItemId = Number(req.params.mediaItemId);\n" +
      "    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return; }\n" +
      "    if (!mediaItemId) { res.status(400).json({ error: 'mediaItemId requerido' }); return; }\n" +
      "    const knex = _dbconfig.Database.knex;\n" +
      "    const [ab, aip, sw] = await Promise.all([\n" +
      "      knex('abandoned').where({ userId, mediaItemId }).first(),\n" +
      "      knex('activelyInProgress').where({ userId, mediaItemId }).first(),\n" +
      "      knex('seen').where({ userId, mediaItemId, kind: 'watched' }).first()\n" +
      "    ]);\n" +
      "    res.json({\n" +
      "      abandoned: !!ab,\n" +
      "      activelyInProgress: !!aip && !aip.excluded,\n" +
      "      activelyInProgressExcluded: !!aip && !!aip.excluded,\n" +
      "      seenWatched: !!sw\n" +
      "    });\n" +
      "  });\n" +
      "  seenWatchedDelete = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
      "    const userId = Number(req.user);\n" +
      "    const mediaItemId = Number(req.params.mediaItemId);\n" +
      "    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return; }\n" +
      "    if (!mediaItemId) { res.status(400).json({ error: 'mediaItemId requerido' }); return; }\n" +
      "    const n = await _dbconfig.Database.knex('seen').where({ userId, mediaItemId, kind: 'watched' }).delete();\n" +
      "    res.json({ ok: true, removed: n });\n" +
      "  });\n";
    const anchor = '}\nexports.MediaItemController = MediaItemController;';
    if (!c.includes(anchor)) {
      console.error('item-flags combined: controller anchor not found'); process.exit(1);
    }
    c = c.replace(anchor, method + anchor);
    fs.writeFileSync(path, c);
    console.log('item-flags combined: controller endpoint added');
  }
}

// ===== Backend: routes =====
{
  const path = '/app/build/generated/routes/routes.js';
  let c = fs.readFileSync(path, 'utf8');
  if (c.includes("/api/item-flags/")) {
    console.log('item-flags combined: route already present');
  } else {
    // Anchor on a stable upstream route (same pattern other custom routes use).
    const anchor = "router.post('/api/catalog/cleanup'";
    if (!c.includes(anchor)) {
      console.error('item-flags combined: routes anchor not found'); process.exit(1);
    }
    const route =
      "router.get('/api/item-flags/:mediaItemId', validatorHandler({}), _MediaItemController.itemFlagsCombined);\n" +
      "router.delete('/api/seen/watched/:mediaItemId', validatorHandler({}), _MediaItemController.seenWatchedDelete);\n";
    c = c.replace(anchor, route + anchor);
    fs.writeFileSync(path, c);
    console.log('item-flags combined: route registered');
  }
}

// ===== Frontend: shared cache + replace _AB and _AIP fetches =====
{
  const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
  let c = fs.readFileSync(bundlePath, 'utf8');

  const marker = '/*mt-fork:item-flags-shared*/';
  if (c.includes(marker)) {
    console.log('item-flags combined: frontend already patched');
    return /* was process.exit(0) */;
  }

  // Helper that fetches once per mediaItemId and reuses the in-flight Promise.
  // Stored on window so both _AB and _AIP (defined as separate vars in the
  // same comma-chain) share it without needing imports. CRITICAL: must be a
  // single comma-separated expression with NO `;` — _AB sits inside a
  // `var foo=…,_AB=function(e){…},_AIP=…` declaration, so introducing `;`
  // breaks the parse. Wrapping in an IIFE returns void and integrates as one
  // expression, then a trailing comma keeps the var-decl chain intact.
  const helperDef =
    '_mtFlagsHelpersInit=(function(){' +
      'window._mtFetchItemFlags=function(id){' +
        'window._mtItemFlags=window._mtItemFlags||{};' +
        'if(window._mtItemFlags[id])return window._mtItemFlags[id];' +
        'window._mtItemFlags[id]=fetch("/api/item-flags/"+id,{credentials:"same-origin"})' +
          '.then(function(r){return r.json()})' +
          '.catch(function(){return{abandoned:false,activelyInProgress:false,activelyInProgressExcluded:false}});' +
        'return window._mtItemFlags[id]' +
      '};' +
      'window._mtBustItemFlags=function(id){if(window._mtItemFlags)delete window._mtItemFlags[id]};' +
      'return true' +
    '})(),';

  // Inject helper before _AB definition (right before _v).
  const helperAnchor = '_AB=function(e){';
  if (!c.includes(helperAnchor)) {
    console.error('item-flags combined: _AB anchor not found'); process.exit(1);
  }
  c = c.replace(helperAnchor, helperDef + helperAnchor);

  // Rewrite the load() body inside _AB to use the shared cache.
  const abLoadOld =
    'fetch("/api/abandoned",{credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){setA((d.items||[]).indexOf(mi.id)>=0)}).catch(function(){setA(false)})';
  const abLoadNew =
    'window._mtFetchItemFlags(mi.id).then(function(d){setA(!!d.abandoned)})';
  if (!c.includes(abLoadOld)) {
    console.error('item-flags combined: _AB load body anchor not found'); process.exit(1);
  }
  c = c.replace(abLoadOld, abLoadNew);

  // Rewrite the load() body inside _AIP.
  const aipLoadOld =
    'fetch("/api/actively-in-progress",{credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){setA((d.included||d.items||[]).indexOf(mi.id)>=0)}).catch(function(){setA(false)})';
  const aipLoadNew =
    'window._mtFetchItemFlags(mi.id).then(function(d){setA(!!d.activelyInProgress)})';
  if (!c.includes(aipLoadOld)) {
    console.error('item-flags combined: _AIP load body anchor not found'); process.exit(1);
  }
  c = c.replace(aipLoadOld, aipLoadNew);

  // Bust the shared cache after each toggle so the next mount sees fresh state.
  // _AB toggle invalidates queries via HW; add a cache bust there too.
  const abInvalidate =
    "try{HW.invalidateQueries([\"items\"])}catch(_){}; try{HW.invalidateQueries([\"details\",mi.id])}catch(_){};";
  if (c.includes(abInvalidate)) {
    c = c.replace(abInvalidate, 'window._mtBustItemFlags(mi.id);' + abInvalidate);
  }
  // _AIP toggle uses removeQueries; add cache bust there too.
  const aipInvalidate =
    'try{HW.removeQueries(["items"])}catch(_){}; try{HW.invalidateQueries(["items"])}catch(_){}; try{HW.removeQueries(["details",mi.id])}catch(_){};';
  if (c.includes(aipInvalidate)) {
    c = c.replace(aipInvalidate, 'window._mtBustItemFlags(mi.id);' + aipInvalidate);
  }

  c = marker + c;
  fs.writeFileSync(bundlePath, c);
  console.log('item-flags combined: _AB and _AIP now share one fetch per item');
}

// Sanity check the modified controller.
try {
  delete require.cache[require.resolve('/app/build/controllers/item.js')];
  require('/app/build/controllers/item.js');
  console.log('item-flags combined: syntax OK');
} catch (e) {
  console.error('item-flags combined: SYNTAX ERROR -> ' + e.message.slice(0, 300));
  process.exit(1);
}

})();

// ===== patch_mark_watched_button.js =====
;(() => {
// "Marcar como visto" toggle on the detail page (replaces the easy-to-mis-click
// eye icon that used to live on game cards). Same visual style as the rest of
// the action row (`btn` / `btn-red`).
//   - Reads state from /api/item-flags (shared cache via _mtFetchItemFlags so
//     it loads in lockstep with _AB and _AIP).
//   - PUT /api/seen?mediaItemId=X&kind=watched&lastSeenAt=now to mark.
//   - DELETE /api/seen/watched/:mediaItemId to unmark — backed by the patch in
//     patch_item_flags_combined that deletes ONLY rows with kind='watched',
//     leaving any 'played' row intact.

const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/*mt-fork:mark-watched-btn*/';
if (c.includes(marker)) {
  console.log('mark-watched-btn: already patched');
  return /* was process.exit(0) */;
}

// _MAS toggle component. Mirrors _AIP / _AB style.
const masDef = '_MAS=function(e){' + marker +
  'var mi=e.mediaItem;' +
  'var _s=r.useState(null),seen=_s[0],setS=_s[1];' +
  'var load=function(){' +
    'window._mtFetchItemFlags(mi.id).then(function(d){setS(!!d.seenWatched)})' +
  '};' +
  'r.useEffect(load,[mi.id]);' +
  'if(seen===null)return null;' +
  'var toggle=function(){' +
    'var url=seen?"/api/seen/watched/"+mi.id:"/api/seen?mediaItemId="+mi.id+"&lastSeenAt=now&kind=watched";' +
    'var method=seen?"DELETE":"PUT";' +
    'fetch(url,{method:method,credentials:"same-origin"}).then(function(){' +
      'setS(!seen);' +
      'window._mtBustItemFlags(mi.id);' +
      'try{HW.invalidateQueries(["items"])}catch(_){}; try{HW.invalidateQueries(["details",mi.id])}catch(_){};' +
    '})' +
  '};' +
  'return r.createElement("div",{className:"text-sm text-center "+(seen?"btn-red":"btn"),onClick:toggle},' +
    'r.createElement(Xe,{id:seen?"Stop being seen":"Mark as seen"})' +
  ')' +
'},';

// Inject _MAS in the comma-chain before _v.
const compAnchor = '_v=function(e){';
if (!c.includes(compAnchor)) {
  console.error('mark-watched-btn: _v anchor not found'); process.exit(1);
}
c = c.replace(compAnchor, masDef + compAnchor);

// _MAS is intentionally NOT mounted on the detail page. The "Marcar como
// completado" green button already covers the "I saw it" semantics for non-
// episodic media (theater, movies, books, audiobooks, games), so a separate
// "Visto" toggle was duplicate UX. We keep the _MAS component definition
// (and the /api/seen/watched/:id endpoint + seenWatched flag) intact so the
// game card "watched" eye-icon and any other consumers keep working.

fs.writeFileSync(bundlePath, c);
console.log('mark-watched-btn: _MAS defined but NOT mounted on detail panel (deduped vs Marcar como completado)');

})();

// ===== patch_details_includes_flags.js =====
;(() => {
// Bug: on the detail page, _AB / _AIP / _MAS each render `null` until their
// async fetch to /api/item-flags resolves, so the buttons pop in late — the
// user sees them appear at the same time as the cover image, not with the
// rest of the static action buttons.
//
// Fix: include the three flags inline in the /api/details/:id response. The
// button components initialize useState from `mi.<flag>` so they render
// synchronously with the rest of the page; the explicit /api/item-flags fetch
// becomes a stale-revalidate, not a blocker.
//
// Edits:
//   1. controllers/item.js: wrap the `details` handler to merge in
//      { abandoned, activelyInProgress, seenWatched } via three small queries
//      in parallel (cheap — single-row exists checks against indexed columns).
//   2. main bundle: change each button's useState(null) initializer to read
//      from `mi.<flag>` when present.

const fs = require('fs');
const child = require('child_process');

// ===== Backend =====
{
  const path = '/app/build/controllers/item.js';
  let c = fs.readFileSync(path, 'utf8');

  if (c.includes('/* mt-fork: details-includes-flags */')) {
    console.log('details-includes-flags: controller already patched');
  } else {
    const oldBlock =
      "    const details = await _mediaItem.mediaItemRepository.details({\n" +
      "      mediaItemId: mediaItemId,\n" +
      "      userId: userId\n" +
      "    });\n" +
      "    res.send(details);";
    const newBlock =
      "    /* mt-fork: details-includes-flags */\n" +
      "    const details = await _mediaItem.mediaItemRepository.details({\n" +
      "      mediaItemId: mediaItemId,\n" +
      "      userId: userId\n" +
      "    });\n" +
      "    if (details) {\n" +
      "      const _knex = _dbconfig.Database.knex;\n" +
      "      const [_ab, _aip, _sw] = await Promise.all([\n" +
      "        _knex('abandoned').where({ userId, mediaItemId }).first(),\n" +
      "        _knex('activelyInProgress').where({ userId, mediaItemId }).first(),\n" +
      "        _knex('seen').where({ userId, mediaItemId, kind: 'watched' }).first()\n" +
      "      ]);\n" +
      "      details.abandoned = !!_ab;\n" +
      "      details.activelyInProgress = !!_aip && !_aip.excluded;\n" +
      "      details.activelyInProgressExcluded = !!_aip && !!_aip.excluded;\n" +
      "      details.seenWatched = !!_sw;\n" +
      "    }\n" +
      "    res.send(details);";
    if (!c.includes(oldBlock)) {
      console.error('details-includes-flags: details handler anchor not found');
      process.exit(1);
    }
    c = c.replace(oldBlock, newBlock);
    fs.writeFileSync(path, c);
    console.log('details-includes-flags: details handler now returns flags inline');
  }
}

// ===== Frontend: initialize each button's useState from mi.<flag> =====
{
  const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
  let c = fs.readFileSync(bundlePath, 'utf8');

  const marker = '/*mt-fork:flags-prehydrated*/';
  if (c.includes(marker)) {
    console.log('details-includes-flags: bundle already patched');
  } else {
  // _AB: useState(null) → useState(mi.abandoned!=null?!!mi.abandoned:null)
  const abOld = "_AB=function(e){var mi=e.mediaItem;var _s=r.useState(null),abandoned=_s[0],setA=_s[1];";
  const abNew = "_AB=function(e){var mi=e.mediaItem;var _s=r.useState(mi.abandoned!=null?!!mi.abandoned:null),abandoned=_s[0],setA=_s[1];";
  if (!c.includes(abOld)) {
    console.error('details-includes-flags: _AB anchor not found');
    process.exit(1);
  }
  c = c.replace(abOld, abNew);

  // _AIP: useState(null) → useState(mi.activelyInProgress!=null?!!mi.activelyInProgress:null)
  const aipOld = "_AIP=function(e){/*mt-fork:actively-in-progress*/var mi=e.mediaItem;var _s=r.useState(null),active=_s[0],setA=_s[1];";
  const aipNew = "_AIP=function(e){/*mt-fork:actively-in-progress*/var mi=e.mediaItem;var _s=r.useState(mi.activelyInProgress!=null?!!mi.activelyInProgress:null),active=_s[0],setA=_s[1];";
  if (!c.includes(aipOld)) {
    console.error('details-includes-flags: _AIP anchor not found');
    process.exit(1);
  }
  c = c.replace(aipOld, aipNew);

  // _MAS: useState(null) → useState(mi.seenWatched!=null?!!mi.seenWatched:null)
  const masOld = "_MAS=function(e){/*mt-fork:mark-watched-btn*/var mi=e.mediaItem;var _s=r.useState(null),seen=_s[0],setS=_s[1];";
  const masNew = "_MAS=function(e){/*mt-fork:mark-watched-btn*/var mi=e.mediaItem;var _s=r.useState(mi.seenWatched!=null?!!mi.seenWatched:null),seen=_s[0],setS=_s[1];";
  if (!c.includes(masOld)) {
    console.error('details-includes-flags: _MAS anchor not found');
    process.exit(1);
  }
  c = c.replace(masOld, masNew);

  c = marker + c;
  fs.writeFileSync(bundlePath, c);
  console.log('details-includes-flags: _AB / _AIP / _MAS now hydrate from mi.* on first render');
  }
}

// Sanity check: the controller must still parse.
try {
  delete require.cache[require.resolve('/app/build/controllers/item.js')];
  require('/app/build/controllers/item.js');
  console.log('details-includes-flags: controller syntax OK');
} catch (e) {
  console.error('details-includes-flags: SYNTAX ERROR -> ' + e.message.slice(0, 300));
  process.exit(1);
}

})();

// ===== patch_update_metadata_btn.js =====
;(() => {
// Two fixes for the "Actualizar metadatos" button on the detail panel:
//
// 1) The render gate filters mediaItem.source against an allowlist
//    ['igdb','tmdb','openlibrary','audible']. Theater items use
//    source='wikidata', so the button never showed for them. Add 'wikidata'.
//
// 2) The button itself is rendered with className 'text-sm btn' — a generic
//    plain-text button — while every other action in the panel uses
//    'text-sm btn-blue' / 'btn-red' / etc. and looks like a proper big button.
//    This made it look like an unfinished placeholder. Promote it to btn-blue
//    so it visually matches the rest of the action row.

const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/* mt-fork: update-metadata-btn */';
if (c.includes(marker)) {
  console.log('update-metadata-btn: already patched (' + bundlePath + ')');
  return /* was process.exit(0) */;
}

let changed = 0;

// 1) Allow wikidata in the source allowlist.
const oldList = '["igdb","tmdb","openlibrary","audible"]';
const newList = '["igdb","tmdb","openlibrary","audible","wikidata"]';
if (c.includes(oldList)) {
  c = c.split(oldList).join(newList);
  changed++;
  console.log('update-metadata-btn: added "wikidata" to source allowlist');
} else {
  console.error('update-metadata-btn: source allowlist anchor not found');
  process.exit(1);
}

// 2) Promote the button styling. The sg= component renders:
//    <button className="text-sm btn" ...><Update metadata/></button>
// Match the exact substring inside sg= so we only touch this one button.
// Match the styling of the other action-row children (text-sm + btn-blue, no
// extra margin or width override — the grid handles sizing) so the button
// renders the same height as its row peers (Marcar como abandonada / etc.).
const oldBtn = 'r.createElement("button",{className:"text-sm btn",onClick:function(){return o()},disabled:s},r.createElement(Xe,{id:"Update metadata"}))';
const newBtn = 'r.createElement("button",{className:"text-sm btn-blue",onClick:function(){return o()},disabled:s},r.createElement(Xe,{id:s?"Updating metadata":"Update metadata"}))';
if (c.includes(oldBtn)) {
  c = c.replace(oldBtn, newBtn);
  changed++;
  console.log('update-metadata-btn: promoted button to btn-blue full-width');
} else {
  console.error('update-metadata-btn: sg= button anchor not found');
  process.exit(1);
}

c = marker + c;
fs.writeFileSync(bundlePath, c);

// Invalidate compressed variants so the server stops serving the old gzip/br.
const path = require('path');
for (const ext of ['.br', '.gz']) {
  const p = bundlePath + ext;
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); console.log('  removed stale ' + path.basename(p)); }
    catch (e) { console.error('  could not remove ' + p + ': ' + e.message); }
  }
}

console.log('update-metadata-btn: done (' + changed + ' edits)');

})();

// ===== patch_per_game_runtime_refresh.js =====
;(() => {
// Per-game "Refrescar tiempo IGDB" button on the detail page.
//
// Wraps `sg=function(e){...}` (the Update-metadata button component) so that,
// for video_game items with an igdbId, an extra button appears next to
// "Update metadata" that triggers POST /api/refresh-game-runtime/:mediaItemId
// (defined by patch_refresh_game_runtimes.js).
//
// On success: invalidate the detail query → the page re-renders with the new
// runtime. On unchanged / missing time-to-beat / error: alert().
//
// MUST run after patch_update_metadata_btn.js — that patch promotes the
// button to btn-blue and changes the Xe id to a conditional, which is the
// anchor we replace.

const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/* mt-fork: per-game-igdb-refresh */';
if (c.includes(marker)) {
  console.log('per-game igdb refresh: already patched');
  return /* was process.exit(0) */;
}

// 1) Inject runtime-refresh state + handler inside sg=, right after `s=i.isLoading;`.
const stateAnchor = 's=i.isLoading;';
if (!c.includes(stateAnchor)) {
  console.error('per-game igdb refresh: sg= state anchor not found');
  process.exit(1);
}
const stateInjection =
  's=i.isLoading;' +
  'var _gr=r.useState(false),grBusy=_gr[0],setGrBusy=_gr[1];' +
  'var refreshGameRT=function(){' +
    'setGrBusy(true);' +
    'fetch("/api/refresh-game-runtime/"+a.id,{method:"POST",credentials:"same-origin"})' +
      '.then(function(r){return r.json()})' +
      '.then(function(d){' +
        'setGrBusy(false);' +
        'if(d.error){alert("Error: "+d.error);return}' +
        'if(d.updated){HW.invalidateQueries(en(a.id))}' +
        'else{alert(d.reason==="unchanged"?"Sin cambios \\u2014 el tiempo ya estaba al d\\u00eda":"Sin tiempo IGDB disponible para este juego")}' +
      '})' +
      '.catch(function(e){setGrBusy(false);alert(String(e.message||e))})' +
  '};';
c = c.replace(stateAnchor, stateInjection);

// 2) Wrap the return: original Update-metadata button + new IGDB refresh button (only for games with igdbId).
const oldReturn = 'return r.createElement("button",{className:"text-sm btn-blue",onClick:function(){return o()},disabled:s},r.createElement(Xe,{id:s?"Updating metadata":"Update metadata"}))';
if (!c.includes(oldReturn)) {
  console.error('per-game igdb refresh: sg= return anchor not found (did patch_update_metadata_btn run first?)');
  process.exit(1);
}
const newReturn = 'return r.createElement(r.Fragment,null,' +
  'r.createElement("button",{className:"text-sm btn-blue",onClick:function(){return o()},disabled:s},r.createElement(Xe,{id:s?"Updating metadata":"Update metadata"})),' +
  '(a.mediaType==="video_game"&&a.igdbId)?r.createElement("button",{className:"text-sm btn-blue",onClick:refreshGameRT,disabled:grBusy},grBusy?xo._("Refreshing IGDB..."):xo._("Refresh IGDB time")):null' +
')';
c = c.replace(oldReturn, newReturn);

c = marker + c;
fs.writeFileSync(bundlePath, c);

// Invalidate compressed variants so the server stops serving stale gzip/br.
const path = require('path');
for (const ext of ['.br', '.gz']) {
  const p = bundlePath + ext;
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); console.log('  removed stale ' + path.basename(p)); }
    catch (e) { console.error('  could not remove ' + p + ': ' + e.message); }
  }
}

console.log('per-game igdb refresh: done');

})();

// ===== patch_games_igdb_hint.js =====
;(() => {
// Insert an "IGDB token configurable in Application tokens" hint inline in the
// section-page header (Zv component) — between the "{N} items" count and the
// filter/sort dropdowns — but only when c.mediaType === "video_game" so it
// shows up on /games and not on Movies/Tv/Books/Theater.
//
// Anchor is the boundary between the items-count <div> and the `m && !w && …`
// Fragment that wraps the two dropdowns (N = Todo/filter, T = sort). We insert
// a guarded element right before that boundary so the hint renders inline
// inside the same `flex` row, hugging the count text on the left.

const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/* mt-fork: games-igdb-hint */';
if (c.includes(marker)) {
  console.log('games igdb hint: already patched');
  return /* was process.exit(0) */;
}

const anchor = '})),m&&!w&&r.createElement(r.Fragment,null,r.createElement("div",{className:"flex ml-auto"},r.createElement(N,null))';
if (!c.includes(anchor)) {
  console.error('games igdb hint: anchor not found (Zv header layout changed?)');
  process.exit(1);
}

const hint =
  ',c.mediaType==="video_game"&&r.createElement("span",{className:"ml-3 text-xs italic text-gray-500 dark:text-gray-400 self-center"},' +
    'xo._("IGDB time configurable in "),' +
    'r.createElement("a",{href:"#/settings/application-tokens",className:"underline text-blue-600 dark:text-blue-400 not-italic"},xo._("Application tokens"))' +
  ')';

c = c.replace(anchor, '})),' + hint.slice(1) + ',m&&!w&&r.createElement(r.Fragment,null,r.createElement("div",{className:"flex ml-auto"},r.createElement(N,null))');

c = marker + c;
fs.writeFileSync(bundlePath, c);

// Invalidate compressed variants so the static server stops serving stale gzip/br.
const path = require('path');
for (const ext of ['.br', '.gz']) {
  const p = bundlePath + ext;
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); console.log('  removed stale ' + path.basename(p)); }
    catch (e) { console.error('  could not remove ' + p + ': ' + e.message); }
  }
}

console.log('games igdb hint: inserted hint between items count and filter dropdown');

})();

// ===== patch_theater_hide_iam_btn.js =====
;(() => {
// The "Lo estoy viendo / leyendo / escuchando / jugando" button (the green
// Progreso button that opens the Rp modal) branches its label on
// Io(movie) / Do(book) / jo(audiobook) / Ao(game). For mediaType='theater'
// none of those match, so the wrapper div renders without a label
// (an empty 34×6 px ghost button).
//
// We're now the primary "in progress" UX (the duplicate _AIP button was
// removed from the grid), so theater MUST get a label here. Add a Tt(a)
// branch using "I am watching it" — fits a play just like a movie.

const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/* mt-fork: theater-iam-watching-label */';
if (c.includes(marker)) {
  console.log('theater-iam-watching-label: already patched');
  return /* was process.exit(0) */;
}

const old = 'Io(a)&&r.createElement(Xe,{id:"I am watching it"}),Do(a)&&r.createElement(Xe,{id:"I am reading it"})';
const _new = 'Io(a)&&r.createElement(Xe,{id:"I am watching it"}),Tt(a)&&r.createElement(Xe,{id:"I am watching it"}),Do(a)&&r.createElement(Xe,{id:"I am reading it"})';

if (!c.includes(old)) {
  console.error('theater-iam-watching-label: anchor not found in bundle');
  process.exit(1);
}
c = c.replace(old, _new);
c = marker + c;
fs.writeFileSync(bundlePath, c);

const path = require('path');
for (const ext of ['.br', '.gz']) {
  const p = bundlePath + ext;
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); console.log('  removed stale ' + path.basename(p)); }
    catch (e) { console.error('  could not remove ' + p + ': ' + e.message); }
  }
}

console.log('theater-iam-watching-label: added Tt(a) "I am watching it" branch');

})();

// ===== patch_theater_seen_history_link.js =====
;(() => {
// Bug: the "Seen history" / "Read history" / etc. link on the detail page
// branches on Io(movie)/Ro(tv)/Do(book)/jo(audiobook)/Ao(game) but never on
// theater. For theater items, the link renders as an empty <a> with no label
// (the user just sees nothing where the history link should be). Add a Tt(a)
// branch using the "Seen history" label.

const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/* mt-fork: theater-seen-history-link */';
if (c.includes(marker)) {
  console.log('theater-seen-history-link: already patched');
  return /* was process.exit(0) */;
}

const old = '(Io(a)||Ro(a))&&r.createElement(Xe,{id:"Seen history"}),Ao(a)&&r.createElement(Xe,{id:"Played history"})';
const _new = '(Io(a)||Ro(a)||Tt(a))&&r.createElement(Xe,{id:"Seen history"}),Ao(a)&&r.createElement(Xe,{id:"Played history"})';

if (!c.includes(old)) {
  console.error('theater-seen-history-link: anchor not found in bundle');
  process.exit(1);
}
c = c.replace(old, _new);
c = marker + c;
fs.writeFileSync(bundlePath, c);

const path = require('path');
for (const ext of ['.br', '.gz']) {
  const p = bundlePath + ext;
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); console.log('  removed stale ' + path.basename(p)); }
    catch (e) { console.error('  could not remove ' + p + ': ' + e.message); }
  }
}

console.log('theater-seen-history-link: added Tt(a) branch to "Seen history" link');

})();

// ===== patch_iam_to_inprogress.js =====
;(() => {
// Remove the white "Lo estoy viendo / leyendo / escuchando / jugando" button
// from the detail page action panel. The "in progress" semantics now live
// exclusively in the Progreso modal (Marcar/Quitar en proceso toggle). For
// games specifically, mount the _MAS toggle ("Marcar como visto" / "Quitar
// de visto") instead — the user wants that "seen-watched" affordance only on
// game detail pages, not on movies / books / audiobooks / theater / tv.
//
// Anchor: the original IAM button div (with the regenerator-coroutine onClick
// and the 5 mediaType-conditional labels — Tt(a) was inserted earlier by
// patch_theater_hide_iam_btn.js, so it's expected here). We replace the whole
// `!Lo(a)&&r.createElement(...)` expression with a games-gated _MAS mount;
// for non-game items the slot collapses to nothing.

const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/* mt-fork: iam-removed-mas-games */';
if (c.includes(marker)) {
  console.log('iam-removed-mas-games: already patched');
  return /* was process.exit(0) */;
}

const old = '!Lo(a)&&r.createElement("div",{className:"mt-3 text-sm btn",onClick:de(ke().mark((function e(){return ke().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:un({mediaItemId:a.id,progress:0});case 1:case"end":return e.stop()}}),e)})))},Io(a)&&r.createElement(Xe,{id:"I am watching it"}),Tt(a)&&r.createElement(Xe,{id:"I am watching it"}),Do(a)&&r.createElement(Xe,{id:"I am reading it"}),jo(a)&&r.createElement(Xe,{id:"I am listening it"}),Ao(a)&&r.createElement(Xe,{id:"I am playing it"}))';
const _new = 'Ao(a)&&r.createElement(_MAS,{mediaItem:a})';
if (!c.includes(old)) {
  console.error('iam-removed-mas-games: anchor not found');
  process.exit(1);
}
c = c.replace(old, _new);
console.log('iam-removed-mas-games: IAM button removed; _MAS mounted only for games (Ao)');

c = marker + c;
fs.writeFileSync(bundlePath, c);

const path = require('path');
for (const ext of ['.br', '.gz']) {
  const p = bundlePath + ext;
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); console.log('  removed stale ' + path.basename(p)); }
    catch (e) { console.error('  could not remove ' + p + ': ' + e.message); }
  }
}

console.log('iam-removed-mas-games: done');

})();

// ===== patch_modal_clear_progress.js =====
;(() => {
// Restructure the Progreso modal (Rp component) so its buttons follow the
// design the user asked for:
//
//   1. Marcar como completado     — green filled (unchanged), FIRST
//   2. Guardar progreso            — green outline, always visible, submits slider
//   3. Quitar progreso             — red outline, always visible, clears progress
//   4. Marcar en proceso ↔ Quitar de proceso — green/red OUTLINE toggle, state-aware
//   5. Cancelar                    — red filled (unchanged), LAST
//
// Save and clear are two separate, always-visible buttons (no toggle): the
// user wants to see both choices at once.
//   • Guardar progreso (green outline) — submits the slider value via _save.
//   • Quitar progreso (red outline)    — sets the matching progress field to 0
//     (audio-progress for audiobook/listen, episode-progress for TV current ep,
//     un() with progress:0 otherwise) and refetches.
//   • Marcar/Quitar de proceso reads/writes mediaItem.activelyInProgress via
//     /api/actively-in-progress/:id (PUT to mark, DELETE to unmark).
//
// "Outline" styling = `btn` class (which already gives a 1px border using
// border-color: currentColor) with text-green-500 / text-red-500 text colors,
// no background — matches Tailwind "outline" semantics naturally.

const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/* mt-fork: modal-restructured-buttons */';
if (c.includes(marker)) {
  console.log('modal-restructured-buttons: already patched');
  return /* was process.exit(0) */;
}

// --- 1. Drop the original "Guardar progreso" submit button inside the form.
// We'll re-add a click-driven version OUTSIDE the form so it can be paired
// with "Quitar progreso" as a single toggle slot in the new button order.
const oldGuardarSubmit = ',r.createElement("button",{className:"w-full btn"},"Guardar progreso")';
if (!c.includes(oldGuardarSubmit)) {
  console.error('modal-restructured-buttons: Guardar submit anchor not found');
  process.exit(1);
}
c = c.replace(oldGuardarSubmit, '');
console.log('modal-restructured-buttons: removed in-form Guardar submit button');

// --- 2. Replace the trailing block (Marcar como completado + Cancel) plus
// any older injected buttons (Quitar de proceso / Quitar progreso) with the
// final four-button layout in the right order.
//
// We anchor on the unchanged Marcar como completado element. Everything from
// there to the end of the createElement(div,{className:"p-3"} ...) tree is
// the buttons section we want to rewrite. The simplest, robust replacement
// is to anchor on the EXACT createElement(...) call for "Marcar como
// completado" that has the green-bg style override, plus the chain that
// follows it (which may now contain my older Quitar de proceso / Quitar
// progreso, or just Cancel).
//
// To stay resilient to either state of the chain, we match
//   <CompletadoElement>...<CancelElement>
// and replace it wholesale.
//
// Build the regex from the Completado anchor.
const completadoAnchor = 'r.createElement("div",{className:"w-full mt-3 btn-blue",style:{background:"#16a34a",color:"white"},onClick:_markCompleted},_tvEp?"Marcar episodio como completado":"Marcar como completado")';
const cancelAnchor = 'r.createElement("div",{className:"w-full mt-3 btn-red",onClick:function(){return n()}},r.createElement(Xe,{id:"Cancel"}))';
const cidx = c.indexOf(completadoAnchor);
const xidx = c.indexOf(cancelAnchor, cidx);
if (cidx < 0 || xidx < 0) {
  console.error('modal-restructured-buttons: Completado/Cancel anchors not found');
  process.exit(1);
}
const oldBlock = c.slice(cidx, xidx + cancelAnchor.length);

// Build the new block. Order:
//   [1] Marcar como completado, [2] Guardar progreso, [3] Quitar progreso,
//   [4] Marcar/Quitar en proceso (toggle), [5] Cancelar.
const newBlock = ''
  + 'r.createElement(r.Fragment,null,'
    // [1] Marcar como completado (unchanged, first)
    + completadoAnchor + ','
    // [2] Guardar progreso — green outline, always visible, submits slider
    + 'r.createElement("div",{className:"w-full mt-3 btn text-green-500",onClick:function(ev){_save(ev)}},"Guardar progreso"),'
    // [3] Quitar progreso — red outline, always visible, sets the matching
    //     progress field to 0 and refetches.
    + '(function(){'
      + 'var _clearOnce=function(){'
        + 'var promises=[];'
        + 'if(_tvEp){'
          + 'promises.push(fetch("/api/episode-progress?episodeId="+_tvEp.id+"&progress=0",{method:"PUT",credentials:"same-origin"}));'
        + '}else{'
          + 'un({mediaItemId:t.id,progress:0,duration:0});'
          + 'promises.push(fetch("/api/audio-progress?mediaItemId="+t.id+"&progress=0",{method:"PUT",credentials:"same-origin"}));'
        + '}'
        + 'Promise.all(promises).finally(function(){HW.refetchQueries(en(t.id));HW.refetchQueries(["items"]);n()});'
      + '};'
      + 'return r.createElement("div",{className:"w-full mt-3 btn text-red-500",onClick:_clearOnce},"Quitar progreso");'
    + '})(),'
    // [4] Toggle Marcar en proceso ↔ Quitar de proceso (outline)
    //     "Quitar de proceso" además garantiza que la serie quede en
    //     Seguimiento (Watchlist) — al sacar de "En proceso" la añadimos
    //     idempotentemente al watchlist para que no desaparezca de la
    //     vista del usuario.
    + '(function(){'
      + 'var _aip=Boolean(t.activelyInProgress);'
      + 'if(_aip){'
        + 'var _delAip=function(){'
          + 'Promise.all(['
            + 'fetch("/api/actively-in-progress/"+t.id,{method:"DELETE",credentials:"same-origin"}),'
            + 'fetch("/api/watchlist?mediaItemId="+t.id,{method:"PUT",credentials:"same-origin"})'
          + ']).finally(function(){window._mtBustItemFlags&&window._mtBustItemFlags(t.id);HW.refetchQueries(en(t.id));HW.refetchQueries(["items"]);n();});'
        + '};'
        + 'return r.createElement("div",{className:"w-full mt-3 btn text-red-500",onClick:_delAip},"Quitar de proceso");'
      + '}'
      + 'var _addAip=function(){'
        + 'fetch("/api/actively-in-progress/"+t.id,{method:"PUT",credentials:"same-origin"})'
          + '.finally(function(){window._mtBustItemFlags&&window._mtBustItemFlags(t.id);HW.refetchQueries(en(t.id));HW.refetchQueries(["items"]);n();});'
      + '};'
      + 'return r.createElement("div",{className:"w-full mt-3 btn text-green-500",onClick:_addAip},"Marcar en proceso");'
    + '})(),'
    // [5] Cancelar (unchanged, last)
    + cancelAnchor
  + ')';

c = c.slice(0, cidx) + newBlock + c.slice(xidx + cancelAnchor.length);
console.log('modal-restructured-buttons: rewrote button block (Completado · Guardar/Quitar progreso · Marcar/Quitar proceso · Cancelar)');

c = marker + c;
fs.writeFileSync(bundlePath, c);

const path = require('path');
for (const ext of ['.br', '.gz']) {
  const p = bundlePath + ext;
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); console.log('  removed stale ' + path.basename(p)); }
    catch (e) { console.error('  could not remove ' + p + ': ' + e.message); }
  }
}

console.log('modal-restructured-buttons: done');

})();

// ===== patch_count_in_library.js =====
;(() => {
// Bug: items.js getItemsKnexSql builds a separate fast-path "count" query for
// the default branch (no special filter). The data query restricts results to
// items the user actually has in their library:
//   query.where(qb => qb.whereNotNull('listItem.mediaItemId')
//                     .orWhereNotNull('lastSeen.mediaItemId'));
// …but the default count branch is just `count('* as count')` over all
// mediaItem rows of that type. Result: a section like /theater shows "9
// elementos" when only 2 are actually rendered (the other 7 are orphaned
// search results that got persisted but never added to a list/seen).
//
// Replace the default count branch with one that applies the same library
// membership filter (in any list of this user, or with any seen row).

const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

const marker = '// mt-fork: count-in-library';
if (c.includes(marker)) {
  console.log('count-in-library: already patched');
  return /* was process.exit(0) */;
}

const old = "} else {\n    sqlCountQuery = _knex('mediaItem').modify(_applyMt).count('* as count');\n  } // count-fast-path";
const _new = "} else {\n    " + marker + "\n    sqlCountQuery = _knex('mediaItem').modify(_applyMt).where(qb => qb\n      .whereExists(function(){ this.from('listItem').join('list','list.id','listItem.listId').whereRaw('listItem.mediaItemId = mediaItem.id').where('list.userId', userId); })\n      .orWhereExists(function(){ this.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId); })\n    ).count('* as count');\n  } // count-fast-path";

if (!c.includes(old)) {
  console.error('count-in-library: anchor not found in items.js (layout changed?)');
  process.exit(1);
}
c = c.replace(old, _new);
fs.writeFileSync(path, c);
console.log('count-in-library: default count branch now requires list-membership or seen');

try {
  delete require.cache[require.resolve(path)];
  require(path);
  console.log('count-in-library: syntax OK');
} catch (e) {
  console.error('count-in-library: SYNTAX ERROR -> ' + e.message.slice(0, 300));
  process.exit(1);
}

})();

// ===== patch_count_query_abandoned.js =====
;(() => {
// Bugfix for the items count fast-path: getItemsKnexSql picks a separate
// `sqlCountQuery` based on the dominant filter (filter / onlyOnWatchlist /
// onlyWithProgress / …). None of those branches knows about `excludeAbandoned`
// or `onlyAbandoned`, so the header count and paginator on /abandonados,
// /in-progress, etc. were wrong:
//   - /abandonados: count fell through to `count(*)` over ALL mediaItem rows.
//   - /in-progress: count included abandoned items that the main query excluded.
// Fix: when either flag is present, derive the count from the main `query`
// (which already has the filters applied). countDistinct on mediaItem.id
// avoids inflated counts from the joins.

const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

const marker = '/* mt-fork: count-query-abandoned */';
if (c.includes(marker)) {
  console.log('count query abandoned: already patched');
  return /* was process.exit(0) */;
}

const anchor = '  let sqlCountQuery;\n  if (filter) {';
if (!c.includes(anchor)) {
  console.error('count query abandoned: anchor not found'); process.exit(1);
}

const replacement =
  '  let sqlCountQuery;\n' +
  '  ' + marker + '\n' +
  '  const _isAbnd = v => v === true || v === \'true\' || v === 1;\n' +
  '  const _hasAbandonedFlag = _isAbnd(excludeAbandoned) || _isAbnd(onlyAbandoned);\n' +
  '  if (_hasAbandonedFlag) {\n' +
  '    // No fast-path covers these — derive count from the filtered main query.\n' +
  '    sqlCountQuery = query.clone().clearOrder().clearSelect().countDistinct(\'mediaItem.id\', { as: \'count\' });\n' +
  '  } else if (filter) {';

c = c.replace(anchor, replacement);
fs.writeFileSync(path, c);
console.log('count query abandoned: count now respects excludeAbandoned/onlyAbandoned');

try {
  delete require.cache[require.resolve(path)];
  require(path);
  console.log('count query abandoned: syntax OK');
} catch (e) {
  console.error('count query abandoned: SYNTAX ERROR ->', e.message.slice(0, 300));
  process.exit(1);
}

})();

// ===== patch_only_just_watched.js =====
;(() => {
// Add a "Solo visto" / "Just watched" filter (games-only). While at it, fix
// upstream's broken pass-through: the items controller never forwarded
// onlyWatched/onlyPlayed to the repository, so the existing "Played" and
// "Visto" dropdown entries didn't actually filter — they only changed the
// header count (because the count fast-path *did* read the flags).
//
// Coordinated edits:
//   1. controllers/items.js: destructure onlyWatched, onlyPlayed, onlyJustWatched
//      from req.query and forward to mediaItemRepository.items({...}). Both
//      getPaginated and get handlers.
//   2. knex/queries/items.js: destructure onlyJustWatched (onlyWatched/onlyPlayed
//      already destructured upstream); apply WHERE clauses for all three; add
//      a count fast-path branch for onlyJustWatched.
//   3. main bundle (frontend): inject {onlyJustWatched:"Just watched"} into the
//      filter dropdown for games. The xo._("Just watched") key already exists
//      in patch_i18n_custom.js (ES: "Solo visto").

const fs = require('fs');
const child = require('child_process');

// ===== Backend: controllers/items.js =====
{
  const path = '/app/build/controllers/items.js';
  let c = fs.readFileSync(path, 'utf8');

  if (c.includes('// mt-fork: only-watched-passthrough')) {
    console.log('only just watched (controllers/items.js): already patched');
  } else {
    // Two destructures (getPaginated + get): both end with `onlyAbandoned\n    } = req.query;`.
    const destrRe = /(\n\s+)(onlyAbandoned)(\s*\n\s*\}\s*=\s*req\.query;)/g;
    const destrMatches = c.match(destrRe);
    if (!destrMatches || destrMatches.length === 0) {
      console.error('only just watched (controllers): destructure anchor not found'); process.exit(1);
    }
    c = c.replace(destrRe, (_, ws, last, tail) =>
      `${ws}${last},${ws}onlyWatched,${ws}onlyPlayed,${ws}onlyJustWatched${tail}`
    );

    // Two `mediaItemRepository.items({ ... })` calls — append the three flags
    // before the closing `})`. Anchor on `onlyAbandoned: onlyAbandoned\n    });`.
    const callRe = /(onlyAbandoned: onlyAbandoned)(\s*\n\s*\}\);)/g;
    const callMatches = c.match(callRe);
    if (!callMatches || callMatches.length === 0) {
      console.error('only just watched (controllers): items() call anchor not found'); process.exit(1);
    }
    c = c.replace(callRe, (_, body, tail) =>
      body + ',\n      onlyWatched: onlyWatched,\n      onlyPlayed: onlyPlayed,\n      onlyJustWatched: onlyJustWatched' + tail
    );

    c = '// mt-fork: only-watched-passthrough\n' + c;
    fs.writeFileSync(path, c);
    console.log('only just watched (controllers/items.js): forwarded onlyWatched/Played/JustWatched (' + destrMatches.length + ' destructures, ' + callMatches.length + ' calls)');
  }
}

// ===== Backend: knex/queries/items.js =====
{
  const path = '/app/build/knex/queries/items.js';
  let c = fs.readFileSync(path, 'utf8');

  if (c.includes('// mt-fork: only-just-watched')) {
    console.log('only just watched (items.js): already patched');
  } else {
    // Add onlyJustWatched to the args destructure (last identifier before `} = args;`).
    const destrRe = /(\n\s+)(onlyAbandoned|onlyDownloaded|onlyWatched)(\s*\n\s*\}\s*=\s*args;)/;
    const m = c.match(destrRe);
    if (!m) {
      console.error('only just watched (items.js): destructure anchor not found'); process.exit(1);
    }
    c = c.replace(destrRe, `${m[1]}${m[2]},${m[1]}onlyJustWatched${m[3]}`);

    // Apply WHERE clauses for onlyWatched, onlyPlayed, onlyJustWatched.
    // Anchor: end of the abandoned-filter block (which is the last filter currently applied).
    const whereAnchor = "if (onlyAbandoned === true || onlyAbandoned === 'true' || onlyAbandoned === 1) {\n        query.whereExists(function() { this.from('abandoned').where('abandoned.userId', userId).whereRaw('abandoned.mediaItemId = mediaItem.id'); });\n      }";
    if (!c.includes(whereAnchor)) {
      console.error('only just watched (items.js): WHERE anchor not found'); process.exit(1);
    }
    const whereInject = whereAnchor +
      "\n      // mt-fork: pass-through onlyWatched / onlyPlayed (upstream had them in count only)\n" +
      "      if (onlyWatched === true || onlyWatched === 'true' || onlyWatched === 1) {\n" +
      "        query.whereExists(function() { this.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId).where('seen.kind', 'watched'); });\n" +
      "      }\n" +
      "      if (onlyPlayed === true || onlyPlayed === 'true' || onlyPlayed === 1) {\n" +
      "        query.whereExists(function() { this.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId).where('seen.kind', 'played'); });\n" +
      "      }\n" +
      "      // mt-fork: only-just-watched — kind='watched' AND no kind='played'\n" +
      "      if (onlyJustWatched === true || onlyJustWatched === 'true' || onlyJustWatched === 1) {\n" +
      "        query.whereExists(function() { this.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId).where('seen.kind', 'watched'); });\n" +
      "        query.whereNotExists(function() { this.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId).where('seen.kind', 'played'); });\n" +
      "      }";
    c = c.replace(whereAnchor, whereInject);

    // Count fast-path: mirror onlyWatched but with the extra whereNotExists.
    const countAnchor = "  } else if (onlyWatched) {\n    sqlCountQuery = _knex('mediaItem').modify(_applyMt)\n      .whereExists(qb => qb.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId).where('seen.kind', 'watched'))\n      .count('* as count');";
    if (!c.includes(countAnchor)) {
      console.error('only just watched (items.js): count fast-path anchor not found'); process.exit(1);
    }
    const countInject = countAnchor +
      "\n  } else if (onlyJustWatched) {\n" +
      "    sqlCountQuery = _knex('mediaItem').modify(_applyMt)\n" +
      "      .whereExists(qb => qb.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId).where('seen.kind', 'watched'))\n" +
      "      .whereNotExists(qb => qb.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId).where('seen.kind', 'played'))\n" +
      "      .count('* as count');";
    c = c.replace(countAnchor, countInject);

    c = '// mt-fork: only-just-watched\n' + c;
    fs.writeFileSync(path, c);
    console.log('only just watched (items.js): destructure + WHERE (3 filters) + count branch added');
  }
}

// ===== Frontend =====
{
  const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
  let c = fs.readFileSync(bundlePath, 'utf8');

  const marker = '/*mt-fork:filter-only-just-watched*/';
  if (c.includes(marker)) {
    console.log('only just watched (frontend): already patched');
  } else {
    // The games filter dropdown stays as upstream (one "Visto" option, no
    // sibling "Solo visto"). The backend filter and pass-through stay in
    // place — onlyJustWatched is reachable via URL ?onlyJustWatched=true
    // until we ship a proper sub-dropdown nested under "Visto".
    c = marker + c;
    fs.writeFileSync(bundlePath, c);
    console.log('only just watched (frontend): kept dropdown as upstream (no extra entry); backend filter still wired');
  }
}

})();

// ===== patch_games_seen_split.js =====
;(() => {
// On /games, when the filter dropdown is "Visto" (onlyWatched), replace the
// flat grid with two collapsible sections that together cover *everything*
// the user has seen in any way:
//   - "Solo vistos"       — kind=watched AND NOT kind=played
//   - "Vistos y jugados"  — kind=played (anything completed; if also watched, fine)
//
// User intent (2026-05-02): "en ese desplegable tiene que aparecer todo lo
// jugado y todo lo visto". The earlier scoping of section 2 to the strict
// intersection (kind=watched AND kind=played) hid every game that was only
// marked completed — they had no home in the Visto dropdown.
//
// Implementation: inject a _GVS component before _v that defines the two
// sub-sections (each renders its own Zv with the right args). Then patch
// Zv's render to short-circuit to _GVS when c.mediaType==='video_game' and
// the active filter key is onlyWatched.

const fs = require('fs');
const child = require('child_process');
const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const marker = '/*mt-fork:games-seen-split*/';
if (c.includes(marker)) {
  console.log('games-seen-split: already patched');
  return /* was process.exit(0) */;
}

// === 1. _GVS component definition (mirrors _ABS layout) ===
// Defined as part of the comma-chain that holds _AB, _AIP, _v — so it ends in
// a trailing comma and contains no `;`.
const gvsDef =
  '_GVS=function(){' +
    'var _Section=function(props){' +
      "var _key='mt_gvs_'+String(props.label||'');" +
      "var _init=(function(){try{return sessionStorage.getItem(_key)!=='0'}catch(_){return true}})();" +
      'var st=r.useState(_init),open=st[0],_set=st[1];' +
      "var setOpen=function(v){try{sessionStorage.setItem(_key,v?'1':'0')}catch(_){}_set(v)};" +
      'return r.createElement("div",{className:"mb-3 border border-slate-300 dark:border-slate-700 rounded overflow-hidden"},' +
        'r.createElement("button",{onClick:function(){setOpen(!open)},className:"w-full text-left text-xl font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-2"},' +
          'r.createElement("i",{className:"material-icons"},open?"expand_more":"chevron_right"),' +
          'props.label' +
        '),' +
        'open&&r.createElement("div",{className:"p-2"},' +
          'r.createElement(Zv,{args:Object.assign({orderBy:"title",sortOrder:"asc"},props.args),showSortOrderControls:!1,showSearch:!1,gridItemAppearance:{}})' +
        ')' +
      ')' +
    '};' +
    'return r.createElement("div",{className:"p-2"},' +
      'r.createElement(_Section,{label:xo._("Just watched"),args:{mediaType:"video_game",onlyJustWatched:!0}}),' +
      'r.createElement(_Section,{label:xo._("Watched and played"),args:{mediaType:"video_game",onlyPlayed:!0}})' +
    ')' +
  '},';

// Inject before _v (same anchor used by other custom comma-chain components).
const compAnchor = '_v=function(e){';
if (!c.includes(compAnchor)) {
  console.error('games-seen-split: _v anchor not found'); process.exit(1);
}
c = c.replace(compAnchor, gvsDef + compAnchor);

// === 2. Short-circuit Zv render to _GVS when on /games + filter=Visto ===
// Anchor on the existing items map. The full render fragment is:
//   null===(t=w?H:A)||void 0===t?void 0:t.map((function(e){return r.createElement(_v,...)}))
// Wrap it with a ternary so the split view replaces the grid (and only the grid)
// for the games + onlyWatched case.
const renderAnchor = 'null===(t=w?H:A)||void 0===t?void 0:t.map((function(e){return r.createElement(_v,';
if (!c.includes(renderAnchor)) {
  console.error('games-seen-split: Zv render anchor not found'); process.exit(1);
}
// Gate: switch to split view ONLY for the top-level games grid with filter=Visto
// AND no active search. When the user types in the search box (`w` truthy), fall
// through to the normal grid so search results show. Also bail in any sub-Zv
// instance (args carry onlyJustWatched / onlyPlayed / onlyWatched) to avoid
// recursion — each of those flags is set only by _GVS itself.
c = c.replace(
  renderAnchor,
  '(!w&&c.mediaType==="video_game"&&W&&W.onlyWatched&&!c.onlyJustWatched&&!c.onlyPlayed&&!c.onlyWatched)?r.createElement(_GVS,null):' + renderAnchor
);

c = marker + c;
fs.writeFileSync(bundlePath, c);
console.log('games-seen-split: _GVS injected and Zv render gated on /games filter=Visto');

})();

// ===== patch_bugfix_pendiente_calendar_v1.js =====
// Three related fixes for: "marking an episode as completed kicks the show out
// of Pendiente and out of Calendario". Caused by three layers all collapsing
// the show out of view as soon as no aired-unseen episodes remain — even when
// the show still has future episodes scheduled.
//   A. controllers/seen.js _removeFromWatchlistIfComplete: also block removal
//      when future episodes exist (releaseDate IS NULL or > today).
//   B. knex/queries/items.js onlyWithProgress: a TV show with any seen episode
//      and a known upcomingEpisode keeps "in progress" status (data query +
//      count fast-path).
//   C. controllers/calendar.js libSubquery: include shows where any episode
//      has a seen row, so the show keeps showing on the Calendar after the
//      last aired episode is marked.
;(() => {
const fs = require('fs');

// === A. seen.js: smarter "complete" check ===
{
  const path = '/app/build/controllers/seen.js';
  let c = fs.readFileSync(path, 'utf8');
  if (c.includes('/* WL_COMPLETE_V2 */')) {
    console.log('bugfix pendiente: watchlist complete v2 already applied');
  } else {
    const old =
      "      const unwatched = await knex('episode')\n" +
      "        .where('episode.tvShowId', mediaItem.id)\n" +
      "        .where('episode.isSpecialEpisode', false)\n" +
      "        .whereNotNull('episode.releaseDate')\n" +
      "        .where('episode.releaseDate', '<=', today)\n" +
      "        .whereNotExists(function() { this.from('seen').whereRaw('seen.episodeId = episode.id').where('seen.userId', userId); })\n" +
      "        .count('* as c').first();\n" +
      "      isComplete = (Number(unwatched && unwatched.c) || 0) === 0;";
    const fresh =
      "      /* WL_COMPLETE_V2 */\n" +
      "      const remaining = await knex('episode')\n" +
      "        .where('episode.tvShowId', mediaItem.id)\n" +
      "        .where('episode.isSpecialEpisode', false)\n" +
      "        .where(q => q\n" +
      "          .whereNull('episode.releaseDate')\n" +
      "          .orWhere('episode.releaseDate', '>', today)\n" +
      "          .orWhereNotExists(function() { this.from('seen').whereRaw('seen.episodeId = episode.id').where('seen.userId', userId); })\n" +
      "        )\n" +
      "        .count('* as c').first();\n" +
      "      isComplete = (Number(remaining && remaining.c) || 0) === 0;";
    if (!c.includes(old)) {
      console.error('bugfix pendiente: seen.js _removeFromWatchlistIfComplete anchor not found');
      process.exit(1);
    }
    c = c.replace(old, fresh);
    fs.writeFileSync(path, c);
    console.log('bugfix pendiente: watchlist auto-remove now considers future episodes');
  }
}

// === B. items.js: keep TV shows with upcoming episodes in onlyWithProgress ===
{
  const path = '/app/build/knex/queries/items.js';
  let c = fs.readFileSync(path, 'utf8');

  // B.1 — data query: relax the TV "in progress" branch to include shows with
  // upcomingEpisode (already leftJoined upstream).
  const tvOld =
    "orWhere(qb => qb.where('mediaItem.mediaType', 'tv').where('seenEpisodesCount', '>', 0).andWhere('unseenEpisodesCount', '>', 0))";
  const tvNew =
    "orWhere(qb => qb.where('mediaItem.mediaType', 'tv').where('seenEpisodesCount', '>', 0).andWhere(inner => inner.where('unseenEpisodesCount', '>', 0).orWhereNotNull('upcomingEpisode.tvShowId')))";
  if (c.includes(tvNew)) {
    console.log('bugfix pendiente: items.js data query TV branch already relaxed');
  } else if (!c.includes(tvOld)) {
    console.error('bugfix pendiente: items.js data query TV anchor not found');
    process.exit(1);
  } else {
    c = c.replace(tvOld, tvNew);
    console.log('bugfix pendiente: items.js data query keeps caught-up shows with upcoming ep');
  }

  // B.2 — data query: require strictly partial progress for non-TV
  // (was: any progress row → in-progress, which catches progress=0 leftovers).
  const nonTvOld =
    "where(qb => qb.whereNot('mediaItem.mediaType', 'tv').whereNotNull('progress.mediaItemId'))";
  const nonTvNew =
    "where(qb => qb.whereNot('mediaItem.mediaType', 'tv').whereNotNull('progress.mediaItemId').where('progress.progress', '>', 0).where('progress.progress', '<', 1))";
  if (c.includes(nonTvNew)) {
    console.log('bugfix pendiente: items.js data query non-TV progress check already strict');
  } else if (!c.includes(nonTvOld)) {
    console.error('bugfix pendiente: items.js data query non-TV anchor not found');
    process.exit(1);
  } else {
    c = c.replace(nonTvOld, nonTvNew);
    console.log('bugfix pendiente: items.js data query non-TV requires 0<progress<1');
  }

  // B.3 — count fast-path: same relaxations using subqueries (the join columns
  // aren't in scope here). Bump the progress-table filter to >0 AND <1, and add
  // an OR-branch for TV shows that have a future episode known.
  const cntProgOld =
    ".whereExists(qbb => qbb.from('progress').whereRaw('progress.mediaItemId = mediaItem.id').where('progress.userId', userId).where('progress.progress', '<', 1))";
  const cntProgNew =
    ".whereExists(qbb => qbb.from('progress').whereRaw('progress.mediaItemId = mediaItem.id').where('progress.userId', userId).where('progress.progress', '>', 0).where('progress.progress', '<', 1))";
  if (c.includes(cntProgNew)) {
    console.log('bugfix pendiente: count fast-path progress filter already strict');
  } else if (!c.includes(cntProgOld)) {
    console.error('bugfix pendiente: count fast-path progress anchor not found');
    process.exit(1);
  } else {
    c = c.replace(cntProgOld, cntProgNew);
    console.log('bugfix pendiente: count fast-path requires 0<progress<1');
  }

  const cntTvOld =
    "    .orWhere(qb2 => qb2.where('mediaItem.mediaType', 'tv')\n" +
    "        .whereExists(qbb => qbb.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId))\n" +
    "        .whereExists(qbe => qbe.from('episode').whereRaw('episode.tvShowId = mediaItem.id')\n" +
    "          .where('episode.isSpecialEpisode', false)\n" +
    "          .whereNotNull('episode.releaseDate')\n" +
    "          .where('episode.releaseDate', '<=', currentDateString)\n" +
    "          .whereNotExists(qbs => qbs.from('seen').whereRaw('seen.episodeId = episode.id').where('seen.userId', userId))\n" +
    "        ))";
  const cntTvNew =
    "    .orWhere(qb2 => qb2.where('mediaItem.mediaType', 'tv')\n" +
    "        .whereExists(qbb => qbb.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId))\n" +
    "        .where(qbR => qbR\n" +
    "          .whereExists(qbe => qbe.from('episode').whereRaw('episode.tvShowId = mediaItem.id')\n" +
    "            .where('episode.isSpecialEpisode', false)\n" +
    "            .whereNotNull('episode.releaseDate')\n" +
    "            .where('episode.releaseDate', '<=', currentDateString)\n" +
    "            .whereNotExists(qbs => qbs.from('seen').whereRaw('seen.episodeId = episode.id').where('seen.userId', userId))\n" +
    "          )\n" +
    "          .orWhereExists(qbf => qbf.from('episode').whereRaw('episode.tvShowId = mediaItem.id')\n" +
    "            .where('episode.isSpecialEpisode', false)\n" +
    "            .where(qbd => qbd.whereNull('episode.releaseDate').orWhere('episode.releaseDate', '>', currentDateString))\n" +
    "          )\n" +
    "        ))";
  if (c.includes(cntTvNew)) {
    console.log('bugfix pendiente: count fast-path TV branch already relaxed');
  } else if (!c.includes(cntTvOld)) {
    console.error('bugfix pendiente: count fast-path TV anchor not found');
    process.exit(1);
  } else {
    c = c.replace(cntTvOld, cntTvNew);
    console.log('bugfix pendiente: count fast-path keeps caught-up shows with future ep');
  }

  fs.writeFileSync(path, c);
  try {
    delete require.cache[require.resolve(path)];
    require(path);
    console.log('bugfix pendiente: items.js syntax OK');
  } catch (e) {
    console.error('bugfix pendiente: items.js SYNTAX ERROR ->', e.message.slice(0, 300));
    process.exit(1);
  }
}

// === C. calendar.js libSubquery: include shows with any seen episode ===
{
  const path = '/app/build/controllers/calendar.js';
  let c = fs.readFileSync(path, 'utf8');
  if (c.includes('/* CALENDAR_LIB_V3 */')) {
    console.log('bugfix pendiente: calendar libSubquery v3 already applied');
  } else {
    const old =
      "const libSubquery = `SELECT mediaItemId FROM listItem li JOIN list l ON l.id = li.listId WHERE l.userId = ${uid}\n" +
      "                       UNION SELECT mediaItemId FROM progress WHERE userId = ${uid} AND progress < 1`;";
    const fresh =
      "/* CALENDAR_LIB_V3 */\n" +
      "  const libSubquery = `SELECT mediaItemId FROM listItem li JOIN list l ON l.id = li.listId WHERE l.userId = ${uid}\n" +
      "                       UNION SELECT mediaItemId FROM progress WHERE userId = ${uid} AND progress > 0 AND progress < 1\n" +
      "                       UNION SELECT DISTINCT episode.tvShowId AS mediaItemId FROM episode JOIN seen ON seen.episodeId = episode.id WHERE seen.userId = ${uid}`;";
    if (!c.includes(old)) {
      console.error('bugfix pendiente: calendar libSubquery anchor not found');
      process.exit(1);
    }
    c = c.replace(old, fresh);
    fs.writeFileSync(path, c);
    try {
      delete require.cache[require.resolve(path)];
      require(path);
      console.log('bugfix pendiente: calendar.js syntax OK');
    } catch (e) {
      console.error('bugfix pendiente: calendar.js SYNTAX ERROR ->', e.message.slice(0, 300));
      process.exit(1);
    }
    console.log('bugfix pendiente: calendar library now includes shows with seen episodes');
  }
}

})();

// ===== patch_bugfix_audiobook_duration_persist.js =====
// Audio/book progress modal: persist the user-entered total duration (audiobook
// H+M) and total pages (book) so the slider's max is restored next time the
// modal opens. Without this maxD/maxP are local React state that reset to
// `t.runtime || 600` / `t.numberOfPages || 200` every render, making the slider
// scale feel like it "doesn't save".
//
// Three edits:
//   1. /app/build/controllers/item.js setAudioProgress also writes runtime +
//      numberOfPages when present in the query.
//   2. /app/build/generated/routes/routes.js — extend the validator schema to
//      allow optional `runtime` and `numberOfPages` (AJV's removeAdditional
//      would otherwise strip them silently).
//   3. /app/public/main_*.js — extend the Rp modal's _save so the audio /
//      reading paths append &runtime=maxD and &numberOfPages=maxP.
;(() => {
const fs = require('fs');
const child = require('child_process');

// === 1. Controller: accept runtime / numberOfPages ===
{
  const path = '/app/build/controllers/item.js';
  let c = fs.readFileSync(path, 'utf8');
  if (c.includes('/* AUDIO_PROGRESS_DUR_V2 */')) {
    console.log('bugfix audio duration: controller already patched');
  } else {
    const old =
      "  setAudioProgress = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
      "    const { mediaItemId } = req.query;\n" +
      "    const progress = req.query.progress !== undefined ? req.query.progress : (req.body && req.body.progress);\n" +
      "    const item = await _dbconfig.Database.knex('mediaItem').select('id').where('id', mediaItemId).first();\n" +
      "    if (!item) { res.status(404).send(); return; }\n" +
      "    const p = (progress === null || progress === undefined) ? null : Math.max(0, Math.min(1, Number(progress)));\n" +
      "    await _dbconfig.Database.knex('mediaItem').update({ audioProgress: p }).where('id', mediaItemId);\n" +
      "    res.json({ ok: true, audioProgress: p });\n" +
      "  });";
    const fresh =
      "  /* AUDIO_PROGRESS_DUR_V2 */\n" +
      "  setAudioProgress = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
      "    const { mediaItemId } = req.query;\n" +
      "    const progress = req.query.progress !== undefined ? req.query.progress : (req.body && req.body.progress);\n" +
      "    const runtime = req.query.runtime;\n" +
      "    const numberOfPages = req.query.numberOfPages;\n" +
      "    const item = await _dbconfig.Database.knex('mediaItem').select('id').where('id', mediaItemId).first();\n" +
      "    if (!item) { res.status(404).send(); return; }\n" +
      "    const patch = {};\n" +
      "    let pOut = undefined;\n" +
      "    if (progress !== null && progress !== undefined) {\n" +
      "      pOut = Math.max(0, Math.min(1, Number(progress)));\n" +
      "      patch.audioProgress = pOut;\n" +
      "    }\n" +
      "    if (runtime !== undefined && runtime !== null && runtime !== '' && !Number.isNaN(Number(runtime))) {\n" +
      "      const r = Math.max(1, Math.round(Number(runtime)));\n" +
      "      patch.runtime = r;\n" +
      "    }\n" +
      "    if (numberOfPages !== undefined && numberOfPages !== null && numberOfPages !== '' && !Number.isNaN(Number(numberOfPages))) {\n" +
      "      const n = Math.max(1, Math.round(Number(numberOfPages)));\n" +
      "      patch.numberOfPages = n;\n" +
      "    }\n" +
      "    if (Object.keys(patch).length > 0) {\n" +
      "      await _dbconfig.Database.knex('mediaItem').update(patch).where('id', mediaItemId);\n" +
      "    }\n" +
      "    res.json({ ok: true, audioProgress: pOut, runtime: patch.runtime, numberOfPages: patch.numberOfPages });\n" +
      "  });";
    if (!c.includes(old)) {
      console.error('bugfix audio duration: setAudioProgress anchor not found');
      process.exit(1);
    }
    c = c.replace(old, fresh);
    fs.writeFileSync(path, c);
    console.log('bugfix audio duration: setAudioProgress also persists runtime + numberOfPages');
  }
}

// === 2. Route validator: allow runtime + numberOfPages ===
{
  const path = '/app/build/generated/routes/routes.js';
  let c = fs.readFileSync(path, 'utf8');
  if (c.includes('/* AUDIO_PROGRESS_ROUTE_V2 */')) {
    console.log('bugfix audio duration: route schema already extended');
  } else {
    const old =
      "router.put('/api/audio-progress', validatorHandler({\n" +
      "  requestQuerySchema: {\n" +
      "    $schema: 'http://json-schema.org/draft-07/schema#',\n" +
      "    type: 'object',\n" +
      "    properties: { mediaItemId: { type: 'number' }, progress: { type: 'number' } },\n" +
      "    required: ['mediaItemId']\n" +
      "  }\n" +
      "}), _MediaItemController.setAudioProgress);";
    const fresh =
      "/* AUDIO_PROGRESS_ROUTE_V2 */\n" +
      "router.put('/api/audio-progress', validatorHandler({\n" +
      "  requestQuerySchema: {\n" +
      "    $schema: 'http://json-schema.org/draft-07/schema#',\n" +
      "    type: 'object',\n" +
      "    properties: { mediaItemId: { type: 'number' }, progress: { type: 'number' }, runtime: { type: 'number' }, numberOfPages: { type: 'number' } },\n" +
      "    required: ['mediaItemId']\n" +
      "  }\n" +
      "}), _MediaItemController.setAudioProgress);";
    if (!c.includes(old)) {
      console.error('bugfix audio duration: route anchor not found');
      process.exit(1);
    }
    c = c.replace(old, fresh);
    fs.writeFileSync(path, c);
    console.log('bugfix audio duration: route now accepts runtime + numberOfPages');
  }
}

// === 3. Bundle: Rp modal _save sends runtime/numberOfPages ===
{
  const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
  let c = fs.readFileSync(bundlePath, 'utf8');
  if (c.includes('AUDIO_PROGRESS_BUNDLE_V2')) {
    console.log('bugfix audio duration: bundle already patched');
  } else {
    // Audio save: append &runtime=maxD so the audiobook duration is persisted.
    const audioOld =
      'fetch("/api/audio-progress?mediaItemId="+t.id+"&progress="+(i/100),{method:"PUT",credentials:"same-origin"}).then(function(){HW.refetchQueries(en(t.id));HW.refetchQueries(["items"])});';
    const audioNew =
      '/* AUDIO_PROGRESS_BUNDLE_V2 */fetch("/api/audio-progress?mediaItemId="+t.id+"&progress="+(i/100)+"&runtime="+Number(maxD||0),{method:"PUT",credentials:"same-origin"}).then(function(){HW.refetchQueries(en(t.id));HW.refetchQueries(["items"])});';
    if (!c.includes(audioOld)) {
      console.error('bugfix audio duration: bundle audio _save anchor not found');
      process.exit(1);
    }
    c = c.replace(audioOld, audioNew);

    // Read save (un({mediaItemId, progress, duration})) → also persist
    // numberOfPages via a parallel PUT /api/audio-progress call (the un()
    // mutation handles progress only). Cheap, idempotent on identical maxP.
    const readOld =
      'un({mediaItemId:t.id,progress:i/100,duration:l});setTimeout(function(){HW.refetchQueries(en(t.id));HW.refetchQueries(["items"])},150);';
    const readNew =
      'un({mediaItemId:t.id,progress:i/100,duration:l});fetch("/api/audio-progress?mediaItemId="+t.id+"&numberOfPages="+Number(maxP||0),{method:"PUT",credentials:"same-origin"}).catch(function(){});setTimeout(function(){HW.refetchQueries(en(t.id));HW.refetchQueries(["items"])},150);';
    if (!c.includes(readOld)) {
      console.error('bugfix audio duration: bundle read _save anchor not found');
      process.exit(1);
    }
    c = c.replace(readOld, readNew);

    fs.writeFileSync(bundlePath, c);
    console.log('bugfix audio duration: bundle _save now persists maxD/maxP');
  }
}

})();
