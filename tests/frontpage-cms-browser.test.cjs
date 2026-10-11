const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
test('Chrome published Startseite media: ordered sizes, native MP4 playback, posters, visibility and cleanup',{skip:!process.env.BROWSER_TEST},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{for(const mobile of [false,true])for(const rejected of [false,true]){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},hasTouch:mobile,isMobile:mobile}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const bytes=await require('./native-media-fixture.cjs').recordMP4(page);let queries=0;
 const image=i=>({asset:{_id:`image-demo${i}-160x90-svg`,url:`https://cdn.sanity.io/images/ck6xe2er/production/demo${i}-160x90.svg`,metadata:{dimensions:{width:160,height:90}}}});
 const media=Array.from({length:9},(_,i)=>({_key:`item-${i}`,type:i===0||i===2?'mp4':'image',size:['large','small','medium'][i%3],image:image(i),poster:image(i),video:{asset:{_id:`file-demo${i}-mp4`,url:`https://cdn.sanity.io/files/ck6xe2er/production/demo${i}.mp4`,mimeType:'video/mp4',metadata:{dimensions:{width:160,height:90}}}}}));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname.endsWith('apicdn.sanity.io')){queries++;return r.fulfill({json:{result:{projects:[],homePage:{_id:'homePage',_type:'homePage',media}}}})}if(u.hostname==='cdn.sanity.io')return u.pathname.endsWith('.mp4')?r.fulfill({body:bytes,contentType:'video/mp4'}):r.fulfill({body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#d34225"/></svg>',contentType:'image/svg+xml',headers:{'access-control-allow-origin':'*'}});if(u.hostname==='preview.test')return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});return r.abort()});
 if(rejected)await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Fixture policy rejection','NotAllowedError'))}});
 await page.goto('https://preview.test/#home');await page.waitForFunction(()=>document.querySelector('.frontpage-fade')?.dataset.source==='sanity');assert.equal(queries,1);
 const first=page.locator('video[data-id="item-0"]'),handle=await first.elementHandle();assert.ok(handle);
 const before=await first.boundingBox();await page.waitForFunction(v=>v.readyState>=2,handle);const after=await first.boundingBox();assert.deepEqual(after,before,'metadata causes no layout shift');assert.equal(await first.evaluate(v=>v.paused),true,'zero-opacity prepared video does not play');
 const cdp=mobile?await page.context().newCDPSession(page):null;
 if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:200,y:700}]});
 else{await page.mouse.move(100,100);await page.mouse.move(130,100)}
 await page.waitForFunction(v=>Number(v.style.opacity)>0,handle);
 assert.equal(await first.evaluate(v=>v.muted&&v.loop&&v.playsInline&&!v.controls),true);
 if(rejected){await page.waitForFunction(v=>v.dataset.autoplay==='blocked',handle);assert.equal(await first.evaluate(v=>v.paused&&Boolean(v.poster)),true)}
 else await page.waitForFunction(v=>!v.paused&&v.currentTime>.05,handle);
 if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const frozen=await page.locator('.frontpage-fade').evaluate(n=>({progress:n.dataset.progress,opacity:[...n.children].map(n=>n.style.opacity)}));await page.waitForTimeout(300);assert.deepEqual(await page.locator('.frontpage-fade').evaluate(n=>({progress:n.dataset.progress,opacity:[...n.children].map(n=>n.style.opacity)})),frozen);
 if(mobile){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:2,x:200,y:700}]});await page.waitForFunction(()=>Number(document.querySelector('.frontpage-fade').dataset.progress)>7.1);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
 else{await page.evaluate(async()=>{document.documentElement.dispatchEvent(new PointerEvent('pointerleave'));let x=0;document.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:x,clientY:100}));while(Number(document.querySelector('.frontpage-fade').dataset.progress)<7.1){x+=FrontpageMediaFade.DISTANCE_PER_IMAGE*.25;document.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:x,clientY:100}));await new Promise(requestAnimationFrame)}})}
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
 assert.equal(await page.locator('.frontpage-fade video').evaluateAll(ns=>ns.every(v=>v.paused)),true,'hidden page pauses all videos');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
 if(!rejected)await page.waitForFunction(()=>[...document.querySelectorAll('.frontpage-fade video')].some(v=>Number(v.style.opacity)>0&&!v.paused));
 assert.equal(await handle.evaluate(v=>v.paused&&!v.hasAttribute('src')&&!v.isConnected),true);assert.ok(await page.locator('.frontpage-fade-media').count()<=7);assert.equal(queries,1);
 const dimensions=await page.locator('.frontpage-fade-media').evaluateAll(ns=>ns.map(n=>{const b=n.getBoundingClientRect();return {w:b.width,h:b.height,x:b.x,y:b.y}}));for(const b of dimensions){assert.ok(Math.abs(b.w/b.h-16/9)<.01);assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=page.viewportSize().width+.1&&b.y+b.h<=page.viewportSize().height+.1)}
 assert.ok(await page.locator('.site-header').evaluate(n=>{const b=n.getBoundingClientRect();return Math.abs(b.top+b.height/2-innerHeight/2)<.51}));
 if(rejected)await page.screenshot({path:path.join(__dirname,'..','reports',`startseite-poster-${mobile?'mobile':'desktop'}.png`)});
 await page.evaluate(()=>location.hash='info');await page.waitForSelector('.info');assert.equal(await page.locator('.frontpage-fade-media').count(),0);assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close()}
});
