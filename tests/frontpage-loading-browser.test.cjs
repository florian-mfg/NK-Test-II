const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..');
for(const engine of ['chromium','webkit']) test(`${engine}: real loading, failures, reusable MP4, responsive wordmark and navigation`,{skip:!process.env.BROWSER_TEST,timeout:120000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try {
 const recorder=await browser.newPage();const bytes=await require('./native-media-fixture.cjs').recordMP4(recorder);const portrait=await require('./native-media-fixture.cjs').recordMP4(recorder,90,160);await recorder.close();
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let requests=0,hold;const gate=new Promise(r=>hold=r);
 const raw={projects:[],homePage:{_id:'homePage',_type:'homePage',media:Array.from({length:20},(_,i)=>({_key:'m'+i,type:i===18?'mp4':'image',size:'large',image:{asset:{_id:`image-demo${i}-160x90-svg`,url:`https://cdn.sanity.io/images/ck6xe2er/production/demo${i}.svg`,metadata:{dimensions:{width:160,height:90}}}},video:{asset:{_id:'file-demo-mp4',url:'https://cdn.sanity.io/files/ck6xe2er/production/demo.mp4'}}}))}};
 await page.route('**/*',async r=>{const u=new URL(r.request().url());
  if(u.hostname==='preview.test')return r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname)});
  if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:raw}});
  if(u.hostname==='cdn.sanity.io'){
   requests++;
   if(u.pathname.includes('demo19'))return r.abort();
   if(u.pathname.endsWith('.mp4')){await gate;return r.fulfill({body:u.pathname.includes('portrait')?portrait:bytes,contentType:'video/mp4'});}
   await gate;
   return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#666"/></svg>'});
  }if(u.hostname==='unreachable.test'){await new Promise(r=>setTimeout(r,200));return r.abort();}return r.abort();
 });
 await page.goto('https://preview.test/#home',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.brand[data-animating]');
 const geometry=()=>page.evaluate(()=>{const brand=document.querySelector('.site-header .brand'),a=brand.firstElementChild.getBoundingClientRect(),b=brand.lastElementChild.getBoundingClientRect();return {a:{x:a.x,y:a.y,right:a.right},b:{x:b.x,y:b.y,right:b.right},width:innerWidth,nav:getComputedStyle(document.querySelector('.main-nav')).visibility,ready:document.querySelector('.frontpage-fade').dataset.ready,overflow:document.documentElement.scrollWidth>innerWidth};});
 await page.waitForTimeout(100);const initial=await geometry();assert.ok(Math.abs(initial.a.x-12)<.1);assert.ok(Math.abs(initial.b.right-1440+12)<.1);assert.equal(initial.a.y,initial.b.y);assert.equal(initial.nav,'hidden');assert.equal(initial.ready,undefined);
 await page.mouse.move(500,200);await page.mouse.move(800,400);assert.equal(await page.locator('.frontpage-fade-media').count(),0);
 hold();await page.waitForFunction(()=>document.querySelector('.frontpage-fade').dataset.ready==='true');
 const final=await geometry();assert.equal(final.a.x,initial.a.x);assert.ok(Math.abs(final.a.y-initial.a.y)<.1,JSON.stringify({initial,final}));assert.equal(final.nav,'visible');assert.ok(final.b.x>final.a.right&&final.b.x-final.a.right<10);assert.equal(final.overflow,false);
 const result=await page.evaluate(()=>JSON.parse(document.querySelector('.frontpage-fade').dataset.preparation));assert.equal(result.filter(r=>r.status==='ready').length,19);assert.equal(result.filter(r=>r.status==='failed').length,1);
 const before=requests;
 const placements=await page.evaluate(()=>{
  const layer=document.querySelector('.frontpage-fade'),home=document.querySelector('.home');
  const move=(x,y)=>home.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:x,clientY:y,bubbles:true}));
  window.dispatchEvent(new Event('blur'));move(400,200);move(401,200);
  const start=+layer.dataset.progress;
  for(let i=0;i<60;i++){
   const n=layer.lastElementChild,r={left:parseFloat(n.style.left),top:parseFloat(n.style.top),width:parseFloat(n.style.width),height:parseFloat(n.style.height)};
   const b={viewLeft:0,viewTop:0,viewRight:innerWidth,viewBottom:innerHeight};
   const v=FrontpageMediaFade.visiblePortion(r,b,8);
   const x=v.left+v.width/2,y=v.top+v.height/2;
   move(x,y);move(Math.min(innerWidth-1,r.left+r.width+2),y);
  }
  return {start,progress:+layer.dataset.progress,count:layer.children.length};
 });assert.equal(placements.progress-placements.start,60,JSON.stringify(placements));assert.equal(placements.count,3);
 await page.waitForTimeout(150);assert.equal(requests,before,'pointer movement reuses prepared nodes without new media requests');
 await page.mouse.move(500,300);await page.mouse.move(501,300);
 await page.evaluate(()=>{
  window.stopTestBrush=FrontpageMediaFade.init(document.querySelector('.frontpage-fade'),[{type:'mp4',src:'https://cdn.sanity.io/files/ck6xe2er/production/demo.mp4',aspectRatio:16/9}],{});
 });
 // A separate prepared one-resource session verifies three simultaneous video instances.
 const video=await page.evaluate(async()=>{
  stopTestBrush();const layer=document.querySelector('.frontpage-fade');
  const p=await FrontpageLoading.prepare([{type:'mp4',src:'https://cdn.sanity.io/files/ck6xe2er/production/demo.mp4'}]);
  const nodes=[];for(let i=0;i<3;i++){const n=p.acquire(p.sequence[0],nodes);nodes.push(n);layer.append(n);}
  const data=nodes.map(n=>({width:n.videoWidth,height:n.videoHeight,state:n.readyState,border:getComputedStyle(n).borderWidth,padding:getComputedStyle(n).padding,background:getComputedStyle(n).backgroundColor}));p.dispose();return data;
 });
 assert.equal(video.length,3);for(const v of video){assert.ok(v.state>=2);assert.equal(v.width/v.height,16/9);assert.equal(v.border,'0px');assert.equal(v.padding,'0px');assert.equal(v.background,'rgba(0, 0, 0, 0)');}
 const portraitResult=await page.evaluate(async()=>{const p=await FrontpageLoading.prepare([{type:'mp4',src:'https://cdn.sanity.io/files/ck6xe2er/production/portrait.mp4'}]);const n=p.acquire(p.sequence[0],[]);const data={ratio:n.videoWidth/n.videoHeight,ready:n.readyState};p.dispose();return data;});assert.equal(portraitResult.ratio,90/160);assert.ok(portraitResult.ready>=2);
 const hash=await page.evaluate(()=>location.hash);await page.locator('.work-toggle').hover();await page.locator('.work-toggle').click();assert.equal(await page.evaluate(()=>location.hash),hash);assert.equal(await page.locator('.work-toggle').getAttribute('aria-expanded'),'true');
 await page.keyboard.press('Escape');await page.locator('.work-toggle').focus();await page.keyboard.press('Space');assert.equal(await page.locator('.work-toggle').getAttribute('aria-expanded'),'true');
 await page.setViewportSize({width:390,height:844});await page.locator('.mobile-menu-toggle').click();const mt=page.locator('.mobile-menu-label');await mt.click();assert.equal(await mt.getAttribute('aria-expanded'),'true');await mt.click();assert.equal(await mt.getAttribute('aria-expanded'),'false');await mt.click();await page.locator('.mobile-work-submenu a').first().click();assert.equal(await page.evaluate(()=>location.hash),'#work/video');
 // Timeouts, empty sequences and cancellation are bounded and distinguish failure.
 const fallback=await page.evaluate(async()=>{const result=await FrontpageLoading.prepare([{type:'mp4',src:'https://unreachable.test/missing.mp4'}],{timeout:50});const empty=await FrontpageLoading.prepare([]);result.dispose();empty.dispose();return {results:result.results,count:result.sequence.length,empty:empty.sequence.length};});assert.equal(fallback.count,0);assert.equal(fallback.empty,0);assert.equal(fallback.results[0].status,'timeout');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine,prepared:result.length,failed:1,initial,final,video,requestsBeforeVideoTest:before}));
 await page.close();
 // Controlled response delays produce intermediate real progress on every viewport.
 for(const [width,height] of [[1920,1080],[760,900],[390,844],[844,390]]) {
  const p=await browser.newPage({viewport:{width,height},reducedMotion:width===390?'reduce':'no-preference'});
  await p.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname==='preview.test')return r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname)});if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:{projects:[],homePage:{_id:'homePage',_type:'homePage',media:raw.homePage.media.slice(0,4)}}}});if(u.hostname==='cdn.sanity.io'){const i=Number(u.pathname.match(/demo(\d+)/)[1]);await new Promise(r=>setTimeout(r,200+i*250));return r.fulfill({body:'<svg xmlns="http://www.w3.org/2000/svg" width="90" height="160"><rect width="90" height="160" fill="#444"/></svg>',contentType:'image/svg+xml'});}return r.abort();});
  await p.goto('https://preview.test/#home',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>{const v=+document.querySelector('.frontpage-fade').dataset.loadingProgress;return v>0&&v<1;});
  assert.equal(await p.locator('.main-nav').evaluate(n=>getComputedStyle(n).visibility),'hidden');await p.waitForFunction(()=>document.querySelector('.frontpage-fade').dataset.ready==='true');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.close();
 }
 }finally{await browser.close();}
});
