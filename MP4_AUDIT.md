# Local portfolio refinement and MP4 audit — 11 October 2026

This records the first implementation. See [the follow-up report](PORTFOLIO_FOLLOWUP_REPORT.md) for the subsequent black Index background, video backing and playback-race fixes.

Changes are local. No deployment, commit, push, CMS write, asset replacement, hosting change or DNS change was performed.

## Mobile menu

Selected Work is a static upright label. The three category links stay visible and indented; no accordion listener or expanded state remains. Opening the menu preserves upright styling, compact spacing, official WF Raglan Neue, the white background and top-right Close control. Logo/contact remain hidden. CMS labels, category order and destination links continue to work. Desktop navigation retains its existing interactions.

## Mobile Index

Only taps/clicks change the mobile active entry. Media advance first, then entries advance in their existing CMS order and loop. The viewport stays fixed with document/list scrolling disabled. Scroll detection, scroll-based selection and scroll snapping were removed. Drags, cancelled gestures, multitouch and controls do not advance; row clicks and background gestures use separate paths to avoid duplicate advances. Only the active entry's existing information row is displayed. Portrait positioning, image aspect ratios, MP4 playback and Sound/Mute are retained. Desktop hover selection and per-entry click cycling remain unchanged.

## Confirmed Revoshock cause

The published Project assigns valid MP4 assets to `modules[0].slots[0]`, `modules[1].slots[0]` and `modules[2].slots[1]`. Its Selected Work preview also references the first file. Reference resolution, GROQ projection and normalization succeed; no invalid-video issue was reported.

| Published slot | File | Native dimensions | Codec |
| --- | --- | --- | --- |
| `modules[0].slots[0]` and preview `composition[0].slots[0]` | `ac1ca394cb3816289ca6736fc865a5f74696c54d.mp4` | 1920 × 1080 | H.264 |
| `modules[1].slots[0]` | `cf318ce6ba07a11c648a3e342682cb4ee5813d50.mp4` | 1920 × 1068 | H.264 |
| `modules[2].slots[1]` | `d8590ee31127d6c721d70348d4a566dff4407a7d.mp4` | 1920 × 1080 | H.264 |

Chrome reproduced the original controller at 1440 and 390 pixels using the actual CDN files. All three had HTTP 206 responses, nonzero element and native dimensions, `readyState: 4`, no media error and no page errors. They default to **manual playback**, have no posters, and were paused with computed `visibility: hidden`. The controller hid every video until its `play` event, so these valid manual videos rendered a white area. Autoplay rejection and unsupported encoding were not the cause of Revoshock's initial blank state.

The updated controller preserves visible loaded frames without posters. Before/after measurements and network statuses are in [reports/mp4-audit.json](reports/mp4-audit.json).

## Other affected slots and playback fixes

The same initial blank-frame risk exists in posterless manual/default-manual detail slots in:

- MaerzMusik 2022: module 0.
- Livevisuals: modules 0, 1, 2 and 3.
- Advection: modules 4 and 5.
- Gaussian Splats: modules 1 and 4.

Module numbers above are zero-based. These are affected by the shared controller logic; Revoshock was the project explicitly reproduced before and after in Chrome.

Readiness and intrinsic aspect ratios now follow loaded metadata instead of an immediately resolved adapter promise. Posters remain until actual `playing`, then hide using an explicit CSS rule; the existing image display rule previously overrode the native hidden attribute. Autoplay `NotAllowedError` preserves the media/poster and exposes manual Play where no control exists. Interrupted `AbortError` does not create a false fallback. Actual media errors remain diagnosable through `data-video-error` and the existing unavailable-control state.

Existing detail/Index audio arbitration and Sound/Mute remain in place. Offscreen/hidden videos pause, manual overview videos pause other audible overview videos, and route cleanup pauses and releases native sources. No new player library was added.

