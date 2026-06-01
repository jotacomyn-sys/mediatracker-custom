// Auto-generated mega-patch: patch_04_backup_audiobook_episodes.js
// Bundles 28 original patch_*.js scripts in execution order.
// Each constituent is wrapped in an IIFE so its top-level vars (const fs = ...)
// don't collide; `process.exit(0)` is rewritten to `return` so an early-exit
// idempotency guard inside one constituent doesn't abort the whole mega-patch.

// ===== patch_backup_controller.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/item.js';
let c = fs.readFileSync(path, 'utf8');

// Strip any prior version of our backup methods (idempotent — re-runs safely after edits)
c = c.replace(/  downloadBackup = \(0, _typescriptRoutesToOpenapiServer\.createExpressRoute\)\(async \(req, res\) => \{[\s\S]*?\}\);\n/, '');
c = c.replace(/  exportJson = \(0, _typescriptRoutesToOpenapiServer\.createExpressRoute\)\(async \(req, res\) => \{[\s\S]*?\}\);\n/, '');
c = c.replace(/  restoreBackup = \(0, _typescriptRoutesToOpenapiServer\.createExpressRoute\)\(async \(req, res\) => \{[\s\S]*?\}\);\n/, '');
c = c.replace(/  importJson = \(0, _typescriptRoutesToOpenapiServer\.createExpressRoute\)\(async \(req, res\) => \{[\s\S]*?\}\);\n/, '');
c = c.replace(/  exportLetterboxd = \(0, _typescriptRoutesToOpenapiServer\.createExpressRoute\)\(async \(req, res\) => \{[\s\S]*?\}\);\n/, '');

const method = `  downloadBackup = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const dbPath = '/storage/data.db';
    const date = new Date().toISOString().slice(0, 10);
    res.download(dbPath, \`mediatoc-backup-\${date}.db\`, (err) => {
      if (err && !res.headersSent) { res.status(500).send('backup failed'); }
    });
  });
  exportJson = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const userId = Number(req.user);
    const knex = _dbconfig.Database.knex;
    const [user, lists, listItems, seen, ratings, progress, items] = await Promise.all([
      knex('user').select('id','name','admin').where('id', userId).first(),
      knex('list').select('*').where('userId', userId),
      knex('listItem').select('listItem.*').leftJoin('list','list.id','listItem.listId').where('list.userId', userId),
      knex('seen').select('*').where('userId', userId),
      knex('userRating').select('*').where('userId', userId),
      knex('progress').select('*').where('userId', userId),
      knex('mediaItem').select('id','title','mediaType','releaseDate','tmdbId','imdbId','igdbId','tvdbId','traktId','openlibraryId','audibleId','goodreadsId','audioProgress','downloaded','links')
    ]);
    const referencedIds = new Set();
    listItems.forEach(li => li.mediaItemId && referencedIds.add(li.mediaItemId));
    seen.forEach(s => s.mediaItemId && referencedIds.add(s.mediaItemId));
    ratings.forEach(r => r.mediaItemId && referencedIds.add(r.mediaItemId));
    progress.forEach(p => p.mediaItemId && referencedIds.add(p.mediaItemId));
    const referencedItems = items.filter(it => referencedIds.has(it.id));
    const tvShowIds = referencedItems.filter(it => it.mediaType === 'tv').map(it => it.id);
    // Episodes for TV shows that have user activity (so the import can map old episodeIds → new ones)
    let episodes = [];
    if (tvShowIds.length > 0) {
      episodes = await knex('episode').select('id','tvShowId','seasonNumber','episodeNumber','title','isSpecialEpisode').whereIn('tvShowId', tvShowIds);
    }
    const out = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 2,
      user, lists, listItems, seen, ratings, progress,
      mediaItems: referencedItems,
      episodes
    };
    const date = new Date().toISOString().slice(0,10);
    res.setHeader('Content-Disposition', 'attachment; filename="mediatoc-export-' + date + '.json"');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(out, null, 2));
  });
  importJson = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const userId = Number(req.user);
    const knex = _dbconfig.Database.knex;
    // Read raw body (express.json default limit is too small for these exports)
    let body = '';
    try {
      await new Promise((resolve, reject) => {
        req.setEncoding('utf8');
        req.on('data', chunk => { body += chunk; if (body.length > 100 * 1024 * 1024) { reject(new Error('Archivo demasiado grande (>100MB)')); } });
        req.on('end', resolve);
        req.on('error', reject);
      });
    } catch (e) { res.status(400).json({ error: e.message }); return; }
    let data;
    try { data = JSON.parse(body); } catch (e) { res.status(400).json({ error: 'JSON inválido: ' + e.message }); return; }
    if (!data || !Array.isArray(data.mediaItems)) { res.status(400).json({ error: 'JSON sin campo mediaItems' }); return; }
    // createMissing: when an external ID isn't found in MT, insert a minimal row so
    // its seen/ratings/progress can attach. MT's metadata refresh fills in the rest later.
    // Default true; set { createMissing: false } in the request body to disable.
    const createMissing = data.createMissing !== false;

    const stats = { mediaItemsMatched: 0, mediaItemsCreated: 0, mediaItemsMissing: 0, episodesMatched: 0, listsCreated: 0, listsExisting: 0, listItemsImported: 0, listItemsSkipped: 0, seenImported: 0, seenSkipped: 0, seenMissing: 0, ratingsImported: 0, ratingsSkipped: 0, progressImported: 0, progressSkipped: 0 };

    // 1. Match mediaItems by external IDs (fall through TMDB → IMDB → TVDB → IGDB → audible → goodreads → openlibrary)
    const mediaItemMap = new Map();
    for (const mi of data.mediaItems) {
      const where = { mediaType: mi.mediaType };
      let match = null;
      const tryMatch = async (key, val) => {
        if (match || !val) return;
        match = await knex('mediaItem').where({ ...where, [key]: val }).first();
      };
      await tryMatch('tmdbId', mi.tmdbId);
      await tryMatch('imdbId', mi.imdbId);
      await tryMatch('tvdbId', mi.tvdbId);
      await tryMatch('igdbId', mi.igdbId);
      await tryMatch('audibleId', mi.audibleId);
      await tryMatch('goodreadsId', mi.goodreadsId);
      await tryMatch('openlibraryId', mi.openlibraryId);
      await tryMatch('traktId', mi.traktId);
      if (match) { mediaItemMap.set(mi.id, match.id); stats.mediaItemsMatched++; continue; }
      if (createMissing && (mi.tmdbId || mi.imdbId || mi.tvdbId || mi.igdbId || mi.audibleId || mi.goodreadsId || mi.openlibraryId)) {
        try {
          const inserted = await knex('mediaItem').insert({
            title: mi.title || '(unknown)',
            mediaType: mi.mediaType,
            tmdbId: mi.tmdbId || null,
            imdbId: mi.imdbId || null,
            tvdbId: mi.tvdbId || null,
            igdbId: mi.igdbId || null,
            audibleId: mi.audibleId || null,
            goodreadsId: mi.goodreadsId || null,
            openlibraryId: mi.openlibraryId || null,
            traktId: mi.traktId || null,
            releaseDate: mi.releaseDate || null,
            source: mi.tmdbId || mi.tvdbId ? 'tmdb' : (mi.igdbId ? 'igdb' : (mi.audibleId ? 'audible' : (mi.goodreadsId ? 'goodreads' : 'openlibrary'))),
            needsDetails: 1,
            lastTimeUpdated: 0
          }).returning('id');
          const newId = inserted[0] && (inserted[0].id !== undefined ? inserted[0].id : inserted[0]);
          mediaItemMap.set(mi.id, newId);
          stats.mediaItemsCreated++;
        } catch (e) {
          stats.mediaItemsMissing++;
        }
      } else {
        stats.mediaItemsMissing++;
      }
    }

    // 2. Match episodes via mapped tvShowId + seasonNumber + episodeNumber
    const episodeMap = new Map();
    for (const ep of (data.episodes || [])) {
      const newShowId = mediaItemMap.get(ep.tvShowId);
      if (!newShowId) continue;
      const existing = await knex('episode').where({ tvShowId: newShowId, seasonNumber: ep.seasonNumber, episodeNumber: ep.episodeNumber }).first();
      if (existing) { episodeMap.set(ep.id, existing.id); stats.episodesMatched++; }
    }

    // 3. Lists: match watchlist by isWatchlist, others by name. Create missing.
    const listMap = new Map();
    for (const list of (data.lists || [])) {
      let existing = list.isWatchlist
        ? await knex('list').where({ userId, isWatchlist: true }).first()
        : await knex('list').where({ userId, name: list.name }).first();
      if (existing) { listMap.set(list.id, existing.id); stats.listsExisting++; }
      else {
        const inserted = await knex('list').insert({
          userId, name: list.name, description: list.description || null,
          isWatchlist: list.isWatchlist ? 1 : 0,
          privacy: list.privacy || 'private',
          createdAt: list.createdAt || Date.now(),
          updatedAt: list.updatedAt || Date.now()
        }).returning('id');
        const newId = inserted[0] && (inserted[0].id || inserted[0]);
        listMap.set(list.id, newId);
        stats.listsCreated++;
      }
    }

    // Steps 4-7 refactored: bulk dedup-and-insert for listItem/seen/userRating/progress.
    // Was N×.first() + N inserts per table; now 1 bulk SELECT + 1 chunked INSERT
    // per table. SQLite param limit is 999 so we chunk inserts at 100 rows.
    const _bulkInsert = async (table, rows) => {
      const CHUNK = 100;
      for (let i = 0; i < rows.length; i += CHUNK) {
        await knex(table).insert(rows.slice(i, i + CHUNK));
      }
    };

    // 4. List items
    {
      const valid = [];
      let skipped = 0;
      for (const li of (data.listItems || [])) {
        const newMI = mediaItemMap.get(li.mediaItemId);
        const newList = listMap.get(li.listId);
        if (!newMI || !newList) { skipped++; continue; }
        valid.push({ li, newMI, newList });
      }
      if (valid.length > 0) {
        const listIds = [...new Set(valid.map(v => v.newList))];
        const miIds = [...new Set(valid.map(v => v.newMI))];
        const existing = await knex('listItem').whereIn('listId', listIds).whereIn('mediaItemId', miIds).select('listId','mediaItemId','seasonId','episodeId');
        const existingSet = new Set(existing.map(e => e.listId+'|'+e.mediaItemId+'|'+(e.seasonId||'')+'|'+(e.episodeId||'')));
        const toInsert = [];
        for (const v of valid) {
          const key = v.newList+'|'+v.newMI+'|'+(v.li.seasonId||'')+'|'+(v.li.episodeId||'');
          if (existingSet.has(key)) { skipped++; continue; }
          existingSet.add(key);
          toInsert.push({ listId: v.newList, mediaItemId: v.newMI, seasonId: v.li.seasonId || null, episodeId: v.li.episodeId || null, addedAt: v.li.addedAt || Date.now() });
        }
        if (toInsert.length) await _bulkInsert('listItem', toInsert);
        stats.listItemsImported = toInsert.length;
      }
      stats.listItemsSkipped = skipped;
    }

    // 5. Seen
    {
      const valid = [];
      let missing = 0;
      for (const s of (data.seen || [])) {
        const newMI = mediaItemMap.get(s.mediaItemId);
        if (!newMI) { missing++; continue; }
        let newEp = null;
        if (s.episodeId) {
          newEp = episodeMap.get(s.episodeId);
          if (!newEp) { missing++; continue; }
        }
        valid.push({ s, newMI, newEp });
      }
      let skipped = 0;
      if (valid.length > 0) {
        const miIds = [...new Set(valid.map(v => v.newMI))];
        const existing = await knex('seen').where('userId', userId).whereIn('mediaItemId', miIds).select('mediaItemId','episodeId','date');
        const existingSet = new Set(existing.map(e => e.mediaItemId+'|'+(e.episodeId||'')+'|'+e.date));
        const toInsert = [];
        for (const v of valid) {
          const key = v.newMI+'|'+(v.newEp||'')+'|'+v.s.date;
          if (existingSet.has(key)) { skipped++; continue; }
          existingSet.add(key);
          toInsert.push({ userId, mediaItemId: v.newMI, episodeId: v.newEp || null, date: v.s.date, duration: v.s.duration || null });
        }
        if (toInsert.length) await _bulkInsert('seen', toInsert);
        stats.seenImported = toInsert.length;
      }
      stats.seenSkipped = skipped;
      stats.seenMissing = missing;
    }

    // 6. Ratings
    {
      const valid = [];
      for (const r of (data.ratings || [])) {
        const newMI = mediaItemMap.get(r.mediaItemId);
        if (!newMI) continue;
        valid.push({ r, newMI });
      }
      let skipped = 0;
      if (valid.length > 0) {
        const miIds = [...new Set(valid.map(v => v.newMI))];
        const existing = await knex('userRating').where('userId', userId).whereIn('mediaItemId', miIds).select('mediaItemId','seasonId','episodeId');
        const existingSet = new Set(existing.map(e => e.mediaItemId+'|'+(e.seasonId||'')+'|'+(e.episodeId||'')));
        const toInsert = [];
        for (const v of valid) {
          const key = v.newMI+'|'+(v.r.seasonId||'')+'|'+(v.r.episodeId||'');
          if (existingSet.has(key)) { skipped++; continue; }
          existingSet.add(key);
          toInsert.push({ userId, mediaItemId: v.newMI, seasonId: v.r.seasonId || null, episodeId: v.r.episodeId || null, rating: v.r.rating, review: v.r.review || null, date: v.r.date || Date.now() });
        }
        if (toInsert.length) await _bulkInsert('userRating', toInsert);
        stats.ratingsImported = toInsert.length;
      }
      stats.ratingsSkipped = skipped;
    }

    // 7. Progress
    {
      const valid = [];
      for (const p of (data.progress || [])) {
        const newMI = mediaItemMap.get(p.mediaItemId);
        if (!newMI) continue;
        const newEp = p.episodeId ? episodeMap.get(p.episodeId) : null;
        if (p.episodeId && !newEp) continue;
        valid.push({ p, newMI, newEp });
      }
      let skipped = 0;
      if (valid.length > 0) {
        const miIds = [...new Set(valid.map(v => v.newMI))];
        const existing = await knex('progress').where('userId', userId).whereIn('mediaItemId', miIds).select('mediaItemId','episodeId');
        const existingSet = new Set(existing.map(e => e.mediaItemId+'|'+(e.episodeId||'')));
        const toInsert = [];
        for (const v of valid) {
          const key = v.newMI+'|'+(v.newEp||'');
          if (existingSet.has(key)) { skipped++; continue; }
          existingSet.add(key);
          toInsert.push({ userId, mediaItemId: v.newMI, episodeId: v.newEp || null, progress: v.p.progress, date: v.p.date || Date.now(), duration: v.p.duration || null, action: v.p.action || null });
        }
        if (toInsert.length) await _bulkInsert('progress', toInsert);
        stats.progressImported = toInsert.length;
      }
      stats.progressSkipped = skipped;
    }

    res.json({ ok: true, ...stats });
  });
  exportLetterboxd = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const userId = Number(req.user);
    const knex = _dbconfig.Database.knex;
    // Letterboxd diary-import format columns:
    //   Date,Name,Year,Rating,Rewatch,Watched Date,Tags
    // Letterboxd is movies-only — export only seen entries that map to mediaType=movie.
    // Aggregate into one row per (movie, watched date), with Rewatch flagged on duplicates per movie.
    const rows = await knex('seen')
      .join('mediaItem', 'mediaItem.id', 'seen.mediaItemId')
      .leftJoin('userRating', qb => qb.on('userRating.mediaItemId', 'mediaItem.id').andOnVal('userRating.userId', userId).andOnNull('userRating.seasonId').andOnNull('userRating.episodeId'))
      .where('seen.userId', userId)
      .where('mediaItem.mediaType', 'movie')
      .whereNotNull('seen.date')
      .select(knex.raw('mediaItem.title AS title'), knex.raw("substr(mediaItem.releaseDate, 1, 4) AS year"), 'seen.date AS watchedAt', 'userRating.rating AS rating')
      .orderBy('seen.date', 'asc');
    const csvEscape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const seenTitles = new Map(); // title|year -> count, to flag rewatches
    const lines = ['Date,Name,Year,Rating,Rewatch,WatchedDate'];
    for (const r of rows) {
      const watchDate = new Date(Number(r.watchedAt));
      const dateStr = watchDate.toISOString().slice(0, 10);
      const key = (r.title || '') + '|' + (r.year || '');
      const isRewatch = seenTitles.has(key);
      seenTitles.set(key, (seenTitles.get(key) || 0) + 1);
      // Letterboxd rating is 0.5–5; MT rating is typically 0–10 (scale by /2)
      const lbRating = r.rating ? (Math.round((r.rating / 2) * 2) / 2) : '';
      lines.push([
        dateStr,
        csvEscape(r.title),
        r.year || '',
        lbRating,
        isRewatch ? 'true' : '',
        dateStr
      ].join(','));
    }
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', 'attachment; filename="letterboxd-' + date + '.csv"');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(lines.join('\\n'));
  });
  restoreBackup = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const fs = require('fs');
    const dest = '/storage/data.db.uploaded';
    try {
      await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(dest);
        req.on('error', reject);
        w.on('error', reject);
        w.on('finish', resolve);
        req.pipe(w);
      });
      const stat = fs.statSync(dest);
      // Sanity check: SQLite files start with 'SQLite format 3\\u0000'
      const fd = fs.openSync(dest, 'r');
      const header = Buffer.alloc(16);
      fs.readSync(fd, header, 0, 16, 0);
      fs.closeSync(fd);
      if (header.toString('utf8', 0, 15) !== 'SQLite format 3') {
        fs.unlinkSync(dest);
        res.status(400).json({ error: 'El archivo subido no es una base SQLite válida' });
        return;
      }
      res.json({ ok: true, size: stat.size, message: 'Archivo subido. Reinicia el contenedor para aplicar.' });
    } catch (e) {
      try { fs.unlinkSync(dest); } catch(_) {}
      res.status(500).json({ error: e.message });
    }
  });
`;

