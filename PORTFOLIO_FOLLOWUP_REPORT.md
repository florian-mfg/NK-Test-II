# Portfolio follow-up — local changes, 11 October 2026

The Index is black again, video backing surfaces are black, and a reproduced Play-control visibility race is fixed. Actual local-page playback was verified using live published Sanity data and production CDN assets, without mocking players or intercepting CMS/media responses. No deployment, commit, push, Sanity write, asset change, hosting change or DNS change was made.

## Index background

`body.is-index`, the archive section and the fixed media backdrop now explicitly use `#000`. The Index's inherited background/text variables are black/white. The contrast sampler treats uncovered Index areas as black on both desktop and mobile; CMS Auto/Black/White overrides remain unchanged.

An animation-frame browser test checks the body/archive/backdrop through delayed CMS loading, delayed image loading and media transitions. A screenshot pixel check verifies an uncovered portrait corner is exactly RGBA `(0,0,0,255)`. Existing portrait geometry, mobile tap-only cycling, desktop interaction and Sound/Mute tests pass. Other page backgrounds are unchanged.

## White video areas and borders

Before the change, `.project-video` inherited `background: var(--dark)`, which resolves to white on Selected Work and Project detail pages. Its containing figure had a transparent background. This exposed the white page during loading and could expose white below shorter intrinsic video boxes in stretched auto-height grid slots.

The fix assigns black backgrounds to `.project-video` and only figures that directly contain a video box. It changes no sizing, grid spans, object-fit, object-position, padding, margins, scaling or cropping. Full-frame portrait behavior is preserved.

Inspection of all eight current unique Selected Work preview MP4s, at desktop/mobile widths, found video and media-container bounds matched, with zero video border/padding/margin. Source-frame samples at 0, 1 and 3 seconds found no continuous near-white bands covering 98% of an outer edge in those files. Their exact URLs and measurements are in the evidence file. The Commissioned category currently has no published video preview; it was still inspected. All six Project module layouts were tested with real generated MP4s and tall companion slots.

A persistent thin white strip was not reproduced in the current production previews. The confirmed white backing is corrected; the precise cause of every previously observed strip cannot be established from the available reproduction. No encoded-border file was identified in the sampled preview frames. Intentional white graphic content inside a video remains intact.

## Revoshock playback investigation and fix

The initial normal-interaction test opened the actual local page at `http://127.0.0.1:5500/#project/revoshock`. All three existing controls started native playback, advanced time for at least three seconds, paused and resumed on desktop and mobile Chrome. This alone did not reproduce the reported persistent failure.

A separate fast-scroll reproduction did expose a real controller failure: after moving a manual video offscreen and then immediately back into view, its visible Play control could be ignored. `inView` still held the observer's older offscreen value. The guard returned before calling `play()`: time stayed zero and the label stayed Play. The previous metadata readiness changes still used this stale state when synchronizing playback.

The controller now checks current video-box geometry when handling Play, the native play event, readiness updates and observer callbacks. Stale offscreen notifications cannot reject or pause a currently visible player. A small positive intersection threshold ensures a new notification when a video moves from merely touching the viewport edge into genuine view; otherwise a zero-threshold callback could be consumed at the boundary and autoplay never restarted.

The same fast-scroll reproduction now advances playback and changes the label to Pause. A focused unit regression also checks delayed `loadeddata` and stale visibility callbacks cannot immediately stop a visible video, while actual offscreen geometry still pauses it. The live Revoshock test additionally exercises the immediate visible-control click and confirms continued time progression for more than three seconds.

