// Local source + live production media. Non-read requests are blocked.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),out=process.env.RELEASE_REPORT_DIR||path.join(require('node:os').tmpdir(),'nk-overview-index'),base=process.env.RELEASE_BASE_URL||'http://127.0.0.1:5500/';
for(const engine of ['chromium','webkit'])test(`${engine}: real overview raster joins and desktop Index hover states`,{skip:!process.env.FINAL_REFINEMENTS_LIVE,timeout:240000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 fs.mkdirSync(out,{recursive:true});
 const results={overviews:[],index:[],errors:[],writes:[],httpErrors:[]};
 const open=async(width,dpr=1)=>{
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:dpr,hasTouch:width<=700,isMobile:width<=700});page.setDefaultTimeout(45000);
  page.on('pageerror',e=>results.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)results.httpErrors.push({url:r.url(),status:r.status()});});
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){results.writes.push(route.request().url());return route.abort();}if(!process.env.RELEASE_BASE_URL&&u.origin===new URL(base).origin){const file=u.pathname==='/'?'index.html':u.pathname.slice(1),type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml'}[path.extname(file)];return route.fulfill({path:path.join(root,file),...(type?{contentType:type}:{})});}return route.continue();});
  await page.goto(base+'#info',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>sanityLoadSettled&&sanityContent);await page.evaluate(()=>document.fonts.ready);
  return page;
 };
 try{
  for(const dpr of (process.env.FINAL_INDEX_ONLY?[]:[1,2]))for(const width of [320,390,700,701,820,1025,1440,1920]){
   const p=await open(width,dpr);await p.addStyleTag({content:'html{scroll-behavior:auto!important}'});
   for(const category of ['video','commissioned','graphic']){
    await p.evaluate(c=>location.hash='#work/'+c,category);await p.waitForSelector('.work[data-source="sanity"]');
    await p.evaluate(async()=>{const images=[...document.querySelectorAll('.project-preview:not([hidden]) img')];for(const i of images)i.loading='eager';await Promise.all(images.map(i=>i.decode()));});
    await p.waitForFunction(()=>[...document.querySelectorAll('.project-preview:not([hidden]) video')].every(v=>v.videoWidth>0));
    await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const rows=await p.evaluate(()=>[...document.querySelectorAll('.project-preview:not([hidden]) .project-module')].map(row=>{
     const r=row.getBoundingClientRect();return {project:row.closest('.project-preview').dataset.project,top:r.top+scrollY,bottom:r.bottom+scrollY,media:[...row.querySelectorAll('.project-slot > img,.project-video > video')].map(m=>{const r=m.getBoundingClientRect(),clip=m.style.clip.match(/[\d.e+-]+(?=px)/g)?.map(Number),ratio=m.tagName==='VIDEO'?m.videoWidth/m.videoHeight:m.naturalWidth/m.naturalHeight;return {top:r.top+scrollY,bottom:r.bottom+scrollY,width:r.width,height:r.height,ratio,clip,position:getComputedStyle(m).position};})};
    }));
    for(let i=0;i<rows.length;i++){
     const row=rows[i];if(i)assert.ok(Math.abs(row.top-rows[i-1].bottom)<.025,`${engine}/${width}/${category}: layout gap`);
     assert.ok(Math.abs(row.top*dpr-Math.round(row.top*dpr))<.03,'row begins on physical pixel');
     assert.ok(Math.abs(row.bottom*dpr-Math.round(row.bottom*dpr))<.03,'row ends on physical pixel');
     for(const m of row.media){assert.equal(m.position,'absolute');assert.ok(m.clip?.length===4);assert.ok(Math.abs(m.height-m.width/m.ratio)<.04,'paint preserves source ratio');assert.ok(Math.abs(m.top+m.clip[0]-row.top)<.03,'paint and layout share top edge');assert.ok(Math.abs(m.top+m.clip[2]-row.bottom)<.03,'paint reaches next module edge');}
    }
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(category==='graphic'&&dpr===1)for(let i=0;i<rows.length-1;i++){
     await p.evaluate(y=>scrollTo(0,Math.max(0,Math.round(y-450))),rows[i].bottom);
     const y=await p.evaluate(b=>b-scrollY,rows[i].bottom);
     if(y>20&&y<880)await p.screenshot({path:path.join(out,`${engine}-${width}-join${i}-verified.png`),clip:{x:0,y:Math.floor(y)-12,width,height:24}});
    }
    results.overviews.push({width,dpr,category,rows});
   }
   console.log(engine,'overview',width,'DPR',dpr,'passed');await p.close();
  }
  for(const width of [1440,390]){
   const p=await open(width),requests=[];p.on('request',r=>{if(r.url().includes('cdn.sanity.io'))requests.push(r.url());});
   await p.evaluate(()=>location.hash='#archive');await p.waitForSelector('.archive[data-prepared="true"]');
   const entries=await p.evaluate(()=>sanityContent.indexPage.entries.map(e=>({title:e.title,src:e.media[0].src,type:e.media[0].type})));
   const selected=()=>p.locator('.archive-row[aria-current]');
   const wait=async i=>{await p.waitForFunction(i=>document.querySelector('.archive-row[aria-current]')?.dataset.index===String(i),i);await p.waitForFunction(src=>{const n=document.querySelector('.archive-background').firstElementChild;return n&&(n.currentSrc||n.src).split('?')[0]===src.split('?')[0]&&(n.tagName==='VIDEO'?n.readyState>=2:n.complete&&n.naturalWidth>0);},entries[i].src);};
   const black=async()=>{assert.equal(await p.locator('.archive-background > img,.archive-background > video').count(),0);assert.equal(await p.locator('.archive-background').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(0, 0, 0)');};
   if(width>700){
    await black();assert.equal(await selected().count(),0);await p.screenshot({path:path.join(out,engine+'-index-initial-black.png')});
    await p.locator('.archive-row').nth(0).hover();await wait(0);const firstRequests=requests.filter(u=>u.split('?')[0]===entries[0].src.split('?')[0]).length;
    await p.locator('.work-toggle').hover();await black();
    await p.locator('.work-submenu a').first().hover();await black();
    const gap=await p.locator('.work-submenu a').evaluateAll(ns=>{const a=ns[0].getBoundingClientRect(),b=ns[1].getBoundingClientRect();return {x:a.left+10,y:(a.bottom+b.top)/2};});await p.mouse.move(gap.x,gap.y);await black();
    await p.mouse.move(1400,895);await black();
    await p.locator('.archive-row').nth(0).hover();await wait(0);assert.equal(requests.filter(u=>u.split('?')[0]===entries[0].src.split('?')[0]).length,firstRequests,'cached image reused after navigation');
    const videoIndex=entries.findIndex(e=>e.type==='mp4');await p.locator('.archive-row').nth(videoIndex).hover();await wait(videoIndex);const v=await p.locator('.archive-background video').elementHandle();await p.waitForFunction(v=>!v.paused&&v.currentTime>0,v);
    await p.locator('.main-nav [href="#info"]').hover();await black();assert.ok(await v.evaluate(v=>v.paused&&!v.isConnected),'hidden video stops playing');
    await p.locator('.archive-row').nth(videoIndex).hover();await wait(videoIndex);await p.waitForFunction(()=>!document.querySelector('.archive-background video').paused);
    // Delay a real cold asset; navigating before decode must keep the canvas black.
    const cold=14,assetPath=new URL(entries[cold].src).pathname;let release;const gate=new Promise(r=>release=r);
    await p.route(u=>u.hostname==='cdn.sanity.io'&&u.pathname===assetPath,async r=>{await gate;return r.continue();});
    await p.locator('.archive-row').nth(cold).hover();await p.locator('.work-toggle').hover();await black();release();await p.waitForTimeout(600);await black();
    await p.locator('.work-submenu a').first().click();await p.waitForSelector('.work');
    await p.locator('.project-preview:not([hidden]) .project-link').first().click({position:{x:100,y:100}});await p.waitForSelector('.detail');
    await p.locator('.header-overview').click();await p.waitForSelector('.work');await p.waitForFunction(()=>document.querySelector('#app').style.visibility!=='hidden');
    await p.evaluate(()=>location.hash='#archive');await p.waitForSelector('.archive[data-prepared="true"]');await black();
   }else{
    await wait(0);const row=i=>p.locator(`.archive-row[data-index="${i}"]:not([inert])`).first();await row(3).tap();await wait(3);
    const swipe=async direction=>p.evaluate(direction=>{const n=document.querySelector('.archive');for(const [type,y]of [['pointerdown',500],['pointermove',500-direction*100],['pointerup',500-direction*100]])n.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:200,clientY:y}));},direction);
    await swipe(1);await wait(4);await p.waitForTimeout(450);await row(8).tap();await wait(8);await swipe(-1);await wait(7);await p.waitForTimeout(450);
    const alignment=await selected().evaluate(n=>n.getBoundingClientRect().top-document.querySelector('.archive-list').getBoundingClientRect().top);assert.ok(Math.abs(alignment)<.2);results.index.push({width,mobileSequence:[0,3,4,8,7]});
   }
   results.index.push({width,passed:true});await p.close();
  }
  assert.deepEqual(results.errors,[]);assert.deepEqual(results.writes,[]);assert.deepEqual(results.httpErrors,[]);
 }finally{fs.writeFileSync(path.join(out,engine+(process.env.FINAL_INDEX_ONLY?'-index-interactions.json':'-verification.json')),JSON.stringify(results,null,2));await browser.close();}
});
