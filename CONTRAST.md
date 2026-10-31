# Overlay text contrast

`contrast.js` is the shared binary overlay controller. It applies exactly
#000000 or #ffffff through `--contrast-color`, without blend modes, inversion,
text shadow, text stroke or duplicate text layers. Normal body copy and static
white surfaces (Info, mobile menu, detail popup/text slots/footer) retain black
text. The overview `(Open)` cursor retains its existing fixed-white behavior.

## Route behavior

- Frontpage navigation automatically switches between black over light imagery
  and white over dark imagery. Uncovered white canvas uses black. Brush placement,
  media changes and moving video frames request contrast updates.
- Index and all three Selected Work overviews use permanently white interface
  text and do not sample media for contrast.
- Project detail overlays retain automatic contrast and the existing optional
  Project Text color override (Auto, Black, White).

Frontpage and Index Text color fields remain in normalized CMS data for
compatibility; these routes use the behaviors above, without a schema migration.
All mobile page canvases are white, including Index. White Index labels/loading
line can therefore be unreadable over uncovered canvas; this approved combination
is not silently changed by the controller.

## Sampling and performance

Decoded images supply cached 64×64 luminance grids. The controller maps label
coordinates through media object-fit/object-position and reads a 5×5 neighborhood.
Brush media ignore pointer events, so Frontpage hit-testing uses their painted
rectangles, newest first. Sanity image URLs preserve their configured crops.

The black/white crossover is 0.179, with a 0.15–0.21 hysteresis band. Frontpage
refreshes are throttled to 120ms. Native Frontpage videos provide a small grid at
most every 250ms per video; a timer requests refresh only while the Frontpage is
visible and video is active. There is no animation-frame canvas-readback loop.
Up to 64 image results, including failures, are cached. Overview cursor behavior
and detail-page contrast retain their existing update mechanisms.

Anonymous CORS permits sampling when the media host supports it. Frontpage video
loading retries once without CORS if needed to preserve ordinary playback.
Unreadable video/image canvas data uses the existing white fallback; failures are
cached rather than retried every frame. Video contrast can lag scene changes by
one sample interval plus scheduling. Detail videos retain the previous fallback;
iframe pixels are never accessed. Static panels remain independent of overrides.

The header arrow continues to use its existing SVG as a currentColor mask. Media
geometry, typography, layout and project playback controls are unchanged.
