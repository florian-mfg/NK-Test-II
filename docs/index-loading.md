# Index loading and release verification

The Index consumes the existing published Sanity project `ck6xe2er`, dataset
`production`. Its order and desktop/mobile preview selection remain CMS driven.

Mobile input uses completed vertical swipes: up selects the next entry, down the
previous entry; taps do not select. Minimum travel is 45 CSS px and vertical
movement must be at least 1.5 times horizontal. Cancellation, multi-touch and
control-origin gestures do not navigate. The existing cyclic order is preserved.
Keyboard/assistive title activation remains available; desktop pointer behavior
is unchanged. The signed queue resolves each gesture after the previous commit.

Initial navigation waits for required media (current/previous/next on mobile,
first previews on desktop), subject to the video budget. Images must decode;
MP4s must provide an initial frame (readyState >= 2). The track-free white
170×3px loading line counts settled required jobs, not elapsed time or whole-file
download percentages. Per-resource and initial-budget deadlines are 12 and
20 seconds. Initial gestures remain gated until preparation settles.

Preparation runs at most two image jobs and one video job. The cache retains up
to eight images and at most two source-owning videos, including preparing video.
Video allocation is deferred until job start and capacity is available; an
inactive settled player is released before another starts. The displayed player
is protected. Queued descriptors without a node own no native media resource.
Eviction pauses inactive video, removes its source and resets the native player.
Mobile lookahead considers current, previous/next and second neighbors, within
these limits. It never preloads the complete Index. Large Sanity images use
display-sized derivatives; small sources and saved crops are preserved.

A failed or timed-out target never commits a title alone. The request searches in
its original direction for a ready entry, with cyclic wrapping, visiting each
candidate at most once. Title, index and decoded media commit together. The
previous valid frame/title stays visible and its video keeps playing while a
replacement prepares. The total recovery search is bounded to 20 seconds.
Exhaustion retains the last valid entry, releases the movement latch and offers
an explicit Retry. Retry clears negative records for a new bounded attempt;
returning to Index also clears negative cache entries. No usable initial media
means no false active title is exposed. Leaving Index cancels pending work;
resident ready media can be reused across routes.

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
- `REAL_CONTENT_TEST=1`: `tests/mobile-index-swipes-live-browser.test.cjs`
  checks local runtime against the current published Index with directional swipes.

Historical `sanity-index-performance-browser` and `sanity-index-failure-live-browser`
suites retain tap-era expectations; they are not the current swipe release gates.
Use the maintained gesture/recovery suites below for current behavior.

Serve the checkout on `http://127.0.0.1:5500/`, an existing Sanity CORS origin.
`SITE_BASE_URL` can target another approved origin, including production after a
successful deployment. Browser outputs under `reports/` are local artifacts,
not application inputs or release assets. CMS counts remain dynamic.

Chrome constrained profiles use CDP bandwidth/latency shaping; WebKit profiles
add CDN request latency without claiming equivalent bandwidth shaping. JS heap
measurements exclude native media buffers. Physical iPhone/iPad validation and
the documented raster rendering limits remain separate from these checks.

## Maintained mobile/recovery regressions

Run browser files serially to avoid competing native encoders and timing noise:

```sh
BROWSER_TEST=1 PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core \
  node --test --test-concurrency=1 \
  tests/index-recovery-budget-browser.test.cjs \
  tests/index-initial-failure-browser.test.cjs \
  tests/index-loading-browser.test.cjs \
  tests/mobile-index-swipes-browser.test.cjs \
  tests/scroll-index-refinements-browser.test.cjs \
  tests/frontpage-contrast-browser.test.cjs
```

`REAL_CONTENT_TEST=1` enables `tests/mobile-index-swipes-live-browser.test.cjs`.
It renders local runtime files against read-only published Sanity content, checks
actual title/media readiness and keeps CMS counts dynamic. The resource tests
instrument native source assignments, counting visible, cached and preparing
players together, rather than only inspecting cache size after a transition.

All mobile root/body/page canvases and theme colors are white. Desktop Index
keeps its existing black background. Native media component surfaces and media
appearance are preserved.
