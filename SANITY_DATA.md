# Sanity data adapter and staged frontend integration

`index.html` loads `sanity-data.js` before `app.js`. The adapter itself has no
side effects; `app.js` calls `load()` once at startup and caches the result. Only
Info, Frontpage, project details, Selected Work, Index, Navigation and Site Settings
consume the snapshot. Legal pages use the same snapshot.
Local projects remain available as migration fallbacks.
Site Settings supplies global branding, browser metadata, shared contacts and project footer links.

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
| indexPage.entries | Independently ordered entries with own title/year/additionalInfo, layout, and 1–3 images/previewImages (no Project reference or URL) |
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

## Navigation and Site Settings integration

The shared one-time public read updates existing desktop/mobile menu nodes in place.
Published main-menu order and labels are authoritative; destinations and hash routes
remain fixed. Duplicate destinations are ignored. Both menus share normalized category
order: Video → Commissioned → Graphic unless explicitly ordered in CMS. Missing
categories are appended in that default order. Menu measurement uses actual labels,
not the literal “Index”; existing dropdown, dialog and active-state handlers remain.

Site Settings updates the two brand links (Navigation homeLabel can override them),
browser title, description, optional og:image, mobile contact, and project footer links.
Info continues using its existing shared contact selectors. Blank browser titles use
CMS brandName as specified by the schema. Empty optional contacts, description, social
image and footer arrays do not restore local examples. Missing documents or failed
requests retain their local fallback independently. No new visible contact sections
are added. Legal bodies independently use their published documents.

Social metadata is applied client-side; social crawlers that do not execute JavaScript
may not see the CMS image. No build-time publishing system is introduced.

Tests: `node --test tests/navigation-settings.test.cjs`; add `INFO_LIVE_SMOKE=1`
for read-only published-data validation. At implementation, Site Settings was present
and Navigation was missing. Publish Navigation manually to test real editorial labels
and ordering. No content or schema changes were made. The Studio's existing initial
category order is preserved; once published, explicit CMS ordering wins.

## Independent Index

`#archive` reads `indexPage.entries` in exact CMS order. Every entry has its own
required `displayTitle`, optional integer `year`, optional `additionalInfo`,
1–3 ordered `previewImages`, and `initialLayout` (`full` or `half`). The query and
normalizer do not read Project references or legacy `yearOverride` values. Project
edits, slugs and detail availability cannot affect an Index entry.

Every row is a preview button; no Index title or row links to a Project. The existing
left/right arrow cursor and click-to-advance interaction are unchanged: desktop
hover starts with the first image, clicking cycles images modulo their count and
alternates full/right-half layout, and leaving the row resets it. Mobile retains
full-width previews driven by row selection and scrolling; clicking selects a row
rather than introducing a new mobile image-cycling gesture. CSS, image positioning,
transitions, crop/hotspot and responsive behavior are unchanged.

The page waits for the shared load. A valid empty list stays empty; request failure,
a missing document or a malformed entries array uses the independent local archive
list. Entries without titles or usable images, or with image counts outside 1–3,
are omitted with diagnostics. Invalid individual images are omitted in order.
No Project metadata or Project image fallback is used. Repeated routing preserves
the current Index DOM; late responses cannot replace another active route.

Validation: `node --test tests/index-page.test.cjs tests/sanity-data.test.cjs`.
Set `INFO_LIVE_SMOKE=1` for the read-only published-data check. Project and Selected
Work regression tests exercise their unchanged behavior.

### Legacy content migration

Before removing a relationship, copy the old renderer's effective title, year and
additional information into independent fields, retaining entry/image keys, array
order, image crop/hotspot and layout. The migration in
`studio/scripts/migrate-index-independent.mjs` performs this once, separately for
published Index and any existing draft. It never publishes a draft or modifies a
Project. Its only Project metadata lookup is migration-time code, not runtime logic.

From `studio/`, run `npx sanity exec scripts/migrate-index-independent.mjs --with-user-token`
to back up content and inspect a dry-run plan. Append `-- --apply` to apply it.
Backups default to `/tmp/nk-index-migration` (override with
`INDEX_MIGRATION_BACKUP_DIR` for durable storage). The script refuses unresolved
titles or image loss, checks revisions, commits atomically, and verifies that all
non-Index content stayed unchanged. It can be rerun without changing migrated data.

The inspected `001NK-Test` entry (`7cbe36eea913`) inherits title `001NK-Test`, year
`2026`, and additional information `Client ` (including the trailing space).
These values are preserved alongside its existing single landscape preview and
Full initial layout; neither the entry nor any asset is deleted.

### Verification (2026-09-23)

The published `indexPage` migration completed and read-back matched the plan.
All non-Index documents, including Projects and Selected Work, matched the
pre-migration snapshot exactly. No Index draft existed. The entry key, image key,
asset reference, layout and visible metadata were retained.

