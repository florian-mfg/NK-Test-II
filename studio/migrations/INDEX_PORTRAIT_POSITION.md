Index portrait positions
========================

The frontend supports existing documents without a migration. Each missing image
position inherits the old first-cycle placement: right-half becomes `right`,
full-width becomes `center`. Portraits now always occupy half the desktop viewport;
landscapes (and square images) always use full width. Orientation uses cropped
image dimensions when available. Mobile sizing is unchanged.

To persist these inherited positions, run from `studio`:

    npx sanity exec scripts/migrate-index-portrait-position.mjs --with-user-token

This is a dry run and saves a local backup. Review its output before applying:

    npx sanity exec scripts/migrate-index-portrait-position.mjs --with-user-token -- --apply

Only the published Index document and its existing draft are considered. The
migration fills unset/empty image positions, preserves custom positions and all
other fields, and keeps entry and image order. Landscape positions may be stored
but are ignored by the renderer. Revision guards reject stale writes. Repeating
the migration does not alter already populated positions. The hidden legacy
`initialLayout` value is retained for backwards compatibility.