const anchor = '}\nexports.MediaItemController = MediaItemController;';
if (!c.includes(anchor)) { console.error('backup controller: anchor not found'); process.exit(1); }
c = c.replace(anchor, method + anchor);
fs.writeFileSync(path, c);
console.log('backup controller: download + export(v2 with episodes) + import + restore methods installed');

})();

// ===== patch_backup_routes.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/generated/routes/routes.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("/api/backup'") && c.includes("/api/backup/restore'") && c.includes("/api/backup/export-json'") && c.includes("/api/backup/import'")) { console.log('backup routes: already patched'); return /* was process.exit(0) */; }
// Strip prior version so we can re-apply with the new import route
c = c.replace(/router\.get\('\/api\/backup'[\s\S]*?router\.post\('\/api\/backup\/restore', _MediaItemController\.restoreBackup\);\n/, '');

const anchor = "router.get('/api/import-trakttv/state'";
if (!c.includes(anchor)) { console.error('backup routes: anchor not found'); process.exit(1); }

const route = `router.get('/api/backup', validatorHandler({}), _MediaItemController.downloadBackup);
router.get('/api/backup/export-json', validatorHandler({}), _MediaItemController.exportJson);
router.post('/api/backup/import', validatorHandler({}), _MediaItemController.importJson);
router.get('/api/backup/letterboxd', validatorHandler({}), _MediaItemController.exportLetterboxd);
router.post('/api/backup/restore', validatorHandler({}), _MediaItemController.restoreBackup);
`;

c = c.replace(anchor, route + anchor);
fs.writeFileSync(path, c);
console.log('backup routes: added GET /api/backup');

})();

// ===== patch_backup_frontend.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Backup page (_BK) rendered as a single table:
//   columns: Acción | Descripción | Control
// Each row groups one feature (download/restore/import/cleanup/auto-backup),
// keeping all the existing behavior (file readers, fetch posts, status banner).
// _JF (Jellyfin) and the runtime-refresh button still mount AFTER this table
// via their own patches; they don't fit the row pattern (they have their own
// internal forms).

