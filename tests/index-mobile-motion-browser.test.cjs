'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
for(const engine of ['chromium','webkit'])test(`mobile animated circular strip: ${engine}`,{skip:!process.env.BROWSER_TEST,timeout:240000},async()=>{
 const p=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await p[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const site=process.env.SITE_BASE_URL;
 const root=path.join(__dirname,'..'),out=path.join(root,'reports/mobile-index-motion',site?'production-live':process.env.PUBLISHED_INDEX?'published':`fixture-${process.env.MOBILE_PROJECT_COUNT||28}`);fs.mkdirSync(out,{recursive:true});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const live=!!(process.env.PUBLISHED_INDEX||site);
 let published;
 if(live){const adapter=require('../sanity-data.js'),url=new URL(`https://${adapter.config.projectId}.apicdn.sanity.io/v${adapter.config.apiVersion}/data/query/${adapter.config.dataset}`);url.searchParams.set('query',adapter.query);url.searchParams.set('perspective','published');const response=await page.request.get(url.href);assert.ok(response.ok());published=await response.json();}
 const revisionsURL='https://ck6xe2er.api.sanity.io/v2025-02-19/data/query/production?perspective=published&query='+encodeURIComponent('*[!(_id in path("drafts.**")) && !(_id in path("versions.**"))] | order(_id asc) {_id,_rev}');
 const revisions=async()=>{const response=await page.request.get(revisionsURL);assert.ok(response.ok());return (await response.json()).result;};
 const before=live?await revisions():null;
 if(live&&process.env.SANITY_BASELINE_PATH){const baseline=process.env.SANITY_BASELINE_PATH;if(fs.existsSync(baseline))assert.deepEqual(before,JSON.parse(fs.readFileSync(baseline,'utf8')),'published Sanity document revisions match pre-deployment snapshot');else fs.writeFileSync(baseline,JSON.stringify(before));}
 const video=live?null:await require('./native-media-fixture.cjs').recordMP4(page);
 const entries=Array.from({length:Number(process.env.MOBILE_PROJECT_COUNT)||28},(_,i)=>({displayTitle:i===4?'Project 5 with a deliberately long title that wraps across several lines on this mobile screen':`Project ${i+1}`,previewImages:[i===2?{mediaType:'mp4',video:{asset:{_id:'file-demo-mp4',url:'https://cdn.sanity.io/files/ck6xe2er/production/demo.mp4'}}}:{mediaType:'image',image:{asset:{_id:`image-p${i}-800x1200-svg`,url:`https://cdn.sanity.io/images/ck6xe2er/production/p${i}.svg`,metadata:{dimensions:{width:800,height:1200}}}}}]}));
 if(!site)await page.route('**/*',r=>{const u=new URL(r.request().url());if(live&&u.hostname.endsWith('apicdn.sanity.io'))return r.fulfill({json:published});if(live&&u.hostname==='cdn.sanity.io')return r.continue();if(u.hostname.endsWith('apicdn.sanity.io'))return r.fulfill({json:{result:{projects:[],indexPage:{_id:'indexPage',_type:'indexPage',entries}}}});if(u.hostname==='cdn.sanity.io')return u.pathname.endsWith('.mp4')?r.fulfill({body:video,contentType:'video/mp4'}):r.fulfill({body:`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="hsl(${parseInt(u.pathname.match(/p(\d+)/)[1])*19} 40% 30%)"/></svg>`,contentType:'image/svg+xml'});if(u.hostname==='preview.test')return r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname)});return r.abort();});
 await page.goto(site?`${site}#archive`:'https://preview.test/#archive');await page.waitForSelector('.archive[data-source="sanity"]');await page.waitForSelector('.archive[data-active-project="0"]');await page.evaluate(()=>document.fonts.ready);
 const sources=await page.evaluate(()=>sanityContent.indexPage.entries.map(e=>e.media.find(m=>m.src).src)),count=sources.length;assert.ok(count>0);
 const state=()=>page.evaluate(()=>{const l=document.querySelector('.archive-list'),t=l.firstElementChild,a=t.querySelector('[aria-current]'),bg=document.querySelector('.archive-background');return{i:+a.dataset.index,top:a.getBoundingClientRect().top-l.getBoundingClientRect().top,italic:getComputedStyle(a.firstElementChild).fontStyle,src:bg.firstElementChild?.getAttribute('src'),media:+bg.dataset.projectIndex,moving:t.classList.contains('is-moving'),count:t.children.length,scroll:[scrollX,scrollY,l.scrollTop]}});
 const settle=async i=>{await page.waitForFunction(i=>{const a=document.querySelector('.archive'),t=a.querySelector('.archive-list-track');return +a.dataset.activeProject===i&&!t.classList.contains('is-moving')},i,{timeout:45000}).catch(async e=>{console.log('settle failed',i,await state(),errors);throw e});const s=await state();assert.equal(s.i,i);assert.equal(s.media,i);assert.ok(Math.abs(s.top)<.2,JSON.stringify(s));assert.equal(s.italic,'italic');assert.deepEqual(s.scroll,[0,0,0]);assert.equal(s.src,sources[i]);return s;};
 const tapFree=async()=>{const point=await page.evaluate(()=>{const controls=[...document.querySelectorAll('button,a')].filter(n=>!n.inert).map(n=>n.getBoundingClientRect());for(let y=100;y<750;y+=50){const x=350;if(!controls.some(r=>x>r.left-35&&x<r.right+35&&y>r.top-35&&y<r.bottom+35))return{x,y};}throw Error('no free tap area');});await page.touchscreen.tap(point.x,point.y);};
 const initial=await settle(0),trace=[];
 for(let step=1;step<=count*3;step++){
 const prev=await page.locator('.archive-row[aria-current]').elementHandle();
 if(step===count){await page.evaluate(()=>{window.wrapFrames=[];window.captureWrap=true;const capture=()=>{if(!captureWrap)return;const a=document.querySelector('.archive-row[aria-current]'),l=document.querySelector('.archive-list'),last=l.firstElementChild.lastElementChild;wrapFrames.push({inMotion:l.firstElementChild.classList.contains('is-moving'),i:+a.dataset.index,y:a.getBoundingClientRect().top-l.getBoundingClientRect().top,bottom:last.getBoundingClientRect().bottom});requestAnimationFrame(capture);};requestAnimationFrame(capture);});const pair=await prev.evaluate(a=>({last:a.textContent,next:a.nextElementSibling.textContent,gap:a.nextElementSibling.getBoundingClientRect().top-a.getBoundingClientRect().bottom}));assert.ok(pair.next===await page.locator('.archive-row').first().textContent());assert.ok(Math.abs(pair.gap)<.2);await page.screenshot({path:path.join(out,`${engine}-wrap-before.png`)});}
 await tapFree();
 await page.waitForFunction(()=>document.querySelector('.archive-list-track').classList.contains('is-moving'),null,{timeout:45000}).catch(async e=>{console.log({step,state:await state(),errors,target:await page.evaluate(()=>document.elementFromPoint(300,500).outerHTML)});throw e});
 const y0=await prev.evaluate(a=>a.getBoundingClientRect().top);
 await page.waitForTimeout(80);const y1=await prev.evaluate(a=>a.getBoundingClientRect().top);assert.ok(y1<y0-1,'actual intermediate upward motion');
 const mid=await state();assert.ok(mid.top>0,'incoming row has not snapped to boundary');
 assert.equal(await page.locator('.archive-list-track').evaluate(t=>getComputedStyle(t).transitionDuration),'0.4s');
 if(step===count)await page.screenshot({path:path.join(out,`${engine}-wrap-during.png`)});
 const s=await settle(step%count);assert.equal(s.count,initial.count);trace.push(s.i);
 if(step===count){await page.screenshot({path:path.join(out,`${engine}-wrap-after.png`)});const samples=await page.evaluate(()=>{captureWrap=false;return wrapFrames});const first=samples.filter(s=>s.i===0&&s.inMotion);assert.ok(first.length>=8);assert.ok(first.every((s,i)=>s.y>=-.2&&(!i||s.y<=first[i-1].y+.2)));assert.ok(samples.every(s=>s.bottom>=844),'no bottom gap during wrap');fs.writeFileSync(path.join(out,`${engine}-wrap-frames.json`),JSON.stringify(samples,null,2));}
 }
 // Record every rapid queued activation, including its order.
 await page.evaluate(()=>{window.activationTrace=[];new MutationObserver(()=>activationTrace.push(+document.querySelector('.archive').dataset.activeProject)).observe(document.querySelector('.archive'),{attributes:true,attributeFilter:['data-active-project']});});
 for(let n=0;n<8;n++)await tapFree();await settle(8%count);assert.deepEqual(await page.evaluate(()=>activationTrace),Array.from({length:8},(_,i)=>(i+1)%count));
 if(await page.locator('.detail-sound-control').count()){await page.locator('.detail-sound-control').tap();await settle(8%count);await page.locator('.detail-sound-control').tap();await settle(8%count);}
 await page.locator('.mobile-menu-toggle').tap();await page.locator('.mobile-menu-close').tap();await settle(8%count);
 const target=await page.locator('.archive-row[aria-current]').evaluate(a=>+a.nextElementSibling.nextElementSibling.dataset.index);
 const position=await page.locator('.archive-row[aria-current]').evaluate(a=>[...a.parentNode.children].indexOf(a));
 await page.locator('.archive-row').nth(position+2).tap();await settle(target);await page.waitForTimeout(450);await settle(target);
 await page.emulateMedia({reducedMotion:'reduce'});await tapFree();await settle((target+1)%count);
 for(let n=0;n<200;n++){await tapFree();await settle((target+2+n)%count);}await settle((target+201)%count);assert.equal((await state()).count,initial.count);
 await page.evaluate(()=>{const n=document.querySelector('.archive');for(const [type,y] of [['pointerdown',700],['pointermove',400],['pointerup',400]])n.dispatchEvent(new PointerEvent(type,{bubbles:true,isPrimary:true,pointerId:99,button:0,clientX:300,clientY:y}));n.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));});await settle((target+201)%count);
 await page.setViewportSize({width:390,height:650});await page.waitForTimeout(100);await settle((target+201)%count);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await settle((target+201)%count);
 await page.setViewportSize({width:1440,height:900});await page.waitForFunction(count=>document.querySelectorAll('.archive-row').length===count,count);assert.equal(await page.locator('.archive-row').count(),count);assert.equal(await page.locator('.archive-list-track').evaluate(t=>getComputedStyle(t).transform),'none');await page.locator('.archive-row').first().hover();await page.waitForFunction(src=>document.querySelector('.archive-background').firstElementChild?.src===src,sources[0]);
 if(live)assert.deepEqual(await revisions(),before,'published Sanity documents and assets remain unchanged');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine,version:browser.version(),loops:3,projects:count,published:live,productionURL:site||null,sanityUnchanged:live,extraTaps:200,intermediateMotion:true,rapidQueue:true,domCount:initial.count,trace}));
 }finally{await browser.close()}
});
