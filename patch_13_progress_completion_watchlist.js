// patch_13_progress_completion_watchlist.js
//
// Fix: setting progress to 1.0 via /api/progress (slider to 100% + "Guardar
// progreso") inserts a seen row but never clears the watchlist for non-TV
// items, so movies/books/audiobooks/theater/video_game stayed on the
// "Lista de seguimiento" forever after being completed via the slider.
//
// Frontend "Marcar como completado" (_markCompleted in patch_04) already
// fires DELETE /api/watchlist explicitly for non-TV so that path works.
// But _save (slider's Guardar progreso button) bypasses that and only hits
// /api/progress, leaving the watchlist untouched.
//
// Fix: in controllers/progress.js addItem, after the progress=1 seen insert,
// remove the item from the watchlist if mediaType !== 'tv'. TV items are
// rejected at the controller entry point (mediaType==='tv' returns 400) so
// the non-TV branch covers every case that reaches addItem.

;(() => {
const fs = require('fs');
const path = '/app/build/controllers/progress.js';
let c = fs.readFileSync(path, 'utf8');

if (c.includes('/* WL_COMPLETE_PROGRESS_V1 */')) {
  console.log('progress watchlist completion: already patched');
  return;
}

const oldBlock =
  "  if (args.progress === 1) {\n" +
  "    await _dbconfig.Database.knex.transaction(async trx => {\n" +
  "      await trx('progress').where({\n" +
  "        userId: args.userId,\n" +
  "        mediaItemId: args.mediaItemId,\n" +
  "        episodeId: args.episodeId || null\n" +
  "      }).delete();\n" +
  "      await trx('seen').insert({\n" +
  "        userId: args.userId,\n" +
  "        mediaItemId: args.mediaItemId,\n" +
  "        episodeId: args.episodeId || null,\n" +
  "        date: Date.now(),\n" +
  "        duration: args.duration\n" +
  "      });\n" +
  "    });\n" +
  "  }";

const newBlock =
  "  if (args.progress === 1) {\n" +
  "    /* WL_COMPLETE_PROGRESS_V1 */\n" +
  "    await _dbconfig.Database.knex.transaction(async trx => {\n" +
  "      await trx('progress').where({\n" +
  "        userId: args.userId,\n" +
  "        mediaItemId: args.mediaItemId,\n" +
  "        episodeId: args.episodeId || null\n" +
  "      }).delete();\n" +
  "      await trx('seen').insert({\n" +
  "        userId: args.userId,\n" +
  "        mediaItemId: args.mediaItemId,\n" +
  "        episodeId: args.episodeId || null,\n" +
  "        date: Date.now(),\n" +
  "        duration: args.duration\n" +
  "      });\n" +
  "    });\n" +
  "    try {\n" +
  "      const _mi = await _mediaItem.mediaItemRepository.findOne({ id: args.mediaItemId });\n" +
  "      if (_mi && _mi.mediaType !== 'tv') {\n" +
  "        await _listItemRepository.listItemRepository.removeItem({\n" +
  "          userId: args.userId,\n" +
  "          mediaItemId: args.mediaItemId,\n" +
  "          watchlist: true\n" +
  "        });\n" +
  "      }\n" +
  "    } catch (_) { /* fire-and-forget */ }\n" +
  "  }";

if (!c.includes(oldBlock)) {
  console.error('progress watchlist completion: anchor not found in progress.js');
  process.exit(1);
}
c = c.replace(oldBlock, newBlock);

// Drop the now-misleading "states-independent" marker comment, since
// progress=1 now mutates watchlist on completion (for non-TV).
c = c.replace(
  "  /* mt-fork: states-independent — no implicit watchlist mutation */\n",
  ""
);

fs.writeFileSync(path, c);
console.log('progress watchlist completion: progress=1 now removes non-TV items from watchlist');

// Sanity check
try {
  delete require.cache[require.resolve('/app/build/controllers/progress.js')];
  require('/app/build/controllers/progress.js');
  console.log('progress watchlist completion: controller syntax OK');
} catch (e) {
  console.error('progress watchlist completion: SYNTAX ERROR -> ' + e.message.slice(0, 300));
  process.exit(1);
}
})();