const compDef = `_BK=function(){` +
  `var _f=r.useState(null),_file=_f[0],_setFile=_f[1];` +
  `var _u=r.useState(null),_status=_u[0],_setStatus=_u[1];` +
  `var _upload=function(){` +
    `if(!_file){return}` +
    `_setStatus({type:"loading",msg:"Subiendo..."});` +
    `fetch("/api/backup/restore",{method:"POST",credentials:"same-origin",body:_file,headers:{"Content-Type":"application/octet-stream"}})` +
      `.then(function(r){return r.json()})` +
      `.then(function(d){` +
        `if(d.ok){_setStatus({type:"success",msg:"Subido OK ("+d.size+" bytes). Reinicia el contenedor: docker compose restart mediatoc (luego el archivo data.db.uploaded sustituirá al actual)."})}` +
        `else{_setStatus({type:"error",msg:d.error||"Error desconocido"})}` +
      `})` +
      `.catch(function(e){_setStatus({type:"error",msg:String(e.message||e)})});` +
  `};` +
  // ----- Cell renderers (kept inline so the table reads top-to-bottom) -----
  `var _btnLink=function(href,label,icon,color){` +
    `return r.createElement("a",{href:href,download:true,className:"inline-flex items-center gap-2 px-3 py-1.5 rounded text-white "+color},` +
      `r.createElement("i",{className:"material-icons text-base"},icon),label` +
    `)` +
  `};` +
  `var _row=function(name,desc,control){` +
    `return r.createElement("tr",{className:"border-t border-slate-300 dark:border-slate-700"},` +
      `r.createElement("td",{className:"py-3 pr-3 align-top font-semibold whitespace-nowrap"},name),` +
      `r.createElement("td",{className:"py-3 pr-3 align-top text-sm text-gray-600 dark:text-gray-300"},desc),` +
      `r.createElement("td",{className:"py-3 align-top whitespace-nowrap"},control)` +
    `)` +
  `};` +
  // ----- File input renderers (Restore + Import JSON) -----
  `var _restoreCtl=r.createElement("div",{className:"flex flex-col gap-2"},` +
    `r.createElement("input",{type:"file",accept:".db",className:"text-sm",onChange:function(e){var f=e.currentTarget.files&&e.currentTarget.files[0];_setFile(f);_setStatus(null)}}),` +
    `_file?r.createElement("button",{onClick:_upload,className:"self-start inline-flex items-center gap-2 px-3 py-1.5 rounded text-white bg-orange-600 hover:bg-orange-700"},` +
      `r.createElement("i",{className:"material-icons text-base"},"file_upload"),xo._("Upload and restore")` +
    `):null` +
  `);` +
  `var _importCtl=r.createElement("div",{className:"flex flex-col gap-2"},` +
    `r.createElement("label",{className:"inline-flex items-center gap-2 text-sm"},` +
      `r.createElement("input",{type:"checkbox",id:"_imp_create",defaultChecked:!0}),` +
      `xo._("Create missing items")` +
    `),` +
    `r.createElement("input",{type:"file",accept:".json",className:"text-sm",onChange:function(e){var f=e.currentTarget.files&&e.currentTarget.files[0];if(!f)return;var createMissing=document.getElementById("_imp_create").checked;_setStatus({type:"loading",msg:"Importando "+f.name+"..."});var rd=new FileReader();rd.onload=function(){var raw=rd.result;try{var obj=JSON.parse(raw);obj.createMissing=createMissing;raw=JSON.stringify(obj)}catch(_){}fetch("/api/backup/import",{method:"POST",credentials:"same-origin",body:raw,headers:{"Content-Type":"application/json"}}).then(function(r){return r.json()}).then(function(d){if(d.error){_setStatus({type:"error",msg:d.error})}else{_setStatus({type:"success",msg:"Items: emparejados "+d.mediaItemsMatched+", creados "+(d.mediaItemsCreated||0)+", no encontrados "+d.mediaItemsMissing+" \\u00b7 Episodios "+d.episodesMatched+" \\u00b7 Listas: "+d.listsCreated+"+/"+d.listsExisting+"= \\u00b7 Visto: +"+d.seenImported+" (saltados "+d.seenSkipped+", sin emparejar "+d.seenMissing+") \\u00b7 Ratings: +"+d.ratingsImported+" \\u00b7 Progreso: +"+d.progressImported})}}).catch(function(e){_setStatus({type:"error",msg:String(e.message||e)})})};rd.readAsText(f)}})` +
  `);` +
  `var _cleanupCtl=r.createElement("button",{onClick:function(){if(confirm(xo._("Delete orphan catalog items?")))fetch("/api/catalog/cleanup",{method:"POST",credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){alert(d.ok?"Eliminados "+d.deleted+" items":"Error: "+(d.error||""))})},className:"inline-flex items-center gap-2 px-3 py-1.5 rounded text-white bg-red-700 hover:bg-red-800"},` +
    `r.createElement("i",{className:"material-icons text-base"},"delete_sweep"),xo._("Purge orphan catalog")` +
  `);` +
  `return r.createElement("div",{className:"mt-8 px-4 max-w-5xl mx-auto"},` +
    `r.createElement("h1",{className:"text-3xl font-bold mb-6"},xo._("Backup heading")),` +
    `r.createElement("table",{className:"w-full"},` +
      `r.createElement("thead",null,` +
        `r.createElement("tr",{className:"text-left text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400"},` +
          `r.createElement("th",{className:"py-2 pr-3 font-semibold w-48"},xo._("Action")),` +
          `r.createElement("th",{className:"py-2 pr-3 font-semibold"},xo._("Description")),` +
          `r.createElement("th",{className:"py-2 font-semibold w-72"},xo._("Control"))` +
        `)` +
      `),` +
      `r.createElement("tbody",null,` +
        `_row(xo._("Download .db (binary)"),xo._("Download backup desc"),` +
          `_btnLink("/api/backup",xo._("Download .db (binary)"),"file_download","bg-blue-600 hover:bg-blue-700"))` +
        `,_row(xo._("Export JSON"),xo._("Export JSON desc"),` +
          `_btnLink("/api/backup/export-json",xo._("Export JSON"),"data_object","bg-emerald-600 hover:bg-emerald-700"))` +
        `,_row(xo._("Letterboxd CSV"),xo._("Letterboxd-importable (movies only)"),` +
          `_btnLink("/api/backup/letterboxd",xo._("Letterboxd CSV"),"movie","bg-orange-500 hover:bg-orange-600"))` +
        `,_row(xo._("Restore"),xo._("Restore desc"),_restoreCtl)` +
        `,_row(xo._("Imports JSON"),xo._("Import JSON desc"),_importCtl)` +
        `,_row(xo._("Catalog cleanup"),xo._("Catalog cleanup desc"),_cleanupCtl)` +
        `,_row(xo._("Automatic backups"),xo._("Auto backups desc"),r.createElement("span",{className:"text-sm text-gray-500"},"\\u2014"))` +
      `)` +
    `),` +
    `_status?r.createElement("div",{className:"mt-4 p-3 rounded text-white "+(_status.type==="success"?"bg-green-700":_status.type==="error"?"bg-red-700":"bg-blue-700")},_status.msg):null` +
  `)` +
`},`;

const cardAnchor = '_v=function(e){';
if (c.includes('_BK=function(){var _f=r.useState')) {
  // Replace any prior _BK definition wholesale (so this patch's table layout
  // wins on rebuild without duplicating the component).
  c = c.replace(/_BK=function\(\)\{var _f=r\.useState[\s\S]*?\}\}\)\)\}\,(?=[\w_])/, compDef);
  console.log('backup frontend: _BK replaced (table layout)');
} else if (!c.includes(cardAnchor)) {
  console.error('backup frontend: _v anchor not found'); process.exit(1);
} else {
  c = c.replace(cardAnchor, compDef + cardAnchor);
  console.log('backup frontend: injected _BK component (table layout)');
}

// 2. Add /backup route to React Router
const routeAnchor = 'r.createElement(Q,{path:"/lists",element:r.createElement(SS,{key:"/lists"})})';
const routePatched = 'r.createElement(Q,{path:"/backup",element:r.createElement(_BK,null)}),' + routeAnchor;
if (c.includes('path:"/backup"')) {
  console.log('backup frontend: /backup route already added');
} else if (!c.includes(routeAnchor)) {
  console.error('backup frontend: /lists route anchor not found'); process.exit(1);
} else {
  c = c.replace(routeAnchor, routePatched);
  console.log('backup frontend: added /backup route');
}

// 3. Add Backup menu item
const menuAnchor = '{path:"/lists",name:xo._("Lists")}]';
const menuPatched = '{path:"/lists",name:xo._("Lists")},{path:"/backup",name:xo._("Backup")}]';
if (c.includes('{path:"/backup",name:')) {
  console.log('backup frontend: menu item already added');
} else if (!c.includes(menuAnchor)) {
  console.error('backup frontend: menu anchor not found'); process.exit(1);
} else {
  c = c.replace(menuAnchor, menuPatched);
  console.log('backup frontend: added Backup menu item');
}

fs.writeFileSync(bundlePath, c);
console.log('backup frontend: complete');

})();

// ===== patch_audiobook_position.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Position seen icon: audiobooks → centered horizontally at the top of cover; others → top-right
const old = '"absolute inline-flex pointer-events-auto foo right-1 top-1"';
const fresh = '"absolute inline-flex pointer-events-auto foo top-1 "+("audiobook"===t.mediaType?"left-1/2 -translate-x-1/2":"right-1")';

if (!c.includes(old)) {
  console.log('audiobook position: anchor not found (may already be patched)');
} else {
  c = c.replace(old, fresh);
  console.log('audiobook position: music_note for audiobooks now in top-left, check for others stays top-right');
}

fs.writeFileSync(bundlePath, c);

})();

// ===== patch_audiobook_progress.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// 1. Slider for audiobooks/movies: max comes from `maxD` state (editable below); fallback Ip default
const oldSlider = '(jo(t)||Io(t))&&t.runtime&&r.createElement(Ip,{max:t.runtime,progress:i,setProgress:o,mediaType:t.mediaType})';
const newSlider = '(jo(t)||Io(t)&&t.runtime)&&r.createElement(Ip,{max:maxD,progress:i,setProgress:o,mediaType:t.mediaType})';

if (!c.includes(oldSlider) && !c.includes(newSlider)) {
  console.error('audiobook progress: slider anchor not found'); process.exit(1);
}
if (c.includes(newSlider)) {
  console.log('audiobook progress: slider already patched');
} else {
  c = c.replace(oldSlider, newSlider);
  console.log('audiobook progress: slider now uses maxD state');
}

// 1b. Add maxD/maxP state declarations to the Rp modal (right after existing state)
const stateOld = 'a=s((0,r.useState)(100*t.progress||0),2),i=a[0],o=a[1],u=s((0,r.useState)(0),2),l=u[0],d=u[1];';
const stateNew = 'a=s((0,r.useState)(100*t.progress||0),2),i=a[0],o=a[1],u=s((0,r.useState)(0),2),l=u[0],d=u[1],mu=s((0,r.useState)(t.runtime||600),2),maxD=mu[0],setMaxD=mu[1],pu=s((0,r.useState)(t.numberOfPages||200),2),maxP=pu[0],setMaxP=pu[1];';
if (!c.includes(stateOld) && !c.includes(stateNew)) {
  console.error('audiobook progress: state anchor not found'); process.exit(1);
}
if (c.includes(stateNew)) {
  console.log('audiobook progress: maxD/maxP state already added');
} else {
  c = c.replace(stateOld, stateNew);
  console.log('audiobook progress: added maxD and maxP state');
}

// 1c. Pages slider (books): use maxP state instead of t.numberOfPages
const pagesOld = 'Do(t)&&t.numberOfPages&&r.createElement(Ip,{max:t.numberOfPages,progress:i,setProgress:o,mediaType:t.mediaType})';
const pagesNew = 'Do(t)&&r.createElement(Ip,{max:maxP,progress:i,setProgress:o,mediaType:t.mediaType})';
if (c.includes(pagesOld)) {
  c = c.replace(pagesOld, pagesNew);
  console.log('audiobook progress: pages slider now uses maxP state');
} else if (c.includes(pagesNew)) {
  console.log('audiobook progress: pages slider already uses maxP');
}

