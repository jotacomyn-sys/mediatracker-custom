// patch_17_button_reflects_in_progress.js
//
// (A) Backend: compute details.inProgress on the detail-page payload,
//     mirroring the SQL onlyWithProgress logic for TV. So the series
//     detail page knows whether a series CURRENTLY appears in /in-progress
//     (whether via natural rule, watchlist branch, or AIP-manual).
//
// (B) Frontend: _AIPS (the series-level toggle from patch_14) now reads
//     mi.inProgress instead of mi.activelyInProgress. Click semantics:
//     - if inProgress=true  -> DELETE -> upserts AIP excluded=true -> hide
//     - if inProgress=false -> PUT    -> upserts AIP excluded=false -> show
//     After the click we also invalidate the details query so the button
//     re-renders against the freshly computed inProgress.
//
// Why: before this patch, the button only reflected AIP state. For series
// shown in /in-progress via natural rule or watchlist branch (e.g., The
// Bear with 3 seen of 38 aired) there was no AIP row, so the button said
// "Marcar en proceso" and clicking it would re-add — not what the user
// wanted. With this patch the button correctly shows "Quitar de en proceso"
// for anything currently in /in-progress, and clicking forces it out via
// AIP excluded=true (matching the controller's original DELETE behavior
// that was reverted to in this same commit by removing patch_15).

const fs = require('fs');
const child = require('child_process');

// === (A) Backend: add details.inProgress to item.js controller ===
(function () {
  const filePath = '/app/build/controllers/item.js';
  const marker = '/*mt-fork:details-inprogress-flag*/';
  let c = fs.readFileSync(filePath, 'utf8');
  if (c.includes(marker)) {
    console.log('inprogress-flag (backend): already applied');
    return;
  }
  const anchor = 'details.seenWatched = !!_sw;';
  if ((c.split(anchor).length - 1) !== 1) {
    console.error('inprogress-flag (backend): anchor count != 1');
    process.exit(1);
  }
  const insertion =
    '\n      ' + marker +
    '\n      {' +
    '\n        const _aipEx = !!_aip && !!_aip.excluded;' +
    '\n        const _aipAc = !!_aip && !_aip.excluded;' +
    '\n        const _unseen = Number(details.unseenEpisodesCount) || 0;' +
    '\n        const _aired = Number(details.numberOfEpisodes) || 0;' +
    '\n        const _seenEps = Math.max(0, _aired - _unseen);' +
    '\n        const _onWl = !!details.onWatchlist;' +
    '\n        const _fue = details.firstUnwatchedEpisode;' +
    '\n        const _fueProg = (_fue && Number(_fue.progress)) || 0;' +
    '\n        if (mediaItem.mediaType === \'tv\') {' +
    '\n          details.inProgress = !_aipEx && (' +
    '\n            (_seenEps > 0 && _unseen > 0) ||' +
    '\n            (_fue && _fueProg > 0) ||' +
    '\n            (_onWl && !!_fue) ||' +
    '\n            _aipAc' +
    '\n          );' +
    '\n        } else {' +
    '\n          details.inProgress = _aipAc;' +
    '\n        }' +
    '\n      }';
  c = c.replace(anchor, anchor + insertion);
  fs.writeFileSync(filePath, c);
  try {
    delete require.cache[require.resolve(filePath)];
    require(filePath);
    console.log('inprogress-flag (backend): applied + syntax OK');
  } catch (e) {
    console.error('inprogress-flag (backend): SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
    process.exit(1);
  }
})();

// === (B) Frontend: _AIPS reads mi.inProgress and refreshes details on click ===
(function () {
  const bundlePath = child.execSync('ls /app/public/main_*.js | grep -v "\\.LICENSE\\|\\.map"').toString().trim();
  const marker = '/*mt-fork:aips-uses-inprogress*/';
  let c = fs.readFileSync(bundlePath, 'utf8');
  if (c.includes(marker)) {
    console.log('inprogress-flag (frontend): already applied');
    return;
  }

  // _AIPS state reads activelyInProgress -> switch to inProgress.
  const oldState = 'r.useState(!!mi.activelyInProgress)';
  const newState = 'r.useState(!!mi.inProgress)';
  if ((c.split(oldState).length - 1) !== 1) {
    console.error('inprogress-flag (frontend): _AIPS state anchor count != 1');
    process.exit(1);
  }
  c = c.replace(oldState, newState);

  // After click, also invalidate the details query so the button re-renders
  // against the freshly computed inProgress (otherwise a click that the
  // server overrules — e.g. Marcar on a caught-up series — would leave
  // the button visually flipped until next nav).
  const oldInvalidate =
    'try{HW.removeQueries(["details",mi.id])}catch(_){};';
  const newInvalidate =
    'try{HW.removeQueries(["details",mi.id])}catch(_){}; try{HW.invalidateQueries(["details",mi.id])}catch(_){}; try{HW.refetchQueries(["details",mi.id])}catch(_){};';
  // _AIPS contains this line; _AIP also does. Only patch the _AIPS one to
  // avoid touching the unmounted _AIP. We do that by anchoring on a
  // string unique to _AIPS — the marker injected by patch_14.
  const aipsBlockAnchor = '/*mt-fork:aip-series-button*/';
  const aipsStart = c.indexOf(aipsBlockAnchor);
  if (aipsStart < 0) {
    console.error('inprogress-flag (frontend): aip-series-button marker not found');
    process.exit(1);
  }
  const aipsEnd = c.indexOf('},', aipsStart) + 2; // crude end of fn assignment
  const slice = c.slice(aipsStart, aipsEnd);
  if ((slice.split(oldInvalidate).length - 1) !== 1) {
    console.error('inprogress-flag (frontend): invalidate anchor count in _AIPS != 1');
    process.exit(1);
  }
  const newSlice = slice.replace(oldInvalidate, newInvalidate);
  c = c.slice(0, aipsStart) + newSlice + c.slice(aipsEnd);

  // Drop-in marker so we can re-check idempotency.
  c = '/*' + marker.slice(2, -2) + '*/\n' + c;

  fs.writeFileSync(bundlePath, c);
  try {
    child.execSync('node --check ' + bundlePath, { stdio: 'pipe' });
    console.log('inprogress-flag (frontend): bundle syntax OK');
  } catch (e) {
    console.error('inprogress-flag (frontend): SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
    process.exit(1);
  }
  console.log('inprogress-flag (frontend): complete');
})();
