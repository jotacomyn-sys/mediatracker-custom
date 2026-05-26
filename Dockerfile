FROM bonukai/mediatracker:latest@sha256:4397847ec1a88a83e29a9c19c31261af47de730047adc7dbe4bbcbb34ca27df1

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null "http://$(hostname):7481/api/configuration" || exit 1

# --- Security: CVE updates (Trivy-flagged HIGH/CRITICAL on the upstream image) ---

# Alpine: upgrade ALL OS-level packages with HIGH/CRITICAL CVEs flagged by Trivy
# (libcrypto3, libssl3, libpng, expat, libexpat, musl, musl-utils, lcms2, zlib).
# `apk upgrade --available` bumps anything where the repo has a newer version,
# which is the only way to clear most of these without changing base image.
RUN apk update && apk upgrade --no-cache --available && rm -rf /var/cache/apk/*

# Bucket 01 — pre-npm: bumps direct deps (axios, fast-xml-parser, form-data, lodash)
# and adds overrides for path-to-regexp + tar-fs in /app/package.json. Must run
# BEFORE `npm install` so the new ranges + overrides take effect on rebuild.
SHELL ["/bin/sh", "-eo", "pipefail", "-c"]
COPY patch_01_security_pre_npm.js /tmp/patch_01_security_pre_npm.js
RUN node /tmp/patch_01_security_pre_npm.js

# Upstream image ships only the node binary (no npm) so install npm via apk for
# this layer, run install, then keep npm installed (~45MB) — `apk del npm` also
# removes its nodejs dep, which clobbers /usr/local/bin/node and breaks every
# later `RUN node /tmp/patch_*.js` step. Acceptable trade-off.
RUN apk add --no-cache npm && \
    cd /app && rm -f package-lock.json && \
    npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -25 && \
    rm -rf /root/.npm /var/cache/apk/*

# Force express's nested path-to-regexp to 0.1.13 — npm overrides + nested
# install both failed in this image. Workaround: download the 0.1.13 tarball
# from the npm registry and overwrite the nested copy in-place. The 0.1.13
# release is a single-file regex change so this is safe.
# Targets CVE-2026-4867 (ReDoS via catastrophic backtracking).
RUN cd /tmp && \
    wget -q https://registry.npmjs.org/path-to-regexp/-/path-to-regexp-0.1.13.tgz && \
    mkdir -p ptr && tar xzf path-to-regexp-0.1.13.tgz -C ptr && \
    rm -rf /app/node_modules/express/node_modules/path-to-regexp && \
    mv ptr/package /app/node_modules/express/node_modules/path-to-regexp && \
    rm -rf /tmp/ptr /tmp/path-to-regexp-0.1.13.tgz && \
    node -p "'path-to-regexp (express nested) → ' + require('/app/node_modules/express/node_modules/path-to-regexp/package.json').version"

# Sanity: print resolved versions for the bumped packages so build logs document the fix.
RUN cd /app && for p in axios fast-xml-parser form-data lodash; do \
      echo "$p: $(node -p "require('$p/package.json').version")"; \
    done

# --- Mega-patches 02 → 10 (consolidated from ~184 individual patch_*.js scripts) ---
# Each mega-patch is the literal concatenation of its constituents in execution
# order; each constituent is wrapped in an IIFE so its top-level vars don't
# collide, and `process.exit(0)` is rewritten to `return` so an early-success
# guard inside one constituent doesn't abort the whole mega-patch.
# Run order matters: 02 lays the SQL/items foundation; 03–05 add features and
# perf optimizations; 06 reshuffles navigation; 07 wires Jellyfin + YouTube +
# endpoint security; 08 adds i18n + theater + homepage; 09 adds abandoned/
# in-progress states; 10 finishes with CSS/bundle hash bumps + PWA.

# Bucket 02 — backend foundation (SQL pragmas, items query fixes, in-progress filter)
COPY patch_02_backend_db_items.js /tmp/patch_02_backend_db_items.js
RUN node /tmp/patch_02_backend_db_items.js

# Inline: force DD/MM/YYYY date format in the bundle (one-shot sed, not a patch).
# Sits between buckets 02 and 03 — order is irrelevant since no later patch
# expects the original `.toLocaleDateString()` pattern.
RUN BUNDLE=$(ls /app/public/main_*.js) && \
    sed -i 's/\.toLocaleDateString()/.toLocaleDateString("es",{day:"2-digit",month:"2-digit",year:"numeric"})/g' "$BUNDLE" && \
    echo "Frontend: date format DD/MM/YYYY OK"

# Bucket 03 — downloaded + links + watch-providers + small features
COPY patch_03_downloaded_links_wp.js /tmp/patch_03_downloaded_links_wp.js
RUN node /tmp/patch_03_downloaded_links_wp.js

# Bucket 04 — backup, audiobook, episodes, audio progress, UI tweaks
COPY patch_04_backup_audiobook_episodes.js /tmp/patch_04_backup_audiobook_episodes.js
RUN node /tmp/patch_04_backup_audiobook_episodes.js

# Bucket 05 — fetch_runtimes, hltb, cleanup, perf indexes, seen_kind, items query optimizations
COPY patch_05_perf_seen_items_opt.js /tmp/patch_05_perf_seen_items_opt.js
RUN node /tmp/patch_05_perf_seen_items_opt.js

# Bucket 06 — navigation reshuffle, dupes, late perf, security middleware
COPY patch_06_navigation_dupes_security.js /tmp/patch_06_navigation_dupes_security.js
RUN node /tmp/patch_06_navigation_dupes_security.js

# Bucket 07 — Jellyfin integration, endpoint security gates, YouTube + OAuth
COPY patch_07_jellyfin_youtube_oauth.js /tmp/patch_07_jellyfin_youtube_oauth.js
RUN node /tmp/patch_07_jellyfin_youtube_oauth.js

# Bucket 08 — i18n custom keys, UI language switcher, Theater providers, homepage finals
COPY patch_08_i18n_theater_homepage.js /tmp/patch_08_i18n_theater_homepage.js
RUN node /tmp/patch_08_i18n_theater_homepage.js

# Bucket 09 — abandoned + actively-in-progress + theater detail-page + count fixes
COPY patch_09_abandoned_inprogress_counts.js /tmp/patch_09_abandoned_inprogress_counts.js
RUN node /tmp/patch_09_abandoned_inprogress_counts.js

# --- patch_11: serialize SQLite writes (pool.max=1) to kill BUSY storm on parallel TMDB inserts ---
COPY patch_11_db_pool_serialize.js /tmp/patch_11_db_pool_serialize.js
RUN node /tmp/patch_11_db_pool_serialize.js

# --- patch_12: in /in-progress, exclude non-tv items the user has already marked seen ---
COPY patch_12_inprogress_aip_excludes_seen.js /tmp/patch_12_inprogress_aip_excludes_seen.js
RUN node /tmp/patch_12_inprogress_aip_excludes_seen.js

# --- patch_13: on /api/progress?progress=1 (slider to 100%), also remove non-TV items from the watchlist ---
COPY patch_13_progress_completion_watchlist.js /tmp/patch_13_progress_completion_watchlist.js
RUN node /tmp/patch_13_progress_completion_watchlist.js
# --- patch_14: TV-only series-level "in progress" toggle button on detail page (right of sg) ---
COPY patch_14_aip_series_button.js /tmp/patch_14_aip_series_button.js
RUN node /tmp/patch_14_aip_series_button.js
# --- patch_15: DELETE /api/actively-in-progress/:id now deletes the row (no excluded=1) ---
COPY patch_15_aip_remove_deletes_row.js /tmp/patch_15_aip_remove_deletes_row.js
RUN node /tmp/patch_15_aip_remove_deletes_row.js

# Bucket 10 — backgrounds, CSS rules, css_rename hash bump, tokens UI, jellyfin
# import buttons, bundle_rename hash bump, index.html title, PWA manifest+SW.
# This bucket MUST run last among the patches because css_rename and bundle_rename
# bump content hashes — any later modification would orphan the new hash.
COPY patch_10_visual_tokens_bundle.js /tmp/patch_10_visual_tokens_bundle.js
RUN node /tmp/patch_10_visual_tokens_bundle.js

# --- Regenerate compressed bundle (.br and .gz) ---
# The server serves pre-compressed versions when the browser supports them; if we
# leave the originals (which were the upstream bundle), all our frontend patches
# are silently bypassed for any client that sends Accept-Encoding: br|gzip
# (Cloudflare always does).
RUN BUNDLE=$(ls /app/public/main_*.js | grep -v '\.LICENSE\|\.map') && \
    node -e "const fs=require('fs'),zlib=require('zlib');const p='$BUNDLE';const d=fs.readFileSync(p);fs.writeFileSync(p+'.gz',zlib.gzipSync(d,{level:9}));fs.writeFileSync(p+'.br',zlib.brotliCompressSync(d));console.log('Recompressed bundle:',p);"
