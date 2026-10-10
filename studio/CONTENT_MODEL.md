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
them. Open a content slot and choose Empty, Image, MP4 Video, or Text. Images support native
uploads, cropping, and hotspot selection. For MP4 Video, upload an MP4 file directly to Sanity. Alt text lives on the slot.

Slots have fixed counts and appear in their original width order, described
above the slot list. Arrangement moves a slot together with its width and media,
exactly as in `project-modules.js`. To clear a slot, select Empty instead of
deleting it. Previously uploaded media is retained for convenience but must be
ignored when Content is Empty. Each module can also be entirely empty.

## Mapping for the future data connection

Project details now use published Sanity data by slug, with local fallback.
Selected Work overviews now use the published singleton references in CMS order. Info uses the same one-time public adapter request. Frontpage data is normalized,
but its fixed local opacity sequence is intentionally independent of CMS media.
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
| Slot `type: mp4` | `{type: 'mp4', src: SanityFileUrl, alt, playback?, poster?, posterImage?}` |

The `middle` value is the single arrangement adaptation needed for a native
string dropdown/radio field. Reverse remains the renderer's literal reverse:
for Half + Quarter + Quarter it yields slot indices `[2, 1, 0]`.
Sanity metadata (`_type`, `_key`, etc.) need not reach the renderer. The hidden
or read-only layout fields are initialized automatically when adding modules.
Image URL generation respects Sanity crop/hotspot data. Project video slots use
validated Sanity MP4 assets, with overview/detail playback policy supplied by the
shared renderer and native media controller.

Empty slots retain their desktop widths. The existing responsive behavior still
stacks occupied slots and hides empty slots at 700px and below.

## Schema organization

- `schemaTypes/documents/project.ts`: Project fields and reorderable modules.
- `schemaTypes/objects/projectModules.ts`: six layouts, shared controls,
  fixed slot counts, defaults, validation, and previews.
- `schemaTypes/objects/mediaSlot.ts`: Empty/Image/MP4/Text, native image and MP4 uploads, copy, alt, poster.
- `schemaTypes/index.ts`: registration, consumed by the existing sanity.config.ts.

Uses native [array controls](https://www.sanity.io/docs/studio/array-type),
[image fields](https://www.sanity.io/docs/studio/image-type), and
[predefined string choices](https://www.sanity.io/docs/studio/string-type).

## Expanded Studio architecture

See [STUDIO_ARCHITECTURE.md](STUDIO_ARCHITECTURE.md) for page singletons,
Selected Work curation, standalone and Project-linked Index entries, shared contacts, navigation,
legal content, compatibility rules, and verification commands. The module mapping
above remains unchanged. Project `description` is plain popup text;
`detailPageEnabled` defaults to true for new documents and must also be interpreted
as true when absent on older documents. Project details, Selected Work and Info are connected; Frontpage keeps its local sequence.



## Supported media and legacy compatibility (2026-10-10)

The active website and Studio support native Sanity images and MP4 uploads.
Project slots additionally retain Empty and Text; overview slots retain Empty.
Index supports native image members and Image/MP4 wrappers. No URL-based video
integration or external player SDK is loaded.

Project and overview MP4 files keep existing heights, arrangements, posters,
autoplay/manual behavior, native inline playback, and custom Play/Pause controls.
Project and Index Sound/Mute controls share the native audio ownership controller.
Only the selected relevant player can become audible; route/media cleanup stops
and releases sources. Index retains its white backdrop and intrinsic portrait
positioning. Only the final Graphic category label is suppressed.

Frontpage's former URL field is replaced by optional `video`, a Sanity MP4 upload.
Its accessible title and poster remain. At the user's request, the existing local
20-image deterministic opacity sequence stays unchanged: the upload is normalized
but is not inserted into that sequence. Mouse distance and mobile touch/hold
behavior are unchanged.

Legacy Vimeo data is not changed, downloaded, converted, or migrated. Stored
project slot `type: video` values become absent media. Unsupported Index media
types are excluded from cycling, and entries without supported items are omitted.
Mixed module rows retain valid images/MP4s and their original slot widths/order;
unsupported-only rows disappear. Unsupported-only explicit previews remain empty
and do not fall back to unrelated detail images.

Studio no longer defines the old URL fields. Sanity may show an unknown-field
notice for their stored values; they remain in the document unless an editor
explicitly removes them. Selector lists contain only supported choices. Their
inferred enum validation is reset before applying required validation plus a
warning for unsupported stored values, so legacy records can still be opened,
edited, reordered, duplicated, and published. Invalid selected image/MP4 assets
still produce errors. Compiled-schema tests verify this without dataset writes.
New uploads and content replacement are editorial actions; no migration is run.

The old `vimeo-media.js` parser and SDK-specific tests have been removed.
Historical migration tests still retain legacy fields to prove lossless handling.
The updated Studio needs a separate future redeployment before hosted editors see
these local schema changes. Nothing has been deployed by this change.


## Project-linked Indexmaterial (2026-10-10)

Projects now contain an optional Indexmaterial object (`indexmaterial`). Upload
up to three Image/MP4 items in `media`, drag them to set cycling order, and optionally
set Index-only `textColor` (Auto/Black/White). Empty material is valid and omitted.
The existing Project title, year and additionalInfo are reused; no duplicate
metadata field or Selected Work preview is created.

Content → Index keeps the same `entries` array, with both standalone `indexEntry`
objects and `indexProjectReference` objects. References store only `project._ref`;
media remains in the Project. Manually ordered entries retain their sequence;
eligible unlisted Projects follow by stable document ID. An explicit reference
controls placement over linked standalone duplicates; otherwise the first linked
standalone position is used. Standalone entries without a reliable Project link
are preserved, even when titles match. Set the optional Related Project link to
resolve these identities manually. No stored legacy entry is deleted or rewritten.

The adapter reads only published Projects and feeds both sources through the
existing Index media normalizer/renderer. Index images retain crop/hotspot and
portrait positions; native MP4 retains autoplay, muted default, looping, playsinline
and shared Sound/Mute. Detail settings, memberships and Selected Work order stay
independent. No new renderer, CSS layout, mutation, migration or deployment is
required in this local task. A later source/Studio deployment is needed before
editors can use the new hosted fields. Publishing Project edits afterward makes
them available to the public query on the next page load.
