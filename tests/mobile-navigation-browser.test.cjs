'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('mobile menu resets upright and collapsed, keeps compact spacing and native accordion navigation', {skip: !process.env.BROWSER_TEST}, async () => {
  const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await chromium.launch({headless: true, executablePath: process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
    const errors = [], fonts = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().endsWith('.woff2')) fonts.push(request.url()); });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'preview.test') {
        const file = path.join(__dirname, '..', url.pathname === '/' ? 'index.html' : url.pathname);
        return route.fulfill({path: file, contentType: ({'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'})[path.extname(file)] || 'application/octet-stream'});
      }
      if (url.pathname.includes('/data/query/')) return route.fulfill({json: {result: {}}});
      return route.fulfill({body: ''});
    });
    await page.goto('https://preview.test/#home');
    const menu = page.locator('.mobile-menu'), toggle = page.locator('.mobile-menu-label');
    const open = () => page.locator('.mobile-menu-toggle').tap();
    const style = locator => locator.evaluate(el => getComputedStyle(el).fontStyle);
    const neutral = async () => {
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('.mobile-work-submenu').isVisible(), false);
      assert.deepEqual(await menu.locator('nav a, nav button').evaluateAll(items => items.map(el => getComputedStyle(el).fontStyle)), Array(6).fill('normal'));
      assert.equal(await menu.locator('.brand').isVisible(), false);
      assert.equal(await menu.locator('.mobile-menu-mail').isVisible(), false);
      const layout = await menu.evaluate(el => {
        const rect = selector => el.querySelector(selector).getBoundingClientRect();
        const work = rect('.mobile-menu-label'), index = rect('[data-route="archive"]'), info = rect('[data-route="info"]'), close = rect('.mobile-menu-close');
        return {firstGap: index.y - work.bottom, secondGap: info.y - index.bottom, x: [work.x, index.x, info.x], closeRight: innerWidth - close.right,
          top: work.top, paddingTop: parseFloat(getComputedStyle(el).paddingTop), closeTop: close.top,
          horizontalPadding: parseFloat(getComputedStyle(el).paddingLeft), closeLeft: close.left, headerLeft: rect('.mobile-menu-header').left, workRight: work.right};
      });
      assert.ok(Math.abs(layout.firstGap) < 1 && Math.abs(layout.secondGap) < 1);
      assert.ok(layout.x.every(x => x === layout.x[0]));
      assert.ok(layout.closeRight > 0 && layout.closeRight < 20);
      assert.ok(Math.abs(layout.top - layout.paddingTop) < .02);
      assert.ok(Math.abs(layout.closeTop - layout.top) < .02);
      assert.ok(Math.abs(layout.x[0] - layout.horizontalPadding) < .02);
      assert.ok(layout.top > 0 && layout.workRight < layout.closeLeft && layout.workRight < layout.headerLeft);
    };
    await open();
    assert.deepEqual(await menu.evaluate(el => {
      const rect = el.getBoundingClientRect(), s = getComputedStyle(el);
      return [s.backgroundColor, s.backgroundImage, s.color, rect.x, rect.y, rect.width === innerWidth, rect.height === innerHeight];
    }), ['rgb(255, 255, 255)', 'none', 'rgb(0, 0, 0)', 0, 0, true, true]);
    await neutral();
    const collapsedY = await menu.locator('[data-route="archive"]').evaluate(el => el.getBoundingClientRect().y);
    for (let i = 0; i < 4; i++) {
      await toggle.tap();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(await style(toggle), 'italic');
      assert.equal(await menu.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      const geometry = await menu.evaluate(el => {
        const main = el.querySelector('.mobile-menu-label').getBoundingClientRect();
        return [...el.querySelectorAll('.mobile-work-submenu a')].map(a => a.getBoundingClientRect().x - main.x);
      });
      assert.ok(geometry.every(x => x > 20 && x === geometry[0]));
      assert.ok(await menu.locator('[data-route="archive"]').evaluate(el => el.getBoundingClientRect().y) > collapsedY);
      const gap = await menu.evaluate(el => el.querySelector('[data-route="archive"]').getBoundingClientRect().y - el.querySelector('[data-route="work/graphic"]').getBoundingClientRect().bottom);
      assert.ok(Math.abs(gap) < 1);
      assert.equal(new URL(page.url()).hash, '#home');
      assert.equal(await menu.evaluate(el => el.open), true);
      await toggle.tap();
      assert.equal(await style(toggle), 'normal');
      assert.equal(await page.locator('.mobile-work-submenu').isVisible(), false);
      assert.equal(await menu.locator('[data-route="archive"]').evaluate(el => el.getBoundingClientRect().y), collapsedY);
    }
    await page.screenshot({path: '/tmp/nk-mobile-menu-collapsed.png'});
    for (const destination of ['archive', 'info', 'work/video', 'work/commissioned', 'work/graphic']) {
      if (destination.startsWith('work/')) await toggle.tap();
      await menu.locator(`[data-route="${destination}"]`).tap();
      await page.waitForFunction(destination => location.hash === '#' + destination && !document.querySelector('.mobile-menu').open, destination);
      await open();
      assert.equal(await menu.locator('[aria-current="page"]').count(), 1);
      assert.equal(await menu.locator('[aria-current="page"]').getAttribute('data-route'), destination);
      await neutral();
    }
    // Reopening on a category resets even an expanded submenu.
    await toggle.tap();
    await page.locator('.mobile-menu-close').tap();
    await open();
    await neutral();
    await toggle.tap();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path: '/tmp/nk-mobile-menu-expanded.png'});
    const client = await page.context().newCDPSession(page);
    await client.send('DOM.enable'); await client.send('CSS.enable');
    const {root} = await client.send('DOM.getDocument');
    const {nodeId} = await client.send('DOM.querySelector', {nodeId: root.nodeId, selector: '.mobile-menu-label'});
    const actual = await client.send('CSS.getPlatformFontsForNode', {nodeId});
    assert.ok(actual.fonts.some(font => font.isCustomFont && /italic/i.test(font.postScriptName)));
    assert.ok(fonts.some(url => url.endsWith('WFRaglanNeue-Light.woff2')));
    assert.ok(fonts.some(url => url.endsWith('WFRaglanNeue-LightItalic.woff2')));
    await client.detach();
    await page.locator('.mobile-menu-close').tap();
    await page.goBack();
    await page.waitForFunction(() => location.hash === '#work/commissioned');
    await open();
    assert.equal(await menu.locator('[aria-current="page"]').getAttribute('data-route'), 'work/commissioned');
    await neutral();
    await page.locator('.mobile-menu-close').tap();
    await page.goForward();
    await page.waitForFunction(() => location.hash === '#work/graphic');
    await open();
    assert.equal(await menu.locator('[aria-current="page"]').getAttribute('data-route'), 'work/graphic');
    await neutral();
    await page.locator('.mobile-menu-close').tap();
    await page.locator('.brand').first().tap();
    await page.waitForFunction(() => location.hash === '#home');
    await open();
    assert.equal(await menu.locator('[aria-current="page"]').count(), 0);
    await neutral();
    await page.locator('.mobile-menu-close').tap();
    for (const width of [320, 430]) {
      await page.setViewportSize({width, height: 844}); await open(); await neutral(); await toggle.tap();
      assert.equal(await menu.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await page.screenshot({path: `/tmp/nk-mobile-menu-top-${width}.png`});
      await page.locator('.mobile-menu-close').tap();
    }
    await page.setViewportSize({width: 1440, height: 900});
    assert.equal(await page.locator('.mobile-menu-toggle').isVisible(), false);
    await page.locator('.work-toggle').click();
    await page.waitForFunction(() => location.hash === '#work');
    assert.equal(await page.locator('.main-nav').isVisible(), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
