'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// BROWSER_TEST=1 PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core node --test tests/index-responsive.test.cjs
test('Index preview positions use exact desktop viewport halves and retain mobile full width', {skip: !process.env.BROWSER_TEST}, async () => {
 const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
 const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const root = path.join(__dirname, '..');
 const positions = ['left','center','right'];
 const preview = (position, landscape=false) => ({asset:{_ref:`image-${position}-${landscape?'1200x800':'800x1200'}-jpg`},portraitPosition:position});
 const raw = {projects:[],indexPage:{_id:'indexPage',_type:'indexPage',entries:[
  {displayTitle:'Portraits',previewImages:positions.map(p=>preview(p))},
  {displayTitle:'Mixed',previewImages:[preview('right'),preview('left',true),preview('center')]},
  {displayTitle:'Third',previewImages:[preview('center')]},
 ]}};
 try {
  const page = await browser.newPage({hasTouch:true,viewport:{width:1440,height:900}});
  await page.route('**/*',async route=>{
   const url = new URL(route.request().url());
   if(url.hostname==='preview.test') {
    const file = path.join(root,url.pathname==='/'?'index.html':url.pathname);
    return route.fulfill({path:file,contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.otf':'font/otf','.woff':'font/woff'})[path.extname(file)] || 'application/octet-stream'});
   }
   if(url.hostname.endsWith('.sanity.io') && url.pathname.includes('/data/query/')) return route.fulfill({json:{result:raw}});
   if(url.hostname==='cdn.sanity.io') return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="gray"/></svg>'});
   return route.fulfill({body:''});
  });
  await page.goto('https://preview.test/#archive');
  await page.waitForSelector('.archive[data-source="sanity"]');
  const geometry = () => page.locator('.archive-background').evaluate(bg=>{
   const rect=bg.getBoundingClientRect(), img=bg.querySelector('img');
   return {x:rect.x,width:rect.width,height:rect.height,fit:getComputedStyle(img).objectFit};
  });
  // No mouse movement is needed to activate the first entry and its position.
  assert.equal(await page.locator('.archive-row[aria-current="true"]').getAttribute('data-index'),'0');
  assert.ok(await page.locator('.archive-background').evaluate(bg=>bg.classList.contains('visible')));
  assert.deepEqual(await geometry(),{x:0,width:720,height:900,fit:'cover'});
  const boxes=await page.locator('.archive-row').evaluateAll(rows=>rows.map(row=>{
   const rect=row.getBoundingClientRect(); return {top:rect.top,bottom:rect.bottom};
  }));
  const active=()=>page.locator('.archive-row[aria-current="true"]').getAttribute('data-index');
  // x=1 is outside the buttons: only the true vertical row boundaries matter.
  await page.mouse.move(1,boxes[0].top+1);
  assert.equal(await active(),'0');
  await page.mouse.move(1,Math.ceil(boxes[1].top)-1);
  assert.equal(await active(),'0');
  await page.mouse.move(1,Math.ceil(boxes[1].top));
  assert.equal(await active(),'1');
  assert.deepEqual(await geometry(),{x:720,width:720,height:900,fit:'cover'});
  await page.mouse.move(1,boxes[0].top+1);
  assert.equal(await active(),'0');
  assert.deepEqual(await geometry(),{x:0,width:720,height:900,fit:'cover'});
  for(const width of [1440,701,700,390]) {
   await page.setViewportSize({width,height:900});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const mobile=width<=700;
   for(const [rowIndex,offsets] of [[0,[0,.25,.5]],[1,[.5,0,.25]]]) {
    const row=page.locator('.archive-row').nth(rowIndex);
    if(mobile) {
     await row.click();
     assert.deepEqual(await geometry(),{x:0,width,height:900,fit:'cover'});
    } else {
     await row.hover();
     for(let index=0;index<3;index++) {
      const landscape=rowIndex===1&&index===1;
      assert.deepEqual(await geometry(),{x:width*offsets[index],width:landscape?width:width/2,height:900,fit:'cover'});
      await row.click();
     }
    }
   }
  }
  for(const width of [390,700]) {
   await page.setViewportSize({width,height:844});
   await page.reload();
   await page.waitForSelector('.archive-row[aria-current="true"][data-index="0"]');
   const settled=async index=>{
    await page.waitForFunction(index=>{
     const list=document.querySelector('.archive-list'),row=list.children[index];
     return row.getAttribute('aria-current')==='true' &&
      Math.abs(row.getBoundingClientRect().top-list.getBoundingClientRect().top)<1;
    },index,{timeout:5000});
   };
   for(const next of [1,2,0]) {
    await page.touchscreen.tap(width/2,600);
    await settled(next);
    assert.deepEqual(await geometry(),{x:0,width,height:844,fit:'cover'});
   }
   // Real native touch scrolling must work and releasing must not advance again.
   const session=await page.context().newCDPSession(page);
   await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2,y:600}]});
   for(const y of [590,575,555,530,500]) {
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width/2,y}]});
    await page.waitForTimeout(35);
   }
   // Let the drag come to rest so release does not add inertia.
   await page.waitForTimeout(150);
   const during=await page.locator('.archive-list').evaluate(list=>list.scrollTop);
   assert.ok(during>0,'native touch drag scrolls the Index');
   await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForTimeout(500);
   assert.equal(await active(),'2'); // The drag reached the last row, never wrapped.
   await page.touchscreen.tap(width/2,600);
   await settled(0);
   // Entry buttons remain controls: tapping one selects it, rather than advancing.
   await page.locator('.archive-row').nth(2).tap();
   await settled(2);
   await session.detach();
  }
 } finally {await browser.close();}
});
