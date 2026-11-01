// Opt-in release verification: raw local files or real deployed source, with live Sanity GETs.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),out=process.env.RELEASE_REPORT_DIR||path.join(require('node:os').tmpdir(),'nk-release-browser'),base=process.env.RELEASE_BASE_URL||'http://127.0.0.1:5500/';
const adapter=require('../sanity-data.js');
const crypto=require('node:crypto');
for(const engine of ['chromium','webkit'])test(`${engine}: recent local changes with live production content`,{skip:!process.env.RELEASE_TEST,timeout:360000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core'),browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const result={engine,checks:[],failures:[],requests:{queries:0,writes:[],httpErrors:[],assetFailures:[]},viewports:[]};
 fs.mkdirSync(out,{recursive:true});
 const sourceTasks=[];result.productionSources=[];
 const expected=adapter.normalize(await require('./sanity-readonly.cjs').publishedContent());
 const check=async(name,fn)=>{try{const data=await fn();result.checks.push({name,data});console.log(engine,'PASS',name);}catch(e){result.failures.push({name,error:e.message,stack:e.stack});console.log(engine,'FAIL',name,e.message);}};
 try{for(const width of [1440,390]){
  const height=width===390?844:900,page=await browser.newPage({viewport:{width,height},hasTouch:width<=700,isMobile:width<=700});page.setDefaultTimeout(45000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/data/query/'))result.requests.queries++;if(r.status()>=400)result.requests.httpErrors.push({url:r.url().split('?')[0],status:r.status()});});
  if(process.env.RELEASE_BASE_URL)page.on('response',response=>{
   const u=new URL(response.url()),origin=new URL(base),file=u.pathname===origin.pathname?'index.html':u.pathname.slice(origin.pathname.length);
   if(u.origin!==origin.origin||!['index.html','style.css','app.js','frontpage-boot.js','projects.js','project-modules.js','project-video.js','project-categories.js','sanity-data.js','contrast.js','frontpage-media.js','frontpage-loading.js','frontpage-media-fade.js'].includes(file))return;
   sourceTasks.push((async()=>{try{const bytes=await response.body(),hash=b=>crypto.createHash('sha256').update(b).digest('hex');result.productionSources.push({file,status:response.status(),matches:hash(bytes)===hash(fs.readFileSync(path.join(root,file)))});}catch(error){result.productionSources.push({file,matches:false,error:error.message});}})());
  });
  page.on('requestfailed',r=>{if(r.url().includes('sanity.io'))result.requests.assetFailures.push({url:r.url().split('?')[0],error:r.failure()?.errorText});});
  await page.route('**/*',route=>{
   if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){result.requests.writes.push(route.request().url());return route.abort();}
   const u=new URL(route.request().url());
   // Serve raw local source, excluding the existing preview server's live-reload injection.
   if(!process.env.RELEASE_BASE_URL&&u.origin===new URL(base).origin){const file=u.pathname==='/'?'index.html':u.pathname.slice(1);const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml'}[path.extname(file)];return route.fulfill({path:path.join(root,file),...(type?{contentType:type}:{})});}
   return route.continue();
  });
  const go=async hash=>{await page.evaluate(h=>location.hash=h,hash);await page.waitForFunction(()=>sanityLoadSettled);};
  await page.goto(base+'#info',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>sanityLoadSettled&&!!sanityContent?.infoPage);await page.evaluate(()=>document.fonts.ready);
  await check(`${width}: live content and Info footer`,async()=>{
   const state=await page.evaluate(()=>({issues:sanityContent.issues,projectIds:sanityContent.projects.map(p=>p.id),index:sanityContent.indexPage.entries.map(e=>e.title),footer:[...document.querySelectorAll('.project-footer-links a')].map(a=>({text:a.textContent,href:a.getAttribute('href')})),contacts:[...document.querySelectorAll('.info-contact a')].map(a=>a.href),credit:document.querySelector('.info-footer-credit').textContent}));
   assert.deepEqual(state.issues,[]);assert.deepEqual(state.projectIds,expected.projects.map(p=>p.id));assert.deepEqual(state.index,expected.indexPage.entries.map(e=>e.title));assert.deepEqual(state.footer,[{text:'Imprint',href:'#imprint'},{text:'Privacy Policy',href:'#privacy-policy'}]);assert.ok(state.contacts.includes(expected.siteSettings.contacts.email.href));assert.ok(state.contacts.includes(expected.siteSettings.contacts.instagram.href));assert.match(state.credit,/Webdesign/);return state;
  });
  await check(`${width}: Frontpage preparation and glass`,async()=>{
   await go('#home');await page.waitForFunction(()=>document.querySelector('.frontpage-fade')?.dataset.ready==='true',null,{timeout:90000});
   const preparation=await page.evaluate(()=>JSON.parse(document.querySelector('.frontpage-fade').dataset.preparation));assert.equal(preparation.length,expected.homePage.media.length);assert.ok(preparation.every(r=>r.status==='ready'));
   if(width>700){
    await page.mouse.move(400,200);await page.mouse.move(401,200);await page.waitForSelector('.frontpage-fade-media');
    await page.locator('.site-header .brand').hover();await page.waitForTimeout(250);
    const glass=await page.evaluate(()=>{const s=getComputedStyle(document.body,'::after');return {blur:s.backdropFilter||s.webkitBackdropFilter,bg:s.backgroundColor,opacity:s.opacity,width:s.width,height:s.height,pointer:s.pointerEvents};});
    assert.deepEqual(glass,{blur:'blur(6px)',bg:'rgba(255, 255, 255, 0.35)',opacity:'1',width:'1440px',height:'900px',pointer:'none'});
    await page.locator('.work-toggle').hover();await page.waitForTimeout(250);
    const points=await page.evaluate(()=>{const a=document.querySelector('.work-toggle').getBoundingClientRect(),links=[...document.querySelectorAll('.work-submenu a')].map(n=>n.getBoundingClientRect());return [[a.left+10,(a.bottom+links[0].top)/2],...links.flatMap((r,i)=>[[r.left+10,r.top+r.height/2],...(links[i+1]?[[r.left+10,(r.bottom+links[i+1].top)/2]]:[])])];});
    await page.evaluate(()=>{window.glassTrace=[];window.glassTracing=true;const loop=()=>{if(!glassTracing)return;glassTrace.push(+getComputedStyle(document.body,'::after').opacity);requestAnimationFrame(loop)};requestAnimationFrame(loop)});
    for(const [x,y]of points){await page.mouse.move(x,y,{steps:8});await page.waitForTimeout(100);}
    const trace=await page.evaluate(()=>{glassTracing=false;return glassTrace;});assert.ok(trace.length>10&&trace.every(v=>v===1),'no flicker across submenu gaps');
    assert.ok((await page.locator('.site-header :is(a,.work-toggle)').evaluateAll(ns=>ns.map(n=>getComputedStyle(n).color))).every(c=>c==='rgb(0, 0, 0)'));
    await page.screenshot({path:path.join(out,engine+'-home-glass.png')});
    await page.mouse.move(1400,850);await page.waitForFunction(()=>getComputedStyle(document.body,'::after').opacity==='0',null,{timeout:3000});
   }else{assert.equal(await page.evaluate(()=>getComputedStyle(document.body,'::after').content),'none');await page.locator('.mobile-menu-toggle').tap();await page.waitForSelector('.mobile-menu[open]');await page.locator('.mobile-menu-close').tap();}
   return {preparation:preparation.map(p=>({status:p.status})),liveMediaTypes:[...new Set(expected.homePage.media.map(m=>m.type))]};
  });
  await check(`${width}: project arrow, module endings and playback`,async()=>{
   const projects=[];let playback=null;
   for(const project of expected.projects.filter(p=>p.detailPageEnabled!==false)){
    console.log(engine,width,'project',project.id);
    await go('#project/'+project.id);await page.waitForSelector(`.detail[data-project-id="${project.id}"]`);
    assert.equal(await page.locator('.overview-arrow').textContent(),'←');assert.equal(await page.locator('.project-footer').count(),0);
    const modules=(project.detailModules||project.modules).filter(Boolean);assert.deepEqual(await page.locator('.detail .project-module').evaluateAll(ns=>ns.map(n=>n.dataset.moduleType)),modules.map(m=>m.type));
    const last=page.locator('.project-module').last();await last.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>[...document.querySelector('.project-modules').lastElementChild.querySelectorAll('img:not(.project-video-poster)')].every(n=>n.complete&&n.naturalWidth>0));
    if(await last.locator('video').count())await page.waitForFunction(()=>[...document.querySelector('.project-modules').lastElementChild.querySelectorAll('video')].every(v=>v.readyState>=1));
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
    const end=await last.evaluate(n=>({last:n.getBoundingClientRect().bottom+scrollY,detail:document.querySelector('.detail').getBoundingClientRect().bottom+scrollY,document:document.documentElement.scrollHeight,viewport:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}));
    assert.ok(Math.abs(end.last-end.detail)<.1,JSON.stringify({id:project.id,end}));assert.ok(Math.abs(end.document-Math.max(end.viewport,end.last))<=1,JSON.stringify({id:project.id,end}));assert.equal(end.overflow,false);
    if(!playback&&await page.locator('.detail video').count()){
     const video=page.locator('.detail video').first();await video.locator('..').evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));
     const button=video.locator('..').locator('.project-video-toggle');if(await button.count()){await page.waitForFunction(v=>v.readyState>=2,await video.elementHandle());if(await video.locator('..').getAttribute('data-playback')!=='autoplay'&&await video.evaluate(v=>v.paused))await button.click();}
     await page.waitForFunction(v=>!v.paused&&v.currentTime>0,await video.elementHandle());playback=await video.evaluate(v=>({source:v.currentSrc,time:v.currentTime,width:v.videoWidth,height:v.videoHeight,error:v.error?.message||null}));
    }
    projects.push({id:project.id,end});
   }
   assert.ok(playback);
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   await page.waitForFunction(()=>!document.querySelector('.site-header').classList.contains('is-hidden'));
   const overview=await page.locator('.header-overview').getAttribute('href');
   await page.locator('.header-overview').click();await page.waitForSelector('.work');
   assert.equal(new URL(page.url()).hash,overview);
   return {projects,playback,overview};
  });
  await check(`${width}: Index loading, background and interactions`,async()=>{
   await go('#archive');await page.waitForSelector('.archive[data-source="sanity"][data-prepared="true"]',{timeout:90000});assert.equal(await page.locator('.index-loading-indicator').count(),0);
   if(width>700){
    assert.equal(await page.locator('.archive-background > img,.archive-background > video').count(),0,'desktop starts with the list on black');
    await page.locator('.archive-row').first().hover();await page.waitForSelector('.archive-background img');
    const colors=await page.evaluate(()=>[document.documentElement,document.body,document.querySelector('#app'),document.querySelector('.archive'),document.querySelector('.archive-background')].map(n=>getComputedStyle(n).backgroundColor));assert.deepEqual(colors,Array(5).fill('rgb(0, 0, 0)'));
    const shot=await page.screenshot({path:path.join(out,engine+'-desktop-index.png')});
    const pixels=await page.evaluate(async data=>{const i=new Image();i.src='data:image/png;base64,'+data;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);const image=document.querySelector('.archive-background img').getBoundingClientRect();let count=0,bad=0;for(let px=0;px<c.width;px++){if(px>=image.left&&px<=image.right)continue;count++;const p=x.getImageData(px,0,1,1).data;if(p[0]||p[1]||p[2])bad++;}return {count,bad};},shot.toString('base64'));assert.ok(pixels.count>0);assert.equal(pixels.bad,0,'uncovered top edge has no white line');
    await page.locator('.archive-row').nth(3).hover();await page.waitForFunction(()=>document.querySelector('.archive-row[aria-current]')?.dataset.index==='3');await page.waitForFunction(()=>{const v=document.querySelector('.archive-background video');return v&&!v.paused&&v.currentTime>0;});return {colors,topEdge:pixels};
   }
   const type=await page.evaluate(()=>{const pick=n=>{const s=getComputedStyle(n);return [s.fontFamily,s.fontSize,s.fontWeight]};return {logo:pick(document.querySelector('.site-header .brand')),rows:[...document.querySelectorAll('.archive-row > span:first-child')].map(pick)};});assert.ok(type.rows.every(r=>JSON.stringify(r)===JSON.stringify(type.logo)));
   await page.evaluate(()=>{window.syncSamples=[];window.traceIndex=true;window.commits=[];new MutationObserver(rs=>rs.forEach(()=>commits.push(+document.querySelector('.archive').dataset.activeProject))).observe(document.querySelector('.archive'),{attributes:true,attributeFilter:['data-active-project']});const loop=()=>{if(!traceIndex)return;const a=document.querySelector('.archive'),m=a.querySelector('.archive-background'),r=a.querySelector('.archive-row[aria-current]');if(r)syncSamples.push({index:+a.dataset.activeProject,media:+m.dataset.projectIndex,title:r.firstElementChild.textContent});requestAnimationFrame(loop)};requestAnimationFrame(loop)});
   const settle=async i=>{await page.waitForFunction(i=>document.querySelector('.archive').dataset.activeProject===String(i)&&!document.querySelector('.archive-list-track').classList.contains('is-moving'),i);const s=await page.evaluate(()=>{const row=document.querySelector('.archive-row[aria-current]'),media=document.querySelector('.archive-background').firstElementChild;return {index:+row.dataset.index,title:row.firstElementChild.textContent,source:media.currentSrc||media.src,ready:media.tagName==='VIDEO'?media.readyState>=2:media.complete&&media.naturalWidth>0,top:row.getBoundingClientRect().top,listTop:document.querySelector('.archive-list').getBoundingClientRect().top}});assert.equal(s.title,expected.indexPage.entries[i].title);assert.equal(new URL(s.source).origin+new URL(s.source).pathname,new URL(expected.indexPage.entries[i].media[0].src).origin+new URL(expected.indexPage.entries[i].media[0].src).pathname);assert.ok(s.ready);assert.ok(Math.abs(s.top-s.listTop)<.2);return s;};
   const gesture=async(direction,index=null)=>page.evaluate(({direction,index})=>{const n=index===null?document.querySelector('.archive'):document.querySelector(`.archive-row[data-index="${index}"]:not([inert])`),r=n.getBoundingClientRect(),x=index===null?200:r.left+r.width/2,y=index===null?500:r.top+r.height/2;for(const [type,dy]of [['pointerdown',0],['pointermove',direction* -100],['pointerup',direction* -100]])n.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y+dy}));n.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));},{direction,index});
   const row=i=>page.locator(`.archive-row[data-index="${i}"]:not([inert])`).first();
   await settle(0);await row(3).locator('span').first().tap();await page.waitForFunction(()=>document.querySelector('.archive-list-track').classList.contains('is-moving'));const y=await page.locator('.archive-row[aria-current]').evaluate(n=>n.getBoundingClientRect().top);await page.waitForTimeout(80);assert.ok(await page.locator('.archive-row[aria-current]').evaluate((n,y)=>n.getBoundingClientRect().top<y,y),'smooth tap alignment');await settle(3);
   await gesture(1);await settle(4);await gesture(-1);await settle(3);await row(8).tap();await settle(8);
   const before=await page.evaluate(()=>commits.length);await gesture(1);await gesture(0,12);await gesture(-1);await settle(11);assert.deepEqual(await page.evaluate(n=>commits.slice(n),before),[9,12,11]);
   await row(0).tap();await settle(0);await gesture(-1);await settle(37);await row(0).tap();await settle(0);
   const cycle=[];for(let i=1;i<=expected.indexPage.entries.length;i++){await gesture(1);cycle.push(await settle(i%expected.indexPage.entries.length));}
   const samples=await page.evaluate(()=>{traceIndex=false;return syncSamples;});assert.ok(samples.every(s=>s.index===s.media&&s.title===sanityTitle(s.index)),'title/media synchronized');
   function sanityTitle(i){return expected.indexPage.entries[i].title;}
   const cache=await page.evaluate(()=>({images:[...indexMediaCache.values()].filter(r=>r.media.type==='image').length,videos:[...indexMediaCache.values()].filter(r=>r.media.type==='mp4').length,concurrency:[indexImagesRunning,indexVideosRunning]}));assert.ok(cache.images<=8&&cache.videos<=2&&cache.concurrency[0]<=2&&cache.concurrency[1]<=1);
   await page.screenshot({path:path.join(out,engine+'-mobile-index.png')});return {logo:type.logo,cycleCount:cycle.length,syncSamples:samples.length,cache};
  });
  for(const viewport of (width<=700?[{width:320,height:568},{width:430,height:932}]:[{width:760,height:900}])){await page.setViewportSize(viewport);await page.waitForTimeout(100);result.viewports.push({...viewport,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
  await check(`${width}: no runtime exceptions`,async()=>{assert.deepEqual(errors,[]);return errors;});await page.close();
 }
 await Promise.all(sourceTasks);
 if(process.env.RELEASE_BASE_URL){assert.ok(result.productionSources.length>=13);assert.ok(result.productionSources.every(s=>s.status===200&&s.matches),'production source matches checkout');}
 assert.deepEqual(result.requests.writes,[]);assert.deepEqual(result.requests.httpErrors,[]);assert.ok(result.requests.queries>0);assert.ok(result.viewports.every(v=>!v.overflow));assert.deepEqual(result.failures,[]);
 }finally{fs.writeFileSync(path.join(out,engine+'-recent-changes-final.json'),JSON.stringify(result,null,2));await browser.close();}
});
