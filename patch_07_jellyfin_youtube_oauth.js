// Auto-generated mega-patch: patch_07_jellyfin_youtube_oauth.js
// Bundles 23 original patch_*.js scripts in execution order.
// Each constituent is wrapped in an IIFE so its top-level vars (const fs = ...)
// don't collide; `process.exit(0)` is rewritten to `return` so an early-exit
// idempotency guard inside one constituent doesn't abort the whole mega-patch.

// ===== patch_jellyfin_controller.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/item.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('jellyfinSync') && c.includes('jellyfinLookup') && c.includes('jellyfinStatus')) {
  console.log('jellyfin controller: already patched'); return /* was process.exit(0) */;
}

// All four methods. Use string concatenation throughout to avoid template-literal nesting headaches.
// `this` works because class field arrow functions bind to the instance.
const method =
"  jellyfinFetch = async (subpath) => {\n" +
"    const fs = require('fs').promises;\n" +
"    const url = process.env.JELLYFIN_URL;\n" +
"    const token = process.env.JELLYFIN_API_KEY;\n" +
"    if (!url || !token) throw new Error('Jellyfin not configured (set JELLYFIN_URL and JELLYFIN_API_KEY in docker-compose.yml)');\n" +
"    const base = url.replace(/\\/+$/, '');\n" +
"    const r = await fetch(base + subpath, { headers: { 'X-Emby-Token': token, 'Accept': 'application/json' } });\n" +
"    if (!r.ok) throw new Error('Jellyfin HTTP ' + r.status + ' on ' + subpath);\n" +
"    return r.json();\n" +
"  };\n" +
"  jellyfinUserId = async () => {\n" +
"    if (process.env.JELLYFIN_USER_ID) return process.env.JELLYFIN_USER_ID;\n" +
"    const users = await this.jellyfinFetch('/Users');\n" +
"    if (!users || !users[0]) throw new Error('No users on Jellyfin server');\n" +
"    return users[0].Id;\n" +
"  };\n" +
"  jellyfinStatus = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
"    const fs = require('fs').promises;\n" +
"    const url = process.env.JELLYFIN_URL;\n" +
"    const token = process.env.JELLYFIN_API_KEY;\n" +
"    if (!url || !token) { res.json({ configured: false }); return; }\n" +
"    let state = {};\n" +
"    try { state = JSON.parse(await fs.readFile('/storage/jellyfin-state.json', 'utf8')); } catch (_) {}\n" +
"    try {\n" +
"      const info = await this.jellyfinFetch('/System/Info');\n" +
"      const userId = await this.jellyfinUserId();\n" +
"      res.json(Object.assign({ configured: true, connected: true, serverName: info.ServerName, version: info.Version, userId }, state));\n" +
"    } catch (e) {\n" +
"      res.json(Object.assign({ configured: true, connected: false, error: e.message }, state));\n" +
"    }\n" +
"  });\n" +
"  jellyfinSync = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
"    const fs = require('fs').promises;\n" +
"    const userId = Number(req.user);\n" +
"    const knex = _dbconfig.Database.knex;\n" +
"    try {\n" +
"      const jfUserId = await this.jellyfinUserId();\n" +
"      const playedRes = await this.jellyfinFetch('/Users/' + jfUserId + '/Items?Filters=IsPlayed&Recursive=true&IncludeItemTypes=Movie,Episode&Fields=ProviderIds,UserData&Limit=10000');\n" +
"      const items = (playedRes && playedRes.Items) || [];\n" +
"      const seriesCache = new Map();\n" +
"      let imported = 0, skipped = 0, unmatched = 0;\n" +
"      for (const it of items) {\n" +
"        const ud = it.UserData || {};\n" +
"        const date = ud.LastPlayedDate ? new Date(ud.LastPlayedDate).getTime() : Date.now();\n" +
"        if (it.Type === 'Movie') {\n" +
"          const pids = it.ProviderIds || {};\n" +
"          const tmdb = pids.Tmdb ? Number(pids.Tmdb) : null;\n" +
"          const imdb = pids.Imdb || null;\n" +
"          let media = null;\n" +
"          if (tmdb) media = await knex('mediaItem').where({ mediaType: 'movie', tmdbId: tmdb }).first();\n" +
"          if (!media && imdb) media = await knex('mediaItem').where({ mediaType: 'movie', imdbId: imdb }).first();\n" +
"          if (!media) { unmatched++; continue; }\n" +
"          const exists = await knex('seen').where({ userId, mediaItemId: media.id, date }).first();\n" +
"          if (exists) { skipped++; continue; }\n" +
"          await knex('seen').insert({ userId, mediaItemId: media.id, episodeId: null, date });\n" +
"          imported++;\n" +
"        } else if (it.Type === 'Episode' && it.SeriesId && it.ParentIndexNumber != null && it.IndexNumber != null) {\n" +
"          let series = seriesCache.get(it.SeriesId);\n" +
"          if (series === undefined) {\n" +
"            try { const s = await this.jellyfinFetch('/Users/' + jfUserId + '/Items/' + it.SeriesId + '?Fields=ProviderIds'); series = (s && s.ProviderIds) || {}; }\n" +
"            catch (_) { series = {}; }\n" +
"            seriesCache.set(it.SeriesId, series);\n" +
"          }\n" +
"          const tvdb = series.Tvdb ? Number(series.Tvdb) : null;\n" +
"          const tmdb = series.Tmdb ? Number(series.Tmdb) : null;\n" +
"          const imdb = series.Imdb || null;\n" +
"          let show = null;\n" +
"          if (tvdb) show = await knex('mediaItem').where({ mediaType: 'tv', tvdbId: tvdb }).first();\n" +
"          if (!show && tmdb) show = await knex('mediaItem').where({ mediaType: 'tv', tmdbId: tmdb }).first();\n" +
"          if (!show && imdb) show = await knex('mediaItem').where({ mediaType: 'tv', imdbId: imdb }).first();\n" +
"          if (!show) { unmatched++; continue; }\n" +
"          const ep = await knex('episode').where({ tvShowId: show.id, seasonNumber: it.ParentIndexNumber, episodeNumber: it.IndexNumber }).first();\n" +
"          if (!ep) { unmatched++; continue; }\n" +
"          const exists = await knex('seen').where({ userId, mediaItemId: show.id, episodeId: ep.id, date }).first();\n" +
"          if (exists) { skipped++; continue; }\n" +
"          await knex('seen').insert({ userId, mediaItemId: show.id, episodeId: ep.id, date });\n" +
"          imported++;\n" +
"        } else { unmatched++; }\n" +
"      }\n" +
"      const state = { lastSync: new Date().toISOString(), lastImported: imported, lastSkipped: skipped, lastUnmatched: unmatched, lastTotal: items.length };\n" +
"      try { { const _t='/storage/jellyfin-state.json.tmp.'+process.pid; await fs.writeFile(_t,JSON.stringify(state)); await fs.rename(_t,'/storage/jellyfin-state.json'); }; } catch (_) {}\n" +
"      res.json(Object.assign({ ok: true }, state));\n" +
"    } catch (e) {\n" +
"      res.status(500).json({ error: e.message });\n" +
"    }\n" +
"  });\n" +
"  jellyfinSyncDownloaded = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
"    if (!process.env.JELLYFIN_URL || !process.env.JELLYFIN_API_KEY) { res.json({ ok: false, configured: false }); return; }\n" +
"    const knex = _dbconfig.Database.knex;\n" +
"    try {\n" +
"      const userId = await this.jellyfinUserId();\n" +
"      const list = await this.jellyfinFetch('/Users/' + userId + '/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds&Limit=20000');\n" +
"      const items = list.Items || [];\n" +
"      let marked = 0, alreadyMarked = 0, unmatched = 0;\n" +
"      for (const it of items) {\n" +
"        const p = it.ProviderIds || {};\n" +
"        const mt = it.Type === 'Movie' ? 'movie' : it.Type === 'Series' ? 'tv' : null;\n" +
"        if (!mt) continue;\n" +
"        let media = null;\n" +
"        if (p.Tmdb) media = await knex('mediaItem').where({ mediaType: mt, tmdbId: Number(p.Tmdb) }).first();\n" +
"        if (!media && p.Imdb) media = await knex('mediaItem').where({ mediaType: mt, imdbId: p.Imdb }).first();\n" +
"        if (!media && p.Tvdb && mt === 'tv') media = await knex('mediaItem').where({ mediaType: mt, tvdbId: Number(p.Tvdb) }).first();\n" +
"        if (!media) { unmatched++; continue; }\n" +
"        if (media.downloaded) { alreadyMarked++; continue; }\n" +
"        await knex('mediaItem').where('id', media.id).update('downloaded', true);\n" +
"        marked++;\n" +
"      }\n" +
"      res.json({ ok: true, jellyfinItems: items.length, newlyMarked: marked, alreadyMarked, unmatched });\n" +
"    } catch (e) {\n" +
"      res.status(500).json({ error: e.message });\n" +
"    }\n" +
"  });\n" +
"  jellyfinLibraryIds = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
"    if (!process.env.JELLYFIN_URL || !process.env.JELLYFIN_API_KEY) { res.json({ tmdb: [], imdb: [], tvdb: [] }); return; }\n" +
"    try {\n" +
"      const userId = await this.jellyfinUserId();\n" +
"      const cacheKey = 'lib:' + userId;\n" +
"      const now = Date.now();\n" +
"      if (!global._jfLibCache) global._jfLibCache = new Map();\n" +
"      let entry = global._jfLibCache.get(cacheKey);\n" +
"      if (!entry || (now - entry.at) > 5 * 60 * 1000) {\n" +
"        const list = await this.jellyfinFetch('/Users/' + userId + '/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds&Limit=20000');\n" +
"        const tmdb = [], imdb = [], tvdb = [];\n" +
"        (list.Items || []).forEach(it => {\n" +
"          const p = it.ProviderIds || {};\n" +
"          if (p.Tmdb) tmdb.push(String(p.Tmdb));\n" +
"          if (p.Imdb) imdb.push(String(p.Imdb));\n" +
"          if (p.Tvdb) tvdb.push(String(p.Tvdb));\n" +
"        });\n" +
"        entry = { at: now, ids: { tmdb, imdb, tvdb } };\n" +
"        global._jfLibCache.set(cacheKey, entry); if (global._jfLibCache.size > 1000) global._jfLibCache.delete(global._jfLibCache.keys().next().value);\n" +
"      }\n" +
"      res.json(entry.ids);\n" +
"    } catch (e) {\n" +
"      res.json({ tmdb: [], imdb: [], tvdb: [], error: e.message });\n" +
"    }\n" +
"  });\n" +
"  jellyfinLookup = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
"    const url = process.env.JELLYFIN_URL;\n" +
"    if (!url || !process.env.JELLYFIN_API_KEY) { res.json({ found: false, configured: false }); return; }\n" +
"    try {\n" +
"      const userId = await this.jellyfinUserId();\n" +
"      const tmdbId = req.query.tmdbId ? String(req.query.tmdbId) : null;\n" +
"      const imdbId = req.query.imdbId ? String(req.query.imdbId) : null;\n" +
"      const tvdbId = req.query.tvdbId ? String(req.query.tvdbId) : null;\n" +
"      const mediaType = req.query.mediaType;\n" +
"      if (!tmdbId && !imdbId && !tvdbId) { res.status(400).json({ error: 'tmdbId, imdbId or tvdbId required' }); return; }\n" +
"      // Jellyfin's AnyProviderIdEquals filter is unreliable on 10.10.x — list all items\n" +
"      // of the right type once (cached in-memory for 5 min) and filter client-side.\n" +
"      const types = mediaType === 'movie' ? 'Movie' : mediaType === 'tv' ? 'Series' : 'Movie,Series';\n" +
"      const cacheKey = userId + ':' + types;\n" +
"      const now = Date.now();\n" +
"      if (!global._jfLookupCache) global._jfLookupCache = new Map();\n" +
"      let entry = global._jfLookupCache.get(cacheKey);\n" +
"      if (!entry || (now - entry.at) > 5 * 60 * 1000) {\n" +
"        const list = await this.jellyfinFetch('/Users/' + userId + '/Items?Recursive=true&IncludeItemTypes=' + types + '&Fields=ProviderIds&Limit=10000');\n" +
"        entry = { at: now, items: list.Items || [] };\n" +
"        global._jfLookupCache.set(cacheKey, entry); if (global._jfLookupCache.size > 1000) global._jfLookupCache.delete(global._jfLookupCache.keys().next().value);\n" +
"      }\n" +
"      const item = entry.items.find(it => {\n" +
"        const p = it.ProviderIds || {};\n" +
"        if (tmdbId && p.Tmdb && String(p.Tmdb) === tmdbId) return true;\n" +
"        if (imdbId && p.Imdb && String(p.Imdb) === imdbId) return true;\n" +
"        if (tvdbId && p.Tvdb && String(p.Tvdb) === tvdbId) return true;\n" +
"        return false;\n" +
"      });\n" +
"      if (!item) { res.json({ found: false }); return; }\n" +
"      const publicUrl = process.env.JELLYFIN_PUBLIC_URL || url;\n" +
"      const base = publicUrl.replace(/\\/+$/, '');\n" +
"      res.json({ found: true, itemId: item.Id, name: item.Name, type: item.Type, deeplink: base + '/web/#/details?id=' + item.Id + '&serverId=' + (item.ServerId || '') });\n" +
"    } catch (e) {\n" +
"      res.json({ found: false, error: e.message });\n" +
"    }\n" +
"  });\n";

