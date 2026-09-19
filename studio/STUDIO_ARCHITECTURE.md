# Studio architecture

This step changes only Studio schemas and organization. No public frontend queries,
rendering, routes, styles, content imports, or hosted dataset mutations are included.
Opening Studio allows editors to create drafts; no singleton documents are seeded
by these source changes.

## Editor navigation

- Content → Frontpage: background video URL, accessible title, optional poster.
- Content → Selected Work: three independently ordered project-reference arrays.
- Content → Projects: normal repeatable project documents and the existing modules.
- Content → Index: independent ordered entries, optionally linked to projects.
- Content → Info: biography, CV, Work, Skills, contact selectors, Selected Clients.
- Settings → Navigation: labels and controlled destinations for both menus.
- Settings → Site Settings: shared contact addresses, brand, metadata, footer links.
- Settings → Legal: fixed Imprint and Privacy Policy documents.

## Stable identifiers and singleton behavior

The fixed document IDs are `homePage`, `selectedWork`, `indexPage`, `infoPage`,
`navigation`, `siteSettings`, `legal-imprint`, and `legal-privacy-policy`.
Structure Builder opens these documents directly. Creation menus omit these
schemas/templates; delete and duplicate actions are removed. Publish, unpublish,
discard changes, and restore remain available. Legal panes apply explicit initial
value templates and validate that the page type matches the fixed document ID.
Projects retain normal creation and document actions.

These are Studio UI safeguards, not dataset-level uniqueness constraints. External
API clients can still write documents; this task does not change dataset permissions.
No existing documents are deleted or consolidated automatically.

Project categories retain the original stored values `Video`, `Commissioned`,
`Graphic`. Selected Work stores references under `video`, `commissioned`, `graphic`.
Reference pickers filter by category, and custom validation also checks the current
referenced project (preferring its draft) to catch later category edits. Changing a
project category requires reviewing its placements in Selected Work.

Navigation destinations are controlled identifiers (`home`, `work`, `archive`,
`info`, and `work/video`, `work/commissioned`, `work/graphic`). Labels do not define
routes. Initial category order follows the latest mobile design: Commissioned,
Graphic, Video. These are new-document defaults only, not imported frontend data.
The homepage link always targets home; its optional label falls back to brandName.

## Shared contact content

Email, Instagram URL, and optional phone number live only in Site Settings.
Info, navigation’s mobile contact link, and footer items select a stable destination
(`email`, `instagram`, `phone`) plus a display label. These are logical references
to the fixed Site Settings document, not duplicate addresses or separate contact
documents. Editors must fill the matching address in Site Settings. A future adapter
should omit unavailable destinations rather than render an empty link.

## Project compatibility

The original project type, six module types, and mediaSlot definitions remain.
Module geometry, heights, arrangements, crop/hotspots, text sizes, and empty slots
are unchanged. New project fields: description (plain text for the popup) and
 detailPageEnabled (true for new projects). An absent detailPageEnabled on older
records MUST be treated as enabled by a future adapter. No new requirement for
modules or description is imposed on existing documents.

Category is now required and constrained to the original three values. Slugs must
use lowercase ASCII letters/numbers separated by single hyphens. Existing projects
with missing/invalid categories or unsafe slugs may need editorial correction
before publishing; values are not rewritten. Title edits do not regenerate slugs.
Preserve existing route IDs during any later import. Sanity’s normal slug uniqueness
check remains in place.

## Index semantics

Index entries are embedded objects in a separately ordered singleton array. They
can exist without any project. Unlinked entries require a displayTitle. Linked
entries fall back to the project title/year/additionalInfo when their overrides are
absent. Preview images are explicitly curated per entry and required, even when a
project is linked. Their order does not depend on project modules. Initial layout
is full or right-half; subsequent cycling and mobile behavior remain frontend logic.
There is no automatic generation from Selected Work and no forced detail route.
The optional additionalInfo override preserves the frontend’s client/brand column.

## Text and homepage decisions

Project descriptions and module text remain plain text. CV entries have a period
and description; Work, Skills, and Clients are ordered strings. No Info layout
controls exist. Legal content uses restricted Portable Text (paragraphs, headings,
lists, bold/italic, and HTTP(S)/email/telephone links).

The temporary homepage stores an HTTPS video URL and accessible title, with optional
poster. Vimeo URLs (including unlisted hashes) and direct video URLs can be stored.
Playback, embed generation, aspect ratio, overlay, and future visual redesign remain
frontend responsibilities. No arbitrary iframe markup is accepted.

## Verification and manual review

From studio/:

- `npm run check` — TypeScript, without generated output.
- `npm run lint` — ESLint.
- `npm run test:architecture` — focused schema/structure tests; uses the existing
  tsx package in the installed Sanity toolchain (no new dependency added).
- `npm run schema:validate` — schema errors and warnings.
- `npm run schema:extract` — extract into ignored tmp/.
- `npm run build` — production Studio build; does not deploy.
- `npm run dev -- --host 127.0.0.1 --port 3333` — local Studio.

The existing autoUpdates setting is unchanged. Build/dev may need internet access
for runtime version checks; the configured production dataset is unchanged.

Manually test after login:

1. Open each fixed page. Confirm no singleton appears in Create or offers Duplicate.
2. Create test projects in all categories; verify all six layouts and empty slots.
3. Fill a project description, toggle detail availability, and validate a slug.
4. Select/reorder projects per category; change a selected project category and
   check the overview validation message.
5. Make an Index-only entry with a title and images, then a linked entry without a
   custom title. Reorder entries/images and switch the initial layout.
6. Edit/reorder Info content. Set shared contacts once; select them in Info/menu/footer.
7. Rename navigation labels while retaining destinations; verify all three categories.
8. Open both legal pages; confirm the correct locked page type and rich text editing.

These editorial tests create content only when performed by the editor. The public
website will not change until a separate, explicitly authorized integration step.
