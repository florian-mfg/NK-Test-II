async function swipe(page) { await page.evaluate(()=>{const n=document.querySelector('.archive');for(const [type,y] of [['pointerdown',600],['pointermove',500],['pointerup',500]])n.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,isPrimary:true,pointerType:'touch',button:0,clientX:350,clientY:y}));}); }
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
for(const engine of ['chromium','webkit'])test(`${engine}: bounded Index preparation, real progress, cache reuse and mobile spacing`,{skip:!process.env.BROWSER_TEST,timeout:120000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const results=[];
 try{for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:{width:mobile?390:1440,height:mobile?844:900},hasTouch:mobile,isMobile:mobile}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const video=await require('./native-media-fixture.cjs').recordMP4(page);
  const image=i=>({asset:{_ref:`image-p${i}-800x1200-svg`}});
  const entries=Array.from({length:38},(_,i)=>({displayTitle:i===3?'A long project title which wraps onto multiple lines on a mobile phone':`Project ${i}`,previewImages:[i===2?{mediaType:'mp4',video:{asset:{_ref:'file-demo-mp4'}}}:image(i)]}));
  let release,held=true;const gate=new Promise(r=>release=r),requests=[];
  await page.route('**/*',async r=>{
   const u=new URL(r.request().url());
   if(u.hostname==='preview.test')return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});
   if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:{projects:[],indexPage:{_id:'indexPage',_type:'indexPage',entries}}}});
   if(u.hostname==='cdn.sanity.io'){
    requests.push(u.href);
    if(u.pathname.includes('/p1-')&&held)await gate;
    if(u.pathname.includes('/p5-'))return r.abort();
    if(u.pathname.endsWith('.mp4'))return r.fulfill({body:video,contentType:'video/mp4'});
    return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#555"/></svg>'});
   }return r.abort();
  });
  await page.addInitScript(()=>{window.indexProgress=[];new MutationObserver(()=>{const n=document.querySelector('.index-loading-indicator');if(n)indexProgress.push(+n.getAttribute('aria-valuenow'));}).observe(document,{subtree:true,attributes:true,attributeFilter:['aria-valuenow'],childList:true});});
  await page.goto('https://preview.test/#archive',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>+document.querySelector('.index-loading-indicator')?.getAttribute('aria-valuenow')>0);
  const bar=await page.locator('.index-loading-indicator').evaluate(n=>{
   const r=n.getBoundingClientRect(),s=getComputedStyle(n),fill=n.firstElementChild,original=fill.style.transform;
   fill.style.transform='scaleX(1)';const full=fill.getBoundingClientRect().width;
   fill.style.transform='scaleX(.5)';const half=fill.getBoundingClientRect().width;fill.style.transform=original;
   return{w:r.width,h:r.height,bottom:innerHeight-r.bottom,center:r.x+r.width/2,full,half,fill:getComputedStyle(fill).backgroundColor,track:s.backgroundColor,border:s.borderWidth,shadow:s.boxShadow,origin:getComputedStyle(fill).transformOrigin};
  });
  assert.equal(bar.w,170);assert.equal(bar.h,3);assert.equal(bar.bottom,24);assert.equal(bar.center,mobile?195:720);assert.equal(bar.full,170);assert.equal(bar.half,85);assert.equal(bar.fill,'rgb(255, 255, 255)');assert.equal(bar.track,'rgba(0, 0, 0, 0)');assert.equal(bar.border,'0px');assert.equal(bar.shadow,'none');assert.ok(bar.origin.startsWith('0px'));
  await page.waitForSelector('.archive-background img');
  assert.ok(requests.length<=3,'only the first three primary assets load initially');
  const current=()=>page.locator('.archive-row[aria-current]').getAttribute('data-index');
  if(mobile)await swipe(page);else {const box=await page.locator('.archive-row').nth(4).boundingBox();await page.mouse.move(box.x+20,box.y+box.height/2);await page.mouse.click(box.x+20,box.y+box.height/2);}
  assert.equal(await current(),'0','startup input cannot select unprepared projects');
  held=false;release();await page.waitForSelector('.archive[data-prepared="true"]');
  assert.equal(await page.locator('.index-loading-indicator').count(),0);assert.equal(await current(),'0');
  const progress=await page.evaluate(()=>indexProgress);assert.ok(progress.every((v,i)=>!i||v>=progress[i-1]));
  const spacing=()=>page.evaluate(()=>{
   const rows=[...document.querySelectorAll('.archive-row:not([data-repeat])')];
   const one=rows[0],multi=rows[3],s=getComputedStyle(one),m=getComputedStyle(multi),r=one.getBoundingClientRect();
   return{font:s.fontSize,line:s.lineHeight,weight:s.fontWeight,letter:s.letterSpacing,height:r.height,gap:r.height-parseFloat(s.lineHeight),multiPadding:parseFloat(m.paddingTop)+parseFloat(m.paddingBottom),overflow:document.documentElement.scrollWidth>innerWidth};
  });
  const after=await spacing();
  const old=await page.addStyleTag({content:'@media(max-width:700px){.is-index .archive-row{min-height:var(--archive-row-height);padding:.12rem 0;}}'});
  const before=await spacing();await old.evaluate(n=>n.remove());
  for(const key of ['font','line','weight','letter'])assert.equal(after[key],before[key]);
  if(mobile){assert.ok(Math.abs(after.gap/before.gap-.75)<.015);assert.ok(Math.abs(after.multiPadding/before.multiPadding-.75)<.015);}else assert.deepEqual(after,before);
  assert.equal(after.overflow,false);
  if(mobile){
   for(let i=0;i<8;i++)await swipe(page);
   await page.waitForFunction(()=>document.querySelector('.archive').dataset.activeProject==='9'&&!document.querySelector('.archive-list-track').classList.contains('is-moving'));
  }else{
   await page.locator('.archive-row').nth(2).hover();await page.waitForSelector('.archive-background video');
   await page.waitForFunction(()=>document.querySelector('.archive-background video')?.readyState>=2);
   assert.ok(await page.locator('.detail-sound-control').count());
   await page.waitForFunction(()=>document.querySelector('.archive-background video')?.paused===false);
  }
  const cache=await page.evaluate(()=>[...indexMediaCache.values()].map(r=>({type:r.media.type,settled:r.settled,connected:r.node.isConnected})));
  assert.ok(cache.filter(r=>r.type==='image'&&r.settled).length<=8);assert.ok(cache.filter(r=>r.type==='mp4'&&r.settled).length<=2);
  const residentFirst=await page.evaluate(()=>[...indexMediaCache.values()].some(r=>r.ready&&r.node.src.includes('/p0-')));
  await page.goto('https://preview.test/#info');await page.waitForSelector('.info');
  const firstRequests=requests.filter(s=>s.includes('/p0-')).length;
  await page.goto('https://preview.test/#archive',{waitUntil:'domcontentloaded'});await page.waitForSelector('.archive[data-prepared="true"]');
  if(residentFirst)assert.equal(requests.filter(s=>s.includes('/p0-')).length,firstRequests,'resident first preview is reused across routes');
  // Drop resident preparation, then leave while a real image request is held.
  await page.goto('https://preview.test/#info');await page.waitForSelector('.info');
  // Force a distinct browser resource as well as clearing the application cache;
  // Image.decode may otherwise reuse the already-decoded bitmap without a fetch.
  await page.evaluate(()=>{indexMediaCache.clear();sanityContent.indexPage.entries[1].media[0].src+='?late=1';});held=true;
  let releaseLate;const late=new Promise(r=>releaseLate=r);
  await page.route('**/p1-*',async r=>{await late;await r.abort().catch(()=>{});});
  await page.goto('https://preview.test/#archive',{waitUntil:'domcontentloaded'});await page.waitForSelector('.index-loading-indicator');
  await page.goto('https://preview.test/#info');await page.waitForSelector('.info');releaseLate();
  await page.waitForTimeout(50);assert.equal(await page.locator('.archive').count(),0);assert.equal(await page.locator('.index-loading-indicator').count(),0);assert.deepEqual(errors,[]);
  results.push({mobile,bar,before,after,progress,requestCount:requests.length,cache});await page.close();
 }
 const out=path.join(__dirname,'..','reports','index-loading');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`${engine}.json`),JSON.stringify(results,null,2));
 }finally{await browser.close();}
});

