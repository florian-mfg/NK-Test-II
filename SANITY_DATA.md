# Sanity data adapter and Info integration

`index.html` loads `sanity-data.js` before `app.js`. The adapter itself has no
side effects; `app.js` calls `load()` once at startup and caches the result. Only
Info consumes the snapshot, using Site Settings to resolve its contact links.
Projects, Selected Work, Index, Frontpage, Navigation and Legal retain local content.
Site Settings does not change global branding, metadata, navigation or footers.

## Interface

When explicitly loaded as a classic script, it exposes `globalThis.SanityData`.
Node tests can use `require('./sanity-data.js')`. No packages are required.

- `load({timeoutMs?, signal?})`: fetch and normalize the published public content.
  Returns `{ok: true, data, error: null}` or
  `{ok: false, data: null, error: {code, message}}`.
- `normalize(projectedQueryResult)`: pure, offline normalization using the same
  object shape returned by the exported GROQ query.
- `normalizeModule(module)`: returns `{module, issues}`; module is null if invalid.
- `normalizeImage(image)`: returns `{image, issues}`; image is null if unusable.
- `config`: frozen public project ID, dataset, API version, perspective, timeout.
- `query`: the published-content GROQ projection.
- `defaultCategoryNavigation`: frozen initial Video → Commissioned → Graphic list.

`load()` uses native fetch, GET, credentials omitted, and no Authorization header.
The endpoint is ck6xe2er.apicdn.sanity.io, dataset production, API v2025-02-19,
with an explicit published perspective. Draft/version project IDs are also excluded
in the query and normalizer. Singleton IDs select only their published documents.
The default timeout is 10 seconds (caller overrides capped at 60 seconds), covering
both the request and JSON body. An AbortSignal can cancel it. Error codes are
`http`, `request_failed`, `invalid_response`, `timeout`, and `aborted`.

Every explicit load call performs one metadata request; there are no background
requests, polling, asset downloads, or persistent caches. The Info integration
loads once and reuses the returned content during hash navigation. Sanity’s
API CDN handles HTTP content caching. No frontend token, private dataset, paid
feature, dependency installation, or build pipeline is introduced.

## Normalized content

| Property | Shape / meaning |
| --- | --- |
| homePage | video descriptor, accessible videoTitle, optional poster |
| siteSettings | brandName, defaultPageTitle, defaultDescription, socialImage, contacts, footerLinks |
| navigation | home link, main items, **one shared categories array**, mobileContact |
| infoPage | introduction, cv objects, work/skills/selectedClients strings, resolved contactLinks |
| projects | Complete usable project metadata collection, independent from Selected Work |
| projectsById | Null-prototype lookup keyed by project slug |
| selectedWork | Ordered slug arrays under video, commissioned, graphic; null when absent |
| indexPage.entries | Independently ordered entries with title/year/additionalInfo, optional projectId, layout, images and previewImages |
| legalPages | imprint and privacy-policy, each containing title and restricted Portable Text body or null |
| availability | missing / invalid / present for source documents and collections |
| issues | Structured diagnostics: path, code, message |

A missing singleton is null, except navigation supplies its shared category defaults.
`availability.navigation` still reports missing. Missing legal pages are individually
null. A present document can intentionally contain empty arrays: these stay empty,
with no automatic local-content fallback. `present` describes the source document,
not editorial completeness; inspect issues and page fields before adopting content.

Text remains plain text, including angle brackets. Renderers must escape it or use
textContent. The legal normalizer restricts supported marks/links but does not turn
Portable Text into HTML. Rich-text rendering remains a later integration task.

## Project composition contract

- Slug.current becomes id; Sanity _id remains documentId for resolving references.
- Numeric years become strings. Only explicit false disables detailPageEnabled.
- Modules remain in stored order. All six original layout names, height presets,
  image/video/text slots, and S/M/L text sizes are retained.
- Empty slots become null before examining retained media. Missing trailing slots
  are padded to the layout’s slot count; occupied slots are never compacted.
- Default/reverse arrangements are preserved. Middle becomes [1, 0, 2] only for
  half-quarter-quarter. Slots are not physically reordered by the adapter, so
  their original widths remain attached when the renderer applies the order.
- Text slots remain present; the existing overview renderer owns text suppression.
- Invalid module/slot content flags the entire project composition as
  modulesValid:false and returns modules:[], retaining project metadata. This
  avoids silently rendering a shortened composition. Consumers must check this flag.
