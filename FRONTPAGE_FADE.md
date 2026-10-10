# Local fullscreen opacity prototype

## Input and tuning

`frontpage-media-fade.js` contains `DISTANCE_PER_IMAGE = 1200` CSS pixels per reveal. Increase it to slow desktop transitions; decrease it to speed them up (20% faster means divide by 1.2, giving 1000). Mobile `MOBILE_TRANSITIONS_PER_SECOND = 0.28` gives about 3.57 seconds of held touch per transition.

Desktop uses accumulated Euclidean mouse distance divided by 1200. Every direction contributes positively. Mobile uses elapsed time only while a valid non-navigation touch is held. Both feed one shared global transition progress and renderer. Final release/cancel cancels the mobile rAF loop immediately. Blur, visibility loss, route changes and input-capability changes also stop it. Navigation controls and links retain normal taps.

## Two fullscreen layers

On load the first image is current at opacity 1; the second is incoming at opacity 0. Both stay in the same fixed viewport rectangle, using width/height 100%, object-fit cover and centered object-position. Native proportions are preserved with intentional cropping. There are no animated transforms, scale, positions or filters.

For global progress p, `floor(p)` selects the current serial and `p - floor(p)` gives linear incoming opacity. At an exact integer, incoming becomes current at opacity 1, and its successor is prepared at opacity 0. No further reveal occurs without further input. Adjacent transitions swap the two reusable node roles; z-index stays 1 for current and 2 for incoming. Navigation remains above their isolated, pointer-transparent canvas.

Excess movement is never discarded: 120 pixels supplied when only 50 remain completes that reveal, then contributes 70/1200 opacity to the next. Large jumps directly select the final pair, never creating nodes for skipped history. Serial progress continues indefinitely; only source indices wrap modulo twenty.

Exactly two media nodes are attached to the DOM. The current all-image sequence reuses the same two identities. A bounded set of twenty detached preload/decode objects warms the source cache, including fast jumps, without asynchronous rendering or progress changes. Future mixed video/image sources can replace a node when its media type changes; live count remains two. Video geometry/metadata/resource cleanup are retained, while new playback functionality is deferred.

Resize/orientation is handled by CSS viewport sizing; opacity and current sequence state remain unchanged. Route cleanup aborts listeners, cancels mobile frames, releases video and image sources, clears preload references, and removes both layers. Returning starts with image 1 and incoming image 2 again.

## Material sequence

1. DSCF6919.jpg
2. Mountain_v20003.jpg
3. _DSF0857.jpg
4. Stone_Artefakt_9.jpg
5. Iceland25_Echo.jpg
6. DSCF2880.jpg
7. MA_GD_Tanzartefakt_7.jpg
8. _DSF2669.jpg
9. Stone_Conserve_Blau_RZ_v2.jpg
10. DSCF1339.jpg
11. DSCF6978.jpg
12. TextureBump_ARC_W_RZ.jpg
13. _DSF3392.jpg
14. DSCF7780.jpg
15. Strommast_Sundown_RZ.jpg
16. _DSF5795.jpg
17. MountainRange_raw.jpg
18. _DSF4139.jpg
19. DSCF7807.jpg
20. _DSF6111.jpg

All sources are local in `material/`.

## Files

Added/replaced: `frontpage-media-fade.js`, `tests/frontpage-media-fade.test.cjs`, `tests/frontpage-media-fade-browser.test.cjs`, and this renamed report.
Removed: `frontpage-media-depth.js`, its two depth-specific test files, and `FRONTPAGE_DEPTH.md`.
Updated: `app.js`, `index.html`, `style.css`, `tests/frontpage.test.cjs`, `tests/contrast-browser.test.cjs`.
Unrelated pre-existing local edits are preserved. Old depth rays/lifecycles, geometry scheduling and edge rules are no longer active.

## Validation

`node --test tests/*.test.cjs`: 141 passed, zero failed, 18 opt-in browser tests skipped. The desktop and native-touch-emulated Chrome fade tests were explicitly run and passed: fullscreen cover geometry, initial opacity pair, direction/diagonal distance, exact frozen styles after 650 ms, promotion at opacity 1, stopped next transition at opacity 0, excess distance, 20 → 1 loop, huge progress jumps with two node identities, resize, no scrolling, navigation, route cleanup and listener counts. Desktop snapshots at initial, half-revealed, near-complete, promoted, carry-over, looping and narrow stages were visually inspected. Existing non-browser site regressions passed. The updated shared-contrast Chrome regression also passed, covering Selected Work, Index, Project and mobile navigation.

## Limitations

Fullscreen cover intentionally crops portraits/landscapes. Sources are only 480 pixels high and can look soft enlarged. Cold-cache first display still depends on asset loading; preloading warms later transitions but cannot eliminate missing/failed files or guarantee instantaneous decoding on every device. Physical-device Safari testing remains outstanding. Existing navigation styling/contrast is preserved. No deployment, commits, pushes, Sanity, hosting or DNS changes were made.
