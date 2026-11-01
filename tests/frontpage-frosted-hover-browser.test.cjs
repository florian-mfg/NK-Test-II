const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
for (const engine of ['chromium', 'webkit']) test(`Frontpage frosted hover: ${engine}`, {skip: !process.env.BROWSER_TEST}, async () => {
  const pw = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await pw[engine].launch({headless: process.env.HEADED !== '1', ...(engine === 'chromium' ? {executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'} : {})});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const video = await require('./native-media-fixture.cjs').recordMP4(page);
    await page.route('**/*', route => {
      const u = new URL(route.request().url());
      if (u.hostname === 'preview.test') return route.fulfill({path: path.join(__dirname, '..', u.pathname === '/' ? 'index.html' : u.pathname)});
      if (u.pathname.includes('/data/query/')) return route.fulfill({json: {result: {projects: [], homePage: {_id: 'homePage', _type: 'homePage', media: [{_key: 'video', type: 'mp4', size: 'large', video: {asset: {_id: 'file-demo-mp4', url: 'https://cdn.sanity.io/files/ck6xe2er/production/demo.mp4'}}}]}}}});
      if (u.pathname.endsWith('.mp4')) return route.fulfill({body: video, contentType: 'video/mp4'});
      return route.abort();
    });
    await page.goto('https://preview.test/');
    await page.waitForFunction(() => document.querySelector('.frontpage-fade')?.dataset.ready === 'true');
    await page.evaluate(() => {
      window.glassTransitionEnds = [];
      document.body.addEventListener('transitionend', event => {
        if (event.target === document.body && event.propertyName === 'opacity') glassTransitionEnds.push(event.elapsedTime);
      });
    });
    const waitForGlass = opacity => page.waitForFunction(opacity => getComputedStyle(document.body, '::after').opacity === String(opacity), opacity);
    const glass = () => page.evaluate(() => {
      const s = getComputedStyle(document.body, '::after');
      return {opacity: s.opacity, blur: s.backdropFilter || s.webkitBackdropFilter, background: s.backgroundColor, pointer: s.pointerEvents, duration: s.transitionDuration, z: s.zIndex, width: s.width, height: s.height, content: s.content};
    });
    await page.mouse.move(400, 200); await page.mouse.move(401, 200);
    await page.waitForFunction(() => document.querySelector('.frontpage-fade video')?.currentTime > 0);
    await page.evaluate(async () => {
      const image = new Image();
      image.className = 'frontpage-fade-media';
      image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="200" height="200" fill="black"/><rect x="200" width="200" height="200" fill="red"/></svg>');
      await image.decode();
      image.style.cssText = 'left:750px;top:100px;width:400px;height:200px';
      document.querySelector('.frontpage-fade').append(image);
    });
    assert.equal((await glass()).opacity, '0');
    for (const selector of ['.site-header .brand', '.work-toggle', '.main-nav > a']) {
      const v = page.locator('.frontpage-fade video').first();
      const before = await v.evaluate(n => n.currentTime);
      await page.evaluate(() => {window.glassTransitionEnds = [];});
      await page.locator(selector).first().hover();
      await waitForGlass(1);
      await page.waitForFunction(() => glassTransitionEnds.length > 0);
      assert.ok(await page.evaluate(() => glassTransitionEnds.some(t => Math.abs(t - .2) < .001)), 'opacity completes its 200ms transition');
      assert.deepEqual(await glass(), {opacity: '1', blur: 'blur(6px)', background: 'rgba(255, 255, 255, 0.35)', pointer: 'none', duration: '0.2s', z: '40', width: '1440px', height: '900px', content: '""'});
      assert.ok(await v.evaluate((n, before) => !n.paused && n.currentTime !== before, before), 'video keeps playing');
      const colors = await page.locator('.site-header :is(a, .work-toggle)').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).color));
      assert.ok(colors.every(c => c === 'rgb(0, 0, 0)'));
      await page.screenshot({path: `reports/frontpage-frosted-hover/${engine}-hover.png`});
      await page.mouse.move(1400, 850); await waitForGlass(0);
      assert.equal((await glass()).opacity, '0');
    }
    // Temporarily allow document scrolling to verify the fixed layer at an offset.
    const scrollStyle = await page.addStyleTag({content: 'html, body { overflow: auto !important; } body { min-height: 2400px; }'});
    await page.evaluate(() => scrollTo(0, 500));
    await page.waitForFunction(() => scrollY > 0);
    await page.locator('.site-header .brand').hover();
    await page.waitForTimeout(250);
    const scrolled = await page.evaluate(() => {
      const s = getComputedStyle(document.body, '::after');
      return {position: s.position, top: s.top, left: s.left, width: s.width, height: s.height, opacity: s.opacity};
    });
    assert.deepEqual(scrolled, {position: 'fixed', top: '0px', left: '0px', width: '1440px', height: '900px', opacity: '1'});
    await page.setViewportSize({width: 1280, height: 800});
    assert.equal((await glass()).width, '1280px');
    assert.equal((await glass()).height, '800px');
    await page.evaluate(() => scrollTo(0, 0));
    await scrollStyle.evaluate(n => n.remove());
    await page.setViewportSize({width: 1440, height: 900});
    const brush = await page.evaluate(() => {
      const layer = document.querySelector('.frontpage-fade');
      const before = +layer.dataset.progress;
      const move = (x, y) => document.querySelector('.home').dispatchEvent(new PointerEvent('pointermove', {pointerType: 'mouse', clientX: x, clientY: y, bubbles: true}));
      window.dispatchEvent(new Event('blur'));
      move(400, 200); move(401, 200);
      for (let i = 0; i < 4; i++) {
        const n = layer.lastElementChild;
        const r = {left: parseFloat(n.style.left), top: parseFloat(n.style.top), width: parseFloat(n.style.width), height: parseFloat(n.style.height)};
        const v = FrontpageMediaFade.visiblePortion(r, {viewLeft: 0, viewTop: 0, viewRight: innerWidth, viewBottom: innerHeight}, 8);
        const y = v.top + v.height / 2;
        move(v.left + v.width / 2, y); move(Math.min(innerWidth - 1, r.left + r.width + 2), y);
      }
      return {before, after: +layer.dataset.progress};
    });
    assert.ok(brush.after > brush.before, 'brush continues placing media after hover');
    await page.locator('.work-toggle').hover();
    await page.waitForTimeout(250);
    const menuGeometry = () => page.locator('.work-submenu, .work-submenu a').evaluateAll(nodes => nodes.map((n, i) => {
      const r = n.getBoundingClientRect();
      // Existing italic link hover changes glyph width, but must not move rows.
      return {x: r.x, y: r.y, ...(i === 0 ? {width: r.width} : {}), height: r.height};
    }));
    const initialMenuGeometry = await menuGeometry();
    const points = await page.evaluate(() => {
      const toggle = document.querySelector('.work-toggle').getBoundingClientRect();
      const links = [...document.querySelectorAll('.work-submenu a')].map(n => n.getBoundingClientRect());
      const index = document.querySelector('.main-nav > a').getBoundingClientRect();
      const x = toggle.left + 10;
      return [
        [x, (toggle.bottom + links[0].top) / 2],
        ...links.flatMap((r, i) => [[x, r.top + r.height / 2], ...(links[i + 1] ? [[x, (r.bottom + links[i + 1].top) / 2]] : [])]),
        [x, (links[0].bottom + links[1].top) / 2],
        [x, toggle.top + toggle.height / 2],
        [(toggle.right + index.left) / 2, toggle.top + toggle.height / 2],
        [index.left + 5, index.top + index.height / 2]
      ];
    });
    await page.evaluate(() => {
      window.glassSamples = [];
      window.sampleGlass = true;
      const sample = () => {
        if (!window.sampleGlass) return;
        window.glassSamples.push(+getComputedStyle(document.body, '::after').opacity);
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    for (const [i, [x, y]] of points.entries()) {
      await page.mouse.move(x, y, {steps: 8});
      await page.waitForTimeout(250);
      assert.equal((await glass()).opacity, '1', `glass stays active at navigation point ${i}, including gaps`);
      if (i < points.length - 2) assert.deepEqual(await menuGeometry(), initialMenuGeometry, 'submenu layout stays unchanged');
    }
    const samples = await page.evaluate(() => {window.sampleGlass = false; return window.glassSamples;});
    assert.ok(samples.length > 10 && samples.every(n => n === 1), 'no fade or flicker while crossing navigation and submenu gaps');
    await page.evaluate(() => {window.glassTransitionEnds = [];});
    await page.mouse.move(1400, 850);
    await waitForGlass(0);
    await page.waitForFunction(() => glassTransitionEnds.length > 0);
    assert.ok(await page.evaluate(() => glassTransitionEnds.some(t => Math.abs(t - .2) < .001)), 'fade completes outside navigation in 200ms');
    assert.equal((await glass()).opacity, '0');
    await page.locator('.main-nav [href="#info"]').click();
    await page.waitForFunction(() => document.body.classList.contains('is-info'));
    assert.equal((await glass()).content, 'none', 'other routes have no layer');
    await page.locator('.site-header .brand').click();
    await page.waitForFunction(() => document.body.classList.contains('is-home'));
    await page.setViewportSize({width: 390, height: 844});
    await page.locator('.site-header .brand').hover();
    assert.equal((await glass()).content, 'none', 'mobile has no layer');
    await page.locator('.mobile-menu-toggle').click();
    assert.equal(await page.locator('.mobile-menu').isVisible(), true);
    console.log(`${engine} ${browser.version()}: fade, stacking styles, video, submenu, route scope and mobile passed`);
  } finally { await browser.close(); }
});
