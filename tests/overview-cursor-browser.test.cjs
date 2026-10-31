const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
for (const engine of ['chromium', 'webkit']) test(`${engine}: overview cursor follows the region through scrolling and menu boundaries`, {skip: !process.env.BROWSER_TEST, timeout: 90000}, async () => {
  const pw = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await pw[engine].launch({headless: true, ...(engine === 'chromium' ? {executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'} : {})});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}}), errors = [];
    page.setDefaultTimeout(7000);
    page.on('pageerror', e => errors.push(e.message));
    const mp4 = await require('./native-media-fixture.cjs').recordMP4(page);
    const projects = ['video', 'commissioned', 'graphic'].flatMap((category, c) => [0, 1, 2].map(i => ({
      _id: `${category}${i}`, _type: 'project', slug: {current: `${category}${i}`}, title: `Project ${i}`, category: ['Video', 'Commissioned', 'Graphic'][c], textColor: i ? 'black' : 'auto',
      modules: [{type: 'full', height: 'viewport', slots: [i === 1 ? {type: 'mp4', video: {asset: {_ref: 'file-demo-mp4'}}} : {type: 'image', image: {asset: {_ref: `image-p${i}-1200x800-svg`}}}]}]
    })));
    const handleRoute = r => {
      const u = new URL(r.request().url());
      if (u.hostname === 'preview.test') return r.fulfill({path: path.join(__dirname, '..', u.pathname === '/' ? 'index.html' : u.pathname)});
      if (u.pathname.includes('/data/query/')) return r.fulfill({json: {result: {projects, selectedWork: {_id: 'selectedWork', _type: 'selectedWork', ...Object.fromEntries(['video', 'commissioned', 'graphic'].map(c => [c, projects.filter(p => p._id.startsWith(c)).map(p => ({_ref: p._id}))]))}}}});
      if (u.pathname.endsWith('.mp4')) return r.fulfill({body: mp4, contentType: 'video/mp4'});
      if (u.hostname === 'cdn.sanity.io') return r.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="white"/></svg>'});
      return r.abort();
    };
    await page.route('**/*', handleRoute);
    const frame = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const visible = async expected => {
      await frame();
      await page.waitForFunction(expected => document.querySelector('.open-cursor').hidden !== expected, expected);
      assert.equal(await page.locator('.open-cursor').evaluate(n => !n.hidden), expected, JSON.stringify(await page.evaluate(()=>({point:overviewPointer,hit:overviewPointer&&document.elementFromPoint(overviewPointer.x,overviewPointer.y)?.outerHTML.slice(0,200),header:document.querySelector('.site-header').getBoundingClientRect().toJSON()}))));
      assert.equal(await page.locator('.open-cursor').count(), 1);
      if (expected) {
        assert.equal(await page.locator('.open-cursor').evaluate(n => getComputedStyle(n).color), 'rgb(255, 255, 255)');
        assert.equal(await page.evaluate(() => getComputedStyle(document.elementFromPoint(600, 450)).cursor), 'none');
      }
    };
    for (const category of ['video', 'commissioned', 'graphic']) {
      await page.goto(`https://preview.test/#work/${category}`,{waitUntil:'domcontentloaded'});
      await page.waitForSelector('.project-preview:not([hidden]) .project-link');
      await page.mouse.move(600, 450); await visible(true);
      assert.deepEqual(await page.locator('.site-header .brand, .main-nav a, .work .project-title > span, .work .project-kind').evaluateAll(nodes => [...new Set(nodes.map(n=>getComputedStyle(n).color))]),['rgb(255, 255, 255)']);
      for (const y of [950, 1850, 700, 0]) {
        await page.evaluate(y => window.scrollTo({top:y,behavior:'instant'}), y); await visible(true);
      }
      await page.mouse.wheel(0, 900); await visible(true);
      // Replace the hit link and add a gap under a stationary pointer.
      await page.evaluate(() => {
        const n = document.elementFromPoint(600, 450).closest('.project-preview');
        n?.querySelector('.project-link')?.remove();
        const gap = document.createElement('div'); gap.style.cssText = 'position:fixed;inset:300px 0 300px;height:300px;z-index:30';
        document.querySelector('.work').append(gap);
      });
      await visible(true);
      await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
      await page.waitForTimeout(250);
      await page.evaluate(() => document.querySelector('.site-header').classList.remove('is-hidden'));
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('.site-header')).transform==='none');
      const brand = await page.locator('.site-header .brand').boundingBox();
      await page.mouse.move(brand.x + 5, brand.y + 5); await visible(false);
      assert.notEqual(await page.locator('.site-header .brand').evaluate(n => getComputedStyle(n).cursor), 'none');
      await page.mouse.move(600, 450); await visible(true);
      // A menu moving under/out from the stored pointer must update without movement.
      await page.evaluate(() => {const h = document.querySelector('.site-header'); h.style.top = '420px'; h.style.height = '80px'; h.style.background = 'white';});
      await visible(false);
      await page.evaluate(() => document.querySelector('.site-header').removeAttribute('style'));
      await visible(true);
      await page.setViewportSize({width: 1280, height: 800}); await visible(true);
      await page.setViewportSize({width: 1440, height: 900});
      await page.keyboard.press('Tab'); await visible(false);
      await page.mouse.move(601, 450); await visible(true);
    }
    const mobile = await browser.newPage({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
    await mobile.route('**/*', handleRoute);
    await mobile.goto('https://preview.test/#work/video');
    await mobile.waitForSelector('.project-preview:not([hidden]) .project-link');
    await mobile.touchscreen.tap(200,400);
    assert.equal(await mobile.locator('.open-cursor').evaluate(n => n.hidden),true);
    assert.equal(await mobile.locator('.open-cursor').evaluate(n => getComputedStyle(n).display),'none');
    await mobile.close();
    assert.deepEqual(errors, []);
  } finally {await browser.close();}
});
