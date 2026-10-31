'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
for(const engine of ['chromium','webkit'])test(`${engine}: mobile detail direction and Index canvas lifecycle`,{skip:!process.env.BROWSER_TEST,timeout:60000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const b=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try{
 const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='preview.test')return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:{}}});return r.fulfill({body:''});});
 await p.goto('https://preview.test/#home');await p.waitForFunction(()=>sanityLoadSettled);
 const id=await p.evaluate(()=>WORK_PROJECTS[0].id);
 await p.evaluate(id=>location.hash='#project/'+id,id);await p.waitForSelector('.detail');
 await p.addStyleTag({content:'html{scroll-behavior:auto!important}.project-modules{min-height:6000px}'});
 const scroll=async y=>{await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(80);};
 const hidden=()=>p.locator('.site-header').evaluate(n=>getComputedStyle(n).visibility==='hidden');
 const controls=()=>p.locator('.detail-info-label, .detail-sound-control').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return [n.className,r.x,r.y,getComputedStyle(n).opacity];}));
 const before=await controls();await scroll(300);assert.equal(await hidden(),true);assert.deepEqual(await controls(),before);
 await scroll(299);assert.equal(await hidden(),true);await scroll(220);assert.equal(await hidden(),false);
 await p.locator('.mobile-menu-toggle').tap();await p.waitForFunction(()=>document.querySelector('.mobile-menu').open);await scroll(350);assert.equal(await p.locator('.site-header').evaluate(n=>n.classList.contains('is-hidden')),false);await p.locator('.mobile-menu-close').tap();
 await scroll(600);assert.equal(await hidden(),true);await scroll(0);assert.equal(await hidden(),false);
 await p.setViewportSize({width:1440,height:900});await p.waitForFunction(()=>innerWidth===1440&&!mobileMenuBreakpoint.matches);assert.equal(await p.locator('.site-header').evaluate(n=>getComputedStyle(n).visibility),'visible');await p.setViewportSize({width:390,height:844});
 // Viewport requests can resolve before WebKit updates a retained MediaQueryList.
 // Enter Index only after the intended responsive state has actually settled.
 await p.waitForFunction(()=>innerWidth===390&&mobileMenuBreakpoint.matches);
 await p.evaluate(()=>location.hash='#archive');await p.waitForSelector('.archive');
 assert.deepEqual(await p.evaluate(()=>[document.documentElement,document.body,document.querySelector('#app'),document.querySelector('.archive')].map(n=>getComputedStyle(n).backgroundColor)),Array(4).fill('rgb(255, 255, 255)'));
 assert.equal(await p.locator('meta[name="theme-color"]').getAttribute('content'),'#ffffff');
 await p.locator('.mobile-menu-toggle').tap();assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(255, 255, 255)');await p.locator('.mobile-menu-close').tap();
 await p.evaluate(()=>location.hash='#info');await p.waitForSelector('.info');assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(255, 255, 255)');
 }finally{await b.close();}
});
