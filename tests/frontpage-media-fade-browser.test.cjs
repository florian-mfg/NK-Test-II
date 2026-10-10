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
 await touch('touchStart',[point(1,20,300)]);await page.waitForTimeout(500);const first=await progress();assert.ok(first>.08&&first<.22);
 await touch('touchMove',[point(1,320,650)]);await page.waitForTimeout(300);assert.ok(await progress()>first);
 await touch('touchEnd');const stopped=await freeze();
 await touch('touchStart',[point(2,360,780)]);assert.ok(await progress()>=stopped);await page.waitForTimeout(350);assert.ok(await progress()>stopped);await touch('touchCancel');await freeze();
 // Measure elapsed time against the configured speed with two fingers.
 await touch('touchStart',[point(3,100,350),point(4,280,450)]);
 const start=await page.evaluate(()=>({time:performance.now(),progress:Number(document.querySelector('.frontpage-fade').dataset.progress)}));
 await page.waitForTimeout(500);
 const end=await page.evaluate(()=>({time:performance.now(),progress:Number(document.querySelector('.frontpage-fade').dataset.progress),speed:FrontpageMediaFade.MOBILE_TRANSITIONS_PER_SECOND}));
 assert.ok(Math.abs((end.progress-start.progress)-(end.time-start.time)/1000*end.speed)<.025,'two fingers advance at one configured speed');
 await touch('touchEnd',[point(4,280,450)]);const oneLeft=await progress();await page.waitForTimeout(300);assert.ok(await progress()>oneLeft);
 await touch('touchEnd');await freeze();
 await touch('touchStart',[point(5)]);await page.waitForTimeout(4000);assert.ok(await page.locator('.frontpage-fade-media').count()===2);
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





