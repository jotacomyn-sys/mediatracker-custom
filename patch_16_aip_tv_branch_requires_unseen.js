// patch_16_aip_tv_branch_requires_unseen.js
// In the onlyWithProgress (/in-progress) query, gate the AIP-manual branch
// for TV with `unseenEpisodesCount > 0`. Previously the gate was just
// `mediaType = 'tv'`, so a TV series with AIP excluded=0 + all aired
// episodes seen stayed pinned in /in-progress until the user clicked
// "Quitar de en proceso" manually — even when "Marcar como completado",
// the Jellyfin sync, or watching the last aired episode one-by-one
// brought the series to caught-up.
//
// After this patch:
//   - Caught up (unseen=0) + AIP excluded=0  -> branch fails -> hidden
//   - Has aired-unseen (unseen>0) + AIP excluded=0 -> branch matches -> shown
//   - Watching mid-season (natural rule already matches) -> unchanged
//   - Pre-airing series (status=Planned, no aired eps) marked AIP manually
//     no longer appears in /in-progress (was a degenerate case anyway —
//     nothing to watch).
//
// The non-TV side of the qc (`orWhereNotExists seen`) is left untouched.

const fs = require('fs');
const filePath = '/app/build/knex/queries/items.js';
const marker = '/*mt-fork:aip-tv-branch-requires-unseen*/';

let c = fs.readFileSync(filePath, 'utf8');
if (c.includes(marker)) {
  console.log('aip-tv-branch-requires-unseen: already applied');
  process.exit(0);
}

const oldQc =
  ".where(qc => qc.where('mediaItem.mediaType', 'tv').orWhereNotExists(function() { this.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId); }))";

if ((c.split(oldQc).length - 1) !== 1) {
  console.error('aip-tv-branch-requires-unseen: qc anchor count != 1');
  process.exit(1);
}

const newQc =
  ".where(qc => qc.where(qd => qd.where('mediaItem.mediaType', 'tv').where('unseenEpisodesCount', '>', 0)).orWhereNotExists(function() { this.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId); }))";

c = c.replace(oldQc, newQc);
c = marker + '\n' + c;
fs.writeFileSync(filePath, c);

try {
  delete require.cache[require.resolve(filePath)];
  require(filePath);
  console.log('aip-tv-branch-requires-unseen: applied + syntax OK');
} catch (e) {
  console.error('aip-tv-branch-requires-unseen: SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
  process.exit(1);
}
