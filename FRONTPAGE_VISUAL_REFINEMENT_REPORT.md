# Frontpage visual refinement — local review

Applied as an additional refinement of the existing frontpage, preserving its media-data/CMS integration. No Sanity schema or hosting changes in this refinement.

Mouse reveal distance decreased from 137.14 to 54.86 CSS pixels; touch progression increased from 2.45 to 6.125 reveals per second. Both are exactly 2.5× faster. Opacity remains proportional to accumulated input, with no CSS transition or autonomous mouse catch-up. The existing half-image per-frame guard preserves intermediate reveals during large pointer bursts.

Six curated spread variants now combine edge-aligned fragments, intentional overlaps, alternating lower-cluster placement, dominant anchors and white negative space. Mobile retains its separate portrait placement rules. Images preserve their aspect ratios and orientation. Six settled images remain; oldest/newest simultaneously crossfade through a temporary seven-image state. Navigation typography, positioning and interaction remain unchanged.

## Validation

- Frontend: 146 passed, 27 opt-in browser tests skipped, no failures.
- Chrome regression run: all 17 other checks passed; the touch-speed check initially failed because its measurement sampled between animation frames. Measuring both endpoints on animation frames resolved that sampling error. Final frontpage rerun: both desktop and touch checks passed, covering exact freeze, resume, multitouch, rolling crossfades, bounded nodes, native proportions, navigation and cleanup.
- Geometry checks cover all six variants at desktop and portrait sizes, enforce significant scale variation, attached clusters, viewport boundaries, and recognizable exposed portions of every source.
- Captured and visually inspected all twelve completed six-image compositions below. Screenshot capture uses the local image fallback with remote CMS queries blocked, preserving the requested local sequence; CMS playback and hydration were separately covered by Chrome regression tests.
- `git diff --check` passed.

## Screenshots

| Completed images | Desktop 1440×900 | Portrait 390×844 |
| --- | --- | --- |
| 6 | [Desktop](reports/refined-editorial-desktop-6.png) | [Mobile](reports/refined-editorial-mobile-6.png) |
| 12 | [Desktop](reports/refined-editorial-desktop-12.png) | [Mobile](reports/refined-editorial-mobile-12.png) |
| 18 | [Desktop](reports/refined-editorial-desktop-18.png) | [Mobile](reports/refined-editorial-mobile-18.png) |
| 24 | [Desktop](reports/refined-editorial-desktop-24.png) | [Mobile](reports/refined-editorial-mobile-24.png) |
| 30 | [Desktop](reports/refined-editorial-desktop-30.png) | [Mobile](reports/refined-editorial-mobile-30.png) |
| 36 | [Desktop](reports/refined-editorial-desktop-36.png) | [Mobile](reports/refined-editorial-mobile-36.png) |

Visual review confirms connected asymmetrical clusters, strong size hierarchy, edge attachment, preserved white space and centered navigation. No deployment, commit, push, or CMS content changes performed.
