const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const connected=(a,b)=>((Math.abs(a.x+a.w-b.x)<.05||Math.abs(b.x+b.w-a.x)<.05)&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.1)||((Math.abs(a.y+a.h-b.y)<.05||Math.abs(b.y+b.h-a.y)<.05)&&Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.1);
function verify(rects,viewport){
 assert.ok(rects.length<=6);
 for(let i=0;i<rects.length;i++){
 const a=rects[i];assert.equal(a.opacity,'1');assert.equal(a.transition,'none');assert.equal(a.animation,'none');
 assert.ok(Math.abs(a.w/a.h-a.ratio)<.01);assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=viewport.width+.05&&a.y+a.h<=viewport.height+.05);
 // Reversals can branch onto an older retained edge; adjacency is audited at insertion.
 for(let j=0;j<i;j++){const b=rects[j];assert.ok(!(a.x<b.x+b.w-.05&&a.x+a.w>b.x+.05&&a.y<b.y+b.h-.05&&a.y+a.h>b.y+.05),'no overlaps');}
 }
}
for(const engine of ['chromium','webkit'])test(`${engine}: ordered trail, instantaneous replacement, touch, video lifecycle, idle, navigation`,{skip:!process.env.BROWSER_TEST},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try{
 for(const mobile of [false,true]){
 const viewport=mobile?{width:390,height:844}:{width:1440,height:900};
 const page=await browser.newPage({viewport,hasTouch:mobile,isMobile:mobile}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const bytes=await require('./native-media-fixture.cjs').recordMP4(page);
 const ratios=[16/9,.65,1.5,1,2,.8,1.3,.7,1.8];
 const media=ratios.map((ratio,i)=>({_key:`item-${i}`,type:i===0?'mp4':'image',size:['large','small','medium'][i%3],
 image:{asset:{_id:`image-demo${i}-160x90-svg`,url:`https://cdn.sanity.io/images/ck6xe2er/production/demo${i}.svg`,metadata:{dimensions:{width:ratio*100,height:100}}}},
 video:{asset:{_id:'file-demo-mp4',url:'https://cdn.sanity.io/files/ck6xe2er/production/demo.mp4',metadata:{dimensions:{width:160,height:90}}}}}));
 await page.route('**/*',r=>{const u=new URL(r.request().url());
 if(u.hostname.endsWith('apicdn.sanity.io'))return r.fulfill({json:{result:{projects:[],homePage:{_id:'homePage',_type:'homePage',media}}}});
 if(u.hostname==='cdn.sanity.io'){
 if(u.pathname.endsWith('.mp4'))return r.fulfill({body:bytes,contentType:'video/mp4'});
 const i=Number(u.pathname.match(/demo(\d+)/)[1]);return r.fulfill({body:`<svg xmlns="http://www.w3.org/2000/svg" width="${ratios[i]*100}" height="100"><rect width="100%" height="100%" fill="hsl(${i*45},50%,45%)"/></svg>`,contentType:'image/svg+xml',headers:{'access-control-allow-origin':'*'}});
 }
 if(u.hostname==='preview.test')return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname),contentType:({'.woff':'font/woff','.woff2':'font/woff2'})[path.extname(u.pathname)]});
 return r.abort();});
 await page.goto('https://preview.test/#home');await page.waitForFunction(()=>document.querySelector('.frontpage-fade')?.dataset.source==='sanity');
 assert.equal(await page.locator('.frontpage-fade-media').count(),0);
 await page.evaluate(()=>{window.trailMax=0;new MutationObserver(()=>{trailMax=Math.max(trailMax,(document.querySelector('.frontpage-fade')?.children.length || 0))}).observe(document.querySelector('.frontpage-fade'),{childList:true});});
 const start={x:mobile?120:400,y:mobile?150:150};
 async function move(x,y){
 if(mobile)await page.evaluate(({x,y})=>document.querySelector('.home').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'touch',pointerId:7,clientX:x,clientY:y})),{x,y});
 else await page.mouse.move(x,y);
 }
 if(mobile)await page.evaluate(p=>document.querySelector('.home').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:7,clientX:p.x,clientY:p.y})),start);
 else await move(start.x,start.y);
 await move(start.x+1,start.y);
 const video=await page.locator('video[data-serial="0"]').elementHandle();assert.ok(video);
 await page.waitForFunction(v=>!v.paused&&v.currentTime>0,video);
 assert.ok(await video.evaluate(v=>v.muted&&v.loop&&v.playsInline&&!v.controls));
 let step = 0;
 const drawingPoints = mobile ? [[300,150],[300,300],[80,300],[80,680],[300,680]] : [[1100,150],[1100,330],[400,330],[400,680],[1100,680]];
 let cursor = {x:start.x+1,y:start.y};
 async function nextMark(target) {
   for(let guard=0;Number(await page.locator('.frontpage-fade').getAttribute('data-progress'))<target&&guard<200;guard++) {
     const end = drawingPoints[step%drawingPoints.length], dx=end[0]-cursor.x,dy=end[1]-cursor.y,len=Math.hypot(dx,dy);
     if(len<1){step++;continue;}
     const travel=Math.min(32,len);cursor={x:cursor.x+dx*travel/len,y:cursor.y+dy*travel/len};await move(cursor.x,cursor.y);
   }
   assert.equal(Number(await page.locator('.frontpage-fade').getAttribute('data-progress')),target);
 }
 await nextMark(6);
 assert.equal(await page.locator('.frontpage-fade-media').count(),6);
 const snapshots=()=>page.locator('.frontpage-fade-media').evaluateAll(ns=>ns.map(n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return {serial:+n.dataset.serial,index:+n.dataset.sequence,x:b.x,y:b.y,w:b.width,h:b.height,opacity:s.opacity,transition:s.transitionProperty,animation:s.animationName,ratio:n.tagName==='VIDEO'?16/9:n.naturalWidth/n.naturalHeight}}));
 await page.waitForFunction(()=>[...document.querySelectorAll('.frontpage-fade img')].every(n=>n.complete&&n.naturalWidth));
 let rects=await snapshots();verify(rects,viewport);assert.deepEqual(rects.map(r=>r.serial),[0,1,2,3,4,5]);
 await nextMark(7);rects=await snapshots();verify(rects,viewport);assert.deepEqual(rects.map(r=>r.serial),[1,2,3,4,5,6]);
 assert.ok(await video.evaluate(v=>!v.isConnected&&v.paused&&!v.hasAttribute('src')));
 const frozen=await page.locator('.frontpage-fade').innerHTML();await page.waitForTimeout(250);assert.equal(await page.locator('.frontpage-fade').innerHTML(),frozen);
 if(mobile){await page.evaluate(()=>document.querySelector('.home').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',pointerId:7})));assert.equal(await page.locator('.frontpage-fade').innerHTML(),frozen);await page.evaluate(()=>document.querySelector('.home').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:7,clientX:300,clientY:150})));}
 const points=mobile?[[300,240],[80,240],[80,730],[360,730],[360,60],[20,60]]:[[1200,180],[1200,720],[200,720],[200,60],[1400,60],[1400,850],[20,850]];
 fs.mkdirSync(path.join(__dirname,'..','reports','trail'),{recursive:true});
 for(let i=0;i<points.length;i++){
 await move(...points[i]);await page.waitForFunction(()=>[...document.querySelectorAll('.frontpage-fade img')].every(n=>n.complete&&n.naturalWidth));
 rects=await snapshots();verify(rects,viewport);assert.equal(rects.length,6);assert.ok(rects.every(r=>r.index===r.serial%9));
 if(i===1||i===points.length-1)await page.screenshot({path:path.join(__dirname,'..','reports','trail',`${engine}-${mobile?'mobile':'desktop'}-${i}.png`)});
 }
 assert.ok(await page.evaluate(()=>trailMax<=6));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
 if(mobile)await page.evaluate(()=>document.querySelector('.home').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',pointerId:7})));
 const beforeNav=await page.locator('.frontpage-fade').getAttribute('data-progress');
 await page.locator('.site-header a').first().hover();assert.equal(await page.locator('.frontpage-fade').getAttribute('data-progress'),beforeNav);
 await page.locator('.site-header a').first().click();
 await page.evaluate(()=>location.hash='info');await page.waitForSelector('.info');assert.equal(await page.locator('.frontpage-fade-media').count(),0);
 assert.deepEqual(errors,[]);await page.close();
 }
 }finally{await browser.close();}
});
for(const engine of ['chromium','webkit'])test(`${engine}: local photograph trails and native Chrome touch drag`,{skip:!process.env.BROWSER_TEST},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try{for(const mobile of [false,true]){
 const viewport=mobile?{width:390,height:844}:{width:1440,height:900};
 const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile});
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='preview.test')return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname),contentType:({'.woff':'font/woff','.woff2':'font/woff2'})[path.extname(u.pathname)]});return r.abort();});
 await page.goto('https://preview.test/#home');await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.fonts.check('300 16px "WF Raglan Neue"')));await page.waitForTimeout(100);
 const points=mobile?[[90,100],[220,100],[220,250],[90,250],[90,650],[300,650],[300,200]]:[[350,180],[750,180],[750,400],[450,400],[450,720],[1150,720],[1150,200]];
 const cdp=mobile&&engine==='chromium'?await page.context().newCDPSession(page):null;
 if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:points[0][0],y:points[0][1]}]});
 else if(mobile)await page.evaluate(([x,y])=>document.querySelector('.home').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:8,clientX:x,clientY:y})),points[0]);
 let step = 0;
 for(const [x,y] of points){
 if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x,y}]});
 else if(mobile)await page.evaluate(({x,y})=>document.querySelector('.home').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'touch',pointerId:8,clientX:x,clientY:y})),{x,y});
 else await page.mouse.move(x,y,{steps:8});
 if(step===2||step===4){await page.waitForFunction(()=>[...document.querySelectorAll('.frontpage-fade img')].every(n=>n.complete&&n.naturalWidth));await page.screenshot({path:path.join(__dirname,'..','reports','trail',`${engine}-${mobile?'mobile':'desktop'}-photographs-${step}.png`)});}
 step++;
 }
 if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>document.querySelectorAll('.frontpage-fade img').length===6&&[...document.querySelectorAll('.frontpage-fade img')].every(n=>n.complete&&n.naturalWidth));
 const rects=await page.locator('.frontpage-fade-media').evaluateAll(ns=>ns.map(n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:b.x,y:b.y,w:b.width,h:b.height,ratio:n.naturalWidth/n.naturalHeight,opacity:s.opacity,transition:s.transitionProperty,animation:s.animationName}}));verify(rects,viewport);
 const frozen=await page.locator('.frontpage-fade').innerHTML();await page.waitForTimeout(300);assert.equal(await page.locator('.frontpage-fade').innerHTML(),frozen);
 assert.equal(await page.evaluate(()=>scrollY),0);
 await page.screenshot({path:path.join(__dirname,'..','reports','trail',`${engine}-${mobile?'mobile':'desktop'}-photographs.png`)});
 await page.close();
 }}finally{await browser.close();}
});
