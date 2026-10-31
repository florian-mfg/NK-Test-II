// Opt-in verification only: local source, published GETs and real CDN media.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=process.env.SANITY_PERFORMANCE_REPORT_DIR||path.join(__dirname,'..','reports','sanity-live-verification','performance');
const base=process.env.SITE_BASE_URL||'http://127.0.0.1:5500/';
for(const engine of ['chromium','webkit'])for(const mobile of [false,true])for(const slow of [false,true])test(`${engine}: real Sanity Index ${mobile?'mobile':'desktop'} / ${slow?'constrained':'normal'}`,{skip:!process.env.LIVE_SANITY_INDEX_TEST,timeout:360000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const result={engine,mobile,slow,profile:slow?(engine==='chromium'?'1.5Mbps download, 750Kbps upload, 150ms latency via CDP':'750ms added CDN request latency; bandwidth unshaped; routing disables HTTP cache'):'normal network; fresh browser context',entries:[],errors:[],httpErrors:[],requests:[],responses:[],progress:[],failedRequests:[]};
 let page,session;
 try{
  page=await browser.newPage({viewport:{width:mobile?390:1440,height:mobile?844:900},hasTouch:mobile,isMobile:mobile,serviceWorkers:'block'});page.setDefaultTimeout(25000);
  page.on('pageerror',e=>result.errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('sanity.io'))result.requests.push({url:r.url(),method:r.method(),range:r.headers()['range']||null,time:Date.now()});});
  page.on('requestfailed',r=>result.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
  page.on('response',r=>{if(r.url().includes('cdn.sanity.io'))result.responses.push({url:r.url(),status:r.status(),range:r.headers()['content-range']||null,length:r.headers()['content-length']||null,time:Date.now()});if(r.status()>=400)result.httpErrors.push({url:r.url(),status:r.status()});});
  if(engine==='chromium'){
   session=await page.context().newCDPSession(page);await session.send('Network.enable');
   result.encodedBytes=0;session.on('Network.loadingFinished',e=>{result.encodedBytes+=e.encodedDataLength||0;});
   if(slow)await session.send('Network.emulateNetworkConditions',{offline:false,downloadThroughput:1500000/8,uploadThroughput:750000/8,latency:150});
  }else if(slow)await page.route('https://cdn.sanity.io/**',async r=>{await new Promise(resolve=>setTimeout(resolve,750));await r.continue().catch(()=>{});});
  await page.addInitScript(()=>{
   window.videoEvents=[];const create=document.createElement.bind(document);document.createElement=function(tag,...args){const n=create(tag,...args);if(tag==='video')for(const event of ['loadedmetadata','loadeddata','play','playing','pause','waiting','stalled','error','suspend'])n.addEventListener(event,()=>videoEvents.push({event,time:performance.now(),src:n.currentSrc||n.src,t:n.currentTime,ready:n.readyState,network:n.networkState,paused:n.paused,error:n.error?.message||null}));return n;};
   window.indexAudit={progress:[],blankFrames:0,samples:0,maxImages:0,maxVideos:0,maxImageJobs:0,maxVideoJobs:0};
   new MutationObserver(records=>{for(const r of records)if(r.target.matches?.('.index-loading-indicator')&&r.attributeName==='aria-valuenow')indexAudit.progress.push(+r.target.getAttribute('aria-valuenow'));}).observe(document,{subtree:true,attributes:true,attributeFilter:['aria-valuenow']});
   const sample=()=>{
    if(document.querySelector('.archive[data-prepared="true"]')){
     const n=document.querySelector('.archive-background')?.firstElementChild;
     indexAudit.samples++;if(!n)indexAudit.blankFrames++;
     if(typeof indexMediaCache!=='undefined'){
      const all=[...indexMediaCache.values()];
      indexAudit.maxImages=Math.max(indexAudit.maxImages,all.filter(r=>r.ready&&r.media.type==='image').length);
      indexAudit.maxVideos=Math.max(indexAudit.maxVideos,all.filter(r=>r.ready&&r.media.type==='mp4').length);
      indexAudit.maxImageJobs=Math.max(indexAudit.maxImageJobs,indexImagesRunning);indexAudit.maxVideoJobs=Math.max(indexAudit.maxVideoJobs,indexVideosRunning);
     }
    }
    requestAnimationFrame(sample);
   };requestAnimationFrame(sample);
  });
  const start=Date.now();
  await page.goto(base+'#archive',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.archive[data-source="sanity"]');result.cmsAndLayoutMs=Date.now()-start;
  const initialRequests=result.requests.length;
  if(await page.locator('.index-loading-indicator').count()){
   result.bar=await page.locator('.index-loading-indicator').evaluate(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n),f=n.firstElementChild;return{width:r.width,height:r.height,bottom:innerHeight-r.bottom,fill:getComputedStyle(f).backgroundColor,track:s.backgroundColor};});
   // Trusted input while busy must not select an unprepared entry.
   if(mobile)await page.touchscreen.tap(350,650);else await page.mouse.click(500,100);
  }
  await page.waitForSelector('.archive[data-prepared="true"]',{timeout:30000});result.navigationReadyMs=Date.now()-start;
  assert.equal(await page.locator('.archive-row[aria-current]').getAttribute('data-index'),'0');
  assert.equal(await page.locator('.index-loading-indicator').count(),0);
  const entries=await page.evaluate(()=>sanityContent.indexPage.entries.map(e=>({key:e.key,title:e.title,media:e.media.map(m=>({type:m.type,src:indexMediaSource(m)}))})));
  result.count=entries.length;result.initialMediaRequests=result.requests.filter(r=>r.url.includes('cdn.sanity.io')).length;
  assert.ok(entries.length>0,'published Index entries remain CMS driven');
  assert.deepEqual(await page.locator('.archive-row:not([data-repeat]) > span:first-child').allTextContents(),entries.map(e=>e.title));
  const waitMedia=async(i,frame=0)=>{
   const expected=entries[i].media[frame];
   await page.waitForFunction(({src,type})=>{
    const n=document.querySelector('.archive-background')?.firstElementChild;
    return n?.getAttribute('src')===src&&(type==='mp4'?n.readyState>=2:n.complete&&n.naturalWidth>0);
   },expected,{timeout:16000});
   if(expected.type==='mp4')await page.waitForFunction(()=>document.querySelector('.archive-background video')?.currentTime>0,{},{timeout:8000});
  };
  await waitMedia(0);result.firstVisibleByMs=Date.now()-start;
  const count=slow?Math.min(8,entries.length):entries.length;
  for(let i=0;i<count;i++){
   const since=Date.now();
   try{
    if(i){
     if(mobile){await page.touchscreen.tap(350,650);await page.waitForFunction(i=>document.querySelector('.archive').dataset.activeProject===String(i)&&!document.querySelector('.archive-list-track').classList.contains('is-moving'),i,{timeout:16000});}
     else {const row=page.locator('.archive-row:not([data-repeat])').nth(i);await row.scrollIntoViewIfNeeded();await row.hover();}
    }
    await waitMedia(i);
    const node=await page.locator('.archive-background > :first-child').evaluate(n=>({type:n.tagName,width:n.naturalWidth||n.videoWidth,height:n.naturalHeight||n.videoHeight,error:n.error?.message||null,muted:n.muted,paused:n.paused}));
    result.entries.push({i,title:entries[i].title,elapsedMs:Date.now()-since,node});
    if(!mobile&&!slow)for(let frame=1;frame<entries[i].media.length;frame++){
     const t=Date.now();await page.locator('.archive-row:not([data-repeat])').nth(i).click();await waitMedia(i,frame);result.entries.push({i,frame,title:entries[i].title,elapsedMs:Date.now()-t});
    }
   }catch(e){const state=await page.evaluate(()=>{const n=document.querySelector('.archive-background video');return n?{src:n.src,time:n.currentTime,ready:n.readyState,network:n.networkState,paused:n.paused,error:n.error?.message||null,buffered:Array.from({length:n.buffered.length},(_,i)=>[n.buffered.start(i),n.buffered.end(i)])}:null});result.entries.push({i,title:entries[i].title,elapsedMs:Date.now()-since,error:e.message,state});}
  }
  if(mobile){
   const active=+await page.locator('.archive-row[aria-current]').getAttribute('data-index'),target=(active+5)%entries.length;
   for(let n=0;n<5;n++)await page.touchscreen.tap(350,650);
   await page.waitForFunction(target=>document.querySelector('.archive').dataset.activeProject===String(target)&&!document.querySelector('.archive-list-track').classList.contains('is-moving'),target,{timeout:25000});await waitMedia(target);result.rapidTapTarget=target;
  }
  result.audit=await page.evaluate(()=>indexAudit);result.videoEvents=await page.evaluate(()=>videoEvents);
  result.progress=result.audit.progress;
  assert.ok(result.progress.every((v,i)=>!i||v>=result.progress[i-1]));
  assert.equal(result.audit.blankFrames,0);
  assert.ok(result.audit.maxImages<=8);assert.ok(result.audit.maxVideos<=2);assert.ok(result.audit.maxImageJobs<=2);assert.ok(result.audit.maxVideoJobs<=1);
  const resident=await page.evaluate(()=>[...indexMediaCache.values()].filter(r=>r.ready).map(r=>r.node.src));
  const beforeReturn=result.requests.length,t=Date.now();await page.goto(base+'#info');await page.goto(base+'#archive',{waitUntil:'domcontentloaded'});await page.waitForSelector('.archive[data-prepared="true"]',{timeout:30000});await waitMedia(0);
  result.returnMs=Date.now()-t;result.residentBeforeReturn=resident;result.returnRequests=result.requests.slice(beforeReturn);
  if(session)result.heap=await session.send('Runtime.getHeapUsage');
  result.duplicates=Object.entries(result.requests.filter(r=>r.url.includes('cdn.sanity.io')).reduce((a,r)=>(a[r.url]=(a[r.url]||0)+1,a),{})).filter(([,n])=>n>1);
  assert.ok(result.requests.every(r=>['GET','HEAD','OPTIONS'].includes(r.method)));
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.httpErrors,[]);
  assert.equal(result.entries.filter(e=>e.error).length,0,JSON.stringify(result.entries.filter(e=>e.error)));
 }finally{
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`${engine}-${mobile?'mobile':'desktop'}-${slow?'slow':'normal'}.json`),JSON.stringify(result,null,2));
  console.log(JSON.stringify({engine,mobile,slow,readyMs:result.navigationReadyMs,initialRequests:result.initialMediaRequests,entries:result.entries.length,failures:result.entries.filter(e=>e.error).length,blankFrames:result.audit?.blankFrames,httpErrors:result.httpErrors,errors:result.errors}));
  await browser.close();
 }
});
