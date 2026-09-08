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
