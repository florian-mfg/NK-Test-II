'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
for (const engine of ['chromium', 'webkit']) test(`desktop Index information visibility: ${engine}`, {skip: !process.env.BROWSER_TEST}, async () => {
  const playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await playwright[engine].launch({headless: true, ...(engine === 'chromium' ? {executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'} : {})});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'preview.test') return route.fulfill({path: path.join(__dirname, '..', url.pathname === '/' ? 'index.html' : url.pathname)});
      if (url.pathname.includes('/data/query/')) return route.fulfill({json: {result: {projects: [], indexPage: {_id: 'indexPage', _type: 'indexPage', entries: Array.from({length: 3}, (_, i) => ({displayTitle: `Project ${i}`, additionalInfo: `Client ${i}`, previewImages: [0, 1].map(j => ({asset: {_ref: `image-p${i}f${j}-800x1200-svg`}}))}))}}}});
      if (url.hostname === 'cdn.sanity.io') return route.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="white"/></svg>'});
      return route.abort();
    });
    await page.goto('https://preview.test/#archive');
    await page.waitForSelector('.archive[data-source="sanity"]');
    await page.evaluate(() => document.fonts.ready);
    const rows = page.locator('.archive-row');
    const visible = () => rows.locator('.archive-additional-info').evaluateAll(nodes => nodes.map((n, i) => getComputedStyle(n).visibility === 'visible' ? i : -1).filter(i => i >= 0));
    const geometry = () => rows.evaluateAll(nodes => nodes.map(n => [n, ...n.children].map(el => {const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];})));
    const initial = await geometry();
    assert.deepEqual(await visible(), []);
    for (const i of [0, 1, 2, 0]) {
      const box = await rows.nth(i).boundingBox();
      await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      assert.deepEqual(await visible(), [i], 'full row hover reveals only its information');
      assert.deepEqual(await geometry(), initial);
      await page.waitForFunction(i => document.querySelector('.archive-row[aria-current="true"]')?.dataset.index === String(i), i);
    }
    await page.mouse.move(1400, 850);
    assert.deepEqual(await visible(), []);
    await rows.nth(1).focus();
    assert.deepEqual(await visible(), [1]);
    await rows.nth(2).focus();
    assert.deepEqual(await visible(), [2]);
    await rows.nth(0).hover();
    assert.deepEqual(await visible(), [0], 'hover takes priority over focus on another row');
    const src = await page.locator('.archive-background img').getAttribute('src');
    await rows.nth(0).click();
    await page.waitForFunction(src => document.querySelector('.archive-background img')?.getAttribute('src') !== src, src);
    assert.equal(new URL(page.url()).hash, '#archive');
    await page.evaluate(() => document.activeElement.blur());
    await page.mouse.move(1400, 850);
    assert.deepEqual(await visible(), []);
    assert.deepEqual(await geometry(), initial);
    await page.setViewportSize({width: 390, height: 844});
    assert.equal(await rows.first().locator('.archive-additional-info').evaluate(n => getComputedStyle(n).display), 'none');
    console.log(`${engine} ${browser.version()}: visibility, focus, geometry, preview cycling and Index click behavior passed`);
  } finally { await browser.close(); }
});