The optional frontpage sequence video branch previously created elements without starting playback. It now supports both `video` and `mp4` sequence types, muted inline looping, visibility pause/resume and source cleanup. The current production frontpage uses its existing local image sequence; no production homepage MP4 is assigned. CMS homepage video settings remain outside this established frontpage interaction.

## Asset and codec audit

The published frontend query contained **52 MP4 references resolving to 45 unique CDN URLs**, across Project modules, Selected Work previews and Index documents/material. Normalization reported no issues. The Index singleton contains 27 entries.

Every unique URL loaded, decoded with nonzero dimensions and advanced playback time in real desktop Chrome. Read-only MP4 header range requests found `avc1` (H.264) sample entries in all 45 files. Audio-bearing files use `mp4a` sample entries; Chrome identified AAC in the audio tracks for which it returned codec properties. No unsupported, missing or corrupt referenced file was found, and no re-encoding or re-upload is recommended based on this audit. Nothing was transcoded or replaced.

The JSON evidence maps every reference to a URL and includes native dimensions, HTTP statuses, playback time, available Chrome media properties and MP4 sample entries.

## Tests

- Frontend unit suite: **139 passed, 0 failed**; 22 opt-in browser/live tests skipped in this command.
- Chrome regression suite: **15 passed, 0 failed**; the separate opt-in production test skipped in this command.
- Live production Chrome test: **1 passed, 0 failed**, checking all 45 actual URLs and Revoshock manual Play/Pause, Sound/Mute, aspect ratios and cleanup at 1440/390 pixels.
- Final focused Chrome rerun after mobile gesture/CSS cleanup: **4 passed, 0 failed**.
- Dedicated autoplay rejection/poster/manual-frame/frontpage MP4 test: passed at desktop/mobile widths.
- Browser coverage includes all Project layout modules, preview geometry, Index media switching/portrait sizing, no duplicate advances or overlapping unmuted detail players, official normal/italic fonts, menu spacing, frontpage opacity, route cleanup and no Vimeo requests.
- `git diff --check`: clean.
- Studio tests were not required: no Studio schema, migration, CMS query or normalization code changed.

Re-run with a Chrome installation and `playwright-core`:

```sh
node --test tests/*.test.cjs
BROWSER_TEST=1 PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core node --test tests/*browser.test.cjs tests/index-responsive.test.cjs tests/selected-work-responsive.test.cjs
LIVE_MP4_TEST=1 PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core node --test tests/production-mp4-browser.test.cjs
```

The live test uses only read-only requests and writes diagnostic evidence to `/tmp/nk-live-mp4-audit.json` (override with `MP4_AUDIT_REPORT`).

## Changed files

Runtime: `app.js`, `index.html`, `style.css`, `project-video.js`, `frontpage-media-fade.js`.

Tests: `tests/index-page.test.cjs`, `tests/index-cycling-browser.test.cjs`, `tests/index-first-frame-browser.test.cjs`, `tests/index-media-browser.test.cjs`, `tests/index-responsive.test.cjs`, `tests/mobile-navigation-browser.test.cjs`, `tests/project-mp4.test.cjs`, `tests/project-video-interaction.test.cjs`, plus new `tests/mp4-fallback-browser.test.cjs` and `tests/production-mp4-browser.test.cjs`.

Review artifacts: `MP4_AUDIT.md` and `reports/mp4-audit.json`.

## Limits

Mobile checks use Chrome touch/mobile emulation, not physical iOS/Android devices. Safari/WebKit and Firefox were not tested. All 45 assets were playback-tested directly in desktop Chrome; actual Revoshock files were also exercised in mobile emulation, while other mobile layouts/playback use generated real MP4 fixtures. The audit verifies startup, decoding, controls and cleanup, not uninterrupted playback of every full-duration file or subjective sound quality. Codec properties from Chrome are partial; MP4 sample-entry inspection covers every file. The dataset is a published read-only snapshot and later CMS edits require a fresh audit.