// 2. Replace original duration block with: "Establecer total" + duration H+M + slider (all editable, all in sync)
//    For audiobooks: total in H+M -> sets maxD. For books: total pages input -> sets maxP.
//    The slider goes 0..maxD (audiobook) or is the existing pages slider (book), both already updated above.
//    Inline styles for spacing/widths because Tailwind purges gap-2 / w-20.
const oldDurFull = '(Ao(t)||Do(t))&&r.createElement("div",{className:"mb-4"},r.createElement("div",{className:"text-lg"},r.createElement(Xe,{id:"Duration"}),":"),r.createElement("label",null,r.createElement("input",{type:"number",min:0,value:l,onChange:function(e){return d(Number(e.currentTarget.value))}})," ",r.createElement(Xe,{id:"{duration, plural, one {minute} other {minutes}}",values:{duration:l}})))';
const newDurFull = '(Ao(t)||Do(t)||jo(t))&&r.createElement(r.Fragment,null,' +
  // Total max — books: pages, audiobooks/games: H+M
  'Do(t)&&r.createElement("div",{className:"mb-2"},r.createElement("div",{className:"text-lg"},"Establecer total páginas:"),r.createElement("input",{type:"number",min:1,value:maxP,style:{width:"6rem"},onChange:function(e){return setMaxP(Math.max(1,Number(e.currentTarget.value)))}})),' +
  '(jo(t)||Ao(t))&&r.createElement("div",{className:"mb-2"},r.createElement("div",{className:"text-lg"},"Establecer duración total:"),r.createElement("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem"}},r.createElement("input",{type:"number",min:0,value:Math.floor(maxD/60),style:{width:"4rem"},onChange:function(e){return setMaxD(Math.max(1,Number(e.currentTarget.value)*60+(maxD%60)))}}),r.createElement("span",null,"h"),r.createElement("input",{type:"number",min:0,max:59,value:maxD%60,style:{width:"4rem"},onChange:function(e){return setMaxD(Math.max(1,Math.floor(maxD/60)*60+Number(e.currentTarget.value)))}}),r.createElement("span",null,"min"))),' +
  // Duration spent in this session
  'r.createElement("div",{className:"mb-4"},r.createElement("div",{className:"text-lg"},r.createElement(Xe,{id:"Duration"}),":"),r.createElement("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem"}},r.createElement("input",{type:"number",min:0,value:Math.floor(l/60),style:{width:"4rem"},onChange:function(e){return d(Number(e.currentTarget.value)*60+(l%60))}}),r.createElement("span",null,"h"),r.createElement("input",{type:"number",min:0,max:59,value:l%60,style:{width:"4rem"},onChange:function(e){return d(Math.floor(l/60)*60+Number(e.currentTarget.value))}}),r.createElement("span",null,"min")),r.createElement("input",{type:"range",min:0,max:Do(t)?maxP:maxD,value:l,style:{width:"100%",marginTop:"0.5rem"},onChange:function(e){return d(Number(e.currentTarget.value))}}))' +
  ')';

if (!c.includes(oldDurFull) && !c.includes(newDurFull)) {
  console.error('audiobook progress: duration field anchor not found'); process.exit(1);
}
if (c.includes(newDurFull)) {
  console.log('audiobook progress: duration field already H+M for audiobooks');
} else {
  c = c.replace(oldDurFull, newDurFull);
  console.log('audiobook progress: duration field now H+M, includes audiobooks');
}

fs.writeFileSync(bundlePath, c);
console.log('audiobook progress: complete');

})();

// ===== patch_unify_books.js =====
;(() => {
// Backend: when querying mediaType='book', also include 'audiobook' (unified tab)
const fs = require('fs');
const path = '/app/build/knex/queries/items.js';
let c = fs.readFileSync(path, 'utf8');

const old = "if (mediaType) {\n      query.andWhere('mediaItem.mediaType', mediaType);\n    }";
const fresh = "if (mediaType) {\n      if (mediaType === 'book') { query.whereIn('mediaItem.mediaType', ['book','audiobook']); }\n      else { query.andWhere('mediaItem.mediaType', mediaType); }\n    }";

if (c.includes(fresh)) {
  console.log('unify books: backend already patched');
} else if (!c.includes(old)) {
  console.error('unify books: anchor not found in items.js'); process.exit(1);
} else {
  c = c.replace(old, fresh);
  fs.writeFileSync(path, c);
  console.log('unify books: backend query now returns book+audiobook for mediaType=book');
}

})();

// ===== patch_unify_books_frontend.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Remove the Audiobooks menu entry (the /books tab will now include audiobooks)
const old = '{path:"/books",name:xo._("Books")},{path:"/audiobooks",name:xo._("Audiobooks")}';
const fresh = '{path:"/books",name:xo._("Books")}';

if (!c.includes(old)) {
  console.log('unify books frontend: menu already patched (or anchor not found)');
} else {
  c = c.replace(old, fresh);
  console.log('unify books frontend: removed Audiobooks menu entry');
}

fs.writeFileSync(bundlePath, c);

})();

// ===== patch_game_playing.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Add a "playing" indicator in top-right for video games that have progress but are not yet completed.
// Sibling to the existing seen-check element. Renders only when: video_game AND has progress AND not seen.
// Anchor must include the exact paren count after position patch (5 close parens).
const anchor = '"check_circle_outline"))))),m&&Wo(t)';
const playingElem = ',Ao(t)&&t.progress>0&&!t.seen&&r.createElement("div",{className:"absolute inline-flex pointer-events-auto foo top-1 right-1"},r.createElement(Fv,null,r.createElement("i",{className:"flex text-white select-none material-icons",title:"Jugando"},"play_circle_outline")))';

if (c.includes('"play_circle_outline"')) {
  console.log('game playing: already patched');
} else if (!c.includes(anchor)) {
  console.error('game playing: anchor not found'); process.exit(1);
} else {
  c = c.replace(anchor, '"check_circle_outline")))))' + playingElem + ',m&&Wo(t)');
  console.log('game playing: added play_circle_outline indicator for games with progress not yet completed');
}

fs.writeFileSync(bundlePath, c);

})();

// ===== patch_game_seen.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// _SE: interactive "mark as seen/visto" toggle button — eye icon, shown on game cards.
// Toggles via PUT /api/seen (mark) or DELETE /api/seen/ (unmark).
const compDef = `_SE=function(e){var _s=r.useState(!!e.s),_t=_s[0],_u=_s[1];r.useEffect(function(){_u(!!e.s)},[e.s]);var _toggle=function(n){n.preventDefault();n.stopPropagation();var willBeSeen=!_t;_u(willBeSeen);var url=willBeSeen?"/api/seen?mediaItemId="+e.id+"&lastSeenAt=now":"/api/seen/?mediaItemId="+e.id;var method=willBeSeen?"PUT":"DELETE";fetch(url,{method:method,credentials:"same-origin"}).then(function(){if(typeof HW!=="undefined"){try{HW.refetchQueries(["items"])}catch(_){}try{HW.invalidateQueries(["details",e.id])}catch(_){}}}).catch(function(){_u(_t)})};return r.createElement("div",{className:"inline-flex pointer-events-auto hover:cursor-pointer",title:_t?"Visto":"Marcar como visto",onClick:_toggle},r.createElement(Fv,null,r.createElement("span",{className:"flex material-icons"},_t?"visibility":"visibility_off")))},`;

const cardAnchor = '_v=function(e){';
if (c.includes('_SE=function(e){var _s=r.useState')) {
  console.log('game seen: _SE already injected');
} else if (!c.includes(cardAnchor)) {
  console.error('game seen: _v anchor not found'); process.exit(1);
} else {
  c = c.replace(cardAnchor, compDef + cardAnchor);
  console.log('game seen: injected _SE component');
}

// Eye on game cards REMOVED — moved to a "Marcar como visto" button on the
// detail page (patch_mark_watched_button.js). The card-overlay eye was easy
// to mis-click and confused with "marcar como completado" (which sends
// kind=played). The detail-page button is explicit and shares its style with
// the rest of the action row.

fs.writeFileSync(bundlePath, c);
console.log('game seen: complete');

})();

// ===== patch_progress_modal.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// 1. Replace i18n "Set progress" with literal "Progreso" — globally (modal title + card button)
const titleOld = 'r.createElement(Xe,{id:"Set progress"})';
const titleNew = '"Progreso"';
const before = c.length;
c = c.split(titleOld).join(titleNew);
const replaced = (before - c.length) / (titleOld.length - titleNew.length);
console.log('progress modal: replaced', replaced, '"Set progress" with "Progreso"');

// 2. Percentage slider section: full width + bottom margin to avoid overlap with the next field.
//    Original used fixed w-64 for the slider; widen to w-full and add mb-4 to the container.
const pctOld = 'r.createElement("div",{className:"flex items-center"},r.createElement("input",{className:"w-64 my-2",type:"range",value:i,min:0,max:100,onChange:function(e){o(Number(e.currentTarget.value))}}),r.createElement("span",{className:"w-10 text-right"},Math.round(i),"%"))';
const pctNew = 'r.createElement("div",{className:"flex items-center mb-4"},r.createElement("input",{className:"w-full my-2 mr-2",type:"range",value:i,min:0,max:100,onChange:function(e){o(Number(e.currentTarget.value))}}),r.createElement("span",{className:"w-10 text-right"},Math.round(i),"%"))';
if (c.includes(pctOld)) {
  c = c.replace(pctOld, pctNew);
  console.log('progress modal: percentage slider now full width, container has mb-4');
} else if (c.includes(pctNew)) {
  console.log('progress modal: percentage slider already patched');
} else {
  console.log('progress modal: percentage anchor not found');
}

fs.writeFileSync(bundlePath, c);
console.log('progress modal: complete');

})();

// ===== patch_hide_seen_summary.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// 1. Remove the "Last read at X" / "Last listened at X" block from the detail page
//    (it remains accessible via the Reading History link)
const lastSeenBlock = 'a.lastSeenAt>0&&r.createElement("div",{className:"mt-3"},jo(a)&&r.createElement(Xe,{id:"Last listened at {0}",values:{0:new Date(a.lastSeenAt).toLocaleString()}}),Do(a)&&r.createElement(Xe,{id:"Last read at {0}",values:{0:new Date(a.lastSeenAt).toLocaleString()}}),(Io(a)||Ro(a))&&r.createElement(Xe,{id:"Last seen at {0}",values:{0:new Date(a.lastSeenAt).toLocaleString()}}),Ao(a)&&r.createElement(Xe,{id:"Last played at {0}",values:{0:new Date(a.lastSeenAt).toLocaleString()}})),';

if (c.includes(lastSeenBlock)) {
  c = c.replace(lastSeenBlock, '');
  console.log('hide seen summary: removed "Last read at" block from detail page');
} else {
  console.log('hide seen summary: lastSeen block already removed (or anchor not found)');
}

// 2. Remove the "Read 1 time" / "Listened N times" inner div, but keep the history link
const timesBlock = 'r.createElement("div",null,jo(a)&&r.createElement(Xe,{id:"{0, plural, one {Listened 1 time} other {Listened # times}}",values:{0:a.seenHistory.length}}),Do(a)&&r.createElement(Xe,{id:"{0, plural, one {Read 1 time} other {Read # times}}",values:{0:a.seenHistory.length}}),(Io(a)||Ro(a))&&r.createElement(Xe,{id:"{0, plural, one {Seen 1 time} other {Seen # times}}",values:{0:a.seenHistory.length}}),Ao(a)&&r.createElement(Xe,{id:"{0, plural, one {Played 1 time} other {Played # times}}",values:{0:a.seenHistory.length}})),';

if (c.includes(timesBlock)) {
  c = c.replace(timesBlock, '');
  console.log('hide seen summary: removed "Read 1 time" inner div from detail page');
} else {
  console.log('hide seen summary: times block already removed (or anchor not found)');
}

fs.writeFileSync(bundlePath, c);
console.log('hide seen summary: complete');

})();

// ===== patch_tooltips.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// 1. Bookmark (Pendiente) — watchlist toggle icon
const bookmarkOld = 'r.createElement("span",{className:"flex material-icons"},"bookmark")';
const bookmarkNew = 'r.createElement("span",{className:"flex material-icons",title:"En pendientes (clic para quitar)"},"bookmark")';
if (c.includes(bookmarkOld)) {
  c = c.replace(bookmarkOld, bookmarkNew);
  console.log('tooltips: added title to bookmark (Pendiente)');
} else {
  console.log('tooltips: bookmark already has title (or anchor not found)');
}

