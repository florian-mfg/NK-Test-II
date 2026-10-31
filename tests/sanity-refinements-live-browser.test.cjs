const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.SITE_BASE_URL||'http://127.0.0.1:5500/';
for(const engine of ['chromium','webkit'])test(`${engine}: all local refinements with published Sanity content`,{skip:!process.env.LIVE_SANITY_REFINEMENTS_TEST,timeout:180000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const results=[];
 try{for(const width of [1440,390]){
  const height=width===390?844:900,page=await browser.newPage({viewport:{width,height},hasTouch:width===390}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Actual assets, with 150ms delivery latency so the loading appearance is observable.
  await page.route('https://cdn.sanity.io/**',async r=>{await new Promise(resolve=>setTimeout(resolve,150));await r.continue().catch(()=>{});});
  await page.goto(base+'#home',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.frontpage-loading-indicator');
  assert.equal(await page.locator('.site-header .brand').isVisible(),true);
  const homeBar=await page.locator('.frontpage-loading-indicator').evaluate(n=>({color:getComputedStyle(n.firstElementChild).backgroundColor,track:getComputedStyle(n).backgroundColor,w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height}));
  assert.deepEqual(homeBar,{color:'rgb(0, 0, 0)',track:'rgba(0, 0, 0, 0)',w:170,h:3});
  await page.waitForFunction(()=>document.querySelector('.frontpage-fade')?.dataset.ready==='true',null,{timeout:30000});
  await page.mouse.move(100,200);await page.mouse.move(width-60,400,{steps:20});
  assert.ok(await page.locator('.frontpage-fade-media').count());
  assert.equal(await page.locator('.site-header .brand').evaluate(n=>getComputedStyle(n).color),'rgb(0, 0, 0)');
  const categories=[];
  for(const category of ['video','commissioned','graphic']){
   await page.goto(base+'#work/'+category);await page.waitForSelector('.project-preview:not([hidden])');
   assert.deepEqual(await page.locator('.site-header .brand,.main-nav a,.work .project-title > span,.work .project-kind').evaluateAll(ns=>[...new Set(ns.map(n=>getComputedStyle(n).color))]),['rgb(255, 255, 255)']);
   if(width>700){
    await page.mouse.move(600,450);await page.waitForFunction(()=>!document.querySelector('.open-cursor').hidden);
    await page.mouse.wheel(0,300);await page.waitForTimeout(150);
    assert.equal(await page.locator('.open-cursor').evaluate(n=>n.hidden),false);
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(300);
    await page.locator('.site-header .brand').hover();assert.equal(await page.locator('.open-cursor').evaluate(n=>n.hidden),true);
   }
   categories.push(category);
  }
  await page.goto(base+'#info');await page.evaluate(()=>document.fonts.ready);
  const info=await page.evaluate(()=>{
   const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,b:r.bottom};},footer=document.querySelector('.project-footer'),credit=footer.querySelector('.info-footer-credit'),links=footer.querySelector('.project-footer-links');
   const last=Math.max(...[...document.querySelectorAll('.info-intro,.info-columns section')].filter(n=>n.getClientRects().length).map(n=>rect(n).b));
   return{statement:rect(document.querySelector('.info-intro')).w,before:rect(footer).y-last,after:rect(footer).b-Math.max(rect(credit).b,rect(links).b),credit:rect(credit),links:rect(links),href:credit.querySelector('a').href,target:credit.querySelector('a').target,rel:credit.querySelector('a').rel,contactText:document.querySelector('.info-contact p')?.textContent,contacts:[...document.querySelectorAll('.info-contact a')].map(n=>({text:n.textContent,href:n.href})),overflow:document.documentElement.scrollWidth>innerWidth,issues:sanityContent.issues};
  });
  assert.ok(Math.abs(info.statement-(width>700?width*.49:width-16))<.04);assert.ok(Math.abs(info.before-height*.375)<.1);assert.ok(Math.abs(info.after-height*.5)<.1);
  assert.equal(info.href,'https://meisnerfloriangestaltung.com/');assert.equal(info.target,'_blank');assert.equal(info.rel,'noopener noreferrer');assert.equal(info.overflow,false);assert.deepEqual(info.issues,[]);
  assert.ok(info.contacts.some(c=>c.text==='@nicocaw'&&c.href==='https://www.instagram.com/nicocaw/'));
  assert.ok(info.contacts.some(c=>c.text==='mail@nicolas-kawohl.com'&&c.href==='mailto:mail@nicolas-kawohl.com'));
  assert.ok(!info.contactText.includes('Instagram:')&&!info.contactText.includes('Mail:'));
  const desktop=width>700;
  if(desktop){assert.equal(info.credit.y,info.links.y);await page.locator('.work-toggle').hover();}
  else{assert.ok(info.links.y>=info.credit.b);await page.locator('.mobile-menu-toggle').click();await page.locator('.mobile-menu-label').click();}
  const menu=await page.evaluate(desktop=>{
   const p=document.querySelector(desktop?'.work-menu':'.mobile-menu-work'),nodes=[p.querySelector(desktop?'.work-toggle':'.mobile-menu-label'),...p.querySelectorAll('a')],tops=nodes.map(n=>n.getBoundingClientRect().top);
   return{steps:tops.slice(1).map((t,i)=>t-tops[i]),labels:nodes.map(n=>n.textContent)};
  },desktop);
  assert.deepEqual(menu.labels,['Selected Work','Video','Photography','Graphic']);assert.ok(Math.max(...menu.steps)-Math.min(...menu.steps)<.04);
  if(!desktop)await page.locator('.mobile-menu-close').click();
  await page.goto(base+'#archive');await page.waitForSelector('.archive[data-prepared="true"]');
  assert.equal(await page.locator('.site-header .brand').evaluate(n=>getComputedStyle(n).color),'rgb(255, 255, 255)');
  assert.equal(await page.locator('.archive-list').evaluate(n=>getComputedStyle(n).color),'rgb(255, 255, 255)');
  await page.screenshot({path:path.join(require('node:os').tmpdir(),`nk-live-index-${engine}-${width}.png`)});
  assert.deepEqual(errors,[]);results.push({width,height,homeBar,categories,info,menu,errors});await page.close();
 }
 }finally{const out=path.join(__dirname,'..','reports','sanity-live-verification');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`refinements-${engine}.json`),JSON.stringify(results,null,2));await browser.close();}
});
