'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), path=require('node:path');
for(const engine of ['chromium','webkit']) test(`one tap equals one project: ${engine}${process.env.SITE_BASE_URL?' live':''}`,{skip:!process.env.BROWSER_TEST},async()=>{
 const p=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await p[engine].launch(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const live=process.env.SITE_BASE_URL;
  if(!live)await page.route('**/*',r=>{
   const u=new URL(r.request().url());
   if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:{projects:[],indexPage:{_id:'indexPage',_type:'indexPage',entries:Array.from({length:12},(_,i)=>({displayTitle:`Project ${i}`,previewImages:[{asset:{_ref:'image-demo-800x1200-jpg'}},{mediaType:'mp4',video:{asset:{_ref:'file-demo-mp4'}}},{mediaType:'mp4',video:{asset:{_ref:'file-second-mp4'}}}] }))}}}});
   if(u.hostname==='preview.test')return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});
   if(u.hostname==='cdn.sanity.io')return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="gray"/></svg>'});
   return r.fulfill({body:''});
  });
  const base=live||'https://preview.test/';
  await page.goto(`${base}#archive`);
  await page.waitForSelector('.archive[data-source="sanity"]');
  const rows=page.locator('.archive-row'),count=await rows.count();assert.ok(count>1);
  const state=async()=>page.evaluate(()=>{
   const list=document.querySelector('.archive-list'), rows=[...list.querySelectorAll('.archive-row')],i=rows.findIndex(r=>r.hasAttribute('aria-current'));
   const top=list.getBoundingClientRect().top;
   return {i,aligned:Math.abs(rows[i].getBoundingClientRect().top-top)<.1,italic:getComputedStyle(rows[i].firstElementChild).fontStyle,hidden:rows.slice(0,i).every(r=>r.inert&&r.getBoundingClientRect().bottom<=top+.1),scroll:[scrollX,scrollY,list.scrollTop],visible:rows.filter(r=>r.getBoundingClientRect().bottom>top+.1).length};
  });
  const check=async i=>{const s=await state();assert.equal(s.i,i);assert.ok(s.aligned&&s.hidden);assert.equal(s.italic,'italic');assert.deepEqual(s.scroll,[0,0,0]);return s;};
  const counts=await page.evaluate(async()=>{const result=await SanityData.load();return result.data.indexPage.entries.map(e=>(e.media||e.images||[]).length)});
  assert.ok(counts.some(n=>n>1),'published/fixture Index must include multiple-media entries');
  const trace=[0];await check(0);
  for(let tap=1;tap<=12;tap++){await page.touchscreen.tap(200,800);const expected=tap%count;await check(expected);trace.push(expected);}
  const before=(await state()).i;
  await page.locator('.detail-sound-control').tap();await check(before);
  await page.locator('.mobile-menu-toggle').tap();
  assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#ffffff');
  await page.locator('.mobile-menu-close').tap();await check(before);
  await rows.last().tap();await check(count-1);
  await rows.last().tap();await check(count-1); // Selection cannot advance.
  await page.touchscreen.tap(200,800);const reset=await check(0);assert.equal(reset.visible,count);
  await page.evaluate(()=>{const n=document.querySelector('.archive');for(const [type,y]of[['pointerdown',750],['pointermove',400],['pointerup',400]])n.dispatchEvent(new PointerEvent(type,{bubbles:true,isPrimary:true,pointerId:7,button:0,clientX:200,clientY:y}));});await check(0);
  await page.waitForSelector('.archive-background img, .archive-background video');
  const coverage=await page.locator('.archive-background').evaluate(n=>{const r=n.getBoundingClientRect();return[r.x,r.y,r.width,r.height]});assert.deepEqual(coverage,[0,0,390,844]);
  await page.goto(`${base}#home`);await page.waitForSelector('.home');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(255, 255, 255)');
  console.log(JSON.stringify({engine,live:!!live,count,multipleMedia:counts.filter(n=>n>1).length,tapIndices:trace,loop:'passed',controls:'passed'}));
 }finally{await browser.close();}
});