// 2. Completado / Escuchado — check_circle_outline / music_note seen indicator
const seenOld = 'r.createElement("i",{className:"flex text-white select-none material-icons"},"audiobook"===t.mediaType?"music_note":"check_circle_outline")';
const seenNew = 'r.createElement("i",{className:"flex text-white select-none material-icons",title:"audiobook"===t.mediaType?"Escuchado":"Completado"},"audiobook"===t.mediaType?"music_note":"check_circle_outline")';
if (c.includes(seenOld)) {
  c = c.replace(seenOld, seenNew);
  console.log('tooltips: added title to seen icon (Completado/Escuchado)');
} else {
  console.log('tooltips: seen icon already has title (or anchor not found)');
}

// 3. Favorito — rating stars
const starOld = 'className:Be("material-icons select-none hover:text-yellow-400 text-2xl",(t<h||t<g)&&"text-yellow-400")},t<h&&(!g||t<g)?"star":"star_border"';
const starNew = 'className:Be("material-icons select-none hover:text-yellow-400 text-2xl",(t<h||t<g)&&"text-yellow-400"),title:(t+1)+(t+1===1?" estrella":" estrellas")},t<h&&(!g||t<g)?"star":"star_border"';
if (c.includes(starOld)) {
  c = c.replace(starOld, starNew);
  console.log('tooltips: added title to rating stars (Favorito)');
} else {
  console.log('tooltips: stars already have title (or anchor not found)');
}

fs.writeFileSync(bundlePath, c);
console.log('tooltips: complete');

})();

// ===== patch_progress_redesign.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Replace the entire Rp modal body with a redesigned version that has two sections:
// "Terminé de leerlo" (books) and "Terminé de escucharlo" (audiobooks), each with its own
// "Marcar como completado" button. Other types fall back to a simpler view.

const startMarker = 'Rp=function(e){';
const endMarker = ',Ap=';
const startIdx = c.indexOf(startMarker);
const endIdx = c.indexOf(endMarker, startIdx);
if (startIdx < 0 || endIdx < 0) { console.error('progress redesign: anchors not found'); process.exit(1); }

const oldFunction = c.slice(startIdx, endIdx);
if (oldFunction.includes('e.mode==="listen"')) { console.log('progress redesign: already applied'); return /* was process.exit(0) */; }

const newFunction =
`Rp=function(e){` +
  `var t=e.mediaItem,n=e.closeModal,_mode=e.mode;` +
  // e.episode (when present) targets a specific episode; otherwise we fall back
  // to the show's firstUnwatchedEpisode so the show-level Progreso button keeps
  // working as before.
  `var _tvEp=e.episode||(Ro(t)&&t.firstUnwatchedEpisode?t.firstUnwatchedEpisode:null);` +
  // Source of truth for the progress slider:
  //   TV → firstUnwatchedEpisode.progress
  //   audiobook (or explicit listen mode) → audioProgress
  //   else → progress
  `var _useAudio=jo(t)||_mode==="listen";` +
  `var _initI=_tvEp?100*(_tvEp.progress||0):(_useAudio?100*(t.audioProgress||0):100*(t.progress||0));` +
  `var a=s((0,r.useState)(_initI),2),i=a[0],o=a[1];` +
  `var u=s((0,r.useState)(0),2),l=u[0],d=u[1];` +
  `var mu=s((0,r.useState)(t.runtime||600),2),maxD=mu[0],setMaxD=mu[1];` +
  `var pu=s((0,r.useState)(t.numberOfPages||200),2),maxP=pu[0],setMaxP=pu[1];` +
  `var hu=s((0,r.useState)(null),2),hltb=hu[0],setHltb=hu[1];` +
  `r.useEffect(function(){if(Ao(t)){fetch("/api/hltb?mediaItemId="+t.id,{credentials:"same-origin"}).then(function(r){return r.json()}).then(setHltb).catch(function(){})}},[t.id]);` +
  `var _markCompleted=function(){` +
    `var _go=function(autoDur){` +
      `var url="/api/seen?mediaItemId="+t.id+"&lastSeenAt=now";` +
      `if(_tvEp){url+="&episodeId="+_tvEp.id}` +
      `if(autoDur)url+="&duration="+autoDur;` +
      `var promises=[fetch(url,{method:"PUT",credentials:"same-origin"})];` +
      // For non-TV: clear the slider-driven progress field (the seen entry
      // above is the source of truth for "completed"). For audio modes (jo or
      // listen) we leave audioProgress=1 instead so the book/audiobook
      // music_note indicator (which keys off audioProgress>0) stays visible
      // after completion.
      //   audiobook OR listen modal → audioProgress = 1 (sentinel: listen-completed)
      //   else (read modal / movie / game) → progress = 0 (cleared)
      `if(!_tvEp){` +
        `if(_useAudio){` +
          `promises.push(fetch("/api/audio-progress?mediaItemId="+t.id+"&progress=1",{method:"PUT",credentials:"same-origin"}));` +
        `}else{` +
          `un({mediaItemId:t.id,progress:0,duration:l||autoDur||0});` +
        `}` +
      `}` +
      // Remove from watchlist when the show / movie / etc. is fully completed.
      // For non-TV: always (a single seen entry means completion).
      // For TV: only when this seen call leaves the show with no more
      // unwatched episodes — i.e. when this was the last unwatched one.
      `var _wlDel=function(){return fetch("/api/watchlist?mediaItemId="+t.id,{method:"DELETE",credentials:"same-origin"})};` +
      `if(!_tvEp){` +
        `promises.push(_wlDel());` +
      `}else if(Number(t.unseenEpisodesCount||0)<=1&&["Returning Series","In Production","Planned"].indexOf(t.status)<0){` +
        `promises.push(_wlDel());` +
      `}` +
      `Promise.all(promises).finally(function(){HW.refetchQueries(en(t.id));HW.refetchQueries(["items"]);n()});` +
    `};` +
    `if(Ao(t)){` +
      `var _src=hltb||null;` +
      `if(_src){_go((_src.completely||_src.normally||_src.hastily)||0)}` +
      `else{fetch("/api/hltb?mediaItemId="+t.id,{credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){_go((d&&(d.completely||d.normally||d.hastily))||0)}).catch(function(){_go(0)})}` +
    `}else{_go(0)}` +
  `};` +
  `var _save=function(e){e.preventDefault();` +
    `if(_tvEp){` +
      `fetch("/api/episode-progress?episodeId="+_tvEp.id+"&progress="+(i/100),{method:"PUT",credentials:"same-origin"}).then(function(){HW.refetchQueries(en(t.id));HW.refetchQueries(["items"])});` +
    `}else if(_useAudio){` +
      `fetch("/api/audio-progress?mediaItemId="+t.id+"&progress="+(i/100),{method:"PUT",credentials:"same-origin"}).then(function(){HW.refetchQueries(en(t.id));HW.refetchQueries(["items"])});` +
    `}else{un({mediaItemId:t.id,progress:i/100,duration:l});setTimeout(function(){HW.refetchQueries(en(t.id));HW.refetchQueries(["items"])},150);}` +
    `n();` +
  `};` +
  `var _showRead=_mode==="read"||(!_mode&&Do(t));` +
  `var _showListen=_mode==="listen"||(!_mode&&jo(t));` +
  `var _showFallback=!_mode&&!Do(t)&&!jo(t);` +
  `var _sectionStyle={border:"1px solid rgba(148,163,184,0.4)",borderRadius:"0.5rem",padding:"0.75rem",marginBottom:"0.75rem"};` +
  `var _btnStyle={padding:"0.4rem 0.8rem",borderRadius:"0.25rem",cursor:"pointer",border:"0",fontWeight:"600"};` +
  // Render
  `return r.createElement("div",{className:"p-3"},` +
    `r.createElement("div",{className:"my-1 text-3xl font-bold text-center"},"Progreso"),` +
    `r.createElement("form",{className:"flex flex-col mt-4",onSubmit:_save},` +

      // === BOOKS section (Reading) ===
      `_showRead&&r.createElement("div",{style:_sectionStyle},` +
                `r.createElement("div",{className:"text-lg mt-2"},xo._("Set total pages")+":"),` +
        `r.createElement("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem"}},` +
          `r.createElement("input",{type:"number",min:1,value:maxP,style:{width:"6rem"},onChange:function(e){return setMaxP(Math.max(1,Number(e.currentTarget.value)))}}),` +
          `r.createElement("span",null,xo._("pages"))` +
        `),` +
        `r.createElement("div",{className:"text-lg mt-3"},"Progreso:"),` +
        `r.createElement(Ip,{max:maxP,progress:i,setProgress:o,mediaType:t.mediaType}),` +
        `r.createElement("div",{className:"flex items-center mt-2"},` +
          `r.createElement("input",{className:"w-full my-2 mr-2",type:"range",value:i,min:0,max:100,onChange:function(e){o(Number(e.currentTarget.value))}}),` +
          `r.createElement("span",{className:"w-10 text-right"},Math.round(i),"%")` +
        `)` +
      `),` +

      // === AUDIOBOOKS section (Listening) ===
      `_showListen&&r.createElement("div",{style:_sectionStyle},` +
        `r.createElement("div",{className:"text-xl font-bold mb-2"},xo._("I finished listening")),` +
                // Set total duration (H+M with green tick)
        `r.createElement("div",{className:"text-lg mt-2"},xo._("Set duration in hours and minutes")+":"),` +
        `r.createElement("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem"}},` +
          `r.createElement("input",{type:"number",min:0,value:Math.floor(maxD/60),style:{width:"4rem"},onChange:function(e){return setMaxD(Math.max(1,Number(e.currentTarget.value)*60+(maxD%60)))}}),` +
          `r.createElement("span",null,"h"),` +
          `r.createElement("input",{type:"number",min:0,max:59,value:maxD%60,style:{width:"4rem"},onChange:function(e){return setMaxD(Math.max(1,Math.floor(maxD/60)*60+Number(e.currentTarget.value)))}}),` +
          `r.createElement("span",null,"min"),` +
          `r.createElement("span",{title:"Aplicado",style:{color:"#4ade80",fontSize:"1.5rem",marginLeft:"0.5rem"}},"✓")` +
        `),` +
        // Progress slider — H+M label tracks the slider value (time, not percent)
        `r.createElement("input",{className:"w-full my-3",type:"range",min:0,max:maxD,value:Math.round(i*maxD/100),onChange:function(e){o(Math.min(100,Number(e.currentTarget.value)/maxD*100))}}),` +
        `r.createElement("div",{className:"text-center text-lg"},Math.floor(Math.round(i*maxD/100)/60),"h ",Math.round(i*maxD/100)%60,"min ",r.createElement("span",{className:"text-sm text-gray-500"},"(",Math.round(i),"%)"))` +
      `),` +

      // === FALLBACK for non-book/non-audiobook (movies, tv, games) ===
      `_showFallback&&r.createElement(r.Fragment,null,` +
        // For TV with current episode: show episode info + runtime
        `_tvEp&&r.createElement("div",{style:_sectionStyle},` +
          `r.createElement("div",{className:"text-sm font-semibold mb-1"},"Episodio actual:"),` +
          `r.createElement("div",{className:"text-base"},"S"+String(_tvEp.seasonNumber).padStart(2,"0")+"E"+String(_tvEp.episodeNumber).padStart(2,"0")+(_tvEp.title?" — "+_tvEp.title:"")),` +
          `_tvEp.runtime&&r.createElement("div",{className:"text-sm text-gray-400"},xo._("Duration")+": "+_tvEp.runtime+" min")` +
        `),` +
        // For games: HLTB time estimates panel
        `Ao(t)&&r.createElement("div",{style:_sectionStyle},` +
          `r.createElement("div",{className:"text-sm font-semibold mb-1"},"How Long To Beat (IGDB):"),` +
          `hltb===null?r.createElement("div",{className:"text-xs text-gray-400"},"Cargando..."):` +
          `(hltb.count===0||(!hltb.hastily&&!hltb.normally&&!hltb.completely))?r.createElement("div",{className:"text-xs text-gray-400"},"Sin datos"):` +
          `r.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:"0.9rem"}},` +
            `r.createElement("div",null,r.createElement("b",null,xo._("Quick")+": "),hltb.hastily?Math.round(hltb.hastily/60*10)/10+" h":"-"),` +
            `r.createElement("div",null,r.createElement("b",null,"Normal: "),hltb.normally?Math.round(hltb.normally/60*10)/10+" h":"-"),` +
            `r.createElement("div",null,r.createElement("b",null,"Completo: "),hltb.completely?Math.round(hltb.completely/60*10)/10+" h":"-")` +
          `)` +
        `),` +
        // For movies with runtime: existing time slider
        `(Io(t)&&t.runtime)&&r.createElement(Ip,{max:maxD,progress:i,setProgress:o,mediaType:t.mediaType}),` +
        // Always: percentage slider
        `r.createElement("div",{className:"text-lg mt-2"},"Progreso:"),` +
        `r.createElement("div",{className:"flex items-center mb-4"},` +
          `r.createElement("input",{className:"w-full my-2 mr-2",type:"range",value:i,min:0,max:100,onChange:function(e){o(Number(e.currentTarget.value))}}),` +
          `r.createElement("span",{className:"w-10 text-right"},Math.round(i),"%")` +
        `)` +
      `),` +

      `r.createElement("button",{className:"w-full btn"},"Guardar progreso")` +
    `),` +
    `r.createElement("div",{className:"w-full mt-3 btn-blue",style:{background:"#16a34a",color:"white"},onClick:_markCompleted},_tvEp?"Marcar episodio como completado":"Marcar como completado"),` +
    `r.createElement("div",{className:"w-full mt-3 btn-red",onClick:function(){return n()}},r.createElement(Xe,{id:"Cancel"}))` +
  `)` +
