'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
for(const engine of ['chromium','webkit'])test(`mobile Index complete two loops, wrapped titles and synchronized media: ${engine}`,{skip:!process.env.BROWSER_TEST,timeout:120000},async()=>{
 const p=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core'),root=path.join(__dirname,'..');
 const browser=await p[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const output=path.join(root,'reports','mobile-index');fs.mkdirSync(output,{recursive:true});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const videoBytes=await require('./native-media-fixture.cjs').recordMP4(page);
 const image=i=>({asset:{_id:`image-preview${i}-800x1200-svg`,url:`https://cdn.sanity.io/images/ck6xe2er/production/preview${i}.svg`,metadata:{dimensions:{width:800,height:1200}}}});
 const count=12;
 let slow = false, firstVideo = false, releaseSlow;const slowGate=new Promise(resolve=>{releaseSlow=resolve;});
 const entries=Array.from({length:count},(_,i)=>({displayTitle:i===1||i===6?`Project ${i+1}: A deliberately long project title to verify wrapped rows and exact alignment below the logo`:`Project ${i+1}`,previewImages:[i===2||i===8?{mediaType:'mp4',video:{asset:{_id:`file-preview${i}-mp4`,url:`https://cdn.sanity.io/files/ck6xe2er/production/preview${i}.mp4`}}}:{mediaType:'image',image:image(i)},{mediaType:'image',image:image(i+100)}]}));
 await page.route('**/*',r=>{const u=new URL(r.request().url());
 if(u.hostname.endsWith('apicdn.sanity.io'))return r.fulfill({json:{result:{projects:[],indexPage:{_id:'indexPage',_type:'indexPage',entries:firstVideo?[entries[2],...entries.filter((_,i)=>i!==2)]:entries}}}});
 if(u.hostname==='cdn.sanity.io'){
 if(slow&&u.pathname.endsWith('/preview1.svg'))return slowGate.then(()=>r.fulfill({body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#345"/></svg>',contentType:'image/svg+xml'}));
 if(u.pathname.endsWith('.mp4'))return r.fulfill({body:videoBytes,contentType:'video/mp4'});
 const i=+u.pathname.match(/preview(\d+)/)[1];return r.fulfill({body:`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="hsl(${i*29} 35% 35%)"/></svg>`,contentType:'image/svg+xml'});
 }
 if(u.hostname==='preview.test')return r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname),contentType:({'.woff':'font/woff','.woff2':'font/woff2'})[path.extname(u.pathname)]});return r.abort();});
 await page.goto('https://preview.test/#archive');await page.waitForSelector('.archive[data-source="sanity"]');await page.evaluate(()=>document.fonts.ready);
 async function check(i){
 await page.waitForFunction(i=>Number(document.querySelector('.archive-row[aria-current]')?.dataset.index)===i&&Number(document.querySelector('.archive-background').dataset.projectIndex)===i,i);
 const s=await page.evaluate(()=>{
 const list=document.querySelector('.archive-list'),rows=[...list.querySelectorAll('.archive-row')],active=rows.find(r=>r.hasAttribute('aria-current')),top=list.getBoundingClientRect().top,i=+active.dataset.index,bg=document.querySelector('.archive-background'),n=bg.firstElementChild,b=n.getBoundingClientRect();
 return {i,top:active.getBoundingClientRect().top,listTop:top,logoBottom:document.querySelector('.brand').getBoundingClientRect().bottom,
 previousHidden:rows.slice(0,i).every(r=>r.inert&&r.getBoundingClientRect().bottom<=top+.1),remaining:rows.filter(r=>r.getBoundingClientRect().bottom>top+.1).length,
 styles:rows.map(r=>getComputedStyle(r.firstElementChild).fontStyle),src:n.getAttribute('src'),fit:getComputedStyle(n).objectFit,transition:getComputedStyle(n).transitionProperty,
 coverage:[b.x,b.y,b.width,b.height],scroll:[scrollX,scrollY,list.scrollTop],nodes:bg.children.length};
 });
 assert.equal(s.i,i);assert.ok(Math.abs(s.top-s.listTop)<.1);assert.ok(s.top>=s.logoBottom);assert.ok(s.previousHidden);assert.equal(s.remaining,count-i);
 assert.ok(s.styles.every((v,j)=>v===(j===i?'italic':'normal')));assert.ok(s.src.endsWith(`preview${i}.${i===2||i===8?'mp4':'svg'}`),'first preview follows active project');
 assert.equal(s.fit,'cover');assert.deepEqual(s.coverage,[0,0,390,844]);assert.deepEqual(s.scroll,[0,0,0]);assert.equal(s.nodes,1);
 if(i===2||i===8)await page.waitForFunction(()=>{const v=document.querySelector('.archive-background video');return v&&!v.paused&&v.currentTime>0});
 return s;
 }
 await check(0);
 assert.ok(await page.locator('.archive-row').nth(1).evaluate(r=>r.getBoundingClientRect().height>parseFloat(getComputedStyle(r).minHeight)),'long titles actually wrap');
 const rowsBefore=await page.locator('.archive-row').elementHandles();
 await page.screenshot({path:path.join(output,`${engine}-initial.png`)});
 // This exact free area was previously swallowed by the full-width first button.
 const top=(await page.locator('.archive-list').boundingBox()).y;
 assert.ok(await page.evaluate(y=>!document.elementFromPoint(300,y).closest('button'),top+6));
 await page.touchscreen.tap(300,top+6);await check(1);
 await page.screenshot({path:path.join(output,`${engine}-second.png`)});
 let videoHandle;
 for(let tap=2;tap<=count*2;tap++){
 const previous=(tap-1)%count;
 if(previous===2||previous===8)videoHandle=await page.locator('.archive-background video').elementHandle();else videoHandle=null;
 await page.touchscreen.tap(200,810);const i=tap%count;await check(i);
 if(videoHandle)assert.ok(await videoHandle.evaluate(v=>v.paused&&!v.hasAttribute('src')&&!v.isConnected),'outgoing video is released');
 if(tap===Math.floor(count/2))await page.screenshot({path:path.join(output,`${engine}-middle.png`)});
 if(tap===count-1)await page.screenshot({path:path.join(output,`${engine}-final.png`)});
 if(tap===count)await page.screenshot({path:path.join(output,`${engine}-loop.png`)});
 }
 assert.ok(await rowsBefore[0].evaluate(r=>r===document.querySelector('.archive-row')),'list data and nodes are not duplicated');
 await page.locator('.detail-sound-control').tap();await check(0);
 await page.locator('.mobile-menu-toggle').tap();await page.locator('.mobile-menu-close').tap();await check(0);
 await page.locator('.archive-row').nth(2).locator('span').first().tap();await check(2);
 await page.locator('.detail-sound-control').tap();await check(2);
 assert.ok(await page.locator('.archive-background video').evaluate(v=>v.muted));
 await page.locator('.archive-row').nth(2).locator('span').first().tap();await check(2);
 // Real Chrome swipe; WebKit checks cancellation plus the compatibility click.
 if(engine==='chromium'){
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:300,y:750}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:300,y:500}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }else await page.evaluate(()=>{const n=document.querySelector('.archive');for(const [type,y]of[['pointerdown',750],['pointermove',500],['pointerup',500]])n.dispatchEvent(new PointerEvent(type,{bubbles:true,isPrimary:true,pointerId:7,button:0,clientX:300,clientY:y}));n.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));});
 await check(2);
 await page.setViewportSize({width:390,height:650});await page.waitForTimeout(50);
 assert.ok(await page.evaluate(()=>Math.abs(document.querySelector('.archive-row[aria-current]').getBoundingClientRect().top-document.querySelector('.archive-list').getBoundingClientRect().top)<.1));
 await page.setViewportSize({width:390,height:844});await check(2);
 // Desktop retains hover selection and cycling among the project's media.
 await page.setViewportSize({width:1440,height:900});await page.locator('.archive-row').first().hover();
 await page.waitForFunction(()=>document.querySelector('.archive-background img')?.src.endsWith('preview0.svg'));
 await page.locator('.archive-row').first().click();await page.waitForFunction(()=>document.querySelector('.archive-background img')?.src.endsWith('preview100.svg'));
 assert.equal(await page.locator('.archive-list-track').evaluate(n=>getComputedStyle(n).transform),'none');
 // A deliberately delayed next preview must not show a new title over old media.
 slow=true;await page.setViewportSize({width:390,height:844});await page.goto('https://preview.test/?cold=1#archive',{waitUntil:'domcontentloaded'});await check(0);
 await page.touchscreen.tap(200,810);
 assert.equal(await page.locator('.archive-row[aria-current]').getAttribute('data-index'),'0');
 assert.ok(await page.locator('.archive-background img').evaluate(n=>n.src.endsWith('preview0.svg')));
 await page.touchscreen.tap(200,810);await check(2);releaseSlow();await page.waitForTimeout(100);await check(2);
 slow=false;firstVideo=true;await page.goto('https://preview.test/?first-video=1#archive',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>{const v=document.querySelector('.archive-background video');return v&&!v.paused&&v.readyState>=2&&v.currentTime>0;});
 assert.equal(await page.locator('.archive-row[aria-current]').getAttribute('data-index'),'0');
 assert.ok(await page.locator('.archive-background video').evaluate(v=>v.src.endsWith('preview2.mp4')&&v.muted&&v.loop&&v.playsInline&&!v.controls));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,projects:count,loops:2,wrappedRows:true,previewSync:true,videoCleanup:true,freeAreaTap:true,desktopCycle:true}));
 }finally{await browser.close();}
});
