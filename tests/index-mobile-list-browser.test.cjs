'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');

for (const engine of ['chromium', 'webkit']) test(`advancing mobile Index and viewport coverage (${engine})`, {skip: !process.env.BROWSER_TEST}, async () => {
  const playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await playwright[engine].launch(engine === 'chromium' ? {executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'} : {});
  const root = path.join(__dirname, '..');
  const output = process.env.SCREENSHOT_DIR || '/tmp/nk-mobile-review';
  fs.mkdirSync(output, {recursive:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('/data/query/')) return route.fulfill({json:{result:{projects:[]}}});
      if (url.hostname !== 'preview.test') return route.fulfill({body:''});
      return route.fulfill({path:path.join(root,url.pathname==='/'?'index.html':url.pathname)});
    });
    await page.goto('https://preview.test/#archive');
    await page.waitForSelector('.archive[data-source="local"]');
    await page.evaluate(()=>document.fonts.ready);
    const rows = page.locator('.archive-row');
    const count = await rows.count();
    const capture = async name => {
      await page.waitForFunction(()=>{
        const index=Number(document.querySelector('.archive-row[aria-current]').dataset.index);
        return document.querySelector('.archive-background img')?.currentSrc.endsWith(ARCHIVE_DISPLAY_PROJECTS[index].images[0]);
      });
      await page.screenshot({path:`${output}/${engine}-index-${name}.png`});
    };
    const check = async index => {
      const state = await page.evaluate(() => {
        const list = document.querySelector('.archive-list'), rows = [...list.querySelectorAll('.archive-row')];
        const active = rows.find(row=>row.hasAttribute('aria-current'));
        const top = list.getBoundingClientRect().top;
        return {index:Number(active.dataset.index),top:active.getBoundingClientRect().top,listTop:top,italic:getComputedStyle(active.firstElementChild).fontStyle,
          previousHidden:rows.slice(0,Number(active.dataset.index)).every(row=>row.inert && row.getBoundingClientRect().bottom<=top+.01),
          visible:rows.filter(row=>row.getBoundingClientRect().bottom>top+.01).length,scroll:[scrollX,scrollY,list.scrollTop],overflow:document.documentElement.scrollWidth>innerWidth};
      });
      assert.equal(state.index,index); assert.ok(Math.abs(state.top-state.listTop)<.1); assert.equal(state.italic,'italic');
      assert.ok(state.previousHidden); assert.equal(state.visible,count-index); assert.deepEqual(state.scroll,[0,0,0]); assert.equal(state.overflow,false);
    };
    await check(0);
    await page.waitForSelector('.archive-background img');
    assert.deepEqual(await page.locator('.archive-background img').evaluate(img=>{const r=img.getBoundingClientRect();return [r.x,r.y,r.width,r.height,getComputedStyle(img).objectFit]}),[0,0,390,844,'cover']);
    await capture('first');
    // Every fallback project has multiple media. Check each individual tap.
    for(let index=1;index<=10;index++) {
      await page.touchscreen.tap(200,810);
      await check(index);
    }
    const middle = Math.floor(count/2);
    await rows.nth(middle).tap(); await check(middle);
    await capture('middle');
    await rows.last().tap(); await check(count-1);
    await capture('final');
    await page.locator('.mobile-menu-toggle').tap();
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#ffffff');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(255, 255, 255)');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(255, 255, 255)');
    await page.screenshot({path:`${output}/${engine}-menu.png`});
    await page.locator('.mobile-menu-close').tap(); await check(count-1);
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#000000');
    await page.touchscreen.tap(200,810);
    await check(0);
    await capture('loop');
    if (engine === 'chromium') await page.mouse.wheel(0,500);
    await page.evaluate(()=>{
      const archive=document.querySelector('.archive');
      for(const [type,y] of [['pointerdown',700],['pointermove',400],['pointerup',400]])
        archive.dispatchEvent(new PointerEvent(type,{bubbles:true,isPrimary:true,pointerId:1,button:0,clientX:200,clientY:y}));
    });
    await check(0);
    // Resize also exercises modern dynamic viewport media coverage.
    await page.setViewportSize({width:390,height:650});
    assert.equal(await page.locator('.archive-background img').evaluate(img=>img.getBoundingClientRect().height),650);
    await page.setViewportSize({width:390,height:844});
    // Desktop WebKit reports zero device insets. Inject representative values
    // to verify CSS geometry, without claiming to emulate iOS browser chrome.
    const safeCSS=fs.readFileSync(path.join(root,'style.css'),'utf8').replace(/env\(safe-area-inset-top\)/g,'59px').replace(/env\(safe-area-inset-bottom\)/g,'34px');
    const safeStyle=await page.addStyleTag({content:safeCSS});
    await check(0);
    assert.equal(await page.locator('.site-header').evaluate(n=>n.getBoundingClientRect().top),59);
    assert.equal(await page.locator('.archive-background').evaluate(n=>n.getBoundingClientRect().top),0);
    await page.locator('.mobile-menu-toggle').tap();
    assert.equal(await page.locator('.mobile-menu-header').evaluate(n=>n.getBoundingClientRect().top),59);
    await page.locator('.mobile-menu-close').tap();
    await safeStyle.evaluate(n=>n.remove());
    await page.goto('https://preview.test/#home');
    await page.waitForSelector('.home');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(255, 255, 255)');
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#ffffff');
    await page.screenshot({path:`${output}/${engine}-frontpage.png`});
    // Compare desktop geometry to the unchanged historical desktop styles.
    await page.setViewportSize({width:1440,height:900});
    await page.goto('https://preview.test/#archive');
    await page.waitForSelector('.archive-row');
    const geometry = () => rows.evaluateAll(rows=>rows.map(row=>{const r=row.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}));
    const current = await geometry();
    const css = execFileSync('git',['show','HEAD:style.css'],{cwd:root,encoding:'utf8'});
    await page.addStyleTag({content:css});
    assert.deepEqual(await geometry(),current);
    await browser.close();
  } finally { await browser.close(); }
});
