// patch_20_loose_aip_inprogress.js
//
// Make AIP-manual a universal force-include for both TV and non-TV, and
// expose an `inProgress` computed field on the items API + details API so
// the popup AIP toggle reflects real /in-progress visibility instead of
// just the raw activelyInProgress flag.
//
// Why: reported 2026-05-26 on Subnautica (video_game, has seen rows, AIP
// excluded=0). The popup button showed "Quitar de proceso" because raw
// t.activelyInProgress=true, but Subnautica wasn't actually visible in
// /in-progress — patch_12 had gated the AIP-manual SQL branch for non-TV
// with `whereNotExists(seen)` to suppress completed items, and that
// suppression overrode the user's manual mark. So clicking "Quitar"
// removed AIP without ever having shown Subnautica anywhere.
//
// Changes:
//   (A) items.js SQL: drop the qc gate on the AIP-manual branch. Now
//       AIP excluded=0 always makes the item visible in /in-progress.
//       The whereNotExists(AIP.excluded=true) gate on the natural sub
//       still applies, so "Quitar de proceso" still force-hides.
//   (B) items.js mapRawResult: emit a computed `inProgress` field that
//       mirrors the (now loosened) SQL.
//   (C) controllers/item.js details: keep the patch_17 TV computation,
//       and replace the non-TV branch (which was just `_aipAc`) with the
//       full natural+AIP formula to match the items query.
//   (D) Bundle popup: switch `Boolean(t.activelyInProgress)` to
//       `Boolean(t.inProgress)` so the button label and the actual
//       /in-progress visibility agree.

const fs = require('fs');
const child = require('child_process');

// === (A) + (B) items.js SQL + mapRawResult ===
(function () {
  const filePath = '/app/build/knex/queries/items.js';
  const marker = '/*mt-fork:loose-aip-inprogress*/';
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.includes(marker)) {
    console.log('loose-aip-inprogress (items.js): already applied');
    return;
  }

  // (A) drop the qc gate from the AIP-manual branch
  const oldQc =
    ".where(qc => qc.where('mediaItem.mediaType', 'tv').orWhereNotExists(function() { this.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId); }))";
  if ((c.split(oldQc).length - 1) !== 1) {
    console.error('loose-aip-inprogress (items.js): qc anchor count != 1');
    process.exit(1);
  }
  c = c.replace(oldQc, '');
  console.log('loose-aip-inprogress (items.js): AIP-manual qc gate removed');

  // (B) Insert inProgress into mapRawResult. Anchor on the unique
  // activelyInProgressExcluded line.
  const mapAnchor = "activelyInProgressExcluded: Boolean(row.activelyInProgressExcludedFlag),";
  if ((c.split(mapAnchor).length - 1) !== 1) {
    console.error('loose-aip-inprogress (items.js): mapRawResult anchor count != 1');
    process.exit(1);
  }
  const inProgressJs =
    "\n    inProgress: (function(){" +
      "var _ex=Boolean(row.activelyInProgressExcludedFlag);" +
      "if(_ex)return false;" +
      "var _ac=Boolean(row.activelyInProgressFlag);" +
      "if(row['mediaItem.mediaType']==='tv'){" +
        "var _unseen=Number(row.unseenEpisodesCount)||0;" +
        "var _aired=Number(row.numberOfEpisodes)||0;" +
        "var _seen=Math.max(0,_aired-_unseen);" +
        "var _fueId=row['firstUnwatchedEpisode.id'];" +
        "var _fueProg=Number(row['firstUnwatchedEpisode.progress'])||0;" +
        "var _onWl=Boolean(row['listItem.id']);" +
        "return (_seen>0&&_unseen>0)||(_fueId&&_fueProg>0)||(_onWl&&_fueId)||_ac;" +
      "}else{" +
        "var _has=Boolean(row['lastSeen.mediaItemId']);" +
        "var _prog=Number(row['progress'])||0;" +
        "var _aprog=Number(row['mediaItem.audioProgress'])||0;" +
        "return (_prog>0&&_prog<1&&!_has)||(_aprog>0&&_aprog<1&&!_has)||_ac;" +
      "}" +
    "})(),";
  c = c.replace(mapAnchor, mapAnchor + inProgressJs);
  console.log('loose-aip-inprogress (items.js): inProgress field added to mapRawResult');

  c = marker + '\n' + c;
  fs.writeFileSync(filePath, c);
  try {
    delete require.cache[require.resolve(filePath)];
    require(filePath);
    console.log('loose-aip-inprogress (items.js): syntax OK');
  } catch (e) {
    console.error('loose-aip-inprogress (items.js): SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
    process.exit(1);
  }
})();

// === (C) controllers/item.js details.inProgress (non-TV branch) ===
(function () {
  const filePath = '/app/build/controllers/item.js';
  const marker = '/*mt-fork:loose-aip-inprogress-details*/';
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.includes(marker)) {
    console.log('loose-aip-inprogress (details): already applied');
    return;
  }
  const oldElse =
    "} else {\n" +
    "          details.inProgress = _aipAc;\n" +
    "        }";
  if ((c.split(oldElse).length - 1) !== 1) {
    console.error('loose-aip-inprogress (details): non-TV branch anchor count != 1');
    process.exit(1);
  }
  const newElse =
    "} else {\n" +
    "          " + marker + "\n" +
    "          const _prog = Number(details.progress) || 0;\n" +
    "          const _aprog = Number(details.audioProgress) || 0;\n" +
    "          const _hasSeen = Boolean(details.seen) || (Array.isArray(details.seenHistory) && details.seenHistory.length > 0);\n" +
    "          details.inProgress = !_aipEx && ((_prog > 0 && _prog < 1 && !_hasSeen) || (_aprog > 0 && _aprog < 1 && !_hasSeen) || _aipAc);\n" +
    "        }";
  c = c.replace(oldElse, newElse);
  fs.writeFileSync(filePath, c);
  try {
    delete require.cache[require.resolve(filePath)];
    require(filePath);
    console.log('loose-aip-inprogress (details): applied + syntax OK');
  } catch (e) {
    console.error('loose-aip-inprogress (details): SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
    process.exit(1);
  }
})();

// === (D) Bundle: popup uses t.inProgress ===
(function () {
  const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
  const marker = '/*mt-fork:popup-uses-inprogress*/';
  let c = fs.readFileSync(bundlePath, 'utf8');
  if (c.includes(marker)) {
    console.log('loose-aip-inprogress (popup): already applied');
    return;
  }
  // Anchor on the popup IIFE that decides between Quitar/Marcar.
  const oldPopup = 'var _aip=Boolean(t.activelyInProgress);if(_aip){var _delAip=function(){';
  if ((c.split(oldPopup).length - 1) !== 1) {
    console.error('loose-aip-inprogress (popup): anchor count != 1');
    process.exit(1);
  }
  const newPopup = 'var _aip=Boolean(t.inProgress);if(_aip){var _delAip=function(){';
  c = c.replace(oldPopup, newPopup);
  c = '/*' + marker.slice(2, -2) + '*/\n' + c;
  fs.writeFileSync(bundlePath, c);
  try {
    child.execSync('node --check ' + bundlePath, { stdio: 'pipe' });
    console.log('loose-aip-inprogress (popup): bundle syntax OK');
  } catch (e) {
    console.error('loose-aip-inprogress (popup): SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
    process.exit(1);
  }
})();

console.log('loose-aip-inprogress: complete');
