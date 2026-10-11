# Editorial frontpage refinement

Implemented locally using the specified editorial characteristics: dense connected image clusters, sharp rectangular boundaries, asymmetric overlaps, pronounced scale differences, viewport-edge placement and white negative space.

## Changes

- Desktop progression is **2.5× faster**: 480 accumulated mouse pixels per reveal instead of 1,200.
- Touch progression is **2.5× faster**: 0.70 images per second instead of 0.28.
- Replaced independent placements with coordinated six-image spreads. Medium images attach to the large anchor; smaller fragments attach to existing edges. Three deterministic corner/scale variations change the arrangement as the sequence progresses.
- Desktop uses a large anchor targeting 62% of viewport width, medium images targeting 27–38%, and fragments targeting 14–18%, with height limits preserving proportions. Actual dimensions depend on each image's aspect ratio.
- Mobile has separate vertical placement rules and sizing, with intentional overlap and fragments placed toward the outer cluster edges. It does not scale down the desktop coordinates.
- Images retain their original orientation and aspect ratio. Individual source placements stay fixed during a reveal and crossfade; resizing recomputes their bounds without resetting progress.
- Input architecture, exact freeze/resume behavior, synchronized incoming/outgoing opacity, original ordered local media data, bounded rolling window, centered navigation and shared contrast remain intact.

## Files changed in this refinement

- `frontpage-media-fade.js`: input speed constants and clustered placement rules.
- `tests/frontpage-media-fade.test.cjs`: timing, scale, clustering, exposed fragments and bounds checks.
- `tests/frontpage-media-fade-browser.test.cjs`: faster input expectations.
- This report and six review screenshots under `reports/editorial-*.png`.

## Verification

- Frontend suite: **141 passed, zero failed**; 26 opt-in tests skipped.
- Chrome regression suite: **17 passed, zero failed**; three separate live-production checks skipped.
- Final frontpage Chrome checks cover mouse progression, exact opacity freezing, touch hold/release/resume, multi-touch, cancellation, navigation exclusion and clickability, group centering, contrast, rolling replacement, loops, bounded DOM, proportions, responsive bounds and route cleanup.
- Geometry checks verify a greater than 2.5:1 width hierarchy, at least four attachments/overlaps per sampled spread, viewport-edge placement and an exposed portion of each of the six images.
- Captured and visually inspected completed compositions at sequence progress 6, 12 and 18, at desktop 1440×900 and mobile 390×844. Inspection prompted a refinement to preserve smaller exposed fragments during overlap.
- `git diff --check` passed.

## Review screenshots

| Composition | Desktop | Mobile |
| --- | --- | --- |
| Images 1–6 | [Desktop](reports/editorial-desktop-6.png) | [Mobile](reports/editorial-mobile-6.png) |
| Images 7–12 | [Desktop](reports/editorial-desktop-12.png) | [Mobile](reports/editorial-mobile-12.png) |
| Images 13–18 | [Desktop](reports/editorial-desktop-18.png) | [Mobile](reports/editorial-mobile-18.png) |

Preview: http://127.0.0.1:5500/#home

No deployment, commit, push, Sanity or hosting changes were made.