const anchor = '}\nexports.MediaItemController = MediaItemController;';
if (!c.includes(anchor)) { console.error('jellyfin controller: anchor not found'); process.exit(1); }
c = c.replace(anchor, method + anchor);
fs.writeFileSync(path, c);
console.log('jellyfin controller: added 4 methods (status, sync, lookup, helpers)');

})();

// ===== patch_jellyfin_routes.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/generated/routes/routes.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("/api/jellyfin/sync'") && c.includes("/api/jellyfin/lookup'") && c.includes("/api/jellyfin/status'") && c.includes("/api/jellyfin/library-ids'") && c.includes("/api/jellyfin/sync-downloaded'")) {
  console.log('jellyfin routes: already patched'); return /* was process.exit(0) */;
}

const anchor = "router.get('/api/import-trakttv/state'";
if (!c.includes(anchor)) { console.error('jellyfin routes: anchor not found'); process.exit(1); }

const route =
"router.get('/api/jellyfin/status', validatorHandler({}), _MediaItemController.jellyfinStatus);\n" +
"router.post('/api/jellyfin/sync', validatorHandler({}), _MediaItemController.jellyfinSync);\n" +
"router.get('/api/jellyfin/lookup', validatorHandler({}), _MediaItemController.jellyfinLookup);\n" +
"router.get('/api/jellyfin/library-ids', validatorHandler({}), _MediaItemController.jellyfinLibraryIds);\n" +
"router.post('/api/jellyfin/sync-downloaded', validatorHandler({}), _MediaItemController.jellyfinSyncDownloaded);\n";

c = c.replace(anchor, route + anchor);
fs.writeFileSync(path, c);
console.log('jellyfin routes: added 3 endpoints (status, sync, lookup)');

})();

// ===== patch_jellyfin_frontend.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// _JF: Jellyfin section in /backup. Two modes (view / edit). View shows status badge + sync button.
// Edit shows a form with URL, API key, user id, public URL, reverseSync. The form starts open
// when neither file nor env has any config, and is reachable via "Editar configuración" otherwise.
const compDef = '_JF=function(){' +
  // hooks
  'var _s=r.useState(null),st=_s[0],setSt=_s[1];' +
  'var _g=r.useState(null),cfg=_g[0],setCfg=_g[1];' +
  'var _e=r.useState(false),edit=_e[0],setEdit=_e[1];' +
  'var _f=r.useState({url:"",apiKey:"",userId:"",publicUrl:"",reverseSync:false}),form=_f[0],setForm=_f[1];' +
  'var _b=r.useState(false),busy=_b[0],setBusy=_b[1];' +
  'var _m=r.useState(null),msg=_m[0],setMsg=_m[1];' +
  // data loaders
  'var loadStatus=function(){fetch("/api/jellyfin/status",{credentials:"same-origin"}).then(function(r){return r.json()}).then(setSt).catch(function(e){setSt({error:String(e)})})};' +
  'var loadCfg=function(){fetch("/api/jellyfin/config",{credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){' +
    'setCfg(d);' +
    'setForm({url:d.url||"",apiKey:"",userId:d.userId||"",publicUrl:d.publicUrl||"",reverseSync:!!d.reverseSync});' +
    'if(!d.url&&!d.apiKeySet&&!(d.envFallback&&(d.envFallback.url||d.envFallback.apiKey)))setEdit(true);' +
  '}).catch(function(){})};' +
  'r.useEffect(function(){loadStatus();loadCfg()},[]);' +
  // save handler
  'var save=function(){' +
    'setBusy(true);setMsg({type:"loading",text:"Guardando..."});' +
    'fetch("/api/jellyfin/config",{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}).then(function(r){return r.json()}).then(function(d){' +
      'setBusy(false);' +
      'if(d.error){setMsg({type:"error",text:"Error: "+d.error});return}' +
      'setMsg({type:"success",text:"Configuraci\\u00f3n guardada"});' +
      'setEdit(false);loadStatus();loadCfg();' +
    '}).catch(function(e){setBusy(false);setMsg({type:"error",text:String(e.message||e)})})};' +
  // sync handler
  'var sync=function(){' +
    'setBusy(true);setMsg({type:"loading",text:"Sincronizando con Jellyfin..."});' +
    'fetch("/api/jellyfin/sync",{method:"POST",credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){' +
      'setBusy(false);' +
      'if(d.error){setMsg({type:"error",text:"Error: "+d.error})}' +
      'else{setMsg({type:"success",text:"Importados: "+d.lastImported+" | Saltados: "+d.lastSkipped+" | Sin emparejar: "+d.lastUnmatched+" | Total revisados: "+d.lastTotal});loadStatus()}' +
    '}).catch(function(e){setBusy(false);setMsg({type:"error",text:String(e.message||e)})})};' +
  // loading guard
  'if(!st||!cfg)return r.createElement("p",{className:"text-gray-500"},"Cargando estado de Jellyfin...");' +
  // status badge
  'var statusBadge;' +
  'if(st.configured&&st.connected){' +
    'statusBadge=r.createElement("span",{className:"inline-flex items-center px-2 py-1 rounded bg-green-700 text-white text-sm gap-1"},r.createElement("i",{className:"material-icons text-base"},"check_circle"),"Conectado a "+(st.serverName||"Jellyfin")+(st.version?" v"+st.version:""));' +
  '}else if(st.configured){' +
    'statusBadge=r.createElement("span",{className:"inline-flex items-center px-2 py-1 rounded bg-red-700 text-white text-sm gap-1"},r.createElement("i",{className:"material-icons text-base"},"error"),"Sin conexi\\u00f3n: "+(st.error||"desconocido"));' +
  '}else{' +
    'statusBadge=r.createElement("span",{className:"inline-flex items-center px-2 py-1 rounded bg-gray-600 text-white text-sm gap-1"},r.createElement("i",{className:"material-icons text-base"},"info"),"No configurado");' +
  '}' +
  'var lastSync=st.lastSync?r.createElement("p",{className:"text-sm text-gray-600 dark:text-gray-300"},"\\u00daltima sincronizaci\\u00f3n: "+new Date(st.lastSync).toLocaleString("es")+" \\u2014 importados: "+(st.lastImported||0)+", saltados: "+(st.lastSkipped||0)+", sin emparejar: "+(st.lastUnmatched||0)):null;' +
  // build children
  // (Title is rendered by the `my` settings-card wrapper in patch_credentials_to_tokens.js's
  // _AT_EXT, so we don't repeat it here.)
  'var children=[statusBadge,lastSync];' +
  'if(edit){' +
    // form helpers (input field generator)
    'var inp=function(label,key,type,placeholder){' +
      'return r.createElement("label",{key:key,className:"flex flex-col text-sm gap-1"},' +
        'r.createElement("span",{className:"text-gray-700 dark:text-gray-300"},label),' +
        'r.createElement("input",{type:type||"text",value:form[key],placeholder:placeholder||"",' +
          'onChange:function(e){var nv={};nv[key]=e.target.value;setForm(Object.assign({},form,nv))},' +
          'className:"px-2 py-1 border rounded bg-white dark:bg-gray-800 dark:border-gray-600"})' +
      ')' +
    '};' +
    'children.push(r.createElement("div",{key:"jfForm",className:"flex flex-col gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded"},' +
      'r.createElement("h3",{className:"font-semibold"},"Configuraci\\u00f3n de Jellyfin"),' +
      'inp("URL del servidor (ej. http://jellyfin:8096)","url","url","http://jellyfin:8096"),' +
      'inp("API key"+(cfg.apiKeySet?" (deja vac\\u00edo para mantener la actual)":""),"apiKey","password",cfg.apiKeySet?"\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022":"API key"),' +
      'inp("User ID (opcional, primer usuario por defecto)","userId","text",""),' +
      'inp("URL p\\u00fablica (para el bot\\u00f3n Reproducir en Jellyfin)","publicUrl","url","https://jellyfin.midominio.com"),' +
      'r.createElement("label",{className:"inline-flex items-center gap-2 mt-1"},' +
        'r.createElement("input",{type:"checkbox",checked:!!form.reverseSync,onChange:function(e){setForm(Object.assign({},form,{reverseSync:e.target.checked}))}}),' +
        'r.createElement("span",null,"Reverse-sync (al marcar visto en MT, marcar reproducido en Jellyfin)")' +
      '),' +
      'r.createElement("div",{className:"flex gap-2 mt-2"},' +
        'r.createElement("button",{onClick:save,disabled:busy,className:"px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-gray-500 text-white rounded inline-flex items-center gap-2"},' +
          'r.createElement("i",{className:"material-icons"},"save"),' +
          'busy?"Guardando...":"Guardar"' +
        '),' +
        '(st.configured||cfg.apiKeySet)?r.createElement("button",{onClick:function(){setEdit(false);setMsg(null);loadCfg()},className:"px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded"},"Cancelar"):null' +
      ')' +
    '));' +
  '}else{' +
    'children.push(r.createElement("div",{key:"jfActions",className:"flex gap-2 flex-wrap"},' +
      'r.createElement("button",{onClick:sync,disabled:busy||!st.connected,className:"px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded shadow inline-flex items-center gap-2"},' +
        'r.createElement("i",{className:"material-icons"},busy?"hourglass_top":"sync"),' +
        'busy?"Sincronizando...":"Sincronizar ahora"' +
      '),' +
      'r.createElement("button",{onClick:function(){setEdit(true)},className:"px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded inline-flex items-center gap-2"},' +
        'r.createElement("i",{className:"material-icons text-base"},"edit"),' +
        '"Editar configuraci\\u00f3n"' +
      ')' +
    '));' +
  '}' +
  'if(msg)children.push(r.createElement("div",{key:"jfMsg",className:"p-3 rounded text-white "+(msg.type==="success"?"bg-green-700":msg.type==="error"?"bg-red-700":"bg-blue-700")},msg.text));' +
  'children.push(r.createElement("p",{key:"jfHelp",className:"text-xs text-gray-500 mt-2"},"Empareja por TMDB/IMDB/TVDB id. Pel\\u00edculas vistas y episodios marcados como reproducidos en Jellyfin se importan al hist\\u00f3rico de MediaTracker."));' +
  'return r.createElement("div",{className:"flex flex-col gap-3"},children)' +
'},';

// Replace any prior _JF definition. The previous patch ended _JF=function(){...} with a
// trailing "})," — we use a fence comment to keep this idempotent across revisions.
if (c.includes('_JF=function(){')) {
  // Find the start of _JF and walk braces to find its end (the comma after the closing })
  const start = c.indexOf('_JF=function(){');
  let i = c.indexOf('{', start);
  let depth = 1;
  i++;
  while (i < c.length && depth > 0) {
    const ch = c[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '"' || ch === "'") {
      // Skip string literal
      const q = ch;
      i++;
      while (i < c.length && c[i] !== q) {
        if (c[i] === '\\') i++;
        i++;
      }
    }
    i++;
  }
  // i now points just past the closing }; expect ","
  while (i < c.length && c[i] !== ',') i++;
  if (i < c.length) i++; // consume the comma
  c = c.slice(0, start) + compDef + c.slice(i);
  console.log('jellyfin frontend: replaced existing _JF with config-form variant');
} else {
  const cardAnchor = '_v=function(e){';
  if (!c.includes(cardAnchor)) { console.error('jellyfin frontend: _v anchor not found'); process.exit(1); }
  c = c.replace(cardAnchor, compDef + cardAnchor);
  console.log('jellyfin frontend: injected _JF component (config-form variant)');
}

// _JF used to be mounted inside _BK (the Backup page). It now lives in
// /settings/application-tokens via patch_credentials_to_tokens.js — the
// component definition above is enough; no _BK mount needed.

fs.writeFileSync(bundlePath, c);
console.log('jellyfin frontend: complete');

})();

// ===== patch_jellyfin_play_button.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// 1. Inject _JFP (Jellyfin Play) component as a comma-separated declarator before _v
const compDef = '_JFP=function(e){' +
  'var t=e.mediaItem;' +
  'var _r=r.useState(null),_res=_r[0],_set=_r[1];' +
  'r.useEffect(function(){' +
    'if(!t||!t.id){return}' +
    'var p=[];' +
    'if(t.tmdbId)p.push("tmdbId="+t.tmdbId);' +
    'if(t.imdbId)p.push("imdbId="+encodeURIComponent(t.imdbId));' +
    'if(t.tvdbId)p.push("tvdbId="+t.tvdbId);' +
    'if(t.mediaType)p.push("mediaType="+encodeURIComponent(t.mediaType));' +
    'if(p.length===0){_set({found:false});return}' +
    'fetch("/api/jellyfin/lookup?"+p.join("&"),{credentials:"same-origin"})' +
      '.then(function(r){return r.json()})' +
      '.then(_set)' +
      '.catch(function(){_set({found:false})})' +
  '},[t&&t.id]);' +
  'if(!_res||!_res.found)return null;' +
  'return r.createElement("a",{' +
    'href:_res.deeplink,' +
    'target:"_blank",' +
    'rel:"noopener noreferrer",' +
    'className:"inline-flex items-center gap-2 px-4 py-2 mt-3 bg-purple-700 hover:bg-purple-800 text-white rounded shadow w-fit"' +
  '},' +
    'r.createElement("i",{className:"material-icons"},"play_circle"),' +
    'xo._("Play in Jellyfin")' +
  ')' +