The published page at [GitHub Pages](https://florian-mfg.github.io/NK-Test-II/#project/revoshock) still serves the **older controller**, with unconditional initial hiding and an immediately resolved readiness promise. It reproduces the initial white area before Play. Its real buttons nevertheless played, paused and resumed all three videos in desktop/mobile Chrome during this investigation. Published `index.html`, `app.js`, `style.css` and `project-video.js` differ from the local files. These local fixes have not been deployed.

Safari WebDriver was attempted, but Safari rejected session creation because **Allow remote automation is disabled**. Safari playback was not verified, and Safari settings were not modified. The reproduced observer race is fixed locally; any separate Safari-specific failure remains unverified.

## Real local-page playback evidence

The final Revoshock checks use the existing page controls, not direct-URL playback. Each module runs for over three seconds, pauses with a stable clock, then resumes for over three seconds. The first module starts near 3.16 seconds in this table because the preceding fast-scroll regression already exercised it.

| Viewport | Video module | First playback clock | Resumed playback clock |
| --- | --- | --- | --- |
| Desktop, 1440 px | 1 | 3.16 → 6.41 s | 6.63 → 9.87 s |
| Desktop, 1440 px | 2 | 0.01 → 3.31 s | 3.50 → 6.75 s |
| Desktop, 1440 px | 3 | 0.01 → 3.26 s | 3.45 → 6.69 s |
| Mobile, 390 px | 1 | 3.16 → 6.41 s | 6.58 → 9.82 s |
| Mobile, 390 px | 2 | 0.01 → 3.26 s | 3.43 → 6.68 s |
| Mobile, 390 px | 3 | 0.01 → 3.25 s | 3.41 → 6.65 s |

Rendered screenshots before/after Play differ; the playing screenshots were also visually inspected. See [desktop module 2 playing](reports/revoshock-frames/1440-module-1-playing.png) and [mobile module 2 playing](reports/revoshock-frames/390-module-1-playing.png). All twelve before/playing screenshots are in `reports/revoshock-frames`.

Across the named projects, **36 desktop/mobile module cases** completed real playback, Pause, resume, audio ownership checks and source cleanup: Revoshock (3 videos), MaerzMusik 2022 (1), Livevisuals (4), Advection (5) and Gaussian Splats (5), at both widths. Checks completed across a full-project run and focused follow-up runs. Short autoplay loops and natural endings are recorded rather than misclassified as stalled playback. With several visible autoplay videos, the test explicitly selects a player before asserting its audio ownership, matching the established global control behavior.

All **16 production preview checks** (8 previews × 2 widths) sustained actual local-page playback with matching video/container bounds and black surfaces. Production Index MP4 playback advanced approximately `0.82 → 3.24 s` at both widths, with Sound/Mute preserving the active entry. Mobile Index reached the MP4 through taps alone.

Detailed measurements, source URLs, viewport geometry, frame-edge samples and before/after race state are in [reports/portfolio-followup.json](reports/portfolio-followup.json).

## Test results

- Frontend unit tests: **140 passed, 0 failed**, 26 optional browser/live tests skipped.
- Final Chrome regression suite: **17 passed, 0 failed**, 3 separately invoked live audits skipped.
- Live overview/Index production-media test: passed at desktop/mobile widths.
- Focused final mobile Revoshock test: passed all three modules and the fast-scroll regression.
- Focused mobile Advection/Gaussian Splats test: passed all ten modules.
- The final desktop Revoshock screenshot cases passed; the combined screenshot run's later mobile navigation encountered a live CMS loading failure. Its mobile cases were rerun successfully in a focused invocation. Live tests retry only a failed CMS load with no player/data, not playback failures.
- Route cleanup, one Sound/Mute controller, single audible detail owner, manual/autoplay controls, all module layouts, portrait geometry, mobile menu, frontpage interaction, Raglan typography, Indexmaterial and no Vimeo requests are covered by the regression tests.
- `git diff --check`: clean. No Studio/CMS code changed; Studio checks were not required.

Useful commands:

```sh
node --test tests/*.test.cjs
BROWSER_TEST=1 PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core node --test --test-concurrency=3 tests/*browser.test.cjs tests/index-responsive.test.cjs tests/selected-work-responsive.test.cjs
LIVE_SITE_TEST=1 PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core node --test tests/live-site-playback-browser.test.cjs tests/live-overview-index-browser.test.cjs
```

Live tests default to the local server at port 5500. Set `SITE_BASE_URL` for another actual site, and `SITE_TEST_WIDTHS` / `SITE_TEST_PROJECTS` to focus the project test. No CMS or player mocks are used in these tests.

## Files changed in this follow-up

- `style.css`: Index black surfaces and black video-only backing.
- `contrast.js`: correct Auto contrast for the black Index backdrop.
- `project-video.js`: current-geometry playback decisions and positive visibility threshold.
- `tests/project-video-interaction.test.cjs`: stale visibility/readiness regression.
- `tests/index-first-frame-browser.test.cjs`, `tests/index-media-browser.test.cjs`: black-background expectations.
- New `tests/index-black-video-surfaces-browser.test.cjs`: loading/transition pixel checks and video layout surfaces.
- New `tests/live-site-playback-browser.test.cjs`, `tests/live-overview-index-browser.test.cjs`: actual-site, production-media playback checks.
- This report, a historical-reference note in `MP4_AUDIT.md`, and the evidence/screenshots under `reports`.

Earlier uncommitted changes remain in place.

## Remaining limits

Safari remains unverified because automation is disabled. Mobile checks use Chrome emulation, not physical devices. Encoded-border sampling covers eight current preview files at three times per file, not every frame of every uploaded video. Tests establish playback progression, controls and audio ownership, not subjective sound quality or uninterrupted full-duration playback. The published site remains unchanged and still uses older code. Published content can change after this read-only audit.
