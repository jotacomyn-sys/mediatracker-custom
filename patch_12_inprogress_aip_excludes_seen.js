// patch_12_inprogress_aip_excludes_seen.js
// Bug: non-tv items (movies/games/books/audiobooks) marked as completed (any
// row in 'seen') stayed in /in-progress because the onlyWithProgress filter's
// three non-tv branches all ignored 'seen' state:
//   - progress.progress in (0,1)              (Plex/Jellyfin scrobble residue)
//   - mediaItem.audioProgress in (0,1)        (audiobook position residue)
//   - activelyInProgress.excluded=false       (manual 'Mark as in progress')
// Fix: gate each of those three branches with a 'no seen row for this user'
// check. TV branches are left untouched — the natural seenEpisodes>0 AND
// unseenEpisodes>0 gate already handles completed series, and the user asked
// not to touch the series logic.

const fs = require('fs');
const filePath = '/app/build/knex/queries/items.js';

const marker = '/*mt-fork:inprogress-non-tv-excludes-seen*/';
let c = fs.readFileSync(filePath, 'utf8');
if (c.includes(marker)) {
  console.log('inprogress-non-tv-excludes-seen: already applied');
  process.exit(0);
}

const seenGuard =
  ".whereNotExists(function() { this.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId); })";

// Branch 1 — non-tv with progress.progress in (0,1)
const a1 =
  "qb.whereNot('mediaItem.mediaType', 'tv').whereNotNull('progress.mediaItemId').where('progress.progress', '>', 0).where('progress.progress', '<', 1)";
if ((c.split(a1).length - 1) !== 1) {
  console.error('inprogress-non-tv-excludes-seen: branch1 anchor count != 1');
  process.exit(1);
}
c = c.replace(a1, a1 + seenGuard);

// Branch 5 — non-tv with mediaItem.audioProgress in (0,1) (main filter, not count)
const a5 =
  ".orWhere(qb => qb.whereNot('mediaItem.mediaType', 'tv').where('mediaItem.audioProgress', '>', 0).where('mediaItem.audioProgress', '<', 1))";
const r5 =
  ".orWhere(qb => qb.whereNot('mediaItem.mediaType', 'tv').where('mediaItem.audioProgress', '>', 0).where('mediaItem.audioProgress', '<', 1)" +
  seenGuard + ")";
if ((c.split(a5).length - 1) !== 1) {
  console.error('inprogress-non-tv-excludes-seen: branch5 anchor count != 1');
  process.exit(1);
}
c = c.replace(a5, r5);

// Branch 6 — AIP active fallback (gate with mediaType='tv' OR no seen row)
const a6 =
  ".orWhere(qb => qb.whereExists(function() { this.from('activelyInProgress').whereRaw('activelyInProgress.mediaItemId = mediaItem.id').where('activelyInProgress.userId', userId).where('activelyInProgress.excluded', false); })));";
const r6 =
  ".orWhere(qb => qb.whereExists(function() { this.from('activelyInProgress').whereRaw('activelyInProgress.mediaItemId = mediaItem.id').where('activelyInProgress.userId', userId).where('activelyInProgress.excluded', false); }).where(qc => qc.where('mediaItem.mediaType', 'tv').orWhereNotExists(function() { this.from('seen').whereRaw('seen.mediaItemId = mediaItem.id').where('seen.userId', userId); }))));";
if ((c.split(a6).length - 1) !== 1) {
  console.error('inprogress-non-tv-excludes-seen: branch6 anchor count != 1');
  process.exit(1);
}
c = c.replace(a6, r6);

c = marker + '\n' + c;
fs.writeFileSync(filePath, c);

try {
  delete require.cache[require.resolve(filePath)];
  require(filePath);
  console.log('inprogress-non-tv-excludes-seen: applied + syntax OK');
} catch (e) {
  console.error('inprogress-non-tv-excludes-seen: SYNTAX ERROR -> ' + (e.message || '').slice(0, 300));
  process.exit(1);
}
