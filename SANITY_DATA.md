# Sanity data adapter and staged frontend integration

`index.html` loads `sanity-data.js` before `app.js`. The adapter itself has no
side effects; `app.js` calls `load()` once at startup and caches the result. Only
Info, Frontpage and project detail routes consume the snapshot. Info uses Site
Settings for contact links. Selected Work overviews, Index, Navigation and Legal
retain local content. Local projects remain available as detail fallbacks.
Site Settings does not change global branding, metadata, navigation or footers.

## Interface

When explicitly loaded as a classic script, it exposes `globalThis.SanityData`.
Node tests can use `require('./sanity-data.js')`. Browsers load `vimeo-media.js`
before this adapter. No packages are required for the adapter.

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
  strict contract remains available to future overview consumers. `detailModules`
  separately preserves valid rows and replaces malformed rows with empty frames
  only when their layout, height and order are valid. Unknown/malformed layouts
  become null and are omitted by details without reordering healthy rows.
  Diagnostics remain in `issues`; no local rows are mixed into CMS compositions.
- Undefined modules are permitted as an empty collection, as in the Studio schema.
  An enabled detail project with no modules renders its existing header/info/footer
  with an empty module area, without injecting unrelated local modules.
- Missing, duplicate, or wrong-category overview references are omitted with issues.
  A project can appear in Selected Work with its detail page disabled.

Native asset references and query-expanded assets are supported. The production
query dereferences assets, so deleted/missing assets become null and are diagnosed.
Image URLs are restricted to the project’s public Sanity asset paths. Project
video slots require `vimeoUrl` and normalize to `{type: "video", src, vimeo, alt,
poster?, posterImage?}`; `vimeo` contains the validated ID and canonical embed URL.
The shared `vimeo-media.js` parser preserves privacy hashes and strips editorial
playback parameters from the embed URL. Controls/playback are renderer concerns.
Legacy upload-only slots produce `legacy_video_requires_migration` and invalidate
the composition while retaining project metadata. No stored data is deleted.
Module alt text comes from the slot: omitted stays undefined, explicitly empty stays
empty. Posters retain their independent image metadata.

## Images and homepage

Image descriptors contain src, assetUrl, alt, original width/height, crop, cropRect,
and hotspot. Valid editorial crop is applied to src with the Sanity rect parameter.
The module renderer maps hotspot center coordinates into the cropped image and
uses CSS object-position for cover placement. The existing object-fit, dimensions
and responsive geometry remain unchanged. Poster images use the same mapping.
No image resizing or layout aspect ratio is forced.

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

## Frontpage integration

`renderHome()` and the existing one-time content load apply the normalized
`homePage` singleton (Studio title: Frontpage) to the existing `.home-media` iframe.
`backgroundVideoUrl` is already projected and normalized by the adapter; the
renderer uses its validated Vimeo embed URL, including any unlisted privacy hash.
It enforces the existing background/autoplay/muted/loop settings, disables controls
and badges, and retains autopause=0, player_id=0 and app_id=58479. `videoTitle`
sets the iframe title; an empty title retains the local accessible title.
A matching source is not assigned again, so the current video does not restart.

Optional normalized poster data becomes a cover background behind the iframe,
using its crop-resolved URL and hotspot position when available. It is decorative;
the iframe title supplies the accessible description. Vimeo does not have a native
iframe poster attribute, and its player may cover this background while loading.
An empty poster adds no styling or DOM nodes.

Missing documents, failed requests, missing/invalid videos and non-Vimeo sources
retain the exact local homepage. The adapter still recognizes direct video files
for backward compatibility, but this Frontpage integration only adopts Vimeo.
CSS, fullscreen geometry, orange overlay, iframe permissions and responsive rules
remain unchanged. Async completion changes only an active Home or Info page;
it does not reroute, reset scroll, or touch other routes. Later visits reuse the
same snapshot. No new request, token, dependency or hosting/build requirement is added.

See `studio/CONTENT_MODEL.md` for the mandatory Vimeo-only project media plan.
Project Vimeo schema, query/normalization and module rendering preparation is
implemented. Detail routes now use published projects; Selected Work remains local.

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
- `INFO_LIVE_SMOKE=1 node --test tests/*.test.cjs` (requires network)

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

Frontpage tests also cover source/title adoption, identical-source reload avoidance,
forced background playback parameters, privacy hashes, optional posters, fallback,
late navigation and one-time loading. The opt-in live test checks the published
Vimeo source and “Nicolas Kawohl — Background Video” title, then confirms the
three published Info values using that same response. Manual browser verification
is still required for actual Vimeo playback/autoplay, origin restrictions and
fullscreen appearance on desktop/mobile; JSDOM does not play embedded videos.

Project Vimeo tests are in `tests/project-vimeo.test.cjs`; Studio validators are
covered by `studio/tests/content-model.test.mjs`. They test URL forms/privacy,
invalid/legacy media, every composition/height/arrangement, overview/detail policy,
button state and API errors, cleanup, hidden categories and retained image/text
behavior. The Vimeo SDK is separate from the one-time Sanity request; Frontpage
and Info do not initialize project players. See `studio/CONTENT_MODEL.md` for the
public upload audit, migration limits and required Vimeo browser checks.


## Project detail integration

`#project/<slug>` resolves `projectsById[slug]` from the existing one-time snapshot,
independently of Selected Work membership. Published metadata/modules win; only
explicit `detailPageEnabled === false` returns to the project's local category
route. Missing published projects or request failure can use `WORK_PROJECTS`.
Only a route absent from both sources returns to `#work` after loading completes.

Initial detail visits retain the hash and render a minimal existing `.detail`
container with `aria-busy` while waiting (up to the adapter's request timeout).
No local fallback player is started while waiting, avoiding replacement/restarts.
Completion fills only an active pending detail; it never invokes routing or
scrollTo. Navigating away prevents a late response from replacing another page.
Repeated renders of the same cached project preserve the live DOM/player; actual
navigation destroys players through the existing cleanup callback.

Title/category bind to the existing header and return links. Slug, source, year
and additionalInfo are exposed as detail data attributes without introducing new
visible metadata UI. Published Project Info is escaped plain text: blank lines
make paragraphs, single line breaks become `<br>`. Empty published descriptions
stay empty. Local fallback descriptions preserve the pre-integration placeholder
when a local description is absent. Footer/contact/navigation sources are unchanged.

Validation on 2026-09-20: live Ethereal Tides (`ethereal-tides`, title Ethereal Tides,
year 2026) reached the real detail DOM with four modules in published order:
Full/auto, Two Thirds + One Third/medium/reverse, Half + Half/medium,
Half + Half/auto. The last contains Vimeo `1226319421`; the detail iframe receives
its source with autoplay=0 and controls=0. The published description is currently
empty. No content was edited to test this.

All 48 frontend tests (including three live Sanity tests), 9 Studio tests, syntax
checks and Studio TypeScript checks passed. Chrome confirmed a direct detail
visit and overview/detail navigation using one request, published image alt/URLs,
desktop widths and mobile stacking/empty-slot hiding. Overview content stayed local. A further 900 Chrome slot comparisons passed
across all six layouts, five heights, both modes and three aspect ratios on
desktop/mobile (mocked Vimeo dimensions, real CSS).
The real Vimeo player timed out before readiness in this environment; SDK-backed
SVG Play/Pause wiring is covered with mocked playback events, but actual playback
must still be checked in the user's browser. Verify Play/Pause/resume, sound,
portrait/landscape cover, posters and slow/offline navigation before deployment.
