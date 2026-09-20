# Project content

Selected Work listings still use `WORK_PROJECTS` in `projects.js`. Detail routes
prefer published Sanity projects by slug and use local projects as fallback when
Sanity fails or the published project is absent. Both use the same module renderer
and stored composition order; Selected Work is not connected to Sanity.

```js
{
  type: "half-quarter-quarter",
  height: "large",
  order: [1, 0, 2],
  slots: [
    { type: "image", src: "material/example.jpg", alt: "Description" },
    null,
    { type: "video", src: "https://vimeo.com/12345", poster: "material/poster.jpg" }
  ]
}
```

Types and their spans on the 12-column grid:

| Type | Spans |
| --- | --- |
| `full` | 12 |
| `half-half` | 6, 6 |
| `half-quarter-quarter` | 6, 3, 3 |
| `quarter-quarter-quarter-quarter` | 3, 3, 3, 3 |
| `third-third-third` | 4, 4, 4 |
| `two-thirds-one-third` | 8, 4 |

`order` defaults to `"default"`. Use `"reverse"` or a permutation of zero-based
slot indices. Each slot keeps its original width and media when moved. For
half/quarter/quarter, `[1, 0, 2]` puts the half in the middle; `[1, 2, 0]` puts it
last. `null` and omitted trailing slots preserve their desktop width.

Heights are `auto`, `small`, `medium`, `large`, and `viewport`. Adjust the
`--module-*` tokens in `style.css`. Auto uses natural media heights; an entirely
empty auto row uses `--module-empty-auto`. Fixed-height media uses `object-fit:
cover`. At 700px and below, occupied slots stack in configured order and empty
slots disappear. Each stacked slot uses the selected height; auto stays natural.

Each work module has a `.project-module-preview` wrapper containing the existing
`.project-title`, with the same positioning, appearance, and stacking. The title
sticks within that row and leaves at its boundary; the next module has its own
title and Open link for the same project. Empty rows and their titles disappear
on mobile. Do not add overflow scrolling or transforms to their ancestors.
The project's existing link overlay still opens the project. Vimeo teasers use
autoplay/muted/loop playback without native UI. Details use a custom Play/Pause
icon button and never autoplay; Vimeo native UI remains hidden.
Header, category filtering, archive data, and detail controls are independent.

The migrated content retains each project's original opening composition on
desktop and uses its existing images in subsequent example rows. Adjust these
rows directly to curate the final compositions.

## Text slots

Every layout accepts `{ type: "text", text: "Your text" }` in any slot instead
of an image, video, or `null`. Text keeps the slot’s width and arrangement, with
top-aligned light text on black. Blank lines separate paragraphs; single newlines
create line breaks. Content is escaped and treated as plain text. Fixed-height
text slots scroll if needed; on mobile they grow to fit the copy.

Ethereal Tides includes image/text examples in all five multi-column layouts.
Project descriptions appear in the Info popup.
Visitors can return to the project's category overview using the Overview link
below the logo.
Project pages end with a full-height contact footer. At the scroll limit, its
links begin at the project title's vertical position. Instagram and Mail use the
existing contact details. Imprint and Privacy Policy link to `#imprint` and
`#privacy-policy`; their content in `renderLegal()` in `app.js` is placeholder
copy awaiting the final legal text.

Set `textSize` on a text slot to `"s"`, `"m"`, or `"l"`. Omitted sizes default
to S (the original 1rem size). M uses 1.5rem and L uses 2.2rem, with tighter
line spacing. For example: `{ type: "text", text: "Your text", textSize: "m" }`.
Ethereal Tides demonstrates all three sizes.

## Index additional info

The sixth value of an `ARCHIVE_PROJECTS` entry in `app.js` is optional free text
shown beside its title, such as a client or brand name. Omit it or use an empty
string to leave the field blank. The fifth value remains the layout override;
use `null` to keep the default. Example:

```js
["Project title", "Graphic", "2026", ["material/example.jpg"], null, "Prada"]
```

Brand names in the sample Index are illustrative placeholders. Categories still
control the existing ordering but are no longer displayed in this column.

Project overviews also accept an optional `additionalInfo` string on each
`WORK_PROJECTS` project. It appears beside each module’s title, aligned with
Selected Work. Omit it or leave it empty to hide the label. The Studio Project
schema includes the same field for the future data connection.

## Vimeo project media

Use a normal Vimeo or player.vimeo.com URL for `src` (or `vimeoUrl`), including
any unlisted privacy hash. Uploaded video file URLs are no longer accepted for
project playback. `renderProjectModule(module, title, mode)` and
`renderProjectModules(modules, title, mode)` accept `overview` or `detail`
(default). Both use exactly the same grid/slot renderer. After inserting markup,
call `initProjectVideos(root)` and retain its cleanup callback for route changes.
The app does this for local overviews and Sanity/local detail content.

The SDK is loaded on demand only for visible Vimeo slots. Fixed-height videos
cover their slot; auto-height follows native video ratio after metadata, initially
16:9. CSS changes are scoped to project Vimeo wrappers. The Play/Pause button uses the supplied `material/play.svg` and
`material/pause.svg` unchanged at their original 60×59 dimensions. Accessible
labels follow playback state; Vimeo native controls stay hidden. For schema/migration rules and remaining browser
checks, see `studio/CONTENT_MODEL.md`. Selected Work remains local; project details prefer published Sanity data.


## Detail migration behavior

Detail hashes wait for the one-time content request before deciding between
published and local data. Only explicit false disables a published detail page.
No Selected Work reference is required. Cached revisits do not fetch again.
Published description text supplies the existing Project Info popup, safely
preserving paragraphs. Empty CMS descriptions/modules remain empty. Known malformed
module frames stay empty; unknown layouts are omitted with adapter diagnostics.
Healthy rows remain in order. See `SANITY_DATA.md` for verification and limitations.
