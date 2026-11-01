# Release verification

The frontend is a static site: there is no frontend bundle/build step. Run syntax checks for the root JavaScript files and the frontend unit suite:

```sh
node --test tests/*.test.cjs
```

With Studio dependencies installed, run these local checks from `studio/`:

```sh
npm run check
node --import tsx --test tests/*.test.mjs
npm run lint
npm run schema:validate
npm run build -- /tmp/nk-studio-release-build
```

These commands do not deploy Studio or change documents. Keep Studio configuration, schemas, runtime code and dataset unchanged during a frontend release.

Browser tests require Playwright Core and installed Chrome/WebKit browsers. Set `PLAYWRIGHT_MODULE_PATH` to the installed `playwright-core` directory when it is not on the default module path. Current Chrome launch paths follow this repository's macOS test setup.

```sh
BROWSER_TEST=1 node --test --test-concurrency=2 tests/frontpage-frosted-hover-browser.test.cjs tests/index-mobile-tap-selection-browser.test.cjs tests/overview-raster-boundaries-browser.test.cjs tests/index-recovery-budget-browser.test.cjs tests/mobile-index-swipes-browser.test.cjs
RELEASE_TEST=1 node --test tests/release-browser.test.cjs
FINAL_REFINEMENTS_LIVE=1 node --test tests/overview-seams-index-hover-live.test.cjs
```

The last two commands query real published Sanity content and use actual CDN media. By default they serve raw local frontend files via browser request interception at `http://127.0.0.1:5500/`, excluding preview-server live-reload injection. They block non-read requests. No saved reports, diagnostics or local backup directories are required. Use `RELEASE_REPORT_DIR` to choose an output directory; otherwise the portable live and raster tests write to the system temporary directory.

For a deployed release, set `RELEASE_BASE_URL=https://florian-mfg.github.io/NK-Test-II/` on the same two live test commands. This disables local-source interception, so frontend code and media are fetched from the real production URLs. The release test compares fetched production HTML, JavaScript and CSS with the checkout in addition to its behavioral checks. `FINAL_INDEX_ONLY=1` limits the overview test to Index and project-link/Overview-return checks when the full viewport matrix has already passed.

Snapshot public published content and asset records before the release and compare again after production verification:

```sh
node tests/sanity-readonly.cjs before /tmp/nk-release-integrity
node tests/sanity-readonly.cjs after /tmp/nk-release-integrity
```

The comparison includes complete public document contents, revisions and asset records plus the projected frontend query. It does not inspect private drafts or document history. No write endpoint is used.

Before committing, explicitly stage only reviewed frontend changes and relevant tests/documentation. Preserve local backups, reports, diagnostics and unused source artwork without adding them to the release commit. Push normally; never force-push. Publication requires a successful GitHub Pages deployment whose commit SHA matches the release commit, matching production assets, and successful production browser verification.

Known test limits: mobile browser emulation is not physical iOS hardware. The installed WebKit test build may omit backdrop blur in screenshots even when filter declarations and hover transitions are correct. Live Frontpage content may contain only images; fixture tests separately exercise videos. Studio auto-update build warnings should be reported without changing Studio versions/configuration as part of a frontend release.
