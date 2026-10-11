const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
test('real Chrome touch hold, exact release freeze, multitouch, cancellation and navigation',{skip:!process.env.BROWSER_TEST},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='preview.test')return r.abort();return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.touchSignals=[];const add=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(t,cb,o){if(this===document&&['pointerdown','pointerup','pointercancel'].includes(t))touchSignals.push(o?.signal);return add.call(this,t,cb,o);};});
 await page.goto('https://preview.test/#home');
 const cdp=await page.context().newCDPSession(page);
 const point=(id,x=180,y=400)=>({id,x,y,radiusX:1,radiusY:1,force:1});
 const touch=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
 const progress=()=>page.locator('.frontpage-fade').evaluate(n=>Number(n.dataset.progress));
 const snapshot=()=>page.locator('.frontpage-fade-media').evaluateAll(ns=>ns.map(n=>n.getAttribute('style')));
 const signals=()=>page.evaluate(()=>touchSignals.filter(s=>s&&!s.aborted).length);
 const freeze=async()=>{const p=await progress(),s=await snapshot();await page.waitForTimeout(650);assert.equal(await progress(),p);assert.deepEqual(await snapshot(),s);return p;};
 assert.equal(await progress(),0);await page.waitForTimeout(200);assert.equal(await progress(),0);const listeners=await signals();
 await touch('touchStart',[point(1,20,300)]);await page.waitForTimeout(500);const first=await progress();assert.ok(first>2.5&&first<3.8);
 await touch('touchMove',[point(1,320,650)]);await page.waitForTimeout(300);assert.ok(await progress()>first);
 await touch('touchEnd');const stopped=await freeze();
 await touch('touchStart',[point(2,360,780)]);assert.ok(await progress()>=stopped);await page.waitForTimeout(350);assert.ok(await progress()>stopped);await touch('touchCancel');await freeze();
 // Measure elapsed time against the configured speed with two fingers.
 await touch('touchStart',[point(3,100,350),point(4,280,450)]);
 const start=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(time=>resolve({time,progress:Number(document.querySelector('.frontpage-fade').dataset.progress)}))));
 await page.waitForTimeout(500);
 const end=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(time=>resolve({time,progress:Number(document.querySelector('.frontpage-fade').dataset.progress),speed:FrontpageMediaFade.MOBILE_TRANSITIONS_PER_SECOND}))));
 assert.ok(Math.abs((end.progress-start.progress)-(end.time-start.time)/1000*end.speed)<.025,'two fingers advance at one configured speed');
 await touch('touchEnd',[point(4,280,450)]);const oneLeft=await progress();await page.waitForTimeout(300);assert.ok(await progress()>oneLeft);
 await touch('touchEnd');await freeze();
 await touch('touchStart',[point(5)]);await page.waitForTimeout(4000);assert.ok(await page.locator('.frontpage-fade-media').count()<=7);
 const beforeResize=await progress();await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);assert.ok(await progress()>=beforeResize);await touch('touchEnd');await freeze();
 assert.ok(await page.evaluate(()=>scrollY===0&&document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
 await page.setViewportSize({width:390,height:844});
 await touch('touchStart',[point(8)]);
 await page.waitForFunction(()=>{const n=document.querySelector('[data-role="incoming"]');return Number(n.style.opacity)>.25&&Number(n.style.opacity)<.60;},null,{polling:'raf'});
 await touch('touchEnd');
 const revealing=await page.locator('[data-role="incoming"]').evaluate(n=>({serial:n.dataset.serial,opacity:Number(n.style.opacity)}));
 await freeze();
 await touch('touchStart',[point(9)]);await page.waitForTimeout(100);await touch('touchEnd');
 const resumedOpacity=await page.locator(`[data-serial="${revealing.serial}"]`).evaluate(n=>Number(n.style.opacity));assert.ok(resumedOpacity>revealing.opacity);await freeze();
 const navProgress=await progress();
 await page.locator('.mobile-menu-toggle').tap();assert.equal(await page.locator('.mobile-menu').evaluate(n=>n.open),true);await page.waitForTimeout(250);assert.equal(await progress(),navProgress);
 await page.locator('.mobile-menu-close').tap();assert.equal(await progress(),navProgress);
 await page.locator('.mobile-menu-toggle').tap();await page.locator('.mobile-menu-label').tap();await page.locator('.mobile-menu a[data-route="work/video"]').tap();await page.waitForSelector('.work');assert.equal(await signals(),listeners-3);
 await page.evaluate(()=>location.hash='home');await page.waitForSelector('.home');assert.equal(await signals(),listeners);assert.equal(await progress(),0);
 await touch('touchStart',[point(6)]);await page.waitForTimeout(200);await page.evaluate(()=>location.hash='info');await page.waitForSelector('.info');await touch('touchEnd');assert.equal(await signals(),listeners-3);assert.equal(await page.locator('.frontpage-fade-media').count(),0);
 await page.evaluate(()=>location.hash='home');await page.waitForSelector('.home');await page.waitForTimeout(650);assert.equal(await progress(),0);assert.equal(await signals(),listeners);
 assert.deepEqual(errors,[]);
 } finally {await browser.close();}
});





