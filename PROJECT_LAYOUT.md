# Project content

Edit `WORK_PROJECTS` in `projects.js`. Both work listings and detail routes render
the project's `modules` array in its stored order. A CMS can supply the same plain
data; no renderer changes or per-project HTML are required.

```js
{
  type: "half-quarter-quarter",
  height: "large",
  order: [1, 0, 2],
  slots: [
    { type: "image", src: "material/example.jpg", alt: "Description" },
    null,
    { type: "video", src: "material/example.mp4", poster: "material/poster.jpg" }
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
The project's existing link overlay still opens the project; video controls are accessible on detail pages.
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
Project pages end with the overview link; descriptions appear in the Info popup.

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