'},';

const cardAnchor = '_v=function(e){';
if (c.includes('_JFP=function(e){var t=e.mediaItem;var _r=r.useState')) {
  console.log('jellyfin play: _JFP already injected');
} else if (!c.includes(cardAnchor)) {
  console.error('jellyfin play: _v anchor not found'); process.exit(1);
} else {
  c = c.replace(cardAnchor, compDef + cardAnchor);
  console.log('jellyfin play: injected _JFP component');
}

// 2. Mount on detail page (right after rating section, just like _LK)
// Same anchor as patch_links_frontend.js. Inject AFTER detailAnchor and BEFORE _LK so order is:
// rating → Jellyfin button → Links section
const detailAnchor = '(Wo(a)||!No(a))&&r.createElement(Zp,{userRating:a.userRating,mediaItem:a})';
const detailPatched = detailAnchor + ',r.createElement(_JFP,{mediaItem:a})';
if (c.includes(',r.createElement(_JFP,{mediaItem:a})')) {
  console.log('jellyfin play: already mounted in detail');
} else if (!c.includes(detailAnchor)) {
  console.error('jellyfin play: detail anchor not found'); process.exit(1);
} else {
  c = c.replace(detailAnchor, detailPatched);
  console.log('jellyfin play: added _JFP to detail page');
}

fs.writeFileSync(bundlePath, c);
console.log('jellyfin play: complete');

})();

// ===== patch_jellyfin_card_badge.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// 1. Inject _JFB (Jellyfin Badge) + _JFLLib helper before _v card declarator
const compDef =
  '_JFLLib=function(){' +
    'if(window.__jfLib)return Promise.resolve(window.__jfLib);' +
    'if(window.__jfLibPromise)return window.__jfLibPromise;' +
    'try{' +
      'var _last=Number(localStorage.getItem("jfSyncDownloadedAt"))||0;' +
      'if(Date.now()-_last>3600000){' +
        'fetch("/api/jellyfin/sync-downloaded",{method:"POST",credentials:"same-origin"})' +
          '.then(function(){localStorage.setItem("jfSyncDownloadedAt",String(Date.now()))})' +
          '.catch(function(){});' +
      '}' +
    '}catch(e){}' +
    'window.__jfLibPromise=fetch("/api/jellyfin/library-ids",{credentials:"same-origin"})' +
      '.then(function(r){return r.json()})' +
      '.then(function(d){window.__jfLib={tmdb:new Set(d.tmdb||[]),imdb:new Set(d.imdb||[]),tvdb:new Set(d.tvdb||[])};return window.__jfLib})' +
      '.catch(function(){window.__jfLib={tmdb:new Set(),imdb:new Set(),tvdb:new Set()};return window.__jfLib});' +
    'return window.__jfLibPromise' +
  '},' +
  '_JFB=function(props){' +
    'var t=props.item;' +
    'var s=r.useState(false),inJ=s[0],setInJ=s[1];' +
    'r.useEffect(function(){' +
      '_JFLLib().then(function(lib){' +
        'var hit=(t.tmdbId&&lib.tmdb.has(String(t.tmdbId)))||' +
                '(t.imdbId&&lib.imdb.has(String(t.imdbId)))||' +
                '(t.tvdbId&&lib.tvdb.has(String(t.tvdbId)));' +
        'if(hit)setInJ(true)' +
      '})' +
    '},[t.id]);' +
    'if(!inJ)return null;' +
    'return r.createElement("div",{className:"absolute pointer-events-auto",style:{top:"50%",left:"4px",transform:"translateY(-50%)"}},' +
      'r.createElement("span",{' +
        'className:"flex material-icons",' +
        'style:{color:"#a855f7",fontSize:"1.75rem",textShadow:"0 0 4px rgba(0,0,0,0.9)"},' +
        'title:xo._("Available on Jellyfin")' +
      '},"play_circle")' +
    ')' +
  '},';

const cardAnchor = '_v=function(e){';
if (c.includes('_JFB=function(props){var t=props.item')) {
  console.log('jellyfin card badge: _JFB already injected');
} else if (!c.includes(cardAnchor)) {
  console.error('jellyfin card badge: _v anchor not found'); process.exit(1);
} else {
  c = c.replace(cardAnchor, compDef + cardAnchor);
  console.log('jellyfin card badge: injected _JFB + _JFLLib');
}

// 2. Mount _JFB on each card. Anchor: the watchlist toggle that's at bottom-1 left-1.
// We inject the badge BEFORE it so it renders into the same children array.
const mountAnchor = 'm&&Wo(t)&&r.createElement("div",{className:"absolute pointer-events-auto bottom-1 left-1"}';
const mountPatched = 'r.createElement(_JFB,{item:t}),' + mountAnchor;
if (c.includes('r.createElement(_JFB,{item:t}),')) {
  console.log('jellyfin card badge: badge already mounted');
} else if (!c.includes(mountAnchor)) {
  console.error('jellyfin card badge: card mount anchor not found'); process.exit(1);
} else {
  c = c.replace(mountAnchor, mountPatched);
  console.log('jellyfin card badge: mounted _JFB on cards');
}

fs.writeFileSync(bundlePath, c);
console.log('jellyfin card badge: complete');

})();

// ===== patch_jellyfin_reverse.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/seen.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('_jfPushPlayed')) { console.log('jellyfin reverse: already patched'); return /* was process.exit(0) */; }

// Helper inserted at the top of the file (after the export). Reads env vars and
// fire-and-forgets a Jellyfin /PlayedItems POST when an MT seen entry is added.
const helper = "\n" +
"// --- Jellyfin reverse-sync helper (MT seen → Jellyfin played) ---\n" +
"async function _jfPushPlayed(mediaItem, episode) {\n" +
"  if (process.env.JELLYFIN_REVERSE_SYNC !== 'true') return;\n" +
"  const url = process.env.JELLYFIN_URL;\n" +
"  const token = process.env.JELLYFIN_API_KEY;\n" +
"  if (!url || !token) return;\n" +
"  try {\n" +
"    const base = url.replace(/\\/+$/, '');\n" +
"    const headers = { 'X-Emby-Token': token, 'Accept': 'application/json' };\n" +
"    let userId = process.env.JELLYFIN_USER_ID;\n" +
"    if (!userId) {\n" +
"      const ru = await fetch(base + '/Users', { headers });\n" +
"      if (!ru.ok) return;\n" +
"      const users = await ru.json();\n" +
"      userId = users && users[0] && users[0].Id;\n" +
"      if (!userId) return;\n" +
"    }\n" +
"    // Jellyfin's AnyProviderIdEquals is broken on 10.10.x — list all items of the\n" +
"    // right type and filter client-side (cached in memory for 5 min).\n" +
"    if (!global._jfReverseCache) global._jfReverseCache = new Map();\n" +
"    const cacheKey = userId + ':' + (episode ? 'Series' : 'Movie');\n" +
"    let entry = global._jfReverseCache.get(cacheKey);\n" +
"    if (!entry || (Date.now() - entry.at) > 5 * 60 * 1000) {\n" +
"      const types = episode ? 'Series' : 'Movie';\n" +
"      const lr = await fetch(base + '/Users/' + userId + '/Items?Recursive=true&IncludeItemTypes=' + types + '&Fields=ProviderIds&Limit=10000', { headers });\n" +
"      if (!lr.ok) return;\n" +
"      const lj = await lr.json();\n" +
"      entry = { at: Date.now(), items: lj.Items || [] };\n" +
"      global._jfReverseCache.set(cacheKey, entry); if (global._jfReverseCache.size > 1000) global._jfReverseCache.delete(global._jfReverseCache.keys().next().value);\n" +
"    }\n" +
"    let target = null;\n" +
"    const matched = entry.items.find(it => {\n" +
"      const p = it.ProviderIds || {};\n" +
"      if (mediaItem.tmdbId && p.Tmdb && String(p.Tmdb) === String(mediaItem.tmdbId)) return true;\n" +
"      if (mediaItem.imdbId && p.Imdb && String(p.Imdb) === String(mediaItem.imdbId)) return true;\n" +
"      if (episode && mediaItem.tvdbId && p.Tvdb && String(p.Tvdb) === String(mediaItem.tvdbId)) return true;\n" +
"      return false;\n" +
"    });\n" +
"    if (!matched) return;\n" +
"    if (episode) {\n" +
"      const eq = '/Users/' + userId + '/Items?Recursive=true&IncludeItemTypes=Episode&ParentId=' + matched.Id + '&ParentIndexNumber=' + episode.seasonNumber + '&IndexNumber=' + episode.episodeNumber + '&Limit=1';\n" +
"      const er = await fetch(base + eq, { headers });\n" +
"      if (!er.ok) return;\n" +
"      const ej = await er.json();\n" +
"      target = ej.Items && ej.Items[0];\n" +
"    } else {\n" +
"      target = matched;\n" +
"    }\n" +
"    if (!target) return;\n" +
"    await fetch(base + '/Users/' + userId + '/PlayedItems/' + target.Id, { method: 'POST', headers });\n" +
"  } catch (_) {}\n" +
"}\n";

const headerAnchor = 'exports.SeenController = void 0;';
if (!c.includes(headerAnchor)) { console.error('jellyfin reverse: header anchor not found'); process.exit(1); }
c = c.replace(headerAnchor, headerAnchor + helper);

// Hook in the addSingleSeen handler — fire-and-forget after the transaction
const txAnchor = '    });\n    res.status(200);';
const occurrences = c.split(txAnchor).length - 1;
if (occurrences !== 1) { console.error('jellyfin reverse: tx anchor count = ' + occurrences + ' (expected 1)'); process.exit(1); }
const txPatched = '    });\n    _jfPushPlayed(mediaItem, episode);\n    res.status(200);';
c = c.replace(txAnchor, txPatched);

fs.writeFileSync(path, c);
console.log('jellyfin reverse: helper installed + addSingleSeen hooked (env JELLYFIN_REVERSE_SYNC=true to enable)');

})();

// ===== patch_jellyfin_admin_only.js =====
;(() => {
const fs = require('fs');

// 1. Item controller — gate the 5 jellyfin endpoints behind an admin check
{
  const path = '/app/build/controllers/item.js';
  let c = fs.readFileSync(path, 'utf8');

  // Helper: returns true iff the caller is an admin in MT's user table.
  // Check the *definition* pattern, not the bare name — earlier patches that
  // call `this.jellyfinIsAdmin(...)` would otherwise short-circuit this guard
  // and leave the helper undefined (every gated endpoint throws TypeError).
  if (!c.includes('jellyfinIsAdmin = async')) {
    const helper =
      "  jellyfinIsAdmin = async (req, res) => {\n" +
      "    const userId = Number(req.user);\n" +
      "    if (!userId) { res.status(401).json({ error: 'login required' }); return false; }\n" +
      "    const u = await _dbconfig.Database.knex('user').where('id', userId).first();\n" +
      "    if (!u || !u.admin) { res.status(403).json({ error: 'admin only' }); return false; }\n" +
      "    return true;\n" +
      "  };\n";
    c = c.replace('  jellyfinFetch = async', helper + '  jellyfinFetch = async');
  }

  // Inject the check at the top of each createExpressRoute body for the JF endpoints.
  const targets = ['jellyfinStatus', 'jellyfinSync', 'jellyfinSyncDownloaded', 'jellyfinLookup', 'jellyfinLibraryIds'];
  for (const name of targets) {
    const pat = new RegExp('(' + name + ' = \\(0, _typescriptRoutesToOpenapiServer\\.createExpressRoute\\)\\(async \\(req, res\\) => \\{\\n)(?!    if \\(!\\(await this\\.jellyfinIsAdmin)', 'g');
    c = c.replace(pat, '$1    if (!(await this.jellyfinIsAdmin(req, res))) return;\n');
  }

  fs.writeFileSync(path, c);
  console.log('jellyfin admin-only: gated 5 endpoints in item.js');
}

// 2. Seen controller — reverse-sync helper should only fire for admin MT users
{
  const path = '/app/build/controllers/seen.js';
  let c = fs.readFileSync(path, 'utf8');

  // Update the call site: pass userId so the helper can check admin
  if (!c.includes('_jfPushPlayed(mediaItem, episode, userId)')) {
    c = c.replace('_jfPushPlayed(mediaItem, episode);', '_jfPushPlayed(mediaItem, episode, userId);');
  }
  // Update the helper signature + add admin check
  if (!c.includes('// _jfPushPlayed admin-gated')) {
    const oldSig = 'async function _jfPushPlayed(mediaItem, episode) {';
    const newSig = 'async function _jfPushPlayed(mediaItem, episode, userId) { // _jfPushPlayed admin-gated\n' +
      "  try {\n" +
      "    const u = await _dbconfig.Database.knex('user').where('id', userId).first();\n" +
      "    if (!u || !u.admin) return;\n" +
      "  } catch (_) { return; }";
    c = c.replace(oldSig, newSig);
  }
  fs.writeFileSync(path, c);
  console.log('jellyfin admin-only: reverse-sync gated to admin users');
}

})();

