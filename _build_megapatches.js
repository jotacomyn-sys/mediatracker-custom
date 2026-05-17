// Throwaway generator: bundles 184 patch_*.js files into 10 mega-patches.
// Run from /home/oem/mis_contenedores/mediatoc/.
// After successful rebuild + smoke test, delete this file along with the originals.

const fs = require('fs');

const BUCKETS = {
  'patch_01_security_pre_npm.js': [
    'patch_security_updates.js',
  ],
  'patch_02_backend_db_items.js': [
    'patch_version.js',
    'patch_auto_restore.js',
    'patch_dbconfig.js',
    'patch_items_v2.js',
    'patch_items_disambiguate.js',
    'patch_tv_episode_progress_in_items.js',
    'patch_in_progress_filter.js',
    'patch_items_progress_sort_ambiguous.js',
  ],
  'patch_03_downloaded_links_wp.js': [
    'patch_downloaded_migration.js',
    'patch_downloaded_entity.js',
    'patch_downloaded_repo.js',
    'patch_downloaded_items.js',
    'patch_audio_progress_in_items.js',
    'patch_downloaded_controller.js',
    'patch_downloaded_routes.js',
    'patch_downloaded_frontend.js',
    'patch_audiobook_icon.js',
    'patch_links_migration.js',
    'patch_links_entity.js',
    'patch_links_controller.js',
    'patch_links_routes.js',
    'patch_links_frontend.js',
    'patch_wp_controller.js',
    'patch_wp_routes.js',
    'patch_wp_frontend.js',
    'patch_progress_card.js',
    'patch_login_page.js',
  ],
  'patch_04_backup_audiobook_episodes.js': [
    'patch_backup_controller.js',
    'patch_backup_routes.js',
    'patch_backup_frontend.js',
    'patch_audiobook_position.js',
    'patch_audiobook_progress.js',
    'patch_unify_books.js',
    'patch_unify_books_frontend.js',
    'patch_game_playing.js',
    'patch_game_seen.js',
    'patch_progress_modal.js',
    'patch_hide_seen_summary.js',
    'patch_tooltips.js',
    'patch_progress_redesign.js',
    'patch_audio_progress_migration.js',
    'patch_audio_progress_entity.js',
    'patch_audio_progress_controller.js',
    'patch_audio_progress_routes.js',
    'patch_audio_progress_frontend.js',
    'patch_sidebar_grid.js',
    'patch_completed_badge.js',
    'patch_audio_listened_icon.js',
    'patch_episode_buttons_short.js',
    'patch_episode_progress_migration.js',
    'patch_episode_progress_entity.js',
    'patch_episode_progress_controller.js',
    'patch_episode_progress_routes.js',
    'patch_episode_progress_frontend.js',
    'patch_episode_page_grid.js',
  ],
  'patch_05_perf_seen_items_opt.js': [
    'patch_fetch_runtimes_controller.js',
    'patch_fetch_runtimes_routes.js',
    'patch_fetch_runtimes_frontend.js',
    'patch_hltb_controller.js',
    'patch_hltb_routes.js',
    'patch_cleanup_controller.js',
    'patch_cleanup_routes.js',
    'patch_perf_indexes_migration.js',
    'patch_perf_indexes_v2_migration.js',
    'patch_perf_indexes_v3_migration.js',
    'patch_seen_kind_migration.js',
    'patch_seen_kind_wiring.js',
    'patch_states_independent.js',
    'patch_items_dedupe_lastseen.js',
    'patch_game_watched_card_icon.js',
    'patch_items_query_cache.js',
    'patch_items_short_circuit_seen_episodes.js',
    'patch_items_force_index.js',
    'patch_items_simple_count.js',
    'patch_only_seen_items_truthy.js',
    'patch_games_seen_filter.js',
    'patch_items_only_downloaded.js',
  ],
  'patch_06_navigation_dupes_security.js': [
    'patch_menu_restructure.js',
    'patch_menu_split.js',
    'patch_settings_appearance.js',
    'patch_library_search.js',
    'patch_lists_page.js',
    'patch_watchlist_tab.js',
    'patch_downloaded_tab.js',
    'patch_sectioned_pages.js',
    'patch_dupes_controller.js',
    'patch_dupes_routes.js',
    'patch_dupes_frontend.js',
    'patch_games_total_time.js',
    'patch_upcoming_filter.js',
    'patch_calendar_all.js',
    'patch_recently_released.js',
    'patch_metadata_throttle.js',
    'patch_silence_episode_dupes.js',
    'patch_skip_startup_metadata.js',
    'patch_igdb_time_to_beat.js',
    'patch_stats_distinct_game_runtime.js',
    'patch_auto_refresh_games_on_stats.js',
    'patch_youtube_stats_in_summary.js',
    'patch_book_reading_minutes.js',
    'patch_refresh_game_runtimes.js',
    'patch_sw_no_cache.js',
    'patch_accept_encoding_safe.js',
    'patch_download_asset_ua.js',
  ],
  'patch_07_jellyfin_youtube_oauth.js': [
    'patch_jellyfin_controller.js',
    'patch_jellyfin_routes.js',
    'patch_jellyfin_frontend.js',
    'patch_jellyfin_play_button.js',
    'patch_jellyfin_card_badge.js',
    'patch_jellyfin_reverse.js',
    'patch_jellyfin_admin_only.js',
    'patch_jellyfin_runtime_config.js',
    'patch_admin_only_endpoints.js',
    'patch_user_byid_gate.js',
    'patch_seen_delete_idor.js',
    'patch_watchlist_autoremove.js',
    'patch_about_thanks.js',
    'patch_youtube_controller.js',
    'patch_youtube_routes.js',
    'patch_body_limit.js',
    'patch_session_samesite_lax.js',
    'patch_cookie_secure.js',
    'patch_youtube_oauth_controller.js',
    'patch_youtube_oauth_routes.js',
    'patch_youtube_watched_controller.js',
    'patch_youtube_watched_routes.js',
    'patch_youtube_frontend.js',
  ],
  'patch_08_i18n_theater_homepage.js': [
    'patch_ui_language_switcher.js',
    'patch_i18n_custom.js',
    'patch_theater_nav.js',
    'patch_theater_routes_enum.js',
    'patch_theater_metadata_provider.js',
    'patch_theater_teatroes_provider.js',
    'patch_theater_card_icon.js',
    'patch_theater_seen_button.js',
    'patch_homepage_remove_audiobooks.js',
    'patch_homepage_youtube_block.js',
    'patch_homepage_theater_block.js',
    'patch_homepage_exclude_abandoned.js',
    'patch_homepage_remove_next_episode.js',
    'patch_section_pages_minimal_grid.js',
    'patch_persistent_state.js',
    'patch_query_cache_tuning.js',
    'patch_homepage_games_hours.js',
    'patch_refresh_game_runtimes_frontend.js',
    'patch_rename_inprogress_to_pendiente.js',
    'patch_pendiente_games_consistent.js',
    'patch_filter_seen_games_only.js',
  ],
  'patch_09_abandoned_inprogress_counts.js': [
    'patch_abandoned_migration.js',
    'patch_reset_outlier_game_runtimes.js',
    'patch_abandoned_controller.js',
    'patch_abandoned_routes.js',
    'patch_abandoned_filter.js',
    'patch_abandoned_frontend.js',
    'patch_actively_in_progress_backend.js',
    'patch_actively_in_progress_frontend.js',
    'patch_item_flags_combined.js',
    'patch_mark_watched_button.js',
    'patch_details_includes_flags.js',
    'patch_update_metadata_btn.js',
    'patch_per_game_runtime_refresh.js',
    'patch_games_igdb_hint.js',
    'patch_theater_hide_iam_btn.js',
    'patch_theater_seen_history_link.js',
    'patch_iam_to_inprogress.js',
    'patch_modal_clear_progress.js',
    'patch_count_in_library.js',
    'patch_count_query_abandoned.js',
    'patch_only_just_watched.js',
    'patch_games_seen_split.js',
  ],
  'patch_10_visual_tokens_bundle.js': [
    'patch_background_colors.js',
    'patch_css_btn_green.js',
    'patch_css_items_grid_fluid.js',
    'patch_items_grid_no_center.js',
    'patch_settings_import_backup_inside.js',
    'patch_css_rename.js',
    'patch_credentials_to_tokens.js',
    'patch_tmdb_user_key.js',
    'patch_jellyfin_import_from_server.js',
    'patch_jellyfin_import_buttons.js',
    'patch_bundle_rename.js',
    'patch_index_html_title.js',
    'patch_pwa.js',
  ],
};

