'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const enabled=process.env.LOCAL_RELEASE_TEST||process.env.LIVE_RELEASE_TEST;
const local=!!process.env.LOCAL_RELEASE_TEST,root=path.join(__dirname,'..');
const base=process.env.SITE_BASE_URL||'https://florian-mfg.github.io/NK-Test-II/';
const localRoute = base+'**';
const localFile = url => {const relative=new URL(url).pathname.slice(new URL(base).pathname.length);return path.join(root,relative||'index.html');};
const output=process.env.RELEASE_REPORT_DIR||'/tmp/nk-release-verification';
fs.mkdirSync(output,{recursive:true});
const connected=(a,b)=>((Math.abs(a.x+a.w-b.x)<.1||Math.abs(b.x+b.w-a.x)<.1)&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.05)||((Math.abs(a.y+a.h-b.y)<.1||Math.abs(b.y+b.h-a.y)<.1)&&Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.05);
for(const engine of ['chromium','webkit'])test(`${local?'local':'LIVE'} release: real Sanity, brush and two complete mobile Index loops (${engine})`,{skip:!enabled,timeout:360000},async()=>{
 const p=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await p[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(local)await page.route(localRoute,r=>{const u=new URL(r.request().url());return r.fulfill({path:localFile(r.request().url()),contentType:({'.woff':'font/woff','.woff2':'font/woff2'})[path.extname(u.pathname)]});});
 await page.goto(base+'#home',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof sanityLoadSettled!=='undefined'&&sanityLoadSettled,{timeout:45000});
 const cms=await page.evaluate(async()=>{const r=await SanityData.load({timeoutMs:45000});return {ok:r.ok,error:r.error,home:r.data?.homePage?.media,index:r.data?.indexPage?.entries,projectCount:r.data?.projects?.length};});
 assert.ok(cms.ok,JSON.stringify(cms.error));assert.ok(cms.index?.length,'published Index entries available');
 const snapshot=await page.request.get('https://ck6xe2er.api.sanity.io/v2025-02-19/data/query/production',{params:{query:'*[] | order(_id asc) {_id,_rev,_type,_updatedAt}',perspective:'published'},timeout:45000});
 assert.ok(snapshot.ok());const documents=(await snapshot.json()).result;assert.ok(Array.isArray(documents)&&documents.length);
 const digest=crypto.createHash('sha256').update(JSON.stringify(documents)).digest('hex');
 const before=path.join(output,'sanity-before.json');
 if(local&&engine==='chromium')fs.writeFileSync(before,JSON.stringify(documents,null,2));
 if(!local)assert.deepEqual(documents,JSON.parse(fs.readFileSync(before,'utf8')),'published document/asset revisions unchanged since preflight');
 const sequence=cms.home||await page.evaluate(()=>FrontpageMedia);
 assert.ok(sequence.length,'Frontpage media available');
 await page.waitForFunction(()=>document.querySelector('.frontpage-fade')?.dataset.maxCursorDistance);
 if(cms.home)assert.equal(await page.locator('.frontpage-fade').getAttribute('data-source'),'sanity');
 await page.evaluate(()=>{
 window.releaseMarks=[];const layer=document.querySelector('.frontpage-fade'),append=layer.append.bind(layer);
 const rect=n=>({serial:+n.dataset.serial,index:+n.dataset.sequence,x:parseFloat(n.style.left),y:parseFloat(n.style.top),w:parseFloat(n.style.width),h:parseFloat(n.style.height),stamp:{x:+n.dataset.brushX,y:+n.dataset.brushY},opacity:n.style.opacity});
 layer.append=function(n){const before=[...layer.children].map(rect);append(n);releaseMarks.push({rect:rect(n),before,count:layer.children.length});};
 });
 const trajectory=[[180,170],[1240,170],[1240,320],[350,320],[350,740],[1150,740]];
 for(const [x,y]of trajectory)await page.mouse.move(x,y,{steps:18});
 const brush=await page.evaluate(()=>({marks:releaseMarks,limit:+document.querySelector('.frontpage-fade').dataset.maxCursorDistance,count:document.querySelector('.frontpage-fade').children.length,html:document.querySelector('.frontpage-fade').innerHTML}));
 assert.ok(brush.marks.length>=7);assert.equal(brush.count,6);
 for(const {rect:a,before,count}of brush.marks){
 assert.ok(count<=6);assert.equal(a.opacity,'1');assert.equal(a.index,a.serial%sequence.length);
 assert.ok(Math.hypot(a.x+a.w/2-a.stamp.x,a.y+a.h/2-a.stamp.y)<=brush.limit+.05);
 if(before.length)assert.ok(before.some(b=>connected(a,b)));
 assert.ok(before.every(b=>!(a.x<b.x+b.w-.05&&a.x+a.w>b.x+.05&&a.y<b.y+b.h-.05&&a.y+a.h>b.y+.05)));
 }
 const serials=await page.locator('.frontpage-fade-media').evaluateAll(ns=>ns.map(n=>+n.dataset.serial));assert.deepEqual(serials,Array.from({length:6},(_,i)=>brush.marks.at(-1).rect.serial-5+i));
 await page.waitForTimeout(100);assert.equal(await page.locator('.frontpage-fade').innerHTML(),brush.html);
 await page.screenshot({path:path.join(output,`${local?'local':'live'}-${engine}-brush.png`)});
 await page.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));
 if(local)await mobile.route(localRoute,r=>{const u=new URL(r.request().url());return r.fulfill({path:localFile(r.request().url()),contentType:({'.woff':'font/woff','.woff2':'font/woff2'})[path.extname(u.pathname)]});});
 await mobile.goto(base+'#archive',{waitUntil:'domcontentloaded'});await mobile.waitForSelector('.archive[data-source="sanity"]',{timeout:45000});
 const count=cms.index.length;assert.equal(await mobile.locator('.archive-row').count(),count);
 const trace=[];
 async function check(i){
 await mobile.waitForFunction(i=>+document.querySelector('.archive-row[aria-current]')?.dataset.index===i&&+document.querySelector('.archive-background')?.dataset.projectIndex===i,i,{timeout:45000});
 const s=await mobile.evaluate(()=>{const list=document.querySelector('.archive-list'),rs=[...list.querySelectorAll('.archive-row')],a=rs.find(r=>r.hasAttribute('aria-current')),i=+a.dataset.index,top=list.getBoundingClientRect().top,n=document.querySelector('.archive-background').firstElementChild,b=n.getBoundingClientRect();return {i,aligned:Math.abs(a.getBoundingClientRect().top-top)<.1,hidden:rs.slice(0,i).every(r=>r.inert&&r.getBoundingClientRect().bottom<=top+.1),remaining:rs.filter(r=>r.getBoundingClientRect().bottom>top+.1).length,italic:getComputedStyle(a.firstElementChild).fontStyle,src:n.getAttribute('src'),fit:getComputedStyle(n).objectFit,scroll:[scrollX,scrollY,list.scrollTop],coverage:[b.x,b.y,b.width,b.height]};});
 assert.equal(s.i,i);assert.ok(s.aligned&&s.hidden);assert.equal(s.remaining,count-i);assert.equal(s.italic,'italic');assert.equal(s.fit,'cover');assert.deepEqual(s.scroll,[0,0,0]);assert.deepEqual(s.coverage,[0,0,390,844]);
 assert.equal(s.src,cms.index[i].media[0].src);
 if(cms.index[i].media[0].type==='mp4')await mobile.waitForFunction(()=>{const v=document.querySelector('.archive-background video');return v?.readyState>=2&&!v.paused;},null,{timeout:45000});
 }
 await check(0);trace.push(0);await mobile.screenshot({path:path.join(output,`${local?'local':'live'}-${engine}-index-initial.png`)});
 for(let tap=1;tap<=count*2;tap++){
 await mobile.touchscreen.tap(200,760);const i=tap%count;await check(i);trace.push(i);
 if(tap===count-1||tap===count)await mobile.screenshot({path:path.join(output,`${local?'local':'live'}-${engine}-index-${tap===count?'loop':'final'}.png`)});
 }
 const sound=mobile.locator('.detail-sound-control');if(await sound.count()){await sound.tap();await check(0);await sound.tap();await check(0);}
 await mobile.locator('.mobile-menu-toggle').tap();await mobile.locator('.mobile-menu-close').tap();await check(0);
 assert.deepEqual(errors,[]);
 const summary={engine,local,base,frontpageSource:cms.home?'sanity':'local fallback',frontpageItems:sequence.length,brushMarks:brush.marks.length,maxVisible:brush.count,indexProjects:count,loops:2,tapIndices:trace,sanityDocuments:documents.length,sanityAssets:documents.filter(d=>d._type?.startsWith('sanity.')).length,sanityRevisionDigest:digest,errors};
 fs.writeFileSync(path.join(output,`${local?'local':'live'}-${engine}.json`),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 }finally{await browser.close();}
});