for(const engine of ['chromium','webkit'])test(`${engine}: unavailable initial media reaches a bounded fallback`,{skip:!process.env.BROWSER_TEST,timeout:30000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  let release;const gate=new Promise(r=>release=r);
  await page.route('**/*',async r=>{
   const u=new URL(r.request().url());
   if(u.hostname==='preview.test')return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});
   if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:{projects:[],indexPage:{_id:'indexPage',_type:'indexPage',entries:[0,1,2].map(i=>({displayTitle:`Project ${i}`,previewImages:[{asset:{_ref:`image-timeout${i}-800x1200-svg`}}]}))}}}});
   if(u.hostname==='cdn.sanity.io'){
    if(u.pathname.includes('timeout1')){await gate;return r.abort().catch(()=>{});}
    if(u.pathname.includes('timeout2'))return r.abort();
    return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"/>'});
   }return r.abort();
  });
  await page.goto('https://preview.test/#archive',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.index-loading-indicator');
  await page.waitForSelector('.archive[data-prepared="true"]',{timeout:16000});
  assert.equal(await page.locator('.index-loading-indicator').count(),0);
  await page.locator('.archive-row').nth(2).hover();await page.waitForSelector('.archive-background img');
  assert.ok(await page.locator('.archive-background img').evaluate(n=>n.complete&&n.naturalWidth>0));
  release();await page.close();
 }finally{await browser.close();}
});

for(const engine of ['chromium','webkit'])test(`${engine}: consecutive MP4 entries retain the nearest two previews`,{skip:!process.env.BROWSER_TEST,timeout:30000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const bytes=await require('./native-media-fixture.cjs').recordMP4(page),requests=[];
  await page.route('**/*',r=>{
   const u=new URL(r.request().url());
   if(u.hostname==='preview.test')return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});
   if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:{projects:[],indexPage:{_id:'indexPage',_type:'indexPage',entries:[0,1,2,3].map(i=>({displayTitle:`Video ${i}`,previewImages:[{mediaType:'mp4',video:{asset:{_ref:`file-video${i}-mp4`}}}]}))}}}});
   if(u.pathname.endsWith('.mp4')){requests.push(u.pathname);return r.fulfill({body:bytes,contentType:'video/mp4'});}
   return r.abort();
  });
  await page.goto('https://preview.test/#archive',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.archive[data-prepared="true"]');
  assert.equal(new Set(requests).size,2,'initial preparation respects the two-video budget');
  for(const i of [1,2]){
   await swipe(page);
   await page.waitForFunction(i=>document.querySelector('.archive').dataset.activeProject===String(i)&&!document.querySelector('.archive-list-track').classList.contains('is-moving'),i);
   await page.waitForFunction(()=>document.querySelector('.archive-background video')?.paused===false);
   assert.ok(await page.locator('.archive-background video').getAttribute('src').then(src=>src.includes(`video${i}.mp4`)));
   assert.ok(await page.evaluate(()=>[...indexMediaCache.values()].filter(r=>r.media.type==='mp4'&&r.settled).length<=2));
  }
 }finally{await browser.close();}
});