- Undefined modules are permitted as an empty collection, as in the Studio schema.
  An enabled detail project with no modules still needs a future empty-page policy.
- Missing, duplicate, or wrong-category overview references are omitted with issues.
  A project can appear in Selected Work with its detail page disabled.

Native asset references and query-expanded assets are supported. The production
query dereferences assets, so deleted/missing assets become null and are diagnosed.
URLs are restricted to the project’s public Sanity asset paths. Project video files
must be MP4/WebM. Video controls and playback behavior remain renderer concerns.
Module alt text comes from the slot: omitted stays undefined, explicitly empty stays
empty. Posters retain their independent image metadata.

## Images and homepage

Image descriptors contain src, assetUrl, alt, original width/height, crop, cropRect,
and hotspot. Valid editorial crop is applied to src with the Sanity rect parameter.
Hotspot metadata is preserved without choosing a target aspect ratio or changing
frontend geometry. Applying hotspot-aware cropping for actual desktop/mobile slot
sizes is **not implemented in this adapter-only step**. No image resizing is forced.

Homepage video descriptors support ordinary Vimeo URLs, player.vimeo.com URLs,
unlisted privacy hashes, and direct HTTPS MP4/WebM URLs. Vimeo embedUrl retains the
privacy hash, while playback parameters and visual presentation remain frontend
responsibilities. Unsupported video URLs yield video:null with an issue; the poster
is retained. Other video hosts/URL formats require a later explicit decision.

## Navigation and Index decisions

Navigation exposes a single shared category list for desktop and mobile. Its
initial/fallback order is Video → Commissioned → Graphic. A valid published CMS
list controls future ordering and labels; destinations remain work/video,
work/commissioned, and work/graphic. Missing categories are appended in default
order; duplicate or unknown destinations are omitted with diagnostics.

The existing Studio navigation schema still initializes new documents in its
previous order (Commissioned, Graphic, Video). This step does not change schemas
or documents. Before activating CMS navigation, set/publish the approved initial
order in the navigation document; an explicitly stored CMS order is never silently
overridden by the adapter. Visible navigation has not changed.

Shared contact selectors resolve through Site Settings; invalid/missing contact
addresses omit the link with a diagnostic. Home label falls back to the brand name.
The adapter does not invent local brand/contact content when settings are absent.

Index entries never derive preview images from project modules and never pass
through the old archive sorting algorithm. They can stand alone. Missing related
projects do not invalidate an entry if it has its own title and preview images.
Unusable images are omitted in order; an entry without any images or a title is
omitted with an issue. Missing title/year/info inherit from a valid related project.
An explicitly empty additionalInfo string suppresses inheritance, while an absent
field inherits. Existing schema/editor behavior may unset an empty string; adding
an explicit suppress-inheritance control would be a separate schema decision.

## Info rendering and fallback

The existing Info section, columns, headings and paragraphs remain in place;
only paragraph contents are updated. CSS and responsive rules are unchanged.
Published empty fields stay empty. Request failures, missing/invalid Info documents
and malformed Info content retain local Info. Missing Site Settings retains only
local contacts when shared addresses are required; valid Info text still wins.

A successful response updates an active Info page even if the visitor has scrolled
or focused it. The previous interaction gate deferred this update until another
Info visit, leaving local content visible despite a successful request. Updates
do not rerun routing or explicitly reset scroll. Responses received on another
route are cached for the next Info visit and do not alter that route.

## Verification

Run from the repository root:

- `node --check app.js`
- `node --check sanity-data.js`
- `node --test tests/*.test.cjs`
- `INFO_LIVE_SMOKE=1 node --test tests/info-page.test.cjs` (requires network)

Adapter tests use Node’s built-in runner and a VM with mocked fetch. Info tests
use the existing `studio/node_modules/jsdom` installation. They exercise all six layouts against the unchanged project renderer,
all height presets and supported arrangements, media, references, page mappings,
invalid content, published-only requests, timeout, and cancellation.

The read-only live test on 2026-09-20 retrieved “Berliner Boy”, “Eps51” and
“Tattooboss” from the published production documents and verified them in the
Info renderer's DOM. No CMS content was written. Regression tests cover late
responses after scroll/focus, document/request failures, contact fallback,
published empty arrays, DOM identity, escaping and unchanged local routes.

Manual browser testing remains: confirm CORS from the actual serving origin,
reload directly at `#info`, navigate to Info from another route, and check desktop
and mobile layout with a delayed response. The automated DOM tests do not measure
browser layout or prove that a deployed page has the latest JavaScript.
