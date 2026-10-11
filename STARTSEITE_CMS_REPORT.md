# Startseite CMS and immediate Frontpage interaction

Implemented locally. No deployment, commit, push, published document/asset edits, hosting or DNS changes were made.

## 1. Interaction speed

`PROGRESSION_MULTIPLIER = 3.5` in `frontpage-media-fade.js` controls both input modes. Desktop now uses approximately **137 CSS pixels per reveal**, versus 480 previously. Touch advances at **2.45 items/second**, versus 0.70 previously: approximately 0.41 seconds per item.

Opacity remains linear and driven entirely by input. Stopping movement or releasing touch freezes the exact rendered opacity; the next input resumes. A half-transition-per-input-frame guard keeps an intermediate opacity visible during very large/coalesced mouse bursts rather than skipping directly over items. Excess mouse travel is retained for subsequent actual movement, never animated autonomously after stopping. Ordinary movement follows the configured distance rate. The same frame guard protects touch input during unusually delayed frames.

The six-completed-media rolling window and synchronized oldest/newest crossfade remain intact; seven items can briefly coexist during a transition. Nodes are removed and released after leaving the window. Short CMS sequences retain up to their available item count; a one-item sequence remains visible after its initial reveal.

## 2. Startseite editor

The existing `homePage` singleton remains at **document ID `homePage`**. Its Content structure label is now **Startseite**. No duplicate singleton was created.

Startseite → Media is a standard sortable Sanity array. Add Image or MP4 items, upload the asset, choose the required Small/Medium/Large dropdown, and drag to reorder. New items default to **Image / Medium**. MP4 items offer an optional preview/poster image. List previews show the image or poster thumbnail, video filename where available, and selected size. Existing legacy fields remain in the schema, hidden from the simplified editor; no data was deleted or migrated. Legacy video title no longer blocks a document using the new media list.

Only standard Sanity features and existing dependencies are used. Vimeo and external video players are not supported.

## 3. Responsive sizes

The approved cluster relationships, corner variations, overlap, edge alignment and separate portrait-mobile rules remain. CMS size affects the individual item's fitting bounds:

| Size | Desktop nominal width / height bounds | Mobile nominal width / height bounds |
| --- | --- | --- |
| Small | 17% / 33% | 29% / 22% |
| Medium | 35% / 57% | 57% / 40% |
| Large | 62% / 78% | 90% / 57% |

Curated per-slot/spread variations adjust width, and each item's aspect ratio determines its final dimensions. These are responsive limits, not fixed pixel dimensions. Bounds are clamped within the viewport. Images and video frames are contained without stretching, rotation or mirroring. Local fallback items retain the previously approved size hierarchy rather than receiving an artificial Medium setting.

## 4. Loading and normalization

The existing published, fixed-singleton GROQ query now projects `homePage.media[]`. The existing shared page request loads and normalizes the collection once; transitions make no CMS requests.

Normalized items contain a stable Sanity array-key ID, supported type, validated Sanity CDN asset URL, size, dimensions/aspect ratio where available, optional poster, and image crop/hotspot metadata. Image cropping reuses the existing URL `rect` normalization and derives the cropped aspect ratio. Hotspot metadata is retained; the collage does not impose an extra automatic crop. MP4 uploads reuse the existing Project asset normalizer and CDN policy. Invalid items and duplicate item IDs are omitted with adapter diagnostics; localhost also logs these diagnostics to the development console.

When published media arrive while Home is active, the collection replaces the fallback once and preserves rendered progress. Arriving data do not reroute other pages. Returning Home uses the already-loaded collection.

## 5. Video playback and cleanup

Collage MP4s are native muted, looping, inline video elements with no native controls. Playback starts only at positive opacity. Prepared zero-opacity videos stay paused; invisible/hidden-page videos pause. Removed videos pause, lose their source and are released from the DOM. Inactive videos are not included in the image warm cache.

Autoplay rejection retains the native poster or decoded first frame, with a development state attribute rather than a broken visible control. The home contrast branch can use a poster's luminance without reading native video pixels.

Sizing reserves stable bounds from supplied video dimensions or the poster's cropped aspect ratio. When neither is available, a stable 16:9 fitting box contains the native frame at its own proportions, avoiding metadata-driven layout shifts. A matching poster is recommended for uploaded videos with unknown intrinsic dimensions. No Project or Index playback controller changes were made in this request.

## 6. Fallback behavior

- Failed request, unavailable singleton, or legacy/unconfigured media field: original ordered 20 local images.
- Configured valid CMS media: only those items in their configured order, without mixing local images into the collection.
- Explicit `media: []`: intentionally blank white collage.
- Invalid individual entries: skipped with diagnostics; if none remain, the configured collection stays empty.
- Malformed non-array field: diagnostic plus local fallback.

## 7. Changed files

Implementation: `frontpage-media-fade.js`, `app.js`, `contrast.js`, `sanity-data.js`, `studio/structure.ts`, `studio/schemaTypes/index.ts`, `studio/schemaTypes/documents/pages.ts`, and new `studio/schemaTypes/objects/frontpageMedia.ts`.

Tests: updated `tests/frontpage-media-fade.test.cjs`, `tests/frontpage-media-fade-browser.test.cjs`, `tests/frontpage.test.cjs`; added `tests/frontpage-cms.test.cjs`, `tests/frontpage-cms-browser.test.cjs`, `studio/tests/frontpage-media.test.mjs`.

Local diagnostic screenshots: `reports/startseite-poster-desktop.png` and `reports/startseite-poster-mobile.png`. These use colored fixture assets to verify poster fallback, not published CMS content.

## 8. Verification

- Frontend: **146 passed**, zero failed; 27 opt-in tests skipped in the non-browser run.
- Studio: **46 passed**, zero failed.
- TypeScript: passed.
- Schema validation: **zero errors, zero warnings**.
- Studio production build: passed. Existing CLI auto-update/version notices remain; configuration and dependencies were not changed.
- Chrome portfolio regression suite: **18 passed**, zero failed; three separate live-production checks skipped.
- Final targeted input/CMS-video checks passed on desktop and mobile, including rejected-autoplay posters, ordering, sizes, white background, centered/clickable navigation, exact freeze/resume, rapid-input sequencing, loops, bounded DOM, video dimensions and cleanup.
- A separate actual-page, read-only Revoshock check passed on the local site at desktop 1440px and mobile 390px. All three project videos visibly played, paused and resumed; `currentTime` increased. This check used the actual project page and controller without mocked page or asset responses.
- `git diff --check` passed.

## 9. Hosted Studio

**Yes: the hosted Sanity Studio requires a future redeployment** to expose the new Startseite controls. The frontend changes likewise need a future website publication before the hosted portfolio reads the new media list. Neither action was performed. Existing published content remains untouched.

Local website review: http://127.0.0.1:5500/#home