// ===== patch_jellyfin_runtime_config.js =====
;(() => {
const fs = require('fs');

// === 1. item.js: install _jfCfg helper, replace env reads, add config GET/PUT methods ===
{
  const p = '/app/build/controllers/item.js';
  let c = fs.readFileSync(p, 'utf8');

  // Replace env reads with helper calls FIRST, then inject the helper. Doing it
  // in the other order would also rewrite `process.env.JELLYFIN_URL` *inside*
  // the helper itself → infinite recursion (the v0.1.7 bug). The helper aliases
  // `process.env` as `_e` so the regex below also can't match its body on re-runs.
  c = c.replace(/process\.env\.JELLYFIN_API_KEY/g, '_jfCfg().apiKey');
  c = c.replace(/process\.env\.JELLYFIN_URL/g, '_jfCfg().url');
  c = c.replace(/process\.env\.JELLYFIN_USER_ID/g, '_jfCfg().userId');
  c = c.replace(/process\.env\.JELLYFIN_PUBLIC_URL/g, '_jfCfg().publicUrl');

  if (!c.includes('function _jfCfg()')) {
    // Sync read of /storage/jellyfin-config.json on each call. File overrides env.
    // No caching — file is tiny and write-frequency is essentially zero.
    // publicUrl is normalized to .origin so any stray /web/, /#/home.html etc.
    // pasted from a browser address bar can't poison the deeplink string.
    const helper =
      "\nfunction _jfCfg() {\n" +
      "  const _e = process.env;\n" +
      "  let f = {};\n" +
      "  try { f = JSON.parse(require('fs').readFileSync('/storage/jellyfin-config.json', 'utf8')); } catch (_) {}\n" +
      "  const _norm = function(u){ try { return u ? new URL(u).origin : ''; } catch (_) { return u || ''; } };\n" +
      "  return {\n" +
      "    url: f.url || _e.JELLYFIN_URL || '',\n" +
      "    apiKey: f.apiKey || _e.JELLYFIN_API_KEY || '',\n" +
      "    userId: f.userId || _e.JELLYFIN_USER_ID || '',\n" +
      "    publicUrl: _norm(f.publicUrl || _e.JELLYFIN_PUBLIC_URL),\n" +
      "    reverseSync: (f.reverseSync !== undefined ? !!f.reverseSync : _e.JELLYFIN_REVERSE_SYNC === 'true'),\n" +
      "  };\n" +
      "}\n";
    const classAnchor = 'class MediaItemController';
    if (!c.includes(classAnchor)) { console.error('jellyfin runtime config: class anchor not found in item.js'); process.exit(1); }
    c = c.replace(classAnchor, helper + '\n' + classAnchor);
  }

  // Add jellyfinGetConfig / jellyfinSaveConfig methods. Both admin-gated via jellyfinIsAdmin
  // (installed by patch_jellyfin_admin_only.js, which must run before this patch).
  if (!c.includes('jellyfinGetConfig =')) {
    const cfgMethods =
      "  jellyfinGetConfig = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
      "    if (!(await this.jellyfinIsAdmin(req, res))) return;\n" +
      "    const fs = require('fs');\n" +
      "    let f = {};\n" +
      "    try { f = JSON.parse(fs.readFileSync('/storage/jellyfin-config.json', 'utf8')); } catch (_) {}\n" +
      "    res.json({\n" +
      "      url: f.url || '',\n" +
      "      apiKey: '',\n" +
      "      apiKeySet: !!f.apiKey,\n" +
      "      userId: f.userId || '',\n" +
      "      publicUrl: f.publicUrl || '',\n" +
      "      reverseSync: !!f.reverseSync,\n" +
      "      envFallback: { url: !!process.env.JELLYFIN_URL, apiKey: !!process.env.JELLYFIN_API_KEY, userId: !!process.env.JELLYFIN_USER_ID, publicUrl: !!process.env.JELLYFIN_PUBLIC_URL }\n" +
      "    });\n" +
      "  });\n" +
      "  jellyfinSaveConfig = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n" +
      "    if (!(await this.jellyfinIsAdmin(req, res))) return;\n" +
      "    const fs = require('fs');\n" +
      "    const body = req.body || {};\n" +
      "    let current = {};\n" +
      "    try { current = JSON.parse(fs.readFileSync('/storage/jellyfin-config.json', 'utf8')); } catch (_) {}\n" +
      "    // Normalize publicUrl to origin only — strips any /web/, /#/..., trailing\n" +
      "    // path/hash so the deeplink concatenation in jellyfinLookup can't be poisoned\n" +
      "    // by a value pasted straight from the JF address bar.\n" +
      "    const _normOrigin = function(u){ try { return u ? new URL(u).origin : ''; } catch (_) { return String(u || '').trim(); } };\n" +
      "    // apiKey: empty string means 'leave existing'; explicit null means 'clear'.\n" +
      "    const merged = {\n" +
      "      url: body.url !== undefined ? String(body.url || '').trim() : (current.url || ''),\n" +
      "      apiKey: body.apiKey === null ? '' : (body.apiKey ? String(body.apiKey).trim() : (current.apiKey || '')),\n" +
      "      userId: body.userId !== undefined ? String(body.userId || '').trim() : (current.userId || ''),\n" +
      "      publicUrl: body.publicUrl !== undefined ? _normOrigin(String(body.publicUrl || '').trim()) : (current.publicUrl || ''),\n" +
      "      reverseSync: body.reverseSync !== undefined ? !!body.reverseSync : !!current.reverseSync,\n" +
      "    };\n" +
      "    try { fs.writeFileSync('/storage/jellyfin-config.json', JSON.stringify(merged, null, 2), { mode: 0o600 }); }\n" +
      "    catch (e) { res.status(500).json({ error: e.message }); return; }\n" +
      "    if (global._jfLookupCache) global._jfLookupCache.clear();\n" +
      "    if (global._jfLibCache) global._jfLibCache.clear();\n" +
      "    if (global._jfReverseCache) global._jfReverseCache.clear();\n" +
      "    res.json({ ok: true });\n" +
      "  });\n";
    c = c.replace('  jellyfinFetch = async', cfgMethods + '  jellyfinFetch = async');
  }

  fs.writeFileSync(p, c);
  console.log('jellyfin runtime config: item.js patched');
}

// === 2. seen.js: install _jfCfg helper and replace env reads in reverse-sync path ===
{
  const p = '/app/build/controllers/seen.js';
  let c = fs.readFileSync(p, 'utf8');

  // Same ordering as item.js: rewrite env reads first, then inject the helper
  // (which uses the `_e` alias so its own body never matches the regex).
  c = c.replace("if (process.env.JELLYFIN_REVERSE_SYNC !== 'true') return;", "if (!_jfCfg().reverseSync) return;");
  c = c.replace(/process\.env\.JELLYFIN_API_KEY/g, '_jfCfg().apiKey');
  c = c.replace(/process\.env\.JELLYFIN_URL/g, '_jfCfg().url');
  c = c.replace(/process\.env\.JELLYFIN_USER_ID/g, '_jfCfg().userId');
  c = c.replace(/process\.env\.JELLYFIN_PUBLIC_URL/g, '_jfCfg().publicUrl');

  if (!c.includes('function _jfCfg()')) {
    const helper =
      "\nfunction _jfCfg() {\n" +
      "  const _e = process.env;\n" +
      "  let f = {};\n" +
      "  try { f = JSON.parse(require('fs').readFileSync('/storage/jellyfin-config.json', 'utf8')); } catch (_) {}\n" +
      "  const _norm = function(u){ try { return u ? new URL(u).origin : ''; } catch (_) { return u || ''; } };\n" +
      "  return {\n" +
      "    url: f.url || _e.JELLYFIN_URL || '',\n" +
      "    apiKey: f.apiKey || _e.JELLYFIN_API_KEY || '',\n" +
      "    userId: f.userId || _e.JELLYFIN_USER_ID || '',\n" +
      "    publicUrl: _norm(f.publicUrl || _e.JELLYFIN_PUBLIC_URL),\n" +
      "    reverseSync: (f.reverseSync !== undefined ? !!f.reverseSync : _e.JELLYFIN_REVERSE_SYNC === 'true'),\n" +
      "  };\n" +
      "}\n";
    const anchor = 'exports.SeenController = void 0;';
    if (!c.includes(anchor)) { console.error('jellyfin runtime config: seen.js anchor not found'); process.exit(1); }
    c = c.replace(anchor, anchor + helper);
  }

  fs.writeFileSync(p, c);
  console.log('jellyfin runtime config: seen.js patched');
}

// === 3. routes.js: register /api/jellyfin/config GET + PUT ===
{
  const p = '/app/build/generated/routes/routes.js';
  let c = fs.readFileSync(p, 'utf8');

  if (c.includes("/api/jellyfin/config'")) {
    console.log('jellyfin runtime config: routes already registered');
  } else {
    const anchor = "router.get('/api/jellyfin/status'";
    if (!c.includes(anchor)) { console.error('jellyfin runtime config: routes anchor not found'); process.exit(1); }
    const route =
      "router.get('/api/jellyfin/config', validatorHandler({}), _MediaItemController.jellyfinGetConfig);\n" +
      "router.put('/api/jellyfin/config', validatorHandler({}), _MediaItemController.jellyfinSaveConfig);\n";
    c = c.replace(anchor, route + anchor);
    fs.writeFileSync(p, c);
    console.log('jellyfin runtime config: routes registered');
  }
}

})();

// ===== patch_admin_only_endpoints.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/item.js';
let c = fs.readFileSync(path, 'utf8');

// Gate backup, restore, import, export, dupes, cleanup endpoints to admin users only.
// Without this, a non-admin user could download the full data.db (other users' data leak)
// or wipe/import data globally.
//
// Reuses jellyfinIsAdmin helper installed by patch_jellyfin_admin_only.js.
// Idempotent: only injects the check at the top of each handler if not already present.

const targets = [
  'downloadBackup', 'exportJson', 'importJson', 'exportLetterboxd', 'restoreBackup',
  'cleanupCatalog', 'findDupes', 'mergeDupes',
];

let count = 0;
for (const name of targets) {
  const pat = new RegExp('(' + name + ' = \\(0, _typescriptRoutesToOpenapiServer\\.createExpressRoute\\)\\(async \\(req, res\\) => \\{\\n)(?!    if \\(!\\(await this\\.jellyfinIsAdmin)', 'g');
  const before = c;
  c = c.replace(pat, '$1    if (!(await this.jellyfinIsAdmin(req, res))) return;\n');
  if (c !== before) count++;
}

fs.writeFileSync(path, c);
console.log('admin-only endpoints: gated ' + count + ' of ' + targets.length + ' endpoints (idempotent re-runs leave already-gated ones alone)');

})();

// ===== patch_user_byid_gate.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/users.js';
let c = fs.readFileSync(path, 'utf8');

// /api/user/:userId leaks {id, name} of any user to any logged-in user — letting
// non-admins enumerate the user list. Tighten: only allow if the requested userId
// matches the current user, OR the current user is admin. Otherwise 403.

if (c.includes('// userByIdGate')) { console.log('user byid gate: already patched'); return /* was process.exit(0) */; }

const old = "  getById = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n    const {\n      userId\n    } = req.params;\n    const user = await _user2.userRepository.findOne({\n      id: userId\n    });";
const fresh = "  getById = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n    const {\n      userId\n    } = req.params;\n    // userByIdGate: prevent enumeration of other users' identities by non-admins.\n    const _reqUserId = Number(req.user);\n    const _me = await _user2.userRepository.findOne({ id: _reqUserId });\n    if (Number(userId) !== _reqUserId && !(_me && _me.admin)) {\n      res.sendStatus(403); return;\n    }\n    const user = await _user2.userRepository.findOne({\n      id: userId\n    });";

if (!c.includes(old)) { console.error('user byid gate: anchor not found'); process.exit(1); }
c = c.replace(old, fresh);
fs.writeFileSync(path, c);
console.log('user byid gate: /api/user/:userId now gated to self-or-admin');

})();

// ===== patch_seen_delete_idor.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/seen.js';
let c = fs.readFileSync(path, 'utf8');

// IDOR: DELETE /api/seen/:seenId deleted by primary key with no ownership check,
// letting any logged-in user wipe another user's seen rows. Add a check that the
// seen row's userId matches req.user before deleting (or that req.user is admin).

if (c.includes('// seenDeleteIdorGate')) { console.log('seen delete idor: already patched'); return /* was process.exit(0) */; }

const old = "  deleteById = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n    const {\n      seenId\n    } = req.params;\n    await _seen.seenRepository.delete({\n      id: seenId\n    });\n    res.send();\n  });";
const fresh = "  deleteById = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {\n    const {\n      seenId\n    } = req.params;\n    // seenDeleteIdorGate: only the row's owner (or an admin) can delete it.\n    const _knex = require('../dbconfig').Database.knex;\n    const _row = await _knex('seen').where('id', seenId).first();\n    if (!_row) { res.sendStatus(404); return; }\n    const _reqUserId = Number(req.user);\n    const _me = await _knex('user').where('id', _reqUserId).first();\n    if (_row.userId !== _reqUserId && !(_me && _me.admin)) { res.sendStatus(403); return; }\n    await _seen.seenRepository.delete({\n      id: seenId\n    });\n    res.send();\n  });";

