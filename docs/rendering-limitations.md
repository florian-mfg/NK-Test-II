# Known media raster limitations

This release preserves intrinsic Auto Height sizing and the assigned module widths.
Geometry checks pass with zero unintended DOM gaps. The limitations below concern
painted pixels, not intentional Spacer modules or borders in source assets.

## WebKit native Auto Height video

A real MP4 can leave one physical pixel showing the background at its bottom edge.
The video, wrapper, slot and module have matching DOM dimensions, and the following
module begins at exactly their bottom. WebKit snaps the native video paint box to
integer CSS pixels while layout can retain a fractional intrinsic height. The line
is absent from the decoded frame; converting that frame to an image fills the same
box correctly. A canvas replacement reproduces it. Compositing changes and native
sizing variants did not eliminate it.

The documented matrix reproduces the line in detail and overview at 390px/DPR 2–3,
and at 701px and 1025px/DPR 3: eight failing video probes. At 390px, a 90 × 160 MP4
has a layout height of 693.328125px; the short native paint extent exposes one pixel.
Physical Safari/iPhone output has not been independently captured.

## Chrome image/Crop boundaries

Ten image boundary probes have previously failed at DPR 2 in both detail and
overview: boundary 5 at 390px and 1440px, and boundaries 5, 7 and 9 at 1025px.
These occur with fractional image/Crop paint joins and deterministic scroll
positions. Chrome's native-video joins pass in that documented matrix.

## Verification and release interpretation

Run the strict diagnostic matrix explicitly:

```sh
BROWSER_TEST=1 PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core \
  MEDIA_SEAM_OUTPUT_DIR=/tmp/nk-media-raster \
  node --test --test-concurrency=1 tests/media-seam-browser.test.cjs
```

The matrix asserts zero raster failures and intentionally remains red for these
known cases; it does not waive them or classify a failing screenshot as passing.
Its structured output lists every failed image/video probe so additional failures
can be distinguished from this baseline. The documented matrix checks 3,456 module
geometry cases and 312 raster probes per engine at 390/701/1025/1440px, DPR 1/2/3,
with all six layouts, mixed Crop/Auto Height, images and real MP4 fixtures.

Pixel probes disable smooth scrolling so geometry and screenshots use the same
position, and wait for decoded images and Crop paint updates. Separate Overview
unit tests control animation frames explicitly; a pre-paint visibility assertion
must not race a wall-clock RAF callback under test load.

No negative margin, source scaling, Auto Height clipping, stretching, arbitrary
background fill or overlap was introduced to conceal these lines. Crop continues
to crop intentionally; Auto Height remains intrinsic and unclipped. The known
raster failures are accepted release limitations, not a claim of pixel-perfect
rendering. New functional failures or materially worse defects require review.
