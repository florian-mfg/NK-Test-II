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
uploads, cropping, and hotspot selection. Alt text lives on the slot.

Slots have fixed counts and appear in their original width order, described
above the slot list. Arrangement moves a slot together with its width and media,
exactly as in `project-modules.js`. To clear a slot, select Empty instead of
deleting it. Previously uploaded media is retained for convenience but must be
ignored when Content is Empty. Each module can also be entirely empty.

## Mapping for the future data connection

Project content is not yet connected to the frontend; examples remain in `projects.js`.
Info and Frontpage are connected separately through the public adapter.
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
| Slot `type: video` | `{type: 'video', src: resolvedFileUrl, alt, poster: resolvedPosterUrl}` |

The `middle` value is the single arrangement adaptation needed for a native
string dropdown/radio field. Reverse remains the renderer's literal reverse:
for Half + Quarter + Quarter it yields slot indices `[2, 1, 0]`.
Sanity metadata (`_type`, `_key`, etc.) need not reach the renderer. The hidden
or read-only layout fields are initialized automatically when adding modules.
Image URL generation should respect Sanity crop/hotspot data. Resolve video
assets to direct file URLs; project modules use native video controls,
playsinline, and metadata preload, with no autoplay or iframe embeds.

Empty slots retain their desktop widths. The existing responsive behavior still
stacks occupied slots and hides empty slots at 700px and below.

## Schema organization

- `schemaTypes/documents/project.ts`: Project fields and reorderable modules.
- `schemaTypes/objects/projectModules.ts`: six layouts, shared controls,
  fixed slot counts, defaults, validation, and previews.
- `schemaTypes/objects/mediaSlot.ts`: Empty/Image/Video/Text, uploads, copy, alt, poster.
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
as true when absent on older documents. Projects and Selected Work remain local; Info and Frontpage are now connected.


## Mandatory Vimeo-only direction (2026-09-20)

All website video content must ultimately use Vimeo URLs, not uploaded Sanity
video files. The file-based project mapping described above documents the current
implementation, not the approved future workflow. Do not connect Projects or
Selected Work until the following changes are explicitly authorized and completed.

- Frontpage: Vimeo background with autoplay, muted playback, looping and no visible
  Vimeo UI. This renderer is connected. The existing `homePage.backgroundVideoUrl`
  schema still advertises direct MP4/WebM as well as Vimeo and only validates HTTPS;
  later tighten its description and validation to Vimeo URLs to match the renderer.
- Selected Work/project overviews: image or Vimeo teaser in media slots; teasers
  must support autoplay + muted + loop + hidden controls and use exactly the same
  layout geometry as image teasers.
- Project details: image or Vimeo video in every media slot across Full,
  Half + Half, Half + Quarter + Quarter, Quarter + Quarter + Quarter + Quarter,
  Third + Third + Third, and Two Thirds + One Third. Preserve all widths, slot
  positions, arrangement, heights, empty-slot behavior and responsive stacking.
  Text and intentional empty slots remain supported.

### Current gaps and required later work

1. `schemaTypes/objects/mediaSlot.ts` currently defines `video` as a Sanity file
   upload, requires `video.asset`, and describes native controls with no autoplay.
   All six layouts in `objects/projectModules.ts` use this shared slot type, so
   none currently accepts a Vimeo URL. Add a `vimeoUrl` URL field with validation
   of supported HTTPS Vimeo/player URLs and unlisted privacy hashes, required when
   type is video; replace the upload requirement and upload-oriented help text.
   Keep optional poster and accessible slot text. Migrate any existing uploaded
   video references to editorially supplied Vimeo URLs before removing old fields;
   do not auto-invent Vimeo equivalents or silently discard stored content.
2. `sanity-data.js` currently projects `video{asset->{_id,url}}` and normalizes only
   project-owned MP4/WebM assets. Project `moduleValue()` must later project/read
   `vimeoUrl` and emit a validated Vimeo descriptor (source, embed URL, privacy hash,
   accessible text, optional poster) instead of a file source. Reuse or extract the
   existing Frontpage Vimeo parsing with tests; keep invalid-slot isolation and
   exact slot positions/arrangements. Never treat URL parameters as playback policy.
3. `project-modules.js` currently emits native `<video controls playsinline
   preload="metadata">`. Add Vimeo iframe rendering and an explicit overview/detail
   playback context. Overviews require background teaser settings; detail playback
   can expose appropriate interactive controls. Extend the existing media sizing
   rules to iframes without altering module geometry. Verify project link overlays
   still open details while teaser iframes do not intercept clicks.
4. Selected Work in `documents/pages.ts` only stores ordered project references;
   it has no separate teaser media fields. Existing overviews use project module
   slots, so shared-slot Vimeo support covers both overview and detail locations.
   No separate Selected Work media schema is required for this existing approach.
5. Before connecting projects, test all six compositions, heights, arrangements,
   empty slots, posters, unlisted URLs, accessible titles, teaser behavior and
   detail interaction, including desktop/mobile browser playback and image/video
   geometry parity. Keep the public dataset, tokenless reads and Free-plan setup.

This step only records the plan. Project/Selected Work schemas, normalization and
renderers have not been changed to implement it.