84 frontend/migration tests passed with all live checks enabled, plus 10 Studio
architecture tests. TypeScript, ESLint and schema validation passed (zero schema
warnings/errors). Chrome compared 21 browsing states for 1/2/3-image entries at
1440px, 700px and 390px against the previous renderer: image geometry, layout,
transitions, cursor and responsive interactions matched. The actual published
Index also rendered from Sanity after migration. CSS and cursor assets are unchanged.
Live Project/Selected Work checks now resolve the current published project instead
of assuming its former `ethereal-tides` slug; their application behavior is unchanged.

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
implemented. Detail routes and Selected Work now use published projects.

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


## Selected Work integration

Selected Work uses the same one-time snapshot. The category sequence remains
Video → Commissioned → Graphic; each category's project order comes directly from
the normalized `selectedWork.video/commissioned/graphic` reference arrays, resolved
through `projectsById`. The default `#work` category is Video. Navigation labels
and links still come from local markup, not the CMS Navigation document.

Valid empty arrays (including unset optional arrays normalized to empty) show no
projects. Never merge local projects into a successfully loaded category. Missing
or invalid references are omitted by the adapter; projects with invalid module
compositions are omitted from overviews without local replacement. Adapter issues
remain available for diagnosis. Request failure or missing/invalid singleton uses
local projects; a malformed category array uses local fallback only for that
category, without changing authoritative valid sibling categories.

Overview routes show the existing empty work container with aria-busy until the
request settles. The response fills only the active pending overview, without
rerouting or resetting scroll. Other active pages are untouched. Same-category
renders preserve the current DOM/player. Changing categories or leaving the page
uses the existing player cleanup. Hidden category players are not initialized.

Existing modules render in overview mode: images retain their geometry; Vimeo
teasers use autoplay/muted/loop, hidden native UI, and no custom Play/Pause button.
Enabled projects keep hash detail links. Explicitly disabled details have no
project overlay/title link; their media and title remain visible. The existing
Commissioned category behavior (title link only for enabled details) is retained.
No schema, CSS or player implementation changes were needed.

Tests cover reference/category ordering, empty arrays without local merging,
request/document/category fallback, disabled details, malformed compositions,
late category navigation, stable player identity and live Ethereal Tides reference
resolution. Frontpage, Info and detail regressions remain in the frontend suite.

Selected Work verification: all 54 frontend tests passed with live checks enabled;
syntax and diff checks passed. Chrome confirmed published Video = Ethereal Tides,
Commissioned = empty, Graphic = empty, a working title-link transition to its
Sanity detail page, one shared request and no page runtime errors. Its overview
Vimeo URL uses autoplay/muted/loop with controls disabled and no custom button.
Real Vimeo playback again timed out in the isolated browser; manually verify
actual teaser playback and desktop/mobile hover/click behavior. No Vimeo player,
CSS, schema, detail-renderer or remaining local-section changes were made here.


## Explicit Selected Work Preview

Projects have optional `selectedWorkPreview` media, projected in the existing query
and normalized with the same image/Vimeo rules as module slots. The normalized
value is one image/video slot or null. It preserves alt, crop, hotspot and optional
video poster data. Invalid values produce preview-specific diagnostics and use
the same migration fallback as a missing preview; detail modules are unaffected.

The overview uses a valid explicit preview in the existing full/auto single-media
renderer, once per project reference. With no usable preview it retains the first
Vimeo-containing detail module, otherwise the first image-containing module.
No detail composition is changed. Valid explicit previews also work independently
of malformed detail modules. Video previews use the existing overview SDK mode;
images use the existing crop/hotspot placement. Category order, reference order,
empty arrays, cached loading and non-detail link behavior remain unchanged.

No preview is automatically populated or published. Nicolas can add an image or
Vimeo URL under Projects → Selected Work Preview, above Project Modules. The object
reuses media-slot image/Vimeo/poster/alt fields and validation but offers only Image
or Vimeo Video, without text, empty, upload-video or composition controls.

## Legal integration

`#imprint` and `#privacy-policy` hydrate only the existing Legal heading and copy
from their corresponding published documents. The existing Legal navigation node,
route, scroll position and layout stay intact; later route visits use cached data.
A missing document or failed request leaves that page's local fallback intact.
Published bodies replace all local text/contact placeholders, including when empty.
Blank or absent Display title remains blank; no local title is injected.

The dependency-free DOM renderer supports only paragraphs, h2, strong, em, bullet
and numbered lists (including nesting), line breaks and http/https/mailto/tel links.
It uses text nodes, restricted element names and validated URLs. Unsupported content
is omitted by the adapter. The Legal-only strong rule permits synthetic bold because
the existing font assets contain only light weights; other typography is unchanged.

Run `node --test tests/legal-pages.test.cjs`, optionally with `INFO_LIVE_SMOKE=1`.
Read-only live validation retrieved “This is the test imprint from Sanity.” and
“This is the test privacy policy from Sanity.” No CMS documents were changed.
All planned page connections are now implemented; missing documents still use fallback.
