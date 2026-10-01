'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

for (const mobile of [false, true]) test(`Index one-step cycling: ${mobile ? 'touch' : 'mouse'}`, {skip: !process.env.BROWSER_TEST}, async () => {
  const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await chromium.launch({headless: true, executablePath: process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const page = await browser.newPage({viewport: {width: mobile ? 390 : 1440, height: 900}, hasTouch: mobile, isMobile: mobile});
    // Real local MP4 exercises metadata, autoplay and teardown without network dependencies.
    const encoded = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
      const stream = canvas.captureStream(20), chunks = [];
      const recorder = new MediaRecorder(stream, {mimeType: 'video/mp4'});
      recorder.ondataavailable = event => chunks.push(event.data);
      const done = new Promise(resolve => recorder.onstop = resolve);
      recorder.start();
      const timer = setInterval(() => canvas.getContext('2d').fillRect(0, 0, 160, 90), 40);
      await new Promise(resolve => setTimeout(resolve, 600)); recorder.stop(); await done; clearInterval(timer);
      stream.getTracks().forEach(track => track.stop());
      return btoa(String.fromCharCode(...new Uint8Array(await new Blob(chunks).arrayBuffer())));
    });
    const img = id => ({asset: {_ref: `image-${id}-800x1200-jpg`}, portraitPosition: {one: 'center', two: 'right', three: 'left'}[id]});
    const raw = {projects: [], indexPage: {_id: 'indexPage', _type: 'indexPage', entries: [
      {displayTitle: 'Images', previewImages: [img('one'), img('two'), img('three')]},
      {displayTitle: 'Mixed', previewImages: [img('one'), {mediaType: 'mp4', video: {asset: {_ref: 'file-demo-mp4'}}}, img('three')]},
      {displayTitle: 'Vimeo', previewImages: [img('one'), {mediaType: 'vimeo', vimeoUrl: 'https://vimeo.com/123456'}, img('three')]}
    ]}};
    await page.addInitScript(() => {
      window.Vimeo = {Player: class {
        constructor(frame) {this.frame = frame;}
        on() {} off() {} ready() {return Promise.resolve();}
        getVideoWidth() {return Promise.resolve(160);}
        getVideoHeight() {return Promise.resolve(90);}
        destroy() {this.frame.remove(); return Promise.resolve();}
      }};
      window.indexClicks = 0;
      window.indexLayoutErrors = [];
      const sample = () => {
        const img = document.querySelector('.archive-background img');
        if (img?.currentSrc && img.naturalWidth && getComputedStyle(img).opacity > 0) {
          const id = img.currentSrc.match(/\/(one|two|three)-/)?.[1];
          const mobile = innerWidth <= 700, rect = img.getBoundingClientRect();
          const x = mobile ? 0 : {one: .25, two: .5, three: 0}[id] * innerWidth;
          if (rect.x !== x || rect.width !== innerWidth / (mobile ? 1 : 2)) window.indexLayoutErrors.push({id, x: rect.x, width: rect.width});
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      document.addEventListener('click', event => {if (event.target.closest('.archive-row')) window.indexClicks++;});
    });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'preview.test') return route.fulfill({path: path.join(__dirname, '..', url.pathname === '/' ? 'index.html' : url.pathname)});
      if (url.pathname.includes('/data/query/')) return route.fulfill({json: {result: raw}});
      if (url.pathname.endsWith('.mp4')) return route.fulfill({body: Buffer.from(encoded, 'base64'), contentType: 'video/mp4'});
      if (url.hostname === 'cdn.sanity.io') return route.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="white"/></svg>'});
      return route.fulfill({body: '<html></html>', contentType: 'text/html'});
    });
    const active = () => page.locator('.archive-background').evaluate(bg => {
      if (bg.querySelector('video')) return 'mp4';
      if (bg.querySelector('iframe')) return 'vimeo';
      return new URL(bg.querySelector('img').src).pathname.match(/\/(one|two|three)-/)[1];
    });
    const expectActive = async (expected, message) => {
      await page.waitForFunction(expected => {
        const bg = document.querySelector('.archive-background');
        if (expected === 'mp4') return !!bg.querySelector('video');
        if (expected === 'vimeo') return !!bg.querySelector('iframe');
        return bg.querySelector('img')?.currentSrc.includes(`/${expected}-`);
      }, expected);
      assert.equal(await active(), expected, message);
    };
    const interact = async row => {
      const target = row.locator('span').first();
      if (mobile) await target.tap();
      else {
        const box = await row.boundingBox();
        await page.mouse.click(box.x + box.width * .85, box.y + box.height / 2);
      }
    };
    const select = async index => {
      const row = page.locator('.archive-row').nth(index);
      if (mobile) {
        await row.evaluate(row => row.closest('.archive-list').scrollTo({top: row.offsetTop, behavior: 'instant'}));
      } else await row.hover();
      await page.waitForFunction(index => document.querySelectorAll('.archive-row')[index].getAttribute('aria-current') === 'true', index);
      return row;
    };
    for (let visit = 0; visit < 2; visit++) {
      if (visit === 0) await page.goto('https://preview.test/#archive');
      else await page.evaluate(() => location.hash = '#archive');
      await page.waitForSelector('.archive[data-source="sanity"]');
      for (const index of [0, 1, 0, 2, 0]) {
        const row = await select(index);
        const sequence = ['one', index === 1 ? 'mp4' : index === 2 ? 'vimeo' : 'two', 'three'];
        await expectActive('one');
        const before = await page.evaluate(() => window.indexClicks);
        // No sleeps between distinct interactions; checks also catch the first click.
        for (let click = 1; click <= 9; click++) {
          await interact(row);
          await expectActive(sequence[click % 3], `entry ${index}, click ${click}`);
          if (click === 1) {
            if (index === 1) await page.waitForFunction(() => {const v = document.querySelector('.archive-background video'); return v && !v.paused && v.readyState >= 2;});
            if (index === 0) await page.waitForFunction(() => document.querySelector('.archive-background img').complete);
            await expectActive(sequence[1], 'loading/playback must not advance');
          }
        }
        assert.equal(await page.evaluate(() => window.indexClicks), before + 9);
        const box = await row.boundingBox();
        if (!mobile) await page.mouse.move(box.x + box.width * .85, box.y + box.height / 2);
        for (let click = 1; click <= 12; click++) {
          if (mobile) await page.touchscreen.tap(box.x + box.width * .85, box.y + box.height / 2);
          else {await page.mouse.down(); await page.mouse.up();}
          await expectActive(sequence[click % 3], `rapid click ${click}`);
        }
        assert.equal(await page.evaluate(() => window.indexClicks), before + 21);
        // Rendering the same snapshot is a no-op and must not add listeners.
        await page.evaluate(() => {renderArchive(); renderArchive();});
      }
      await page.evaluate(() => {window.oldIndexRow = document.querySelector('.archive-row'); window.oldIndexBg = document.querySelector('.archive-background'); location.hash = '#info';});
      await page.waitForSelector('.info');
      assert.equal(await page.evaluate(() => {
        const before = window.oldIndexBg.innerHTML;
        window.oldIndexRow.click();
        return window.oldIndexBg.innerHTML === before;
      }), true, 'detached row listeners are aborted');
      assert.equal(await page.locator('.archive-background').count(), 0);
      assert.deepEqual(await page.evaluate(() => window.indexLayoutErrors), []);
    }
  } finally {await browser.close();}
});