if (!c.includes(old)) { console.error('seen delete idor: anchor not found'); process.exit(1); }
c = c.replace(old, fresh);
fs.writeFileSync(path, c);
console.log('seen delete idor: DELETE /api/seen/:seenId now requires ownership or admin');

})();

// ===== patch_watchlist_autoremove.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/seen.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('_removeFromWatchlistIfComplete')) { console.log('watchlist auto-remove: already patched'); return /* was process.exit(0) */; }

// Helper at module top: delete from watchlist when an item is "complete".
// - Non-tv: complete after any seen entry
// - TV: complete only when no unwatched non-special aired episodes remain
const helper = "\n" +
"async function _removeFromWatchlistIfComplete(userId, mediaItem) {\n" +
"  try {\n" +
"    const knex = _dbconfig.Database.knex;\n" +
"    let isComplete = false;\n" +
"    if (mediaItem.mediaType !== 'tv') {\n" +
"      isComplete = true;\n" +
"    } else {\n" +
"      const today = new Date().toISOString().slice(0, 10);\n" +
"      const unwatched = await knex('episode')\n" +
"        .where('episode.tvShowId', mediaItem.id)\n" +
"        .where('episode.isSpecialEpisode', false)\n" +
"        .whereNotNull('episode.releaseDate')\n" +
"        .where('episode.releaseDate', '<=', today)\n" +
"        .whereNotExists(function() { this.from('seen').whereRaw('seen.episodeId = episode.id').where('seen.userId', userId); })\n" +
"        .count('* as c').first();\n" +
"      isComplete = (Number(unwatched && unwatched.c) || 0) === 0;\n" +
"    }\n" +
"    if (!isComplete) return;\n" +
"    await knex('listItem')\n" +
"      .whereIn('listId', knex('list').select('id').where({ userId, isWatchlist: true }))\n" +
"      .where('mediaItemId', mediaItem.id)\n" +
"      .whereNull('seasonId')\n" +
"      .whereNull('episodeId')\n" +
"      .delete();\n" +
"  } catch (_) { /* fire-and-forget */ }\n" +
"}\n";

const headerAnchor = 'exports.SeenController = void 0;';
if (!c.includes(headerAnchor)) { console.error('watchlist auto-remove: header anchor not found'); process.exit(1); }
c = c.replace(headerAnchor, headerAnchor + helper);

// Hook into addSingleSeen — after the seen insert, fire the watchlist cleanup
const txAnchor = '    });\n    _jfPushPlayed(mediaItem, episode, userId);\n    res.status(200);';
const txPatched = '    });\n    _jfPushPlayed(mediaItem, episode, userId);\n    _removeFromWatchlistIfComplete(userId, mediaItem);\n    res.status(200);';
if (!c.includes(txAnchor)) { console.error('watchlist auto-remove: tx anchor not found'); process.exit(1); }
c = c.replace(txAnchor, txPatched);

fs.writeFileSync(path, c);
console.log('watchlist auto-remove: hooked into addSingleSeen');

})();

// ===== patch_about_thanks.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

const NEW_NAME = 'MediaTOC';
const TAGLINE = 'media tracker for the obsessively organised';

const fresh = 'Wy=function(){var e=Ap().configuration;return r.createElement(r.Fragment,null,' +
  'r.createElement("div",null,' +
    'r.createElement("strong",null,"' + NEW_NAME + '"),' +
    '" v",e.version,' +
    'r.createElement("span",{style:{marginLeft:"0.75rem",fontSize:"0.85em",color:"#888",fontStyle:"italic"}},"' + TAGLINE + '")' +
  '),' +
  'r.createElement("div",{style:{marginTop:"1.5rem",fontSize:"0.9em",color:"#888"}},' +
    'r.createElement("a",{href:"https://github.com/javimentallab/mediatoc",target:"_blank",rel:"noopener noreferrer",className:"underline"},"github.com/javimentallab/mediatoc")' +
  ')' +
')}';

// Idempotency check: bundle already has the current "v"+version + new tagline form
if (c.includes('"MediaTOC"') && c.includes('" v",e.version') && c.includes('"' + TAGLINE + '"')) {
  console.log('about thanks: already injected (current version)');
  return /* was process.exit(0) */;
}

// Replace any existing Wy=function block (patched or unpatched) with the fresh one.
// Anchor end on the next minified declaration `,Ny=function` to avoid greedy/short-match drift.
const re = /Wy=function\(\)\{var e=Ap\(\)\.configuration;return r\.createElement\(r\.Fragment,null,[^]*?\}(?=,Ny=function)/;
const m = c.match(re);
if (!m) { console.error('about thanks: anchor not found'); process.exit(1); }
c = c.replace(re, fresh);
fs.writeFileSync(bundlePath, c);
console.log('about thanks: rewrote /about page (' + m[0].length + ' → ' + fresh.length + ' bytes)');

})();

// ===== patch_youtube_controller.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/item.js';
let c = fs.readFileSync(path, 'utf8');

// Strip prior versions for idempotent re-applies
['youtubeChannels','youtubeAddChannel','youtubeDeleteChannel','youtubeFeed'].forEach(name => {
  const re = new RegExp('  ' + name + ' = \\(0, _typescriptRoutesToOpenapiServer\\.createExpressRoute\\)\\(async \\(req, res\\) => \\{[\\s\\S]*?\\}\\);\\n', 'g');
  c = c.replace(re, '');
});

const method = `  youtubeChannels = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const fs = require('fs').promises;
    const userId = Number(req.user);
    const file = '/storage/youtube-' + userId + '.json';
    let data = { channels: [] };
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) {}
    res.json(data.channels || []);
  });
  youtubeAddChannel = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const fs = require('fs').promises;
    const userId = Number(req.user);
    const file = '/storage/youtube-' + userId + '.json';
    const input = (req.body && req.body.input || '').trim();
    if (!input) { res.status(400).json({ error: 'input requerido' }); return; }
    // Resolve to channel ID + name
    let channelId = null, name = null;
    const m = input.match(/(?:channel\\/)?(UC[A-Za-z0-9_-]{20,24})/);
    if (m) channelId = m[1];
    if (!channelId) {
      // Try to resolve @handle or username via fetch.
      // SSRF mitigation: only allow URLs to youtube.com/youtu.be — otherwise an attacker
      // could pivot to internal services on the docker network (http://jellyfin:8096, etc.)
      let url = input;
      if (!url.startsWith('http')) {
        if (url.startsWith('@')) url = 'https://www.youtube.com/' + url;
        else url = 'https://www.youtube.com/@' + url;
      } else {
        try {
          const u = new URL(url);
          const host = u.hostname.toLowerCase();
          const allowed = host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com' || host === 'youtu.be';
          if (!allowed || u.protocol !== 'https:') {
            res.status(400).json({ error: 'Solo se aceptan URLs de youtube.com / youtu.be' }); return;
          }
        } catch (_) {
          res.status(400).json({ error: 'URL inválida' }); return;
        }
      }
      let fetchStatus = null;
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        fetchStatus = r.status;
        const html = await r.text();
        // Prefer the canonical link (always points to the page's own channel)
        const canon = html.match(/<link rel="canonical" href="https?:\\/\\/www\\.youtube\\.com\\/channel\\/(UC[A-Za-z0-9_-]{20,24})"/);
        if (canon) channelId = canon[1];
        if (!channelId) {
          const cm = html.match(/"externalId":"(UC[A-Za-z0-9_-]{20,24})"/);
          if (cm) channelId = cm[1];
        }
        const tm = html.match(/<title>([^<]+) - YouTube<\\/title>/);
        if (tm) name = tm[1];
      } catch (_) {}
      if (!channelId && fetchStatus === 404) {
        res.status(404).json({ error: 'El canal o el handle no existe en YouTube (404). Comprueba el @handle o pega el ID UCxxxx.' }); return;
      }
    }
    if (!channelId) { res.status(400).json({ error: 'No se pudo resolver el canal. Pega el ID UCxxxx o la URL completa.' }); return; }
    if (!name) {
      // Fetch RSS to get channel title
      try {
        const r = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId);
        const xml = await r.text();
        const tm = xml.match(/<title>([^<]+)<\\/title>/);
        if (tm) name = tm[1];
      } catch (_) {}
    }
    let data = { channels: [] };
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) {}
    if ((data.channels || []).find(c => c.id === channelId)) { res.json({ ok: true, alreadyAdded: true, channel: { id: channelId, name } }); return; }
    data.channels = [...(data.channels || []), { id: channelId, name: name || channelId, addedAt: Date.now() }];
    // Atomic write — tempfile + rename so a crash mid-write can't corrupt the JSON.
    const tmp = file + '.tmp.' + process.pid;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, file);
    res.json({ ok: true, channel: data.channels[data.channels.length - 1] });
  });
  youtubeDeleteChannel = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const fs = require('fs').promises;
    const userId = Number(req.user);
    const file = '/storage/youtube-' + userId + '.json';
    const id = req.params.id;
    let data = { channels: [] };
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) {}
    const before = (data.channels || []).length;
    data.channels = (data.channels || []).filter(c => c.id !== id);
    const tmp = file + '.tmp.' + process.pid;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, file);
    res.json({ ok: true, removed: before - data.channels.length });
  });
  youtubeFeed = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const fs = require('fs').promises;
    const userId = Number(req.user);
    const file = '/storage/youtube-' + userId + '.json';
    let data = { channels: [] };
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) {}
    const channels = data.channels || [];
    if (channels.length === 0) { res.json({ videos: [] }); return; }
    // Per-channel cache (5 min TTL). Keyed by channelId — global, shared across users
    // because RSS content is the same for everyone. Adding/removing channels does
    // NOT invalidate the others (vs. the previous "key = sorted list of channels"
    // which caused every channel to be re-fetched on add/remove → if any single
    // RSS hit was rate-limited, that channel's videos vanished from the feed).
    //
    // Persisted to disk (/storage/youtube-feed-cache.json) so it survives container
    // restarts — important because YouTube's RSS endpoint has been throwing 404s
    // for hours at a time since Dec-2025; without persistence, every restart would
    // empty the cache and leave the feed at 0 videos until YouTube recovered.
    const cacheFile = '/storage/youtube-feed-cache.json';
    const CACHE_MAX = 1000;
    const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    if (!global._ytChannelCache) {
      global._ytChannelCache = new Map();
      try {
        const raw = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
        const cutoff = Date.now() - CACHE_MAX_AGE_MS;
        // Sort entries newest-first so trimming to CACHE_MAX keeps the freshest.
        const sorted = Object.entries(raw || {})
          .filter(([, v]) => v && Array.isArray(v.entries) && typeof v.at === 'number' && v.at >= cutoff)
          .sort((a, b) => b[1].at - a[1].at)
          .slice(0, CACHE_MAX);
        for (const [id, v] of sorted) global._ytChannelCache.set(id, v);
      } catch (_) {}
    }
    const persistCache = async () => {
      try {
        const obj = {};
        for (const [id, v] of global._ytChannelCache) obj[id] = v;
        const tmp = cacheFile + '.tmp.' + process.pid;
        await fs.writeFile(tmp, JSON.stringify(obj));
        await fs.rename(tmp, cacheFile);
      } catch (_) {}
    };
    const TTL = 5 * 60 * 1000;
    const now = Date.now();
    const fresh = req.query && req.query.fresh === '1';
    let cacheDirty = false;
    const fetchChannel = async (ch) => {
      const cached = global._ytChannelCache.get(ch.id);
      if (!fresh && cached && (now - cached.at) < TTL) return cached.entries;
      try {
        const r = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + ch.id, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) {
          // Rate-limit / 5xx / YouTube's recurring 404 outage: fall back to last-known-good
          // entries for this channel instead of returning [] (which would make the channel
          // disappear from the feed during the outage).
          return cached ? cached.entries : [];
        }
        const xml = await r.text();
        const channelTitleMatch = xml.match(/<title>([^<]+)<\\/title>/);
        const channelTitle = channelTitleMatch ? channelTitleMatch[1] : ch.name;
        const entries = [];
        const re = /<entry>([\\s\\S]*?)<\\/entry>/g;
        let m;
        while ((m = re.exec(xml)) !== null) {
          const block = m[1];
          const idM = block.match(/<yt:videoId>([^<]+)<\\/yt:videoId>/);
          const titleM = block.match(/<title>([^<]+)<\\/title>/);
          const pubM = block.match(/<published>([^<]+)<\\/published>/);
          const thumbM = block.match(/<media:thumbnail url="([^"]+)"/);
          if (idM && titleM && pubM) {
            entries.push({
              videoId: idM[1],
              title: titleM[1].replace(/&amp;/g, '&'),
              published: pubM[1],
              thumbnail: thumbM ? thumbM[1] : 'https://i.ytimg.com/vi/' + idM[1] + '/hqdefault.jpg',
              channelName: channelTitle,
              channelId: ch.id,
              url: 'https://www.youtube.com/watch?v=' + idM[1]
            });
          }
        }
        // Cap per-channel to the 4 most-recent videos so the feed doesn't drown in
        // one prolific channel's uploads.
        const sorted = entries.sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, 4);
        // Only refresh the cache entry if we got something — an empty parse on a
        // 200 response (rare, but happens when YouTube serves an HTML error page
        // with status 200) would otherwise overwrite good data with [].
        if (sorted.length > 0) {
          global._ytChannelCache.set(ch.id, { at: now, entries: sorted });
          // LRU trim: insertion-order Map → drop the oldest when over cap.
          if (global._ytChannelCache.size > CACHE_MAX) {
            global._ytChannelCache.delete(global._ytChannelCache.keys().next().value);
          }
          cacheDirty = true;
          return sorted;
        }
        return cached ? cached.entries : [];
      } catch (e) {
        return cached ? cached.entries : [];
      }
    };
    // Concurrency-limited fan-out: with N channels, only run K=5 in parallel
    // at any moment so we don't fan out 50+ requests against YouTube RSS at
    // once (which sometimes triggers 429s during their flaky-RSS windows).
    // Worker-pool — each of K workers picks the next available channel.
    const _CONCURRENCY = 5;
    const results = new Array(channels.length);
    let _next = 0;
    const _workers = Array.from({ length: Math.min(_CONCURRENCY, channels.length) }, async () => {
      while (_next < channels.length) {
        const idx = _next++;
        results[idx] = await fetchChannel(channels[idx]);
      }
    });
    await Promise.all(_workers);
    if (cacheDirty) await persistCache();
    const videos = [].concat(...results).sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, 100);
    res.json({ videos });
  });
`;