`}`;

c = c.replace(oldFunction, newFunction);
fs.writeFileSync(bundlePath, c);
console.log('progress redesign: rewrote Rp modal with two sections (leerlo/escucharlo)');

})();

// ===== patch_audio_progress_migration.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/migrations';
const list = fs.readdirSync(path).filter(f => f.endsWith('.js')).sort();

const fname = '20260428000002_addAudioProgressToMediaItem.js';
const dest = path + '/' + fname;
if (fs.existsSync(dest)) { console.log('audio-progress migration: already exists'); return /* was process.exit(0) */; }

const content = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
exports.down = void 0;
async function up(knex) {
  await knex.schema.table('mediaItem', table => {
    table.float('audioProgress').nullable();
  });
}
async function down(knex) {
  await knex.schema.table('mediaItem', table => {
    table.dropColumn('audioProgress');
  });
}
exports.up = up;
exports.down = down;
//# sourceMappingURL=` + fname + `.map
`;

fs.writeFileSync(dest, content);
console.log('audio-progress migration: created', fname);

})();

// ===== patch_audio_progress_entity.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/entity/mediaItem.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("'audioProgress'") || c.includes('"audioProgress"')) {
  console.log('audio-progress entity: already patched');
  return /* was process.exit(0) */;
}

// Add 'audioProgress' to the mediaItemColumns array (next to 'downloaded' / 'links')
const old = "'downloaded',";
if (!c.includes(old)) { console.error('audio-progress entity: anchor not found'); process.exit(1); }
c = c.replace(old, "'downloaded', 'audioProgress',");
fs.writeFileSync(path, c);
console.log('audio-progress entity: added audioProgress to mediaItemColumns');

})();

// ===== patch_audio_progress_controller.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/item.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('setAudioProgress')) { console.log('audio-progress controller: already patched'); return /* was process.exit(0) */; }

const method = `  setAudioProgress = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const { mediaItemId } = req.query;
    const progress = req.query.progress !== undefined ? req.query.progress : (req.body && req.body.progress);
    const item = await _dbconfig.Database.knex('mediaItem').select('id').where('id', mediaItemId).first();
    if (!item) { res.status(404).send(); return; }
    const p = (progress === null || progress === undefined) ? null : Math.max(0, Math.min(1, Number(progress)));
    await _dbconfig.Database.knex('mediaItem').update({ audioProgress: p }).where('id', mediaItemId);
    res.json({ ok: true, audioProgress: p });
  });
