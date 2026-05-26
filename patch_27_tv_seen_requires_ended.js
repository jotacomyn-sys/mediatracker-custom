// patch_27_tv_seen_requires_ended.js
//
// "Marcar/Quitar completado" was flipping to "Quitar completado" for any
// Returning Series whose aired episodes were all watched (e.g. Euphoria
// after watching the latest aired episode while season 3 is still
// airing). The user expects:
//   - watching an episode marks only that episode as seen,
//   - the SERIES is considered completed only when status indicates the
//     show is finished (i.e. not Returning Series / In Production /
//     Planned) AND all aired episodes are seen.
//
// Three changes:
//   (A) items.js mapRawResult: TV `seen` flag also requires status NOT
//       in [Returning Series, In Production, Planned].
//   (B) knex/queries/details.js: same gate for the detail-page `seen`.
//   (C) Bundle button condition: drop the
//         seenHistory.some(s=>s.kind==='played')
//       term, which short-circuited the TV gate above by treating any
//       per-episode 'played' row as series-level completion. After
//       removal, the conditional relies on a.seen (now correctly
//       computed), progress and audioProgress.

const fs = require('fs');
const child = require('child_process');

const ENDED_GATE_JS_ITEMS =
  "[\"Returning Series\",\"In Production\",\"Planned\"].indexOf(row['mediaItem.status']) < 0";
const ENDED_GATE_JS_DETAILS =
  "[\"Returning Series\",\"In Production\",\"Planned\"].indexOf(mediaItem.status) < 0";

// === (A) items.js mapRawResult ===
(function () {
  const filePath = '/app/build/knex/queries/items.js';
  const marker = '/*mt-fork:tv-seen-requires-ended-items*/';
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.includes(marker)) {
    console.log('tv-seen-ended (items.js): already applied');
    return;
  }
  const oldExpr = "seen: row['mediaItem.mediaType'] === 'tv' ? row.numberOfEpisodes > 0 && !row.unseenEpisodesCount : Boolean(row['lastSeen.mediaItemId']),";
  if ((c.split(oldExpr).length - 1) !== 1) {
    console.error('tv-seen-ended (items.js): anchor count != 1');
    process.exit(1);
  }
  const newExpr = "seen: " + marker + " row['mediaItem.mediaType'] === 'tv' ? (row.numberOfEpisodes > 0 && !row.unseenEpisodesCount && " + ENDED_GATE_JS_ITEMS + ") : Boolean(row['lastSeen.mediaItemId']),";
  c = c.replace(oldExpr, newExpr);
  fs.writeFileSync(filePath, c);
  try {
    delete require.cache[require.resolve(filePath)];
    require(filePath);
    console.log('tv-seen-ended (items.js): applied + syntax OK');
  } catch (e) {
    console.error('tv-seen-ended (items.js): SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
    process.exit(1);
  }
})();

// === (B) details.js ===
(function () {
  const filePath = '/app/build/knex/queries/details.js';
  const marker = '/*mt-fork:tv-seen-requires-ended-details*/';
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.includes(marker)) {
    console.log('tv-seen-ended (details.js): already applied');
    return;
  }
  const oldExpr = "const seen = mediaItem.mediaType === 'tv' ? numberOfEpisodes > 0 && unseenEpisodesCount === 0 : seenHistory && (seenHistory === null || seenHistory === void 0 ? void 0 : seenHistory.length) > 0;";
  if ((c.split(oldExpr).length - 1) !== 1) {
    console.error('tv-seen-ended (details.js): anchor count != 1');
    process.exit(1);
  }
  const newExpr = marker + " const seen = mediaItem.mediaType === 'tv' ? (numberOfEpisodes > 0 && unseenEpisodesCount === 0 && " + ENDED_GATE_JS_DETAILS + ") : seenHistory && (seenHistory === null || seenHistory === void 0 ? void 0 : seenHistory.length) > 0;";
  c = c.replace(oldExpr, newExpr);
  fs.writeFileSync(filePath, c);
  try {
    delete require.cache[require.resolve(filePath)];
    require(filePath);
    console.log('tv-seen-ended (details.js): applied + syntax OK');
  } catch (e) {
    console.error('tv-seen-ended (details.js): SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
    process.exit(1);
  }
})();

// (C) The bundle button conditional uses `a.seen === true` for TV
// directly (the seenHistory.some(...) branch is gated by mediaType ===
// 'video_game'), so fixing a.seen via (A)+(B) is enough — no bundle
// patch needed for the button label.

console.log('patch_27: complete');
