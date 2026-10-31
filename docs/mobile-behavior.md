# Mobile page canvas and navigation

The mobile breakpoint remains 700 CSS px. Every route's root, body and page
canvas is #FFFFFF; the browser theme color is white. Page-level Index background
is also white, while actual image/video appearance and explicit component
backgrounds remain intact. Desktop backgrounds remain unchanged. Physical
Safari rubber-band/browser-chrome output requires device testing.

Index/overview text stays permanently white, including white Index loading and
retry labels. Readability over uncovered white canvas is an approved limitation.
Frontpage navigation uses dynamic contrast with no shadow; see [contrast](../CONTRAST.md).

Only mobile project details honor directional header hiding. Four CSS pixels
of movement are required; downward movement hides the header/project title,
upward movement restores them, and reaching the top restores the full navigation.
Info and Sound stay in their existing fixed positions. Opening the mobile menu
clears the directional hiding state; scrolling cannot hide its navigation.
Breakpoint changes clear that state, and reduced-motion preferences remove the
transitions. Other routes and desktop retain their existing interactions.

Index gestures, preparation and recovery are documented in [Index loading](index-loading.md).