const anchor = '}\nexports.MediaItemController = MediaItemController;';
if (!c.includes(anchor)) { console.error('youtube controller: anchor not found'); process.exit(1); }
c = c.replace(anchor, method + anchor);
fs.writeFileSync(path, c);
console.log('youtube controller: 4 methods (channels CRUD + feed) installed');

})();

// ===== patch_youtube_routes.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/generated/routes/routes.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("/api/youtube/feed'") && c.includes("/api/youtube/channels'")) { console.log('youtube routes: already patched'); return /* was process.exit(0) */; }

const anchor = "router.get('/api/import-trakttv/state'";
if (!c.includes(anchor)) { console.error('youtube routes: anchor not found'); process.exit(1); }

const route =
"router.get('/api/youtube/channels', validatorHandler({}), _MediaItemController.youtubeChannels);\n" +
"router.post('/api/youtube/channels', validatorHandler({}), _MediaItemController.youtubeAddChannel);\n" +
"router.delete('/api/youtube/channels/:id', validatorHandler({}), _MediaItemController.youtubeDeleteChannel);\n" +
"router.get('/api/youtube/feed', validatorHandler({}), _MediaItemController.youtubeFeed);\n";

c = c.replace(anchor, route + anchor);
fs.writeFileSync(path, c);
console.log('youtube routes: 4 endpoints registered');

})();

// ===== patch_body_limit.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/server.js';
let c = fs.readFileSync(path, 'utf8');

// express.json() defaults to 100KB. Our JSON imports (mediatoc-export-*.json)
// can easily reach 10-50MB on a populated library. Bump the limit so /api/backup/import
// stops returning PayloadTooLargeError.
const old = "this.#app.use(_express.default.json());";
const fresh = "this.#app.use(_express.default.json({ limit: '100mb' }));";

if (c.includes(fresh)) { console.log('body limit: already patched'); return /* was process.exit(0) */; }
if (!c.includes(old)) { console.error('body limit: anchor not found'); process.exit(1); }
c = c.replace(old, fresh);
fs.writeFileSync(path, c);
console.log('body limit: express.json() now accepts up to 100MB');

})();

// ===== patch_session_samesite_lax.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/server.js';
let c = fs.readFileSync(path, 'utf8');

// Default `sameSite: true` translates to "Strict" — the session cookie is NOT
// sent on cross-site navigations, including OAuth callbacks coming back from
// accounts.google.com. We need 'lax' so the cookie rides along on top-level
// navigations (still blocks CSRF on subresource requests / non-GET cross-site).
const old = "        sameSite: true,";
const fresh = "        sameSite: 'lax',";

if (c.includes(fresh)) { console.log('session samesite: already lax'); return /* was process.exit(0) */; }
if (!c.includes(old)) { console.error('session samesite: anchor not found'); process.exit(1); }
c = c.replace(old, fresh);
fs.writeFileSync(path, c);
console.log('session samesite: set to lax (allows OAuth callback from cross-site)');

})();

// ===== patch_cookie_secure.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/server.js';
let c = fs.readFileSync(path, 'utf8');

// Hardening:
// 1. trust proxy → so Express reads X-Forwarded-Proto from Cloudflare and knows
//    when the user is on HTTPS (otherwise it always sees HTTP and won't issue
//    secure cookies).
// 2. cookie.secure: 'auto' → emits Secure flag when req.secure is true (i.e. the
//    user reached us via HTTPS). On direct localhost HTTP access we still emit
//    a non-secure cookie so login works.

if (c.includes('// cookieSecureHardening')) { console.log('cookie secure: already patched'); return /* was process.exit(0) */; }

// Insert `trust proxy` right before the express-session use() call.
const oldSession = "    this.#app.use((0, _expressSession.default)({\n      secret: this.#config.sessionKey,\n      resave: false,\n      saveUninitialized: false,\n      cookie: {\n        httpOnly: true,\n        sameSite: 'lax',\n        maxAge: 1000 * 60 * 60 * 24 * 365\n      },";
const freshSession = "    // cookieSecureHardening: trust X-Forwarded-Proto from Cloudflare so secure cookies\n    // can be issued when the user arrived over HTTPS (still permits HTTP on localhost direct).\n    this.#app.set('trust proxy', true);\n    this.#app.use((0, _expressSession.default)({\n      secret: this.#config.sessionKey,\n      resave: false,\n      saveUninitialized: false,\n      cookie: {\n        httpOnly: true,\n        sameSite: 'lax',\n        secure: 'auto',\n        maxAge: 1000 * 60 * 60 * 24 * 365\n      },";

if (!c.includes(oldSession)) { console.error('cookie secure: anchor not found'); process.exit(1); }
c = c.replace(oldSession, freshSession);
fs.writeFileSync(path, c);
console.log('cookie secure: trust proxy enabled + cookie.secure=auto');

})();

// ===== patch_youtube_oauth_controller.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/item.js';
let c = fs.readFileSync(path, 'utf8');

// Strip prior versions for idempotent re-applies
['youtubeOauthStart','youtubeOauthCallback','youtubeOauthStatus','youtubeOauthSync','youtubeOauthDelete'].forEach(name => {
  const re = new RegExp('  ' + name + ' = \\(0, _typescriptRoutesToOpenapiServer\\.createExpressRoute\\)\\(async \\(req, res\\) => \\{[\\s\\S]*?\\}\\);\\n', 'g');
  c = c.replace(re, '');
});

const method = `  youtubeOauthStart = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const userId = Number(req.user);
    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return; }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) { res.status(500).json({ error: 'GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI not configured' }); return; }
    if (!global._ytOauthStates) global._ytOauthStates = new Map();
    // GC stale states (>10 min)
    const cutoff = Date.now() - 600000;
    for (const [k, v] of global._ytOauthStates) { if (v.ts < cutoff) global._ytOauthStates.delete(k); }
    const state = require('crypto').randomBytes(16).toString('hex');
    global._ytOauthStates.set(state, { userId: userId, ts: Date.now() });
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' +
      'client_id=' + encodeURIComponent(clientId) +
      '&redirect_uri=' + encodeURIComponent(redirectUri) +
      '&response_type=code' +
      '&scope=' + encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly') +
      '&access_type=offline' +
      // prompt=consent forces re-consent so we always get a refresh_token even if the user
      // already authorized this app once before (Google only issues refresh_token on first consent otherwise).
      // prompt=select_account shows the account picker so users with multiple Google accounts can pick.
      '&prompt=' + encodeURIComponent('consent select_account') +
      '&state=' + state;
    res.redirect(url);
  });
  youtubeOauthCallback = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const fs = require('fs').promises;
    const reqUserId = Number(req.user);
    if (!reqUserId) { res.status(401).send('unauthenticated — log in to MediaTracker first and retry'); return; }
    const code = req.query.code;
    const state = req.query.state;
    const err = req.query.error;
    if (err) { res.status(400).send('Google authorization denied: ' + err); return; }
    if (!code || !state) { res.status(400).send('missing code or state'); return; }
    if (!global._ytOauthStates) global._ytOauthStates = new Map();
    const stateEntry = global._ytOauthStates.get(state);
    if (!stateEntry) { res.status(400).send('invalid or expired state'); return; }
    global._ytOauthStates.delete(state);
    if (Date.now() - stateEntry.ts > 600000) { res.status(400).send('expired state'); return; }
    if (stateEntry.userId !== reqUserId) { res.status(403).send('state user mismatch'); return; }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: 'authorization_code'
      })
    });
    const tokens = await tokenRes.json();
    if (tokens.error) { res.status(400).send('token exchange failed: ' + tokens.error_description || tokens.error); return; }
    let email = null;
    try {
      const u = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + tokens.access_token } });
      const info = await u.json();
      email = info.email || null;
    } catch (_) {}
    const file = '/storage/youtube-' + reqUserId + '.json';
    let data = { channels: [] };
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) {}
    data.auth = {
      accessToken: tokens.access_token,
      // Keep prior refresh_token if Google didn't issue a new one (e.g. re-consent without prompt=consent)
      refreshToken: tokens.refresh_token || (data.auth && data.auth.refreshToken) || null,
      expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
      email: email,
      connectedAt: Date.now()
    };
    { const _wTmp = file + '.tmp.' + process.pid; await fs.writeFile(_wTmp, JSON.stringify(data, null, 2)); await fs.rename(_wTmp, file); }
    res.redirect('/#/youtube');
  });
  youtubeOauthStatus = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const fs = require('fs').promises;
    const userId = Number(req.user);
    const file = '/storage/youtube-' + userId + '.json';
    let data = {};
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) {}
    if (!data.auth || !data.auth.refreshToken) { res.json({ connected: false }); return; }
    res.json({ connected: true, email: data.auth.email || null, connectedAt: data.auth.connectedAt || null });
  });
  youtubeOauthSync = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const fs = require('fs').promises;
    const userId = Number(req.user);
    const file = '/storage/youtube-' + userId + '.json';
    let data = { channels: [] };
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) {}
    if (!data.auth || !data.auth.refreshToken) { res.status(400).json({ error: 'not connected' }); return; }
    let accessToken = data.auth.accessToken;
    // Refresh if expired (or about to in <60s)
    if (Date.now() >= (data.auth.expiresAt - 60000)) {
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: data.auth.refreshToken,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          grant_type: 'refresh_token'
        })
      });
      const t = await r.json();
      if (t.error) { res.status(400).json({ error: 'refresh failed: ' + (t.error_description || t.error) }); return; }
      accessToken = t.access_token;
      data.auth.accessToken = accessToken;
      data.auth.expiresAt = Date.now() + (t.expires_in || 3600) * 1000;
      { const _wTmp = file + '.tmp.' + process.pid; await fs.writeFile(_wTmp, JSON.stringify(data, null, 2)); await fs.rename(_wTmp, file); }
    }
    // Paginate subscriptions (50 per page, cap at 1000 total = 20 pages)
    const subs = [];
    let pageToken = '';
    for (let i = 0; i < 20; i++) {
      const url = 'https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50&order=alphabetical' + (pageToken ? '&pageToken=' + pageToken : '');
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
      const j = await r.json();
      if (j.error) { res.status(400).json({ error: 'subscriptions: ' + (j.error.message || JSON.stringify(j.error)) }); return; }
      for (const item of (j.items || [])) {
        const channelId = item.snippet && item.snippet.resourceId && item.snippet.resourceId.channelId;
        const name = item.snippet && item.snippet.title;
        if (channelId) subs.push({ id: channelId, name: name });
      }
      if (!j.nextPageToken) break;
      pageToken = j.nextPageToken;
    }
    const existing = new Set((data.channels || []).map(c => c.id));
    let added = 0;
    for (const s of subs) {
      if (!existing.has(s.id)) {
        data.channels.push({ id: s.id, name: s.name || s.id, addedAt: Date.now() });
        added++;
      }
    }
    { const _wTmp = file + '.tmp.' + process.pid; await fs.writeFile(_wTmp, JSON.stringify(data, null, 2)); await fs.rename(_wTmp, file); }
    res.json({ ok: true, total: subs.length, added: added, skipped: subs.length - added });
  });
  youtubeOauthDelete = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const fs = require('fs').promises;
    const userId = Number(req.user);
    const file = '/storage/youtube-' + userId + '.json';
    let data = {};
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) {}
    if (data.auth && data.auth.refreshToken) {
      try { await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(data.auth.refreshToken), { method: 'POST' }); } catch (_) {}
    }
    delete data.auth;
    { const _wTmp = file + '.tmp.' + process.pid; await fs.writeFile(_wTmp, JSON.stringify(data, null, 2)); await fs.rename(_wTmp, file); }
    res.json({ ok: true });
  });
`;

const anchor = '}\nexports.MediaItemController = MediaItemController;';
if (!c.includes(anchor)) { console.error('youtube oauth controller: anchor not found'); process.exit(1); }
c = c.replace(anchor, method + anchor);
fs.writeFileSync(path, c);
console.log('youtube oauth controller: 5 OAuth methods installed');

})();