`;

const anchor = '}\nexports.MediaItemController = MediaItemController;';
if (!c.includes(anchor)) { console.error('audio-progress controller: close anchor not found'); process.exit(1); }
c = c.replace(anchor, method + anchor);
fs.writeFileSync(path, c);
console.log('audio-progress controller: added setAudioProgress method');

})();

// ===== patch_audio_progress_routes.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/generated/routes/routes.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("/api/audio-progress'")) { console.log('audio-progress routes: already patched'); return /* was process.exit(0) */; }

const anchor = "router.patch('/api/downloaded'";
if (!c.includes(anchor)) { console.error('audio-progress routes: anchor not found'); process.exit(1); }

const route = `router.put('/api/audio-progress', validatorHandler({
  requestQuerySchema: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: { mediaItemId: { type: 'number' }, progress: { type: 'number' } },
    required: ['mediaItemId']
  }
}), _MediaItemController.setAudioProgress);
`;
c = c.replace(anchor, route + anchor);
fs.writeFileSync(path, c);
console.log('audio-progress routes: added PUT /api/audio-progress');

})();

// ===== patch_audio_progress_frontend.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Replace the sidebar block:
//   Lo(a)&&Fragment("I finished it" button + "Progress: X%")  +  ug button (Progreso)
// with:
//   "Marcar como completado" button (single, always shown)
//   Two parallel buttons "Progreso leído"/"Progreso escuchado" with their respective % below
// For non-book/audiobook items, fall back to the original single ug button.

const oldBlock = 'Lo(a)&&r.createElement(r.Fragment,null,r.createElement("div",{className:"mt-3 text-sm btn",onClick:de(ke().mark((function e(){return ke().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:un({mediaItemId:a.id,progress:1});case 1:case"end":return e.stop()}}),e)})))},Io(a)&&r.createElement(Xe,{id:"I finished watching it"}),Do(a)&&r.createElement(Xe,{id:"I finished reading it"}),jo(a)&&r.createElement(Xe,{id:"I finished listening it"}),Ao(a)&&r.createElement(Xe,{id:"I finished playing it"})),r.createElement("div",{className:"mt-3"},r.createElement(Xe,{id:"Progress"}),":"," ",Math.round(100*a.progress),"%")),r.createElement("div",{className:"mt-3"},r.createElement(ug,{mediaItem:a}))';

const newBlock =
  // For book/audiobook: two parallel columns with their own progress %
  // (The "Marcar como completado" button is rendered as part of the action grid above by patch_sidebar_grid.js)
  // The progress text was previously gated by `!a.seen` so it disappeared after
  // first completion; this hid re-read / re-listen progress entirely. Now we
  // show it whenever the underlying field is strictly between 0 and 1 (a
  // re-read/re-listen in flight) — at exact 1 we hide it because the
  // "Marcar como completado" button + green badge already convey completion.
  '(Do(a)||jo(a))?r.createElement("div",{style:{display:"flex",gap:"0.5rem",marginTop:"0.75rem"}},' +
    'r.createElement("div",{style:{flex:"1"}},' +
      'r.createElement(mo,{openModal:function(open){return r.createElement("div",{className:"text-sm text-green-500 btn",onClick:function(){return open()}},"Progreso leído")}},function(close){return r.createElement(Rp,{mediaItem:a,closeModal:close,mode:"read"})}),' +
      '(a.progress!=null&&a.progress>0&&a.progress<1)&&r.createElement("div",{className:"text-xs mt-1"},"Progreso: ",Math.round(100*a.progress),"%")' +
    '),' +
    'r.createElement("div",{style:{flex:"1"}},' +
      'r.createElement(mo,{openModal:function(open){return r.createElement("div",{className:"text-sm text-green-500 btn",onClick:function(){return open()}},"Progreso escuchado")}},function(close){return r.createElement(Rp,{mediaItem:a,closeModal:close,mode:"listen"})}),' +
      '(a.audioProgress!=null&&a.audioProgress>0&&a.audioProgress<1)&&r.createElement("div",{className:"text-xs mt-1"},"Progreso: ",Math.round(100*a.audioProgress),"%")' +
    ')' +
  '):r.createElement("div",{className:"mt-3"},r.createElement(ug,{mediaItem:a}))';

// New marker (v2) detects the fix that lets re-read/re-listen progress show
// after first completion. v1 (with `(!a.seen)` gate) is recognized and bumped.
const v2Marker = 'a.audioProgress!=null&&a.audioProgress>0&&a.audioProgress<1';
const v1Pattern = '(!a.seen)&&r.createElement("div",{className:"text-xs mt-1"},"Progreso: ",Math.round(100*(a.progress||0)),"%")';

if (c.includes(v2Marker)) {
  console.log('audio-progress frontend: already at v2 (re-read/re-listen progress visible)');
} else if (c.includes(v1Pattern)) {
  // Upgrade v1 → v2 in place: rebuild the inner block by re-running the
  // replacement assuming oldBlock was the original. We reconstruct the v1
  // shape from the current block bounds and replace with v2.
  const v1Block = oldBlock.replace(/Lo\(a\).*$/s, '').slice(0); // unused; just use direct strings:
  const v1Read = '(!a.seen)&&r.createElement("div",{className:"text-xs mt-1"},"Progreso: ",Math.round(100*(a.progress||0)),"%")';
  const v2Read = '(a.progress!=null&&a.progress>0&&a.progress<1)&&r.createElement("div",{className:"text-xs mt-1"},"Progreso: ",Math.round(100*a.progress),"%")';
  const v1Listen = '(!a.seen)&&r.createElement("div",{className:"text-xs mt-1"},"Progreso: ",Math.round(100*(a.audioProgress||0)),"%")';
  const v2Listen = '(a.audioProgress!=null&&a.audioProgress>0&&a.audioProgress<1)&&r.createElement("div",{className:"text-xs mt-1"},"Progreso: ",Math.round(100*a.audioProgress),"%")';
  c = c.replace(v1Read, v2Read).replace(v1Listen, v2Listen);
  console.log('audio-progress frontend: bumped v1 → v2 (re-read/re-listen progress visible)');
} else if (!c.includes(oldBlock)) {
  console.error('audio-progress frontend: anchor block not found');
  process.exit(1);
} else {
  c = c.replace(oldBlock, newBlock);
  console.log('audio-progress frontend: replaced sidebar block with two parallel progress buttons (v2)');
}

fs.writeFileSync(bundlePath, c);

})();

// ===== patch_sidebar_grid.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Replace the sequence of detail-page sidebar action buttons with a 2-column grid:
//   Row 1: [Marcar como completado] [Actualizar metadatos]
//   Row 2: [Marcar como leído]      [Marcar como no leído]
//   Row 3: [Añadido en N listas]    [Quitar/Añadir a Pendientes]
//
// Buttons that don't satisfy their visibility condition render an empty <div> as a
// placeholder so the grid stays aligned.

const oldBlock = 'function(e){var t;return["igdb","tmdb","openlibrary","audible"].includes(null===(t=e.source)||void 0===t?void 0:t.toLowerCase())}(a)&&r.createElement("div",{className:"pt-3"},r.createElement(sg,{mediaItem:a})),r.createElement("div",{className:"mt-3"},function(e){return!0===e.onWatchlist}(a)?r.createElement(og,{mediaItem:a}):r.createElement(ig,{mediaItem:a})),r.createElement("div",{className:"mt-3"},r.createElement(Gp,{mediaItemId:a.id})),r.createElement("div",{className:"mt-3"},(Wo(a)||!No(a))&&r.createElement(r.Fragment,null,r.createElement(Yp,{mediaItem:a}),Kp(a)&&r.createElement("div",{className:"mt-3"},r.createElement($p,{mediaItem:a})))),r.createElement("div",{className:"mt-3"})';

// Toggle "Marcar como completado" / "Quitar completado":
//   - If item is completed (seen / progress=1 / audioProgress=1): red, removes completion
//   - Else: white, marks completion. For games, auto-pulls HLTB time and stores it as seen.duration
//
// For games, "completado" means a kind='played' seen row exists. Without this
// branch the button would also light up after "Marcar como visto" (kind='watched'),
// because `a.seen===true` is set as soon as ANY seen row exists.
const completedExpr =
  '((a.mediaType==="video_game"' +
    '?(a.seenHistory&&a.seenHistory.some(function(s){return s.kind==="played"}))' +
    ':a.seen===true' +
  ')||a.progress===1||a.audioProgress===1)';
// "Quitar completado" must delete only kind='played' rows, not watched ones —
// the new DELETE accepts &kind=played (handler patched in patch_seen_kind_wiring).
const markCompletedBtn = 'r.createElement("div",{className:"text-sm btn",style:' + completedExpr + '?{background:"#dc2626",color:"white",borderColor:"#dc2626"}:{},onClick:function(){' +
  'if(' + completedExpr + '){' +
    'Promise.all([' +
      'fetch("/api/seen/?mediaItemId="+a.id+"&kind=played",{method:"DELETE",credentials:"same-origin"}),' +
      'fetch("/api/audio-progress?mediaItemId="+a.id+"&progress=0",{method:"PUT",credentials:"same-origin"})' +
    ']).then(function(){un({mediaItemId:a.id,progress:0,duration:0});HW.refetchQueries(en(a.id));HW.refetchQueries(["items"])});' +
  '}else{' +
    'un({mediaItemId:a.id,progress:1});' +
    'var _doMark=function(dur){' +
      'var url="/api/seen?mediaItemId="+a.id+"&lastSeenAt=now"+(dur?"&duration="+dur:"");' +
      // Sidebar toggle: only seen + progress (read). Does NOT touch audioProgress
      // (use the listen modal explicitly to mark as escuchado).
      'return fetch(url,{method:"PUT",credentials:"same-origin"})' +
        '.then(function(){HW.refetchQueries(en(a.id));HW.refetchQueries(["items"])});' +
    '};' +
    'if(Ao(a)){fetch("/api/hltb?mediaItemId="+a.id,{credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){_doMark((d&&(d.completely||d.normally||d.hastily))||0)}).catch(function(){_doMark(0)})}else{_doMark(0)}' +
  '}' +
'}},' + completedExpr + '?"Quitar completado":"Marcar como completado")';

const sgCell = 'function(e){var t;return["igdb","tmdb","openlibrary","audible"].includes(null===(t=e.source)||void 0===t?void 0:t.toLowerCase())}(a)?r.createElement(sg,{mediaItem:a}):r.createElement("div")';
const gpCell = 'r.createElement(Gp,{mediaItemId:a.id})';
const watchlistCell = 'function(e){return!0===e.onWatchlist}(a)?r.createElement(og,{mediaItem:a}):r.createElement(ig,{mediaItem:a})';

// Grid is now 2 rows × 2 cols (no Yp / $p — replaced by the toggle)
const newBlock =
  'r.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem",marginTop:"0.75rem"}},' +
    markCompletedBtn + ',' +
    sgCell + ',' +
    gpCell + ',' +
    watchlistCell +
  ')';

if (c.includes('Marcar como completado"')&&c.includes('display:"grid",gridTemplateColumns:"1fr 1fr"')) {
  console.log('sidebar grid: already patched');
} else if (!c.includes(oldBlock)) {
  console.error('sidebar grid: anchor block not found');
  process.exit(1);
} else {
  c = c.replace(oldBlock, newBlock);
  console.log('sidebar grid: replaced action buttons with 2-column grid');
}

fs.writeFileSync(bundlePath, c);

})();

// ===== patch_completed_badge.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Wrap the seen-history link with a vertical container:
//   row 1: link  +  green "✓ Completado" badge (if completed)
//   row 2: compact summary "N veces · Última vez DD/MM/YYYY"
const old = 'r.createElement(ie,{to:"/seen-history/".concat(a.id),className:"underline"},jo(a)&&r.createElement(Xe,{id:"Listened history"}),Do(a)&&r.createElement(Xe,{id:"Read history"}),(Io(a)||Ro(a))&&r.createElement(Xe,{id:"Seen history"}),Ao(a)&&r.createElement(Xe,{id:"Played history"}))';

const summaryExpr =
  '(function(){' +
    'var n=(a.seenHistory&&a.seenHistory.length)||0;' +
    'var verb=jo(a)?"Escuchado":Do(a)?"Leído":Ao(a)?"Jugado":"Visto";' +
    'var last=a.lastSeenAt?new Date(a.lastSeenAt).toLocaleDateString("es",{day:"2-digit",month:"2-digit",year:"numeric"}):null;' +
    'if(n===0&&!last)return null;' +
    'var parts=[];' +
    'var isTv=a.mediaType==="tv";' +
    'if(n>0){' +
      'parts.push(verb+" "+n+(n===1?" vez":" veces"));' +
      // For non-tv items, surface re-watches explicitly: visit #1 = first, the rest are re-watches
      'if(!isTv&&n>=2)parts.push((n-1)+" re-vista"+(n-1===1?"":"s"));' +
    '}' +
    'if(last)parts.push("última vez "+last);' +
    // First-watch date (oldest seen entry) for non-tv items with multiple visits
    'if(!isTv&&n>=2&&a.seenHistory){' +
      'var dates=a.seenHistory.map(function(s){return s.date}).filter(Boolean).sort();' +
      'if(dates.length>=2){var first=new Date(dates[0]).toLocaleDateString("es",{day:"2-digit",month:"2-digit",year:"numeric"});parts.push("primera vez "+first)}' +
    '}' +
    'return r.createElement("div",{className:"text-xs text-gray-500 mt-1"},parts.join(" · "))' +
  '})()';

// For games, `seen===true` is true as soon as any seen row exists (including
// kind='watched'), which would falsely light up "Completado" when the user
// only clicked "Marcar como visto". Require kind='played' for games; other
// media types keep the original semantic.
const completedExpr =
  '((a.mediaType==="video_game"' +
    '?(a.seenHistory&&a.seenHistory.some(function(s){return s.kind==="played"}))' +
    ':a.seen===true' +
  ')||a.progress===1||a.audioProgress===1)';

const fresh = 'r.createElement("div",{className:"mt-3"},' +
  'r.createElement("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem"}},' + old +
    ',' + completedExpr + '&&r.createElement("span",{style:{background:"#16a34a",color:"white",padding:"0.15rem 0.5rem",borderRadius:"0.25rem",fontSize:"0.75rem",fontWeight:"600"}},"✓ Completado")' +
  '),' + summaryExpr +
')';

if (c.includes('re-vista')) {
  console.log('completed badge: already added (with rewatch info)');
} else if (c.includes('"✓ Completado"')) {
  // Old version was applied; replace it with the new one that includes rewatch info
  const oldFresh = 'r.createElement("div",{className:"mt-3"},r.createElement("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem"}},' + old + ',((a.seen===true)||(a.progress===1)||(a.audioProgress===1))&&r.createElement("span",{style:{background:"#16a34a",color:"white",padding:"0.15rem 0.5rem",borderRadius:"0.25rem",fontSize:"0.75rem",fontWeight:"600"}},"✓ Completado")),(function(){var n=(a.seenHistory&&a.seenHistory.length)||0;var verb=jo(a)?"Escuchado":Do(a)?"Leído":Ao(a)?"Jugado":"Visto";var last=a.lastSeenAt?new Date(a.lastSeenAt).toLocaleDateString("es",{day:"2-digit",month:"2-digit",year:"numeric"}):null;if(n===0&&!last)return null;var parts=[];if(n>0)parts.push(verb+" "+n+(n===1?" vez":" veces"));if(last)parts.push("última vez "+last);return r.createElement("div",{className:"text-xs text-gray-500 mt-1"},parts.join(" · "))})())';
  if (c.includes(oldFresh)) {
    c = c.replace(oldFresh, fresh);
    console.log('completed badge: upgraded to include rewatch info');
  } else {
    console.log('completed badge: legacy version detected but exact pattern mismatch (skipping)');
  }
} else if (!c.includes(old)) {
  console.error('completed badge: anchor not found'); process.exit(1);
} else {
  c = c.replace(old, fresh);
  console.log('completed badge: green badge + rewatch info added');
}

fs.writeFileSync(bundlePath, c);

})();

// ===== patch_audio_listened_icon.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Show music_note (top-center) on any item that has audio progress > 0 (book/audiobook with audioProgress)
// regardless of seen state. Keeps the existing top-right check_circle for non-audiobook seen items.
const oldSeen = 's.showUnwatchedEpisodesCount&&1==t.seen&&r.createElement("div",{className:"absolute inline-flex pointer-events-auto foo top-1 "+("audiobook"===t.mediaType?"left-1/2 -translate-x-1/2":"right-1")},r.createElement(Fv,null,r.createElement("i",{className:"flex text-white select-none material-icons",title:"audiobook"===t.mediaType?"Escuchado":"Completado"},"audiobook"===t.mediaType?"music_note":"check_circle_outline")))';

const newSeen =
  // (a) Audiobook seen → music_note at top-CENTER (audiobook seen check replacement)
  '"audiobook"===t.mediaType&&1==t.seen&&r.createElement("div",{className:"absolute inline-flex pointer-events-auto foo top-1",style:{left:"50%",transform:"translateX(-50%)"}},r.createElement(Fv,null,r.createElement("span",{className:"flex material-icons",title:"Escuchado"},"music_note"))),' +
  // (b) Check_circle for completed non-audiobook items at top-right (includes games)
  's.showUnwatchedEpisodesCount&&1==t.seen&&"audiobook"!==t.mediaType&&r.createElement("div",{className:"absolute inline-flex pointer-events-auto foo top-1 right-1"},r.createElement(Fv,null,r.createElement("span",{className:"flex material-icons",title:"Completado"},"check_circle_outline"))),' +
  // (c) Books only: music_note BELOW the completed icon when audioProgress>0
  '"book"===t.mediaType&&t.audioProgress>0&&r.createElement("div",{className:"absolute inline-flex pointer-events-auto foo right-1",style:{top:"3rem"}},r.createElement(Fv,null,r.createElement("span",{className:"flex material-icons",title:"Escuchado"},"music_note")))';

if (c.includes('t.audioProgress>0||("audiobook"===t.mediaType&&1==t.seen)')) {
  console.log('audio listened icon: already patched');
} else if (!c.includes(oldSeen)) {
  console.error('audio listened icon: anchor not found');
  process.exit(1);
} else {
  c = c.replace(oldSeen, newSeen);
  console.log('audio listened icon: split seen icon into music_note (top-center, audioProgress>0) + check (top-right, seen+non-audiobook)');
}

fs.writeFileSync(bundlePath, c);

})();

// ===== patch_episode_buttons_short.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Shorten the Spanish labels for episode mark/unmark to fit on one line
const replacements = [
  ['"Add episode to seen history":"Marcar episodio como visto"', '"Add episode to seen history":"Visto"'],
  ['"Remove episode from seen history":"Marcar episodio como no visto"', '"Remove episode from seen history":"No visto"'],
];

let count = 0;
for (const [oldS, newS] of replacements) {
  if (c.includes(oldS)) {
    c = c.replace(oldS, newS);
    count++;
  }
}
fs.writeFileSync(bundlePath, c);
console.log('episode buttons short:', count, 'translations updated');

})();

// ===== patch_episode_progress_migration.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/migrations';
const fname = '20260428000003_addProgressToEpisode.js';
const dest = path + '/' + fname;
if (fs.existsSync(dest)) { console.log('episode-progress migration: already exists'); return /* was process.exit(0) */; }

const content = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
exports.down = void 0;
async function up(knex) {
  await knex.schema.table('episode', table => {
    table.float('progress').nullable();
  });
}
async function down(knex) {
  await knex.schema.table('episode', table => {
    table.dropColumn('progress');
  });
}
exports.up = up;
exports.down = down;
//# sourceMappingURL=` + fname + `.map
`;

