'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
for(const engine of ['chromium','webkit'])test(`${engine}: mobile Index taps and swipes share the directional queue`,{skip:!process.env.BROWSER_TEST,timeout:90000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const bytes=await require('./native-media-fixture.cjs').recordMP4(page);
  const entries=Array.from({length:12},(_,i)=>({displayTitle:`Project ${i}`,previewImages:[i===4?{mediaType:'mp4',video:{asset:{_ref:'file-video4-mp4'}}}:{asset:{_ref:`image-tap${i}-800x1200-jpg`}}]}));
  let release;const gate=new Promise(r=>release=r);let held=true;const requests=[];
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='preview.test')return route.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});
   if(u.pathname.includes('/data/query/'))return route.fulfill({json:{result:{projects:[],indexPage:{_id:'indexPage',_type:'indexPage',entries}}}});
   if(u.hostname==='cdn.sanity.io'){
    requests.push(u.href);
    if(u.pathname.includes('/tap7-')&&held)await gate;
    if(u.pathname.includes('/tap9-'))return route.abort();
    return u.pathname.endsWith('.mp4')?route.fulfill({body:bytes,contentType:'video/mp4'}):route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#777"/></svg>'});
   }return route.abort();
  });
  await page.goto('https://preview.test/#archive');await page.waitForSelector('.archive[data-prepared="true"]');
  const settle=async index=>{
   await page.waitForFunction(index=>document.querySelector('.archive').dataset.activeProject===String(index)&&!document.querySelector('.archive-list-track').classList.contains('is-moving'),index);
   await page.waitForTimeout(40);
   const s=await page.evaluate(()=>{const a=document.querySelector('.archive-row[aria-current]'),list=document.querySelector('.archive-list');return {index:+a.dataset.index,media:+document.querySelector('.archive-background').dataset.projectIndex,top:a.getBoundingClientRect().top,listTop:list.getBoundingClientRect().top};});
   assert.equal(s.index,index);assert.equal(s.media,index);assert.ok(Math.abs(s.top-s.listTop)<.2,'selected title aligns at list top');
  };
  const visibleRow=index=>page.locator(`.archive-row[data-index="${index}"]:not([inert])`).first();
  const gesture=async({index=null,dx=0,dy=0,back=false,cancel=false,multi=false,click=true}={})=>page.evaluate(({index,dx,dy,back,cancel,multi,click})=>{
   const row=index===null?document.querySelector('.archive'):document.querySelector(`.archive-row[data-index="${index}"]:not([inert])`);
   const r=row.getBoundingClientRect(),x=index===null?200:r.left+r.width/2,y=index===null?500:r.top+r.height/2;
   const send=(type,px,py,id=1)=>row.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',isPrimary:id===1,pointerId:id,clientX:px,clientY:py,button:0}));
   send('pointerdown',x,y);if(multi)send('pointerdown',x+20,y,2);
   send('pointermove',x+dx,y+dy);
   send(cancel?'pointercancel':'pointerup',back?x:x+dx,back?y:y+dy);
   if(multi)send('pointerup',x+20,y,2);
   if(click)row.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
  },{index,dx,dy,back,cancel,multi,click});
  await settle(0);
  await page.evaluate(()=>{window.commits=[];new MutationObserver(rs=>rs.forEach(()=>commits.push(+document.querySelector('.archive').dataset.activeProject))).observe(document.querySelector('.archive'),{attributes:true,attributeFilter:['data-active-project']});});
  await visibleRow(3).locator('span').first().tap();
  await page.waitForFunction(()=>document.querySelector('.archive-list-track').classList.contains('is-moving'));
  const top=await page.locator('.archive-row[aria-current]').evaluate(n=>n.getBoundingClientRect().top);
  await page.waitForTimeout(80);
  assert.ok(await page.locator('.archive-row[aria-current]').evaluate((n,top)=>n.getBoundingClientRect().top<top,top),'tap alignment animates smoothly');
  await settle(3);await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>commits),[3],'native touch click does not double-select');
  await visibleRow(4).tap();await settle(4);
  await page.waitForFunction(()=>{const v=document.querySelector('.archive-background video');return v&&!v.paused&&v.currentTime>0;});
  // Start a swipe on a title; Chrome uses native touch input as well.
  if(engine==='chromium'){
   const box=await visibleRow(6).boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let i=1;i<=4;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*20}]});await page.waitForTimeout(40);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else await gesture({index:6,dy:-80});
  await settle(5);
  for(const options of [{index:6,dy:-25},{index:6,dx:80,dy:-50},{index:6,dy:-80,back:true},{index:6,cancel:true},{index:6,multi:true}]){
   await gesture(options);await page.waitForTimeout(80);await settle(5);
  }
  await visibleRow(7).tap();await page.waitForTimeout(150);
  assert.equal(await page.locator('.archive').getAttribute('data-active-project'),'5','cold tap retains matching old title and media');
  await gesture({dy:-100});await gesture({index:10});await gesture({dy:100});
  held=false;release();await settle(8); // 7, swipe to 8, direct 10, backward swipe skips failed 9 to 8.
  assert.deepEqual(await page.evaluate(()=>commits),[3,4,5,7,8,10,8]);
  const before=requests.filter(u=>u.includes('/tap10-')).length;
  await visibleRow(10).tap();await settle(10);
  assert.equal(requests.filter(u=>u.includes('/tap10-')).length,before,'tap reuses cached image');
  await visibleRow(0).tap();await settle(0); // Select a repeated row across the wrap.
  await gesture({dy:100});await settle(11);await gesture({dy:-100});await settle(0);
  await visibleRow(0).tap();await page.waitForTimeout(100);await settle(0);
  await page.emulateMedia({reducedMotion:'reduce'});await visibleRow(2).tap();await settle(2);
  const cache=await page.evaluate(()=>({images:[...indexMediaCache.values()].filter(r=>r.media.type==='image').length,videos:[...indexMediaCache.values()].filter(r=>r.media.type==='mp4').length}));
  assert.ok(cache.images<=8&&cache.videos<=2);
  await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(100);
  await page.locator('.archive-row[data-index="3"]').hover();
  await page.waitForFunction(()=>document.querySelector('.archive-row[aria-current]')?.dataset.index==='3');
  console.log(`${engine}: native taps, smooth alignment, swipe discrimination, mixed queue, cold loading, failure recovery, cache, wrap and desktop passed`);
 }finally{await browser.close();}
});