// ===== patch_youtube_oauth_routes.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/generated/routes/routes.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("/api/youtube/oauth/start'")) { console.log('youtube oauth routes: already patched'); return /* was process.exit(0) */; }

const anchor = "router.get('/api/import-trakttv/state'";
if (!c.includes(anchor)) { console.error('youtube oauth routes: anchor not found'); process.exit(1); }

const route =
"router.get('/api/youtube/oauth/start', validatorHandler({}), _MediaItemController.youtubeOauthStart);\n" +
"router.get('/api/youtube/oauth/callback', validatorHandler({}), _MediaItemController.youtubeOauthCallback);\n" +
"router.get('/api/youtube/oauth/status', validatorHandler({}), _MediaItemController.youtubeOauthStatus);\n" +
"router.post('/api/youtube/oauth/sync', validatorHandler({}), _MediaItemController.youtubeOauthSync);\n" +
"router.delete('/api/youtube/oauth', validatorHandler({}), _MediaItemController.youtubeOauthDelete);\n";

c = c.replace(anchor, route + anchor);
fs.writeFileSync(path, c);
console.log('youtube oauth routes: 5 endpoints registered');

})();

// ===== patch_youtube_watched_controller.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/controllers/item.js';
let c = fs.readFileSync(path, 'utf8');

// Per-user "marked as watched" tracking for YouTube videos. Storage extends
// /storage/youtube-<userId>.json with a `watched` array. Each entry has the
// video id, channel id, title, thumbnail, durationSeconds, watchedAt.
//
// Duration comes from YouTube Data API v3 (videos?id=X&part=contentDetails),
// authenticated with the user's OAuth access token (requires the user to have
// connected via Google OAuth — patch_youtube_oauth_controller.js).
//
// Endpoints:
//   POST   /api/youtube/watched           body: {videoId, channelId, channelName, title, thumbnail, url}
//   DELETE /api/youtube/watched/:videoId
//   GET    /api/youtube/watched-stats     → {count, totalSeconds, totalMinutes}

// Strip prior versions so re-applies are idempotent.
['youtubeMarkWatched', 'youtubeUnmarkWatched', 'youtubeWatchedStats', 'youtubeRefreshToken', 'youtubeParseDuration'].forEach(name => {
  const re = new RegExp('  ' + name + ' = (?:\\(0, _typescriptRoutesToOpenapiServer\\.createExpressRoute\\)\\(async \\(req, res\\) => \\{|async (?:\\(\\w*\\) => \\{|function|\\w*\\s*\\([^)]*\\) \\{))[\\s\\S]*?\\n  \\}\\)?;\\n', 'g');
  c = c.replace(re, '');
});
// Also strip the standalone helpers (regex above is conservative — match these explicitly)
c = c.replace(/  _ytParseDuration = [\s\S]*?\n  \};\n/g, '');
c = c.replace(/  _ytRefreshToken = async [\s\S]*?\n  \};\n/g, '');

const method = `  _ytParseDuration = (iso) => {
    // ISO 8601 duration: PT#H#M#S (any field optional). Returns seconds.
    if (!iso || typeof iso !== 'string') return 0;
    const m = iso.match(/^PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?$/);
    if (!m) return 0;
    const h = Number(m[1] || 0), mn = Number(m[2] || 0), s = Number(m[3] || 0);
    return h * 3600 + mn * 60 + s;
  };
  _ytRefreshToken = async (data, file) => {
    // Refresh the OAuth access token if it's expired (or expires in <60s).
    // Mutates and persists \`data.auth\`. Returns the access token.
    const fs = require('fs').promises;
    if (!data.auth || !data.auth.refreshToken) throw new Error('Google OAuth not connected (Settings → YouTube)');
    if (Date.now() < (data.auth.expiresAt - 60000)) return data.auth.accessToken;
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: data.auth.refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token'
      })
    });
    const t = await r.json();
    if (t.error) throw new Error('refresh failed: ' + (t.error_description || t.error));
    data.auth.accessToken = t.access_token;
    data.auth.expiresAt = Date.now() + (t.expires_in || 3600) * 1000;
    { const _wTmp = file + '.tmp.' + process.pid; await fs.writeFile(_wTmp, JSON.stringify(data, null, 2)); await fs.rename(_wTmp, file); }
    return t.access_token;
  };
  youtubeMarkWatched = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const fs = require('fs').promises;
    const userId = Number(req.user);
    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return; }
    const file = '/storage/youtube-' + userId + '.json';
    const body = req.body || {};
    const videoId = String(body.videoId || '').trim();
    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) { res.status(400).json({ error: 'videoId requerido (11 chars)' }); return; }
    let data = { channels: [], watched: [] };
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) {}
    if (!Array.isArray(data.watched)) data.watched = [];
    if (data.watched.find(w => w.videoId === videoId)) {
      res.json({ ok: true, alreadyMarked: true });
      return;
    }
    let durationSeconds = 0;
    // Try OAuth-based YouTube Data API first (more reliable, has rate limits but
    // returns clean ISO 8601 duration). Fall back to scraping the watch page for
    // \`lengthSeconds\` so users without an OAuth-linked Google account can still
    // use the feature.
    let oauthErr = null;
    try {
      const accessToken = await this._ytRefreshToken(data, file);
      const r = await fetch('https://www.googleapis.com/youtube/v3/videos?id=' + encodeURIComponent(videoId) + '&part=contentDetails', {
        headers: { Authorization: 'Bearer ' + accessToken }
      });
      const j = await r.json();
      if (j.error) throw new Error('YouTube API: ' + (j.error.message || JSON.stringify(j.error)));
      const item = (j.items || [])[0];
      if (!item) throw new Error('video no encontrado en YouTube');
      durationSeconds = this._ytParseDuration(item.contentDetails && item.contentDetails.duration);
    } catch (e) {
      oauthErr = e.message;
    }
    if (!durationSeconds) {
      try {
        const r = await fetch('https://www.youtube.com/watch?v=' + encodeURIComponent(videoId), {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' }
        });
        const html = await r.text();
        const m = html.match(/\"lengthSeconds\":\"(\\d+)\"/);
        if (m) durationSeconds = Number(m[1]);
      } catch (_) {}
    }
    if (!durationSeconds) {
      res.status(400).json({ error: 'No se pudo obtener la duraci\\u00f3n del v\\u00eddeo' + (oauthErr ? ' (OAuth: ' + oauthErr + ')' : '') });
      return;
    }
    data.watched.push({
      videoId,
      channelId: body.channelId ? String(body.channelId) : null,
      channelName: body.channelName ? String(body.channelName) : null,
      title: body.title ? String(body.title) : null,
      thumbnail: body.thumbnail ? String(body.thumbnail) : null,
      url: body.url ? String(body.url) : ('https://www.youtube.com/watch?v=' + videoId),
      durationSeconds,
      watchedAt: Date.now()
    });
    try { { const _wTmp = file + '.tmp.' + process.pid; await fs.writeFile(_wTmp, JSON.stringify(data, null, 2)); await fs.rename(_wTmp, file); } }
    catch (e) { res.status(500).json({ error: 'persist failed: ' + e.message }); return; }
    res.json({ ok: true, durationSeconds });
  });
  youtubeUnmarkWatched = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const fs = require('fs').promises;
    const userId = Number(req.user);
    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return; }
    const file = '/storage/youtube-' + userId + '.json';
    const videoId = String(req.params.videoId || '').trim();
    if (!videoId) { res.status(400).json({ error: 'videoId requerido' }); return; }
    let data = { channels: [], watched: [] };
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) {}
    if (!Array.isArray(data.watched)) data.watched = [];
    const before = data.watched.length;
    data.watched = data.watched.filter(w => w.videoId !== videoId);
    if (data.watched.length === before) { res.status(404).json({ error: 'no marcado' }); return; }
    try { { const _wTmp = file + '.tmp.' + process.pid; await fs.writeFile(_wTmp, JSON.stringify(data, null, 2)); await fs.rename(_wTmp, file); } }
    catch (e) { res.status(500).json({ error: e.message }); return; }
    res.json({ ok: true });
  });
  youtubeWatchedStats = (0, _typescriptRoutesToOpenapiServer.createExpressRoute)(async (req, res) => {
    const fs = require('fs').promises;
    const userId = Number(req.user);
    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return; }
    const file = '/storage/youtube-' + userId + '.json';
    let data = { channels: [], watched: [] };
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) {}
    const arr = Array.isArray(data.watched) ? data.watched : [];
    const totalSeconds = arr.reduce((sum, w) => sum + (Number(w.durationSeconds) || 0), 0);
    res.json({ count: arr.length, totalSeconds, totalMinutes: Math.round(totalSeconds / 60), videoIds: arr.map(w => w.videoId) });
  });
`;

const anchor = '}\nexports.MediaItemController = MediaItemController;';
if (!c.includes(anchor)) { console.error('youtube watched controller: anchor not found'); process.exit(1); }
c = c.replace(anchor, method + anchor);
fs.writeFileSync(path, c);
console.log('youtube watched controller: added mark/unmark/stats + helpers');

})();

// ===== patch_youtube_watched_routes.js =====
;(() => {
const fs = require('fs');
const path = '/app/build/generated/routes/routes.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes("/api/youtube/watched-stats'")) {
  console.log('youtube watched routes: already patched');
  return /* was process.exit(0) */;
}

const anchor = "router.get('/api/youtube/feed'";
if (!c.includes(anchor)) { console.error('youtube watched routes: anchor not found'); process.exit(1); }

const route =
  "router.post('/api/youtube/watched', validatorHandler({}), _MediaItemController.youtubeMarkWatched);\n" +
  "router.delete('/api/youtube/watched/:videoId', validatorHandler({}), _MediaItemController.youtubeUnmarkWatched);\n" +
  "router.get('/api/youtube/watched-stats', validatorHandler({}), _MediaItemController.youtubeWatchedStats);\n";

c = c.replace(anchor, route + anchor);
fs.writeFileSync(path, c);
console.log('youtube watched routes: added 3 endpoints');

})();

// ===== patch_youtube_frontend.js =====
;(() => {
const fs = require('fs');
const bundlePath = require('child_process').execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
let c = fs.readFileSync(bundlePath, 'utf8');

// Strip prior version
c = c.replace(/_YT=function\(\)\{[\s\S]*?\}\)\)\)\},/g, '');

