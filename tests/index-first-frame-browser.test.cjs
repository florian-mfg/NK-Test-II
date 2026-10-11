'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

for (const mobile of [false, true]) test(`Index image layout on every visible frame (${mobile ? 'touch' : 'Chrome mouse'})`, {skip: !process.env.BROWSER_TEST}, async () => {
  const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await chromium.launch({headless: true, executablePath: process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const held = new Map();
  const delayed = new Set(['right', 'slow']);
  try {
    const page = await browser.newPage({viewport: {width: mobile ? 390 : 1440, height: 900}, hasTouch: mobile, isMobile: mobile});
    const advanceTo = async index => {
      for(let step=0;step<60;step++) {
        if(Number(await page.locator('.archive-row[aria-current="true"]').getAttribute('data-index'))===index)return;
        await page.locator('.archive-row.is-active').tap();
      }
      throw Error('Entry not reached by taps');
    };
    const img = (id, portraitPosition) => ({asset: {_ref: `image-${id}-${{left:600,right:900,center:800,slow:600}[id]}x1200-jpg`}, portraitPosition});
    const raw = {projects: [], indexPage: {_id: 'indexPage', _type: 'indexPage', entries: [
      {displayTitle: 'Forward', previewImages: [img('center','center'), img('right','right'), img('left','left')]},
      {displayTitle: 'Reverse', previewImages: [img('left','left'), img('right','right'), img('center','center')]},
      {displayTitle: 'Slow', previewImages: [img('slow','left'), img('center','center'), img('right','right')]}
    ]}};
    await page.addInitScript(() => {
      window.frameSamples = [];
      const bitmaps = new WeakMap();
      const sample = () => {
        const bg = document.querySelector('.archive-background'), img = bg?.querySelector('img');
        // Remember the displayed bitmap: Chrome can clear currentSrc while a
        // replacement request is pending but still paint the previous bitmap.
        if (img?.currentSrc && img.naturalWidth) bitmaps.set(img, img.currentSrc);
        const bitmap = img && bitmaps.get(img);
        if (bitmap && getComputedStyle(img).opacity > 0) {
          const rect = img.getBoundingClientRect();
          window.frameSamples.push({src: bitmap, x: rect.x, width: rect.width, height: rect.height, backdrop: getComputedStyle(bg).backgroundColor, body: getComputedStyle(document.body).backgroundColor});
        }
      };
      // Observe DOM commits as well as paints, so an insertion later in an
      // animation frame cannot escape the first-visible-frame assertion.
      new MutationObserver(sample).observe(document, {subtree: true, childList: true,
        attributes: true, attributeFilter: ['class', 'style', 'src']});
      const frame = () => {sample(); requestAnimationFrame(frame);};
      requestAnimationFrame(frame);
    });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/app.js' && process.env.INDEX_APP_SOURCE) return route.fulfill({path: process.env.INDEX_APP_SOURCE, contentType: 'application/javascript'});
      if (url.hostname === 'preview.test') return route.fulfill({path: path.join(__dirname, '..', url.pathname === '/' ? 'index.html' : url.pathname)});
      if (url.pathname.includes('/data/query/')) return route.fulfill({json: {result: raw}});
      if (url.hostname === 'cdn.sanity.io') {
        const id = url.pathname.match(/\/(center|right|left|slow)-/)?.[1];
        if (delayed.delete(id)) await new Promise(resolve => held.set(id, resolve));
        return route.fulfill({contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${{left:600,right:900,center:800,slow:600}[id]}" height="1200"><rect width="900" height="1200" fill="${id === 'center' ? 'red' : id === 'right' ? 'green' : 'blue'}"/></svg>`});
      }
      return route.fulfill({body: ''});
    });
    const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const displayed = async id => {
      await page.waitForFunction(id => document.querySelector('.archive-background img')?.currentSrc.includes(`/${id}-`), id);
      await frames();
    };
    const click = async () => {
      const row = page.locator('.archive-row[aria-current="true"]');
      const box = await row.boundingBox();
      if (mobile) await page.touchscreen.tap(box.x + box.width * .85, box.y + box.height / 2);
      else await page.mouse.click(box.x + box.width * .85, box.y + box.height / 2);
    };
    const select = async index => {
      const row = page.locator('.archive-row').nth(index);
      if (mobile) await advanceTo(index);
      else await row.hover();
      await page.waitForFunction(index => document.querySelectorAll('.archive-row')[index].getAttribute('aria-current') === 'true', index);
    };
    const checkFrames = async () => {
      const samples = await page.evaluate(() => window.frameSamples);
      assert.ok(samples.length > 0);
      for (const sample of samples) {
        assert.equal(sample.backdrop,'rgb(0, 0, 0)');
        assert.equal(sample.body,'rgb(0, 0, 0)');
        const id = sample.src.match(/\/(center|right|left|slow)-/)[1];
        assert.equal(sample.x, mobile ? 0 : {center: 420, right: 765, left: 0, slow: 0}[id], `wrong visible position: ${JSON.stringify(sample)}`);
        assert.equal(sample.width, mobile ? 390 : {center:600,right:675,left:450,slow:450}[id], `wrong visible width: ${JSON.stringify(sample)}`);
        assert.equal(sample.height, mobile ? {center:585,right:520,left:780,slow:780}[id] : 900);
      }
      return samples;
    };
    await page.goto('https://preview.test/#archive');
    await displayed('center');
    await page.screenshot({path:`/tmp/nk-portrait-center-${mobile?'mobile':'desktop'}.png`});
    await click(); // Uncached Right is held: the visible Center must not move.
    await page.waitForFunction(() => document.querySelector('.archive-row[aria-current="true"]'));
    await frames();
    await checkFrames();
    assert.ok(held.has('right'), 'uncached replacement request started');
    held.get('right')(); held.delete('right');
    await displayed('right');
    await page.screenshot({path:`/tmp/nk-portrait-right-${mobile?'mobile':'desktop'}.png`});
    await click(); await displayed('left');
    await page.screenshot({path:`/tmp/nk-portrait-left-${mobile?'mobile':'desktop'}.png`});
    if (mobile) {
      // Finish Forward, traverse Reverse, then loop through Slow using taps.
      await click();await displayed('left'); // next entry's first media
      await click();await displayed('right');await click();await displayed('center');
      await click();await frames();assert.ok(held.has('slow'));
      // Leave the held media and ensure a late completion cannot replace Center.
      await click();await displayed('center');
      held.get('slow')();held.delete('slow');await frames();await displayed('center');
      const samples=await checkFrames();
      assert.equal(samples.some(sample=>sample.src.includes('/slow-')),false);
      for(const id of ['center','right','left'])assert.ok(samples.some(sample=>sample.src.includes(`/${id}-`)));
      return;
    }
    await click(); await displayed('center'); await click(); await displayed('right');
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const id of ['left','center','right']) {await click(); await displayed(id);}
    }
    await select(1); await displayed('left');
    for (const id of ['right','center','left','right','center','left']) {await click(); await displayed(id);}
    await select(0); await displayed('center');
    // Native clicks remain distinct while decoded replacements may still be pending.
    for (let count = 0; count < 7; count++) await click();
    await displayed('right');
    await select(2); await frames();
    assert.ok(held.has('slow'));
    await select(0); await displayed('center');
    held.get('slow')(); held.delete('slow');
    await frames();
    await displayed('center'); // A late completion must never replace the current entry.
    const samples = await checkFrames();
    assert.equal(samples.some(sample => sample.src.includes('/slow-')), false);
    for (const id of ['center','right','left']) assert.ok(samples.some(sample => sample.src.includes(`/${id}-`)), `sampled first visible ${id} frame`);
    if (!mobile) {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:2,mobile:false});
      await click(); await displayed('right');
      const box = await page.locator('.archive-background img').boundingBox();
      assert.equal(box.width,450);
      assert.equal(box.height,600);
      assert.equal(box.x,990);
      await session.detach();
    }

  } finally {
    for (const release of held.values()) release();
    await browser.close();
  }
});
