# Project content model

## Permanent Free-plan requirement

All current and future Nicolas Kawohl portfolio development must work on Sanity's
Free plan after the Growth trial ends. Use only the existing public `production`
dataset in project `ck6xe2er`, standard documents/schemas/references, image/file
assets, GROQ, and ordinary draft editing and manual publishing.

Do not introduce dependencies on private datasets, custom roles or advanced access
control, Scheduled Drafts, Comments/Tasks workflows, Content Releases, AI Assist,
or other paid AI features. Do not add paid plugins or services without an explicit
user request. Singleton UI controls and schema validation are not access-control
roles. Use Free-plan roles and stay within Free-plan storage, bandwidth, document,
and request quotas; do not assume paid overages. Check current
[Sanity plan availability](https://www.sanity.io/pricing) before adding features.

Review on 2026-09-19: no paid-feature dependency was found in the Studio config or
schemas; an unauthenticated query confirmed public access to `production`.
Trial-only controls may appear through Sanity defaults, but must not become part
of the workflow. No configuration or dataset changes were needed. Hosted member
roles and account usage were not audited; future plan or quota changes require
rechecking compatibility rather than assuming permanent vendor terms.

## Editing projects

Refresh http://localhost:3333 and create a Project. Enter a title, generate its
slug, and add modules. Drag modules to reorder them or use their menu to delete
them. Open a content slot and choose Empty, Image, Video, or Text. Images support native
uploads, cropping, and hotspot selection. For Video, paste a Vimeo URL; no video
upload is needed. Alt text lives on the slot.

Slots have fixed counts and appear in their original width order, described
above the slot list. Arrangement moves a slot together with its width and media,
exactly as in `project-modules.js`. To clear a slot, select Empty instead of
deleting it. Previously uploaded media is retained for convenience but must be
ignored when Content is Empty. Each module can also be entirely empty.

## Mapping for the future data connection

Project details now use published Sanity data by slug, with local fallback.
Selected Work overviews now use the published singleton references in CMS order. Info and Frontpage remain connected
through the same one-time public adapter request.
Sanity documents are not yet directly renderable: native assets are references,
and Sanity object arrays use typed objects rather than null entries.

| Sanity | Existing frontend data |
| --- | --- |
| `title`, `category` | Same fields and values |
| `slug.current` | `id` used by project routes |
| `year` (number) | `year` (currently a string; stringify if needed) |
| `modules[]` | Same array order |
| Module `type` | Identical six internal names from `PROJECT_MODULE_TYPES` |
| Module `height` | `auto`, `small`, `medium`, `large`, `viewport` unchanged |
| `order: default` / `reverse` | Unchanged |
| `order: middle` | `[1, 0, 2]` for Half + Quarter + Quarter |
| `slots[]` | Same index positions; never filter or compact |
| Slot `type: empty` | `null`, even if old image/video fields remain |
| Slot `type: text` | `{type: 'text', text, textSize}` (s/m/l; defaults to s) (plain text; blank lines separate paragraphs) |
| Slot `type: image` | `{type: 'image', src: resolvedImageUrl, alt}` |
| Slot `type: video` | `{type: 'video', src: originalVimeoUrl, vimeo: {type, src, id, embedUrl}, alt, poster?, posterImage?}` |

The `middle` value is the single arrangement adaptation needed for a native
string dropdown/radio field. Reverse remains the renderer's literal reverse:
for Half + Quarter + Quarter it yields slot indices `[2, 1, 0]`.
Sanity metadata (`_type`, `_key`, etc.) need not reach the renderer. The hidden
or read-only layout fields are initialized automatically when adding modules.
Image URL generation respects Sanity crop/hotspot data. Project video slots use
validated Vimeo URLs, with overview/detail playback policy supplied by the shared
renderer. Uploaded files are retained only for manual migration, not playback.

Empty slots retain their desktop widths. The existing responsive behavior still
stacks occupied slots and hides empty slots at 700px and below.

## Schema organization

- `schemaTypes/documents/project.ts`: Project fields and reorderable modules.
- `schemaTypes/objects/projectModules.ts`: six layouts, shared controls,
  fixed slot counts, defaults, validation, and previews.
- `schemaTypes/objects/mediaSlot.ts`: Empty/Image/Video/Text, images, Vimeo URL, legacy uploads, copy, alt, poster.
- `schemaTypes/index.ts`: registration, consumed by the existing sanity.config.ts.

Uses native [array controls](https://www.sanity.io/docs/studio/array-type),
[image fields](https://www.sanity.io/docs/studio/image-type), and
[predefined string choices](https://www.sanity.io/docs/studio/string-type).

## Expanded Studio architecture

See [STUDIO_ARCHITECTURE.md](STUDIO_ARCHITECTURE.md) for page singletons,
Selected Work curation, independent Index entries, shared contacts, navigation,
legal content, compatibility rules, and verification commands. The module mapping
above remains unchanged. Project `description` is plain popup text;
`detailPageEnabled` defaults to true for new documents and must also be interpreted
as true when absent on older documents. Project details, Selected Work, Info and Frontpage are connected.


## Permanent project-video requirement: Vimeo only

All website videos must ultimately use Vimeo URLs, never Sanity video uploads.
Project-media preparation and project DETAIL integration are implemented.
Selected Work overviews now use published Sanity reference arrays; valid empty
categories stay empty. `projects.js` is retained for migration fallback.
Details prefer published projects, with local data retained as migration fallback.
Frontpage and Info behavior are unchanged.

### Nico's editing workflow

In Projects, add any of the six modules, open a content slot, select **Video**,
and paste the video link into **Vimeo URL**. Normal `https://vimeo.com/12345`,
unlisted `https://vimeo.com/12345/privacyHash`, and
`https://player.vimeo.com/video/12345?h=privacyHash` links are accepted, including
additional query parameters. Include the privacy hash for unlisted videos.
Optionally provide alt text and a poster image. New uploaded-video fields are
not offered. Image, Text and Empty continue to work as before.

### Shared schema, adapter and renderer

- `vimeo-media.js` supplies one Vimeo URL validator/parser to the Studio, adapter
  and renderer. It rejects non-HTTPS, other hosts, invalid paths/IDs, credentials,
  custom ports, invalid/duplicate privacy hashes. Original URL is retained; only
  video ID and privacy hash enter the canonical embed URL. Pasted UI/playback
  options never override the selected rendering mode.
- `sanity-data.js` projects `vimeoUrl` and normalizes a Vimeo descriptor. Invalid
  videos still invalidate the module composition with diagnostics; project metadata
  survives. Empty slots ignore all retained media. Image crop/hotspot, text sizes,
  alt, order, heights, null positions and arrangement mappings remain unchanged.
- All six compositions use the same `mediaSlot` and `project-modules.js`: Full,
  Half + Half, Half + Quarter + Quarter, Quarter + Quarter + Quarter + Quarter,
  Third + Third + Third, Two Thirds + One Third.
- Selected Work still stores ordered project references, with no separate teaser
  media fields. The same module slots support overview teasers and project details.
  No Selected Work ordering or schema change was needed.

### Playback and geometry

Overview mode uses autoplay + muted + loop + background, with native controls,
title, portrait, byline and badges disabled. Detail mode explicitly disables
background/autoplay/muting/looping and uses a custom Play/Pause icon button with
Vimeo controls disabled. Sound follows the viewer's device settings. Buttons track
actual play/pause/ended events rather than assuming a successful API command.
Play rejection permits retry; unavailable embeds/SDK failures disable the button
and expose the failure through its accessible label and tooltip.

The detail button uses the supplied `material/play.svg` and `material/pause.svg`
assets unchanged at their native 60×59 size and original color. Player events swap
the icon and accessible label. There is no visible text-button design, filter or
hover recoloring; the keyboard focus outline remains. Existing control placement
and Vimeo playback logic are unchanged.

`project-video.js` loads the official Vimeo Player SDK only when visible project
Vimeo slots exist. Hidden overview categories never load their embeds. Route cleanup
removes listeners/observers and destroys players; late SDK completion cannot create
players after navigation. No project data is loaded from Sanity by this controller.

The existing grid, slot spans, heights, ordering, spacing and mobile stacking are
shared by both modes. Iframes are centered and resized to cover the slot like an
image; they do not intercept project-link clicks. Auto-height uses the video's
native ratio reported by Vimeo, with a temporary 16:9 ratio until metadata arrives.
Fixed-height slots crop to cover. A poster is decorative behind the player. The
pre-metadata aspect ratio and real Vimeo playback still need browser verification
with the intended content, particularly portrait videos and mobile Safari.

### Migration safety and audit

Read-only public production audit on 2026-09-20 found **1 public Project and 0
uploaded video references**, including retained assets in inactive slots. The
unauthenticated query cannot rule out private drafts/releases. Inspect those in
Studio before connecting Projects.

The original `video` file field remains read-only and visible when populated,
labelled **Legacy uploaded video (migration only)**. No documents/assets were
written, deleted or migrated. Existing uploads remain stored, but are not accepted
for project playback. An active video slot without a valid Vimeo URL receives
validation feedback and a `legacy_video_requires_migration` adapter diagnostic.
Supply an editorially chosen Vimeo equivalent manually; files cannot be converted
into Vimeo URLs automatically. A valid Vimeo URL wins even if a legacy asset remains.

### Remaining playback checks

1. Verify intended Vimeo videos allow embedding from localhost and the deployed
   GitHub Pages origin, including privacy hashes and owner-side embed settings.
2. Confirm real autoplay teasers, custom detail Play/Pause, sound, posters and
   desktop/mobile cover geometry. No layout changes are needed for the data hookup.
3. Review any private drafts for legacy uploads, replace them with Vimeo URLs,
   and resolve invalid module diagnostics before adopting a project composition.
4. Selected Work is now connected. Keep public
   tokenless Sanity reads, the existing hash routes and Free-plan-compatible setup.

The SDK and iframe are served directly by Vimeo; no Vimeo API token, npm runtime
package, Sanity video asset or frontend build is needed. Vimeo's own account/embed
settings are separate from Sanity Free-plan compatibility. Vimeo documents account
requirements for `background` and `controls=0`; verify the video owner's eligibility.
Sources: [Vimeo Player SDK](https://github.com/vimeo/player.js),
[Vimeo player parameters](https://help.vimeo.com/hc/en-us/articles/12426260232977-About-Player-Parameters).

### Preparation verification (2026-09-20)

- 41 frontend tests passed with live Sanity smoke tests enabled, including the
  existing published Frontpage and Info values; 9 Studio tests passed.
- TypeScript, ESLint, JavaScript syntax checks and Sanity schema validation passed
  (zero schema warnings/errors).
- Isolated Chrome geometry fixture passed 900 slot comparisons: six layouts,
  five heights, both modes, landscape/portrait/square dimensions and desktop/mobile
  viewport sizes. The fixture mocked Vimeo metadata; it tested actual browser CSS.
- A separate real Vimeo playback fixture loaded the SDK but received an HTTP 401
  during loading and timed out waiting for player readiness. Real project playback
  is therefore **not verified** by this run. Check the intended video's permissions,
  embedding origin and custom Play/Pause on the deployed site before integration.
- The existing Studio test script references an unavailable `tsx` installation.
  Tests ran with a temporary `/tmp` installation of the same runner; package files
  and application dependencies were not changed. Install the runner in the usual
  development environment before using `npm run test:architecture` there.


### Detail integration verification

The next detail-only integration passed 48 frontend tests, including live published
Ethereal Tides, Frontpage and Info tests. The public project has four modules and
Vimeo video `1226319421`; its description is empty. Direct Chrome routing and cached
navigation rendered its actual metadata, images and video source while leaving
Selected Work local. Actual Vimeo readiness timed out, so real playback still
requires manual browser verification. `detailModules` provides defensive row-level
recovery without changing the strict `modulesValid/modules` contract or CMS schema.
See `SANITY_DATA.md` for full loading, fallback, metadata and validation behavior.


Selected Work integration uses the existing normalized ordered reference lists,
with fixed category sequence Video → Commissioned → Graphic. No schema was changed.
Navigation and Site Settings now drive global labels/order, branding, metadata and
shared contact/footer links through the existing public read. Legal bodies now use their published Display title and restricted formatted text,
with per-document local fallback only when unavailable.
Index now consumes its independently ordered
entries, required own titles, independent year/additional information and 1–3 own
preview images. Entries only browse previews and never link to Project details. Missing
Index documents retain local fallback, while valid empty lists stay empty.
The detail renderer and Vimeo player
implementation were not changed during the Selected Work connection.


### Selected Work Preview compositions

In Content → Projects → a project, **Selected Work Preview** appears above
**Project Modules**. It is optional and independent of the detail page.

1. Add one **Composition** and choose one of the same six Project Module layouts.
2. Fill the fixed slots with **Image**, **Vimeo Video**, or **Empty**. Images retain
   crop/hotspot and alt controls; Vimeo accepts the existing URL forms and poster.
3. Choose the existing **Height** preset and **Arrangement** (including the middle
   half in Half + Quarter + Quarter). Each slot moves with its width and media.

The shared `createProjectModules()` factory creates both detail and preview schema
objects. Preview slots reuse image/Vimeo fields from `mediaSlot`, but do not offer
Text or uploaded-video controls. Only one composition is allowed per preview. The
project still appears once in Selected Work, in that page's curated category order.

Existing single Image/Vimeo previews normalize to Full Width / Auto without manual
re-entry. The lossless migration moves that media into the composition editor while
retaining old fields for compatibility. See [SANITY_DATA.md](../SANITY_DATA.md#backwards-compatibility-and-migration)
for dry-run/apply commands and backup/revision protection.

The overview uses the existing module renderer, CSS and video controller. All media
slots keep the same desktop grid and mobile stacking/empty hiding. Vimeo previews
autoplay muted and loop without native controls; detail videos and modules are
unchanged. A missing/invalid preview retains the existing detail-media fallback;
a valid all-empty composition stays empty. No paid Sanity features are used.