test('Chrome editorial collage: centered navigation, input fades, six-image rolling window, aspect ratios, loop and cleanup',{skip:!process.env.BROWSER_TEST},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='preview.test')return r.abort();return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});});
 await page.goto('https://preview.test/#home');await page.evaluate(()=>document.fonts.ready);
 const progress=()=>page.locator('.frontpage-fade').evaluate(n=>Number(n.dataset.progress));
 const snapshot=()=>page.locator('.frontpage-fade-media').evaluateAll(ns=>ns.map(n=>({serial:Number(n.dataset.serial),index:Number(n.dataset.sequence),opacity:Number(n.style.opacity),style:n.getAttribute('style')})));
 const freeze=async()=>{const p=await progress(),s=await snapshot();await page.waitForTimeout(350);assert.equal(await progress(),p);assert.deepEqual(await snapshot(),s)};
 const check=async()=>{
 const result=await page.evaluate(()=>{const header=document.querySelector('.site-header').getBoundingClientRect();return {mid:header.top+header.height/2,height:innerHeight,bg:getComputedStyle(document.querySelector('.home')).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,media:[...document.querySelectorAll('.frontpage-fade-media')].map(n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:b.x,y:b.y,w:b.width,h:b.height,ratio:n.naturalWidth/n.naturalHeight,transform:s.transform,fit:s.objectFit,z:Number(s.zIndex)}})}});
 assert.ok(Math.abs(result.mid-result.height/2)<.51);assert.equal(result.bg,'rgb(255, 255, 255)');assert.equal(result.overflow,false);
 for(const n of result.media){assert.ok(n.x>=0&&n.y>=0&&n.x+n.w<=page.viewportSize().width+.1&&n.y+n.h<=page.viewportSize().height+.1);assert.ok(Math.abs(n.w/n.h-n.ratio)<.01);assert.equal(n.transform,'none');assert.equal(n.fit,'contain');}
 assert.ok(result.media.every((n,i)=>i===0||n.z>result.media[i-1].z));return result;
 };
 const decode=()=>page.locator('.frontpage-fade-media').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));
 await decode();await check();assert.equal(await progress(),0);
 // Exercise the homepage branch of the shared contrast controller with known pixels.
 for(const [fill,color] of [['black','rgb(255, 255, 255)'],['white','rgb(0, 0, 0)']]){
 await page.evaluate(async fill=>{document.querySelector('#contrast-fixture')?.remove();const n=document.createElement('img');n.id='contrast-fixture';n.className='frontpage-fade-media';n.style.cssText='left:0;top:0;width:100%;height:100%;opacity:1;z-index:8';n.src=`data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${fill}"/></svg>`;document.querySelector('.frontpage-fade').append(n);await n.decode();Contrast.refresh()},fill);
 await page.waitForFunction(color=>getComputedStyle(document.querySelector('.brand')).color===color,color);
 }
 await page.evaluate(()=>{document.querySelector('#contrast-fixture').remove();Contrast.refresh()});

 await page.mouse.move(100,100);await page.mouse.move(115,100);await page.waitForFunction(()=>Number(document.querySelector('.frontpage-fade').dataset.progress)>.2);assert.ok(Math.abs(await progress()-(15/(480/8.75)))<1e-6);await freeze();
 await page.mouse.move(100,100);await page.waitForFunction(()=>Number(document.querySelector('.frontpage-fade').dataset.progress)>.5);assert.ok(Math.abs(await progress()-(30/(480/8.75)))<1e-6);
 await page.evaluate(()=>{document.documentElement.dispatchEvent(new PointerEvent('pointerleave'));window.pointerX=0;document.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:0,clientY:100}))});
 const advance=async target=>{await page.evaluate(async p=>{while(p-Number(document.querySelector('.frontpage-fade').dataset.progress)>1e-8){const step=Math.min(.25,p-Number(document.querySelector('.frontpage-fade').dataset.progress));pointerX+=step*FrontpageMediaFade.DISTANCE_PER_IMAGE;document.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:pointerX,clientY:100}));await new Promise(requestAnimationFrame)}},target);await decode()};
 await advance(6);assert.deepEqual((await snapshot()).map(n=>n.index),[0,1,2,3,4,5]);
 await advance(6.5);let state=await snapshot();assert.equal(state.length,7);assert.equal(state[0].opacity,.5);assert.equal(state.at(-1).opacity,.5);await freeze();const geometry=await check();if(process.env.COLLAGE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.COLLAGE_SCREENSHOT_DIR,"frontpage-desktop.png")});assert.ok(new Set(geometry.media.map(n=>Math.round(n.w))).size>3);assert.ok(new Set(geometry.media.map(n=>Math.round(n.x))).size>3);
 await advance(7);assert.deepEqual((await snapshot()).map(n=>n.index),[1,2,3,4,5,6]);await advance(8);assert.deepEqual((await snapshot()).map(n=>n.index),[2,3,4,5,6,7]);
 await advance(20.5);assert.equal((await snapshot()).at(-1).index,0);await advance(60.375);assert.equal((await snapshot()).length,7);await freeze();
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1440,height:900}]){const p=await progress();await page.setViewportSize(viewport);await page.waitForTimeout(100);assert.equal(await progress(),p);await check();if(process.env.COLLAGE_SCREENSHOT_DIR&&viewport.width===390)await page.screenshot({path:path.join(process.env.COLLAGE_SCREENSHOT_DIR,"frontpage-mobile.png")});}
 await page.mouse.wheel(0,1000);await freeze();
 await page.locator('.main-nav a[data-route="info"]').click();await page.waitForSelector('.info');assert.equal(await page.locator('.frontpage-fade-media').count(),0);
 for(const hash of ['home','work','archive','project/mystic-landscapes','home']){await page.evaluate(h=>location.hash=h,hash);await page.waitForTimeout(100);if(hash==='home')assert.equal(await progress(),0);else assert.equal(await page.locator('.frontpage-fade-media').count(),0)}
 assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