fs.writeFileSync(dest, content);
console.log('episode-progress migration: created', fname);

})();

// ===== patch_episode_progress_entity.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/entity/tvepisode.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("'progress'")) { console.log('episode-progress entity: already patched'); return /* was process.exit(0) */; }

const old = "'tvShowId', 'isSpecialEpisode'";
if (!c.includes(old)) { console.error('episode-progress entity: anchor not found'); process.exit(1); }
c = c.replace(old, "'tvShowId', 'isSpecialEpisode', 'progress'");
fs.writeFileSync(path, c);
console.log('episode-progress entity: added progress to tvEpisodeColumns');

})();

// ===== patch_episode_progress_controller.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/item.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('setEpisodeProgress')) { console.log('episode-progress controller: already patched'); return /* was process.exit(0) */; }

const method = `  setEpisodeProgress = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const { episodeId } = req.query;
    const progress = req.query.progress !== undefined ? req.query.progress : (req.body && req.body.progress);
    const ep = await _dbconfig.Database.knex('episode').select('id').where('id', episodeId).first();
    if (!ep) { res.status(404).send(); return; }
    const p = (progress === null || progress === undefined) ? null : Math.max(0, Math.min(1, Number(progress)));
    await _dbconfig.Database.knex('episode').update({ progress: p }).where('id', episodeId);
    res.json({ ok: true, progress: p });
  });
`;
const anchor = '}\nexports.MediaItemController = MediaItemController;';
if (!c.includes(anchor)) { console.error('episode-progress controller: close anchor not found'); process.exit(1); }
c = c.replace(anchor, method + anchor);
fs.writeFileSync(path, c);
console.log('episode-progress controller: added setEpisodeProgress method');

})();

// ===== patch_episode_progress_routes.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/generated/routes/routes.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("/api/episode-progress'")) { console.log('episode-progress routes: already patched'); return /* was process.exit(0) */; }

const anchor = "router.put('/api/audio-progress'";
if (!c.includes(anchor)) { console.error('episode-progress routes: anchor not found'); process.exit(1); }

const route = `router.put('/api/episode-progress', validatorHandler({
  requestQuerySchema: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: { episodeId: { type: 'number' }, progress: { type: 'number' } },
    required: ['episodeId']
  }
}), _MediaItemController.setEpisodeProgress);
`;
c = c.replace(anchor, route + anchor);
fs.writeFileSync(path, c);
console.log('episode-progress routes: added PUT /api/episode-progress');

})();

// ===== patch_episode_progress_frontend.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Inject `_EP` component (per-episode progress slider) before _v card definition.
// Standard hack: add it as another comma-separated declarator inside `var Ov,Lv,Hv,_v=...`
// On mount + when episode prop changes, sync local state to episode.progress.
// When seenHistory length changes (Visto / No visto clicked), reset progress to 0.
const compDef = `_EP=function(e){` +
  `var _ep=e.episode;` +
  `var _s=r.useState(Math.round(100*(_ep.progress||0))),_p=_s[0],_setP=_s[1];` +
  `var _seenLen=(_ep.seenHistory&&_ep.seenHistory.length)||0;` +
  `var _prevSeen=r.useRef(_seenLen);` +
  `r.useEffect(function(){_setP(Math.round(100*(_ep.progress||0)))},[_ep.id,_ep.progress]);` +
  `r.useEffect(function(){` +
    `if(_seenLen!==_prevSeen.current){` +
      `_prevSeen.current=_seenLen;` +
      `if(_p>0){fetch("/api/episode-progress?episodeId="+_ep.id+"&progress=0",{method:"PUT",credentials:"same-origin"});_setP(0)}` +
    `}` +
  `},[_seenLen]);` +
  // Auto-fetch runtimes once per show per session if any episode is missing runtime
  `r.useEffect(function(){` +
    `if(!_ep.runtime&&_ep.tvShowId){` +
      `var k="rtm_"+_ep.tvShowId;` +
      `if(typeof sessionStorage!=="undefined"&&!sessionStorage.getItem(k)){` +
        `sessionStorage.setItem(k,"1");` +
        `fetch("/api/episodes/fetch-runtimes?mediaItemId="+_ep.tvShowId,{method:"POST",credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){if(d&&d.ok&&typeof HW!=="undefined"&&typeof en!=="undefined"){HW.refetchQueries(en(_ep.tvShowId));HW.refetchQueries(["items"])}}).catch(function(){})` +
      `}` +
    `}` +
  `},[_ep.tvShowId,_ep.runtime]);` +
  `var _save=function(v){` +
    `_setP(v);` +
    `fetch("/api/episode-progress?episodeId="+_ep.id+"&progress="+(v/100),{method:"PUT",credentials:"same-origin"}).catch(function(){});` +
  `};` +
  `return r.createElement("div",{className:"flex items-center",style:{minWidth:"8rem"}},` +
    `r.createElement("input",{type:"range",min:0,max:100,value:_p,style:{width:"5rem"},onChange:function(e){_save(Number(e.currentTarget.value))}}),` +
    `r.createElement("span",{className:"text-xs ml-1 text-gray-400",style:{minWidth:"2.5rem"}},_p,"%")` +
  `)` +
`},`;

const cardAnchor = '_v=function(e){';
if (c.includes('_EP=function(e){var _ep=e.episode')) {
  console.log('episode-progress frontend: _EP component already injected');
} else if (!c.includes(cardAnchor)) {
  console.error('episode-progress frontend: _v anchor not found'); process.exit(1);
} else {
  c = c.replace(cardAnchor, compDef + cardAnchor);
  console.log('episode-progress frontend: injected _EP component');
}

// Insert duration column + per-episode "Progreso" button into the Iy (episode
// row) component. The button opens the same Rp modal used by the show-level
// Progreso button, but with `episode:i` so it targets this specific episode
// (Rp's _tvEp falls back to e.episode || firstUnwatchedEpisode).
const rowAnchor = 'r.createElement("div",{className:"flex w-10 md:justify-center"},(Wo(i)||!No(a))&&r.createElement(Yo,{mediaItem:a,episode:i}))';
const rowPatched = rowAnchor +
  ',r.createElement("div",{className:"text-sm text-gray-400 ml-2",style:{minWidth:"3.5rem"}},i.runtime?i.runtime+" min":"")' +
  ',r.createElement("div",{className:"ml-2"},r.createElement(mo,{openModal:function(open){return r.createElement("div",{className:"text-xs text-green-500 btn",onClick:function(){return open()}},"Progreso")}},function(close){return r.createElement(Rp,{mediaItem:a,episode:i,closeModal:close})}))';

if (c.includes('r.createElement(Rp,{mediaItem:a,episode:i')) {
  console.log('episode-progress frontend: per-episode Progreso button already added to Iy');
} else if (!c.includes(rowAnchor)) {
  console.error('episode-progress frontend: Iy row anchor not found'); process.exit(1);
} else {
  c = c.replace(rowAnchor, rowPatched);
  console.log('episode-progress frontend: added duration column + per-episode Progreso button to each episode row');
}

fs.writeFileSync(bundlePath, c);
console.log('episode-progress frontend: complete');

})();

// ===== patch_episode_page_grid.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Restructure individual episode page (PS) into a grid:
//   Row 1: [Visto (Yp)]                [No visto ($p)]
//   Row 2: [Añadir episodio a la lista (Gp)]  full-width
//   Row 3: [Progreso (opens Rp modal targeting this episode)]  full-width

const oldBlock = 'r.createElement("div",{className:"mt-3"},r.createElement(Gp,{mediaItemId:o.id,episodeId:s.id})),(Wo(s)||!No(o))&&r.createElement(r.Fragment,null,r.createElement("div",{className:"mt-3"},r.createElement(Yp,{mediaItem:o,episode:s})),Kp(s)&&r.createElement("div",{className:"mt-3"},r.createElement($p,{mediaItem:o,episode:s})))';

const newBlock =
  'r.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem",marginTop:"0.75rem",alignItems:"center"}},' +
    // Row 1
    '(Wo(s)||!No(o))?r.createElement(Yp,{mediaItem:o,episode:s}):r.createElement("div"),' +
    'Kp(s)?r.createElement($p,{mediaItem:o,episode:s}):r.createElement("div"),' +
    // Row 2: Añadir a lista takes full width
    'r.createElement("div",{style:{gridColumn:"1 / -1"}},r.createElement(Gp,{mediaItemId:o.id,episodeId:s.id})),' +
    // Row 3: Per-episode Progreso button — opens the same Rp modal as the
    // show-level button, targeting this episode (Rp uses e.episode when set).
    'r.createElement("div",{style:{gridColumn:"1 / -1"}},r.createElement(mo,{openModal:function(open){return r.createElement("div",{className:"text-sm text-green-500 btn",onClick:function(){return open()}},"Progreso")}},function(close){return r.createElement(Rp,{mediaItem:o,episode:s,closeModal:close})}))' +
  ')';

if (c.includes('r.createElement(_EP,{episode:s})')) {
  console.log('episode page grid: already patched');
} else if (!c.includes(oldBlock)) {
  console.error('episode page grid: anchor block not found');
  process.exit(1);
} else {
  c = c.replace(oldBlock, newBlock);
  console.log('episode page grid: replaced PS bottom block with 2x2 grid');
}

fs.writeFileSync(bundlePath, c);

})();
