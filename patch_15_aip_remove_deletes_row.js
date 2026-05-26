// patch_15_aip_remove_deletes_row.js
// Change DELETE /api/actively-in-progress/:mediaItemId so it deletes the
// AIP row instead of flipping excluded=true.
//
// Why: with excluded=true the items.js `whereNotExists(... excluded=true ...)`
// gate blocks the natural /in-progress rules for that series — even when
// new episodes air. Reported 2026-05-26: user clicked "Quitar de en proceso"
// on Euphoria; with the previous semantics the show would NOT auto-reappear
// when the next episode airs. After this patch, "Quitar" just removes the
// row, so the natural rules (seenEpisodes>0 AND unseenEpisodes>0, or the
// WATCHLIST_NONTV_DROPPED_V1 branch) bring the series back automatically as
// soon as a new aired episode exists.
//
// The "exclude permanently" semantics that excluded=true used to provide is
// dropped — no UI relied on it intentionally. The non-TV "mark completed"
// flow already prevents reappearance via the natural-rule gates (progress
// must be in (0,1) AND no seen rows). The whereNotExists gates in items.js
// stay in place but become no-ops once no excluded=1 rows exist.

const fs = require('fs');
const filePath = '/app/build/controllers/item.js';
const marker = '/*mt-fork:aip-remove-deletes-row*/';

let c = fs.readFileSync(filePath, 'utf8');
if (c.includes(marker)) {
  console.log('aip-remove-deletes-row: already applied');
  process.exit(0);
}

const oldBlock =
  "    const existing = await knex('activelyInProgress').where({ userId, mediaItemId }).first();\n" +
  "    if (existing) {\n" +
  "      await knex('activelyInProgress').where({ id: existing.id }).update({ excluded: true });\n" +
  "    } else {\n" +
  "      await knex('activelyInProgress').insert({ userId, mediaItemId, excluded: true, createdAt: Date.now() });\n" +
  "    }\n";

if ((c.split(oldBlock).length - 1) !== 1) {
  console.error('aip-remove-deletes-row: anchor block not found exactly once');
  process.exit(1);
}

const newBlock =
  "    " + marker + "\n" +
  "    const existing = await knex('activelyInProgress').where({ userId, mediaItemId }).first();\n" +
  "    if (existing) {\n" +
  "      await knex('activelyInProgress').where({ id: existing.id }).delete();\n" +
  "    }\n";

c = c.replace(oldBlock, newBlock);
fs.writeFileSync(filePath, c);

try {
  delete require.cache[require.resolve(filePath)];
  require(filePath);
  console.log('aip-remove-deletes-row: applied + syntax OK');
} catch (e) {
  console.error('aip-remove-deletes-row: SYNTAX ERROR -> ' + (String(e.message || '')).slice(0, 400));
  process.exit(1);
}