// Sanity check: every patch_*.js on disk (minus the orphan + the new mega-patches
// + this generator itself) must appear exactly once across all buckets.
const onDisk = fs.readdirSync('.')
  .filter(f => /^patch_[a-z0-9_]+\.js$/.test(f))
  .filter(f => !/^patch_(0[1-9]|10)_/.test(f))   // exclude already-generated megas
  .filter(f => f !== 'patch_ug_progress_text.js'); // known orphan, intentionally dropped

const allBucketed = Object.values(BUCKETS).flat();
const bucketedSet = new Set(allBucketed);

if (allBucketed.length !== bucketedSet.size) {
  const dups = allBucketed.filter((x, i) => allBucketed.indexOf(x) !== i);
  console.error('FATAL: duplicate entries in BUCKETS:', dups);
  process.exit(1);
}

const onDiskSet = new Set(onDisk);
const missing = [...onDiskSet].filter(f => !bucketedSet.has(f));
const extra = [...bucketedSet].filter(f => !onDiskSet.has(f));

if (missing.length || extra.length) {
  console.error('FATAL: bucket map mismatch with disk');
  if (missing.length) console.error('  on disk but not bucketed:', missing);
  if (extra.length) console.error('  bucketed but missing on disk:', extra);
  process.exit(1);
}

console.log(`Bucketing ${onDisk.length} patches into ${Object.keys(BUCKETS).length} mega-patches.`);

for (const [megaName, patches] of Object.entries(BUCKETS)) {
  const header = [
    `// Auto-generated mega-patch: ${megaName}`,
    `// Bundles ${patches.length} original patch_*.js scripts in execution order.`,
    `// Each constituent is wrapped in an IIFE so its top-level vars (const fs = ...)`,
    `// don't collide; \`process.exit(0)\` is rewritten to \`return\` so an early-exit`,
    `// idempotency guard inside one constituent doesn't abort the whole mega-patch.`,
    '',
  ].join('\n');

  let body = '';
  for (const p of patches) {
    let src = fs.readFileSync(p, 'utf8');
    // Replace early-success exits with `return` so the IIFE bails but the next
    // constituent still runs. Only `process.exit(0)`, never the non-zero ones
    // (those signal real failure and should propagate).
    src = src.replace(/process\.exit\(\s*0\s*\)/g, 'return /* was process.exit(0) */');
    body += `\n// ===== ${p} =====\n;(() => {\n${src}\n})();\n`;
  }

  fs.writeFileSync(megaName, header + body);
  const lines = (header + body).split('\n').length;
  console.log(`  ${megaName}: ${patches.length} patches, ${lines} lines`);
}

console.log('Done.');