test('Chrome fullscreen two-layer reveal, promotion, carry, loop, static geometry and cleanup',{skip:!process.env.BROWSER_TEST},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='preview.test')return r.abort();return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});});
 await page.addInitScript(()=>{window.inputSignals=[];window.mediaNodes=new Set();const add=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(t,cb,o){if(this===document&&t==='pointermove')inputSignals.push(o?.signal);return add.call(this,t,cb,o);};const replace=Element.prototype.replaceChildren;Element.prototype.replaceChildren=function(...nodes){if(this.classList.contains('frontpage-fade'))nodes.forEach(n=>mediaNodes.add(n));return replace.apply(this,nodes);};});
 await page.goto('https://preview.test/#home');
 const snapshot=()=>page.locator('.frontpage-fade-media').evaluateAll(ns=>ns.map(n=>({style:n.getAttribute('style'),role:n.dataset.role,serial:n.dataset.serial,src:n.getAttribute('src')})));
 const progress=()=>page.locator('.frontpage-fade').evaluate(n=>Number(n.dataset.progress));
 const signals=()=>page.evaluate(()=>inputSignals.filter(s=>s&&!s.aborted).length);
 const decode=()=>page.locator('.frontpage-fade-media').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));
 const opacity=()=>page.locator('[data-role="incoming"]').evaluate(n=>Number(n.style.opacity));
 const geometry=async()=>{const v=page.viewportSize(),ns=await page.locator('.frontpage-fade-media').evaluateAll(ns=>ns.map(n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:b.x,y:b.y,w:b.width,h:b.height,fit:s.objectFit,position:s.objectPosition,transform:s.transform,transition:s.transitionDuration,animation:s.animationName,pointer:s.pointerEvents,z:s.zIndex,opacity:Number(s.opacity),role:n.dataset.role};}));assert.equal(ns.length,2);for(const n of ns){assert.equal(n.x,0);assert.equal(n.y,0);assert.equal(n.w,v.width);assert.equal(n.h,v.height);assert.equal(n.fit,'cover');assert.equal(n.position,'50% 50%');assert.equal(n.transform,'none');assert.equal(n.transition,'0s');assert.equal(n.animation,'none');assert.equal(n.pointer,'none');assert.equal(n.z,n.role==='current'?'1':'2');}assert.equal(ns.find(n=>n.role==='current').opacity,1);return ns;};
 const screenshot=async name=>{if(process.env.FADE_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.FADE_SCREENSHOT_DIR,name+'.png')});};
 await decode();await geometry();assert.equal(await progress(),0);assert.equal(await opacity(),0);assert.equal(await page.locator('[data-role="current"]').getAttribute('data-sequence'),'0');await screenshot('fade-01-initial');const listeners=await signals();
 await page.mouse.move(100,200);await page.mouse.move(300,200);assert.ok(Math.abs(await opacity()-200/1200)<1e-6);
 await page.mouse.move(100,200);assert.ok(Math.abs(await opacity()-400/1200)<1e-6);await page.mouse.move(103,204);assert.ok(Math.abs(await opacity()-405/1200)<1e-6);
 const frozen=await snapshot();await page.waitForTimeout(650);assert.deepEqual(await snapshot(),frozen);await page.mouse.move(106,208);assert.ok(Math.abs(await opacity()-410/1200)<1e-6);await geometry();
 // Reset only the pointer baseline, preserving accumulated transition progress.
 await page.evaluate(()=>{document.documentElement.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));window.testPointerX=0;document.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:0,clientY:400}));});
 const advance=async target=>{await page.evaluate(p=>{const current=Number(document.querySelector('.frontpage-fade').dataset.progress);testPointerX+=(p-current)*FrontpageMediaFade.DISTANCE_PER_IMAGE;document.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:testPointerX,clientY:400}));},target);await decode();};
 await advance(.5);assert.equal(await opacity(),.5);await screenshot('fade-02-half-reveal');
 await advance(.95);await screenshot('fade-03-nearly-complete');await page.evaluate(()=>window.promotedNode=document.querySelector('[data-role="incoming"]'));
 await advance(1);assert.equal(await opacity(),0);assert.equal(await page.locator('[data-role="current"]').getAttribute('data-sequence'),'1');assert.equal(await page.locator('[data-role="incoming"]').getAttribute('data-sequence'),'2');assert.ok(await page.locator('[data-role="current"]').evaluate(n=>n===promotedNode));
 const completed=await snapshot();await page.waitForTimeout(650);assert.deepEqual(await snapshot(),completed);await screenshot('fade-04-promoted');
 await advance(1.95);await advance(2.07);assert.ok(Math.abs(await opacity()-.07)<1e-12);assert.equal(await page.locator('[data-role="current"]').getAttribute('data-sequence'),'2');await screenshot('fade-05-excess-distance');
 await advance(19.75);assert.equal(await page.locator('[data-role="incoming"]').getAttribute('data-sequence'),'0');await screenshot('fade-06-loop-reveal');await advance(20);assert.equal(await opacity(),0);assert.equal(await page.locator('[data-role="current"]').getAttribute('data-sequence'),'0');
 await advance(1e6+.375);assert.equal(await opacity(),.375);assert.equal(await page.evaluate(()=>mediaNodes.size),2);
 const before=await progress(),o=await opacity();await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await progress(),before);assert.equal(await opacity(),o);await geometry();await screenshot('fade-07-narrow');
 const wheel=await snapshot();await page.mouse.wheel(0,1000);await page.waitForTimeout(650);assert.deepEqual(await snapshot(),wheel);assert.ok(await page.evaluate(()=>scrollY===0&&document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
 await page.setViewportSize({width:1200,height:800});assert.ok(await page.locator('.site-header').evaluate(n=>Number(getComputedStyle(n).zIndex)>2));
 for(const hash of ['work','archive','project/mystic-landscapes','info']){await page.evaluate(h=>location.hash=h,hash);await page.waitForFunction(()=>!document.querySelector('.home'));assert.equal(await signals(),listeners-1);assert.equal(await page.locator('.frontpage-fade-media').count(),0);await page.evaluate(()=>location.hash='home');await page.waitForSelector('.home');assert.equal(await signals(),listeners);assert.equal(await progress(),0);assert.equal(await opacity(),0);assert.equal(await page.locator('.frontpage-fade-media').count(),2);}
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
