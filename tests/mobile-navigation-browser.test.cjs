'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
test('mobile menu stays expanded, upright, compact and uses official Raglan; desktop navigation remains available',{skip:!process.env.BROWSER_TEST},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='preview.test')return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:{}}});return r.fulfill({body:''})});
 await page.goto('https://preview.test/#home');
 for(const width of [320,390,430]){
 await page.setViewportSize({width,height:844});
 for(const destination of ['archive','info','work/video','work/commissioned','work/graphic']){
 await page.locator('.mobile-menu-toggle').tap();const menu=page.locator('.mobile-menu');
 assert.equal(await menu.locator('.mobile-work-submenu').isVisible(),true);
 assert.equal(await menu.locator('.mobile-menu-label').getAttribute('aria-expanded'),null);
 const before=await menu.innerHTML();await menu.locator('.mobile-menu-label').tap();assert.equal(await menu.innerHTML(),before);
 const geometry=await menu.evaluate(el=>{const nodes=[el.querySelector('.mobile-menu-label'),...el.querySelectorAll('nav a')];const s=getComputedStyle(el);return{background:s.backgroundColor,overflow:el.scrollWidth>el.clientWidth,styles:nodes.map(n=>getComputedStyle(n).fontStyle),gaps:nodes.slice(1).map((n,i)=>n.getBoundingClientRect().top-nodes[i].getBoundingClientRect().bottom),indent:nodes[1].getBoundingClientRect().left-nodes[0].getBoundingClientRect().left,top:nodes[0].getBoundingClientRect().top,padding:parseFloat(s.paddingTop)}});
 assert.equal(geometry.background,'rgb(255, 255, 255)');assert.equal(geometry.overflow,false);assert.deepEqual(geometry.styles,Array(6).fill('normal'));assert.ok(geometry.gaps.every(g=>Math.abs(g)<1));assert.ok(geometry.indent>20);assert.ok(Math.abs(geometry.top-geometry.padding)<1);
 assert.equal(await menu.locator('.brand').isVisible(),false);assert.equal(await menu.locator('.mobile-menu-mail').isVisible(),false);
 await menu.locator(`[data-route="${destination}"]`).tap();await page.waitForFunction(d=>location.hash==='#'+d&&!document.querySelector('.mobile-menu').open,destination);
 }
 }
 await page.locator('.mobile-menu-toggle').tap();await page.evaluate(()=>document.fonts.ready);
 const session=await page.context().newCDPSession(page);await session.send('DOM.enable');await session.send('CSS.enable');const {root}=await session.send('DOM.getDocument');const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector:'.mobile-menu-label'});const fonts=await session.send('CSS.getPlatformFontsForNode',{nodeId});assert.ok(fonts.fonts.some(f=>f.isCustomFont&&/Raglan/i.test(f.familyName)&&!/italic/i.test(f.postScriptName)));await session.detach();
 await page.screenshot({path:'/tmp/nk-mobile-menu-expanded.png'});await page.locator('.mobile-menu-close').tap();await page.setViewportSize({width:1440,height:900});assert.equal(await page.locator('.mobile-menu-toggle').isVisible(),false);assert.equal(await page.locator('.main-nav').isVisible(),true);assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
