# Studio architecture

Studio schemas and the public read-only adapter share this content model.
Source changes never import, migrate or mutate hosted dataset content.
Opening Studio allows editors to create drafts; no singleton documents are seeded
by these source changes.

## Editor navigation

- Content → Frontpage: optional MP4 upload, accessible title, optional poster; the frontend keeps its fixed local sequence.
- Content → Selected Work: three independently ordered project-reference arrays.
- Content → Projects: normal repeatable project documents, existing modules, and optional Indexmaterial.
- Content → Index: a sortable mixed array of standalone entries and Project references.
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

The existing `indexPage.entries` array retains its standalone `indexEntry` objects
and adds `indexProjectReference` objects containing only a `project` reference.
Editors drag both types together. No media or project metadata is copied into a
reference. Existing standalone entries keep their own metadata and preview media.
An optional Related Project reference provides an explicit identity for duplicate
handling; unlinked entries are never matched by title.

Each Project exposes optional `indexmaterial.media` (0–3 items, Image/MP4) and
`indexmaterial.textColor` (Auto by default). Existing Project title, year and
additionalInfo supply Index metadata. Crop/hotspot and portrait positions reuse
the existing Index media schema. Detail text color, category memberships and
Selected Work previews/curation remain independent.

The published-only query reads Project media directly. Usable Indexmaterial makes
a Project eligible, even without a manually added reference. Ordered references
and standalone entries come first; eligible unlisted Projects follow sorted by
stable document ID. If an eligible Project is explicitly ordered, its reference
position wins over linked standalone duplicates. Otherwise its first linked
standalone position is reused. Duplicate references are shown once. An ineligible
Project reference is omitted; linked standalone entries remain when that Project
has no usable Indexmaterial. Published documents are never edited by this logic.
Unlinked entries may need an editor to set Related Project when they represent the
same Project; similar titles alone do not establish identity.

Both sources normalize to the same renderer contract. Index buttons still cycle
media rather than navigating to Project detail. Desktop selection/cycling, mobile
scrolling/taps, portrait behavior, contrast and global MP4 Sound/Mute are retained.
No migration or content rewrite is needed to adopt these source changes. Historic
migration scripts are not part of this transition and must not be run for it.

## Text and homepage decisions

Project descriptions and module text remain plain text. CV entries have a period
and description; Work, Skills, and Clients are ordered strings. No Info layout
controls exist. Legal content uses restricted Portable Text (paragraphs, headings,
lists, bold/italic, and HTTP(S)/email/telephone links).

Frontpage stores an optional direct Sanity MP4 upload and accessible title, with
an optional poster. Its fixed local opacity sequence remains unchanged and does
not consume that upload. Images and MP4 files are the only active frontend media.
See CONTENT_MODEL.md for unsupported legacy-media compatibility.

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
5. Test optional Project Indexmaterial, its three-item limit and independent text color.
   Mix Project references and standalone entries under Index and drag to reorder.
   Confirm unlisted eligible Projects follow in document-ID order and explicitly
   linked duplicates appear once. Index clicks still cycle media rather than navigate.
6. Edit/reorder Info content. Set shared contacts once; select them in Info/menu/footer.
7. Rename navigation labels while retaining destinations; verify all three categories.
8. Open both legal pages; confirm the correct locked page type and rich text editing.

These editorial tests create content only when performed by the editor. The public
website and hosted Studio will use source changes only after a separate deployment.
No deployment or published-content edits are part of this local implementation.
