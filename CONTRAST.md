# Overlay text contrast

The former Difference rules covered Selected Work's header, project titles,
category labels, text slots and Open cursor; and project detail's header, back
link, Info controls/popup copy, text slots and footer links. The header arrow also
used an invert filter. Those effects have been removed. Static white surfaces
(Info, mobile menu, detail popup/text slots/footer) retain black text. Normal body
copy is not subject to image analysis.

Sanity's optional **Text color** field is available on Frontpage, Project and
individual Index entries. Values are Auto (default for missing/invalid values),
Black and White. Project settings apply to overview and detail overlays. Index
settings apply to every preview image in that entry. No migration is needed.

`contrast.js` is the single overlay controller. It applies `--contrast-color`
using exactly #000000 or #ffffff. It hit-tests behind each overlay and reads a
5×5 neighborhood from a cached 64×64 image sample, mapping the viewport coordinate
through image object-fit/object-position. Cropped Sanity URLs already contain the
crop. Mobile Index sampling accounts for the existing 28% dark scrim. Pixel values
are converted to linear RGB and weighted for relative luminance.

The black/white crossover is 0.179, with a 0.15–0.21 hysteresis band. Events are
coalesced to at most one overlay update per 120ms and one cursor update per 100ms.
There is no animation-frame pixel loop. Up to 64 image results (including failures)
are cached, with one small canvas read per successfully sampled image.

Manual modes bypass image analysis. Auto uses white for videos/iframes and image
load/CORS/canvas failures, black over known white page backgrounds, and white over
known dark backgrounds. Vimeo frames are never accessed, and posters are not
assumed to represent changing video brightness. Use a manual override for light
video scenes. Static panels remain readable independently of project overrides.

The header arrow uses its existing SVG as a currentColor mask, retaining the
original image's layout space. No media geometry, pointer handling, navigation,
Vimeo parameters or responsive breakpoints are changed by this system.
