# Project content model

Refresh http://localhost:3333 and create a Project. Enter a title, generate its
slug, and add modules. Drag modules to reorder them or use their menu to delete
them. Open a media slot and choose Empty, Image, or Video. Images support native
uploads, cropping, and hotspot selection. Alt text lives on the slot.

Slots have fixed counts and appear in their original width order, described
above the slot list. Arrangement moves a slot together with its width and media,
exactly as in `project-modules.js`. To clear a slot, select Empty instead of
deleting it. Previously uploaded media is retained for convenience but must be
ignored when Content is Empty. Each module can also be entirely empty.

## Mapping for the future data connection

No frontend connection, migration, deployment, or renderer changes are included.
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
- `schemaTypes/objects/mediaSlot.ts`: Empty/Image/Video, uploads, alt, poster.
- `schemaTypes/index.ts`: registration, consumed by the existing sanity.config.ts.

Uses native [array controls](https://www.sanity.io/docs/studio/array-type),
[image fields](https://www.sanity.io/docs/studio/image-type), and
[predefined string choices](https://www.sanity.io/docs/studio/string-type).
