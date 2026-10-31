# Index loading and release verification

The Index consumes the existing published Sanity project `ck6xe2er`, dataset
`production`. Its order and desktop/mobile preview selection remain CMS driven.

Initial navigation waits for the first preview and up to two upcoming previews,
subject to a two-video budget. Images must decode; MP4s must provide an initial
frame (`loadeddata`, readyState >= 2). Failed resources settle into the existing
fallback. The track-free white 170×3px line counts settled required jobs, not
elapsed time or whole-file download percentages. Per-resource and initial-budget
deadlines are 12 and 20 seconds.

Preparation runs at most two image jobs and one video job. The rolling cache
retains up to eight images and two videos, protects the displayed node, and
prioritizes nearby entries. Large Sanity images use display-sized derivatives;
small sources and saved crops are preserved. Later cold loads retain the last
preview. Leaving the Index cancels pending work; resident media can be reused.

A prepared video hands off to a waiting consumer before the preparer considers
pausing it. Only detached warm nodes pause. Pausing and immediately replaying an
attached consumer during `loadeddata` can strand WebKit playback at time zero.
The regression test in `tests/index-page.test.cjs` preserves this distinction.

## Local verification

From the repository root, run frontend tests with `node --test tests/*.test.cjs`.
From `studio`, run `node --import tsx --test tests/*.test.mjs` and `npm run check`.
Browser suites require installed Chrome/WebKit and `playwright-core`; set
`PLAYWRIGHT_MODULE_PATH` if it is not available through normal module resolution.

Use `BROWSER_TEST=1` for the maintained fixture browser suites. Live suites are
explicitly opt-in and read-only:

- `LIVE_SANITY_TEST=1`: `tests/sanity-live-integration.test.cjs` checks published
  documents, ordering, project details and revision stability.
- `LIVE_SANITY_INDEX_TEST=1`: `tests/sanity-index-performance-browser.test.cjs`
  checks desktop/mobile normal and constrained network profiles.
- `LIVE_SANITY_REFINEMENTS_TEST=1`: `tests/sanity-refinements-live-browser.test.cjs`
  checks the approved colors, loading, cursor, Info and submenu refinements.
- `LIVE_SANITY_INDEX_FAILURE_TEST=1`: `tests/sanity-index-failure-live-browser.test.cjs`
  withholds one actual initial image locally to test the real deadline/fallback.
  It queries published content itself and does not require report snapshots.

Serve the checkout on `http://127.0.0.1:5500/`, an existing Sanity CORS origin.
`SITE_BASE_URL` can target another approved origin, including production after a
successful deployment. Browser outputs under `reports/` are local artifacts,
not application inputs or release assets. CMS counts remain dynamic.

Chrome constrained profiles use CDP bandwidth/latency shaping; WebKit profiles
add CDN request latency without claiming equivalent bandwidth shaping. JS heap
measurements exclude native media buffers. Physical iPhone/iPad validation and
the documented raster rendering limits remain separate from these checks.
