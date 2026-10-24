const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
for (const engine of ['chromium', 'webkit']) test(`${engine}: mobile metadata, loading status, logo and viewport`, {skip: !process.env.BROWSER_TEST, timeout: 60000}, async () => {
  const pw = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await pw[engine].launch({headless:true, ...(engine === 'chromium' ? {executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'} : {})});
  try {
    const recorder = await browser.newPage();
    const bytes = await require('./native-media-fixture.cjs').recordMP4(recorder);
    await recorder.close();
    const page = await browser.newPage({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
    let release;
    const gate = new Promise(r => release = r);
    const media = {mediaType:'mp4',video:{asset:{_id:'file-test-mp4',url:'https://cdn.sanity.io/files/ck6xe2er/production/test.mp4'}}};
    await page.route('**/*', async route => {
      const u = new URL(route.request().url());
      if(u.hostname === 'preview.test') return route.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});
      if(u.pathname.includes('/data/query/')) return route.fulfill({json:{result:{projects:[],homePage:{_id:'homePage',_type:'homePage',visibleMediaLimit:2,media:[{...media,type:'mp4'}]},indexPage:{_id:'indexPage',_type:'indexPage',entries:[{displayTitle:'Video',previewImages:[media]}]}}}});
      if(u.hostname === 'cdn.sanity.io') {await gate; return route.fulfill({body:bytes,contentType:'video/mp4'});}
      return route.abort();
    });
    await page.goto('https://preview.test/#home',{waitUntil:'domcontentloaded'});
    const status = page.locator('.frontpage-loading-indicator');
    await status.waitFor();
    assert.equal(await status.textContent(),'(Loading)');
    const box = await status.boundingBox();
    assert.ok(Math.abs(box.x + box.width/2 - 195) < 1);
    assert.ok(Math.abs(844-box.y-box.height-14)<1);
    release();
    await page.waitForSelector('.frontpage-fade[data-ready="true"]');
    assert.equal(await status.count(),0);
    const prepared = await page.locator('.frontpage-fade').getAttribute('data-preparation');
    assert.equal(JSON.parse(prepared)[0].readiness,'metadata');
    assert.equal(JSON.parse(prepared)[0].status,'ready');
    await page.evaluate(()=>{const home=document.querySelector('.home');for(const [type,x] of [['pointerdown',150],['pointermove',160],['pointerup',160]])home.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',pointerId:7,isPrimary:true,button:0,clientX:x,clientY:300}));});
    await page.waitForSelector('.frontpage-fade video');
    await page.waitForFunction(()=>[...document.querySelectorAll('.frontpage-fade video')].some(v=>v.videoWidth && !v.paused && v.currentTime>0));
    // Metadata alone must settle preparation even when decoded-frame events never arrive.
    assert.equal(await page.evaluate(async()=>{
      const create=document.createElement.bind(document);
      document.createElement=function(tag){const n=create(tag);if(tag==='video')Object.defineProperty(n,'onloadeddata',{set(){},get(){return null;},configurable:true});return n;};
      try {const p=await FrontpageLoading.prepare([{type:'mp4',src:'https://cdn.sanity.io/files/ck6xe2er/production/test.mp4'}],{timeout:2000});const s=p.results[0].status;p.dispose();return s;} finally {document.createElement=create;}
    }), 'ready');
    for(const route of ['info','archive','home']) {
      await page.evaluate(route=>location.hash=route,route);
      await page.locator('.mobile-menu-toggle').click();
      const logo=page.locator('.mobile-menu-header .brand');
      await logo.waitFor({state:'visible'});
      await logo.focus();await page.keyboard.press('Enter');
      await page.waitForFunction(()=>location.hash==='#home' && !document.querySelector('.mobile-menu').open);
    }
    await page.evaluate(()=>location.hash='archive');
    await page.waitForSelector('.archive-background video');
    for(const height of [844,650,844]) {
      await page.setViewportSize({width:390,height});
      const geometry=await page.evaluate(()=>{const bg=document.querySelector('.archive-background').getBoundingClientRect();return {top:bg.top,height:bg.height,w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,view:innerHeight,fit:getComputedStyle(document.querySelector('.archive-background video')).objectFit};});
      assert.equal(geometry.top,0);assert.ok(geometry.height>=height);assert.equal(geometry.w,390);assert.ok(geometry.h<=geometry.view);assert.equal(geometry.fit,'cover');
    }
  } finally {await browser.close();}
});