// _YT (YouTube page): OAuth section + two collapsible dropdowns (channel config + recent videos).
// Cards include a "Marcar visto" toggle that POSTs the video id to /api/youtube/watched —
// the backend resolves duration via the YouTube Data API (using the user's OAuth token) and
// stores it in /storage/youtube-<userId>.json. The watched set + total seconds are surfaced
// next to the section title and consumed by the homepage summary block (_YTHome).
const compDef = '_YT=function(){' +
  'var _channelsState=r.useState([]),channels=_channelsState[0],setChannels=_channelsState[1];' +
  'var _videosState=r.useState(null),videos=_videosState[0],setVideos=_videosState[1];' +
  'var _inputState=r.useState(""),input=_inputState[0],setInput=_inputState[1];' +
  'var _msgState=r.useState(null),msg=_msgState[0],setMsg=_msgState[1];' +
  'var _busyState=r.useState(false),busy=_busyState[0],setBusy=_busyState[1];' +
  'var _openCfgState=r.useState(false),openCfg=_openCfgState[0],setOpenCfg=_openCfgState[1];' +
  'var _openVidsState=r.useState(true),openVids=_openVidsState[0],setOpenVids=_openVidsState[1];' +
  'var _authState=r.useState(null),auth=_authState[0],setAuth=_authState[1];' +
  'var _syncBusyState=r.useState(false),syncBusy=_syncBusyState[0],setSyncBusy=_syncBusyState[1];' +
  'var _watchedState=r.useState({set:{},count:0,totalSeconds:0}),watched=_watchedState[0],setWatched=_watchedState[1];' +
  'var _markBusyState=r.useState({}),markBusy=_markBusyState[0],setMarkBusy=_markBusyState[1];' +
  'var loadChannels=function(){fetch("/api/youtube/channels",{credentials:"same-origin"}).then(function(r){return r.json()}).then(setChannels).catch(function(){})};' +
  'var loadVideos=function(fresh){setVideos(null);fetch("/api/youtube/feed"+(fresh?"?fresh=1":""),{credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){setVideos(d.videos||[])}).catch(function(){setVideos([])})};' +
  'var loadAuth=function(){fetch("/api/youtube/oauth/status",{credentials:"same-origin"}).then(function(r){return r.json()}).then(setAuth).catch(function(){setAuth({connected:false})})};' +
  'var loadWatched=function(){fetch("/api/youtube/watched-stats",{credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){var s={};(d.videoIds||[]).forEach(function(id){s[id]=true});setWatched({set:s,count:d.count||0,totalSeconds:d.totalSeconds||0})}).catch(function(){})};' +
  'var connectOauth=function(){window.location="/api/youtube/oauth/start"};' +
  'var syncOauth=function(){' +
    'setSyncBusy(true);setMsg(null);' +
    'fetch("/api/youtube/oauth/sync",{method:"POST",credentials:"same-origin"})' +
      '.then(function(r){return r.json()})' +
      '.then(function(d){setSyncBusy(false);if(d.error){setMsg({type:"error",text:d.error})}else{setMsg({type:"success",text:"Suscripciones sincronizadas: a\\u00f1adidas "+d.added+", saltadas (ya estaban) "+d.skipped+", total "+d.total});loadChannels();loadVideos()}})' +
      '.catch(function(e){setSyncBusy(false);setMsg({type:"error",text:String(e.message||e)})})' +
  '};' +
  'var disconnectOauth=function(){' +
    'if(!confirm("\\u00bfDesvincular tu cuenta de YouTube? Los canales ya a\\u00f1adidos se quedan; solo se borra el token de acceso."))return;' +
    'fetch("/api/youtube/oauth",{method:"DELETE",credentials:"same-origin"}).then(function(){loadAuth()})' +
  '};' +
  'r.useEffect(function(){loadChannels();loadVideos();loadAuth();loadWatched()},[]);' +
  'var addChannel=function(){' +
    'if(!input.trim())return;' +
    'setBusy(true);setMsg(null);' +
    'fetch("/api/youtube/channels",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:input.trim()})})' +
      '.then(function(r){return r.json()})' +
      '.then(function(d){setBusy(false);if(d.error){setMsg({type:"error",text:d.error})}else{setInput("");setMsg({type:"success",text:"A\\u00f1adido: "+d.channel.name});loadChannels();loadVideos()}})' +
      '.catch(function(e){setBusy(false);setMsg({type:"error",text:String(e.message||e)})})' +
  '};' +
  'var removeChannel=function(id){' +
    'if(!confirm("\\u00bfQuitar este canal?"))return;' +
    'fetch("/api/youtube/channels/"+id,{method:"DELETE",credentials:"same-origin"}).then(function(r){return r.json()}).then(function(){loadChannels();loadVideos()})' +
  '};' +
  'var markWatched=function(v){' +
    'setMarkBusy(Object.assign({},markBusy,(function(o){o[v.videoId]=true;return o})({})));' +
    'var b={videoId:v.videoId,channelId:v.channelId||null,channelName:v.channelName||null,title:v.title||null,thumbnail:v.thumbnail||null,url:v.url||null};' +
    'fetch("/api/youtube/watched",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)})' +
      '.then(function(r){return r.json()})' +
      '.then(function(d){setMarkBusy(function(prev){var n=Object.assign({},prev);delete n[v.videoId];return n}.bind(null,markBusy)());if(d.error){setMsg({type:"error",text:d.error})}else{loadWatched()}})' +
      '.catch(function(e){setMarkBusy(function(prev){var n=Object.assign({},prev);delete n[v.videoId];return n}.bind(null,markBusy)());setMsg({type:"error",text:String(e.message||e)})})' +
  '};' +
  'var unmarkWatched=function(v){' +
    'setMarkBusy(Object.assign({},markBusy,(function(o){o[v.videoId]=true;return o})({})));' +
    'fetch("/api/youtube/watched/"+encodeURIComponent(v.videoId),{method:"DELETE",credentials:"same-origin"})' +
      '.then(function(r){return r.json()})' +
      '.then(function(d){setMarkBusy(function(prev){var n=Object.assign({},prev);delete n[v.videoId];return n}.bind(null,markBusy)());if(d.error){setMsg({type:"error",text:d.error})}else{loadWatched()}})' +
      '.catch(function(e){setMarkBusy(function(prev){var n=Object.assign({},prev);delete n[v.videoId];return n}.bind(null,markBusy)());setMsg({type:"error",text:String(e.message||e)})})' +
  '};' +
  'var formatDate=function(s){try{var d=new Date(s);var diff=(Date.now()-d.getTime())/86400000;if(diff<1)return xo._("today");if(diff<2)return xo._("yesterday");if(diff<7){var n=Math.floor(diff);return n+" "+(n===1?xo._("day"):xo._("days"))}return d.toLocaleDateString("es",{day:"2-digit",month:"2-digit",year:"numeric"})}catch(_){return s}};' +
  'var formatHours=function(sec){if(!sec)return "0m";var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);return (h?h+"h ":"")+m+"m"};' +
  'return r.createElement("div",{className:"p-2"},' +
    'r.createElement("h2",{className:"text-2xl mb-2 px-2"},"YouTube"),' +
    // OAuth account-link section moved to /settings/application-tokens
    // (rendered there via _YTAUTH in patch_credentials_to_tokens.js).
    // Hint pointing users to where the YouTube account link is configured.
    'r.createElement("p",{className:"text-sm text-gray-500 dark:text-gray-400 italic mb-3 px-2"},' +
      'xo._("Link your YouTube account in "),' +
      'r.createElement("a",{href:"#/settings/application-tokens",className:"underline text-blue-600 dark:text-blue-400 not-italic"},xo._("Application tokens")),' +
      '"."' +
    '),' +
    // Watched stats badge
    'r.createElement("div",{className:"mb-3 px-2 text-sm text-gray-600 dark:text-gray-300"},' +
      'r.createElement("i",{className:"material-icons text-base align-middle mr-1"},"visibility"),' +
      '"Vistos: ",r.createElement("b",null,watched.count)," videos \\u00b7 ",r.createElement("b",null,formatHours(watched.totalSeconds))' +
    '),' +
    // Section 1: configure channels
    'r.createElement("div",{className:"mb-3 border border-slate-300 dark:border-slate-700 rounded overflow-hidden"},' +
      'r.createElement("button",{onClick:function(){setOpenCfg(!openCfg)},className:"w-full text-left text-xl font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-2"},' +
        'r.createElement("i",{className:"material-icons"},openCfg?"expand_more":"chevron_right"),' +
        '"Mis canales (" + channels.length + ")"' +
      '),' +
      'openCfg&&r.createElement("div",{className:"p-3"},' +
        'r.createElement("p",{className:"text-sm text-gray-600 dark:text-gray-300 mb-2"},"Pega la URL de un canal de YouTube (ej. youtube.com/@LinusTechTips) o el ID UCxxxx."),' +
        'r.createElement("div",{className:"flex gap-2 mb-3"},' +
          'r.createElement("input",{type:"text",placeholder:"youtube.com/@canal o UC...",value:input,onChange:function(e){setInput(e.currentTarget.value)},onKeyDown:function(e){if(e.key==="Enter")addChannel()},className:"flex-1 px-3 py-1 rounded border dark:bg-slate-800 dark:border-slate-600"}),' +
          'r.createElement("button",{onClick:addChannel,disabled:busy,className:"px-4 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-500 text-white rounded"},busy?"...":xo._("Add"))' +
        '),' +
        'msg?r.createElement("div",{className:"mb-3 p-2 rounded text-sm "+(msg.type==="success"?"bg-green-700 text-white":"bg-red-700 text-white")},msg.text):null,' +
        'channels.length===0?r.createElement("p",{className:"text-gray-500 italic"},xo._("No channels yet")):r.createElement("ul",{className:"flex flex-col gap-1"},' +
          'channels.map(function(ch){' +
            'return r.createElement("li",{key:ch.id,className:"flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded"},' +
              'r.createElement("a",{href:"https://www.youtube.com/channel/"+ch.id,target:"_blank",rel:"noopener noreferrer",className:"underline text-blue-600 dark:text-blue-400"},ch.name),' +
              'r.createElement("button",{onClick:function(){removeChannel(ch.id)},className:"text-sm text-red-500 hover:text-red-700"},"Quitar")' +
            ')' +
          '})' +
        ')' +
      ')' +
    '),' +
    // Section 2: recent videos
    'r.createElement("div",{className:"mb-3 border border-slate-300 dark:border-slate-700 rounded overflow-hidden"},' +
      'r.createElement("button",{onClick:function(){setOpenVids(!openVids)},className:"w-full text-left text-xl font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-2"},' +
        'r.createElement("i",{className:"material-icons"},openVids?"expand_more":"chevron_right"),' +
        'xo._("Recent videos") + (videos?(" (" + videos.length + ")"):"")' +
      '),' +
      'openVids&&r.createElement("div",{className:"p-3"},' +
        // Refresh button — bypasses the per-channel server cache via ?fresh=1
        'r.createElement("div",{className:"mb-2 flex justify-end"},' +
          'r.createElement("button",{onClick:function(){loadVideos(true)},disabled:videos===null,className:"px-3 py-1 text-sm rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 inline-flex items-center gap-1"},' +
            'r.createElement("i",{className:"material-icons text-base"},"refresh"),' +
            'xo._("Refresh")' +
          ')' +
        '),' +
        'videos===null?r.createElement("p",{className:"text-gray-500"},"Cargando..."):' +
        'videos.length===0?r.createElement("p",{className:"text-gray-500 italic"},xo._("No videos")):' +
        // Inline style — Tailwind tree-shook .grid/.grid-cols-*/.gap-* because
        // the upstream JSX never used them, so className-based grid classes are
        // a no-op here. Style attribute always wins.
        'r.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(3, minmax(0, 1fr))",gap:"0.75rem"}},' +
          'videos.map(function(v){' +
            'var isWatched=!!watched.set[v.videoId];' +
            'var isBusy=!!markBusy[v.videoId];' +
            'return r.createElement("div",{key:v.videoId,className:"flex flex-col bg-slate-50 dark:bg-slate-800 rounded overflow-hidden"+(isWatched?" ring-2 ring-green-600":"")},' +
              'r.createElement("a",{href:v.url,target:"_blank",rel:"noopener noreferrer",className:"block hover:opacity-90"},' +
                'r.createElement("img",{src:v.thumbnail,alt:v.title,className:"w-full aspect-video object-cover"})' +
              '),' +
              'r.createElement("div",{className:"p-2 flex flex-col gap-1"},' +
                'r.createElement("a",{href:v.url,target:"_blank",rel:"noopener noreferrer",className:"font-semibold text-sm leading-tight line-clamp-2 hover:underline"},v.title),' +
                'r.createElement("div",{className:"text-xs text-gray-500"},v.channelName+" \\u00b7 "+formatDate(v.published)),' +
                'r.createElement("button",{onClick:function(){isWatched?unmarkWatched(v):markWatched(v)},disabled:isBusy,className:"mt-1 self-start px-2 py-1 rounded text-xs inline-flex items-center gap-1 "+(isWatched?"bg-green-700 hover:bg-green-800 text-white":"bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600")},' +
                  'r.createElement("i",{className:"material-icons text-base"},isBusy?"hourglass_top":isWatched?"check_circle":"visibility"),' +
                  'isBusy?"...":isWatched?"Visto":"Marcar visto"' +
                ')' +
              ')' +
            ')' +
          '})' +
        ')' +
      ')' +
    ')' +
  ')' +
'},';

const cardAnchor = '_v=function(e){';
if (!c.includes(cardAnchor)) { console.error('youtube frontend: _v anchor not found'); process.exit(1); }
c = c.replace(cardAnchor, compDef + cardAnchor);
console.log('youtube frontend: injected _YT component (with watched-tracking)');

// Add /youtube route
const routeAnchor = 'r.createElement(Q,{path:"/lists",element:r.createElement(SS,{key:"/lists"})})';
const routePatched = 'r.createElement(Q,{path:"/youtube",element:r.createElement(_YT,null)}),' + routeAnchor;
if (c.includes('path:"/youtube"')) { console.log('youtube frontend: route already added'); }
else if (!c.includes(routeAnchor)) { console.error('youtube frontend: route anchor not found'); process.exit(1); }
else { c = c.replace(routeAnchor, routePatched); console.log('youtube frontend: added /youtube route'); }

// Add YouTube menu entry next to Downloaded
const menuAnchor = '{path:"/lists",name:xo._("Lists")},{path:"/watchlist",name:xo._("Watchlist")},{path:"/downloaded",name:xo._("Downloaded")}]';
const menuPatched = '{path:"/lists",name:xo._("Lists")},{path:"/watchlist",name:xo._("Watchlist")},{path:"/downloaded",name:xo._("Downloaded")},{path:"/youtube",name:"YouTube"}]';
if (c.includes('{path:"/youtube",name:"YouTube"}')) { console.log('youtube frontend: menu already added'); }
else if (!c.includes(menuAnchor)) { console.error('youtube frontend: menu anchor not found'); process.exit(1); }
else { c = c.replace(menuAnchor, menuPatched); console.log('youtube frontend: added YouTube menu entry'); }

// /youtube → top nav
const topOld = '["/","/tv","/movies","/games","/books"]';
const topNew = '["/","/tv","/movies","/games","/books","/youtube"]';
if (c.includes(topNew)) { console.log('youtube frontend: top nav already includes /youtube'); }
else if (!c.includes(topOld)) { console.log('youtube frontend: top nav anchor not found (skipping)'); }
else { c = c.split(topOld).join(topNew); console.log('youtube frontend: added /youtube to top nav (right of Books)'); }

// Strip /youtube from side hamburger if a previous version added it there.
const sideWithYt = '["/upcoming","/in-progress","/calendar","/lists","/watchlist","/downloaded","/youtube"]';
const sideWithoutYt = '["/upcoming","/in-progress","/calendar","/lists","/watchlist","/downloaded"]';
if (c.includes(sideWithYt)) {
  c = c.replace(sideWithYt, sideWithoutYt);
  console.log('youtube frontend: removed /youtube from side hamburger (top nav only)');
}

fs.writeFileSync(bundlePath, c);
console.log('youtube frontend: complete');

})();
