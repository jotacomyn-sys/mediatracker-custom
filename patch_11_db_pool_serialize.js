// patch_11_db_pool_serialize.js
//
// Serialize SQLite writes by forcing knex pool.max = 1.
//
// Why: with better-sqlite3 + WAL, several concurrent INSERTs (e.g. catalog
// pre-cache during a "Colony"-style search that hits TMDB + teatroes + tv
// + movie in parallel) keep tripping `SQLITE_BUSY` even though we set
// `busy_timeout=5000` in `pool.afterCreate`. The root cause is that each
// pool slot has its own connection and only one writer can hold the WAL
// lock at a time; the others time out instead of being queued.
//
// Pool max = 1 forces every write to go through the same connection,
// which knex serializes internally — eliminating the BUSY storm and the
// resulting 500/"NaN elementos" the frontend shows.
//
// Read perf is fine because (a) every read still goes through that
// connection but better-sqlite3 is synchronous & fast, and (b) the cache
// pragmas already in afterCreate (mmap_size, cache_size, temp_store)
// keep hot data in memory.
//
// Order: must run after patch_02 (which is what introduced the current
//   pool: { min: 1, max: 5, ... } shape via the original "mt-fork:
//   pool-max-5" marker). Anywhere in patch_02+ is fine.

const fs = require('fs');
const path = '/app/build/dbconfig.js';

let c = fs.readFileSync(path, 'utf8');

// Idempotency check — bail if already serialized.
if (c.includes('mt-fork: pool-max-1')) {
  console.log('patch_11: already serialized (pool-max-1)');
  return /* was process.exit(0) */;
}

// We rewrite the "pool-max-5" marker introduced by patch_02. Be strict:
// only mutate if we find that exact phrasing, so a future patch_02 redesign
// doesn't get silently shadowed by us.
const old = 'pool: { min: 1, max: 5, /* mt-fork: pool-max-5 */';
const fresh = 'pool: { min: 1, max: 1, /* mt-fork: pool-max-1 */';

if (!c.includes(old)) {
  console.error('patch_11: anchor not found (expected `' + old + '`). Is patch_02 still using pool-max-5?');
  process.exit(1);
}

c = c.replace(old, fresh);
fs.writeFileSync(path, c);
console.log('patch_11: pool.max set to 1 (writes serialized)');
