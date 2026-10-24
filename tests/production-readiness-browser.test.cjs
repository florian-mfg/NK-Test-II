'use strict';
// Local-source or deployed-source checks against public, read-only Sanity data.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const local=!!process.env.LOCAL_PRODUCTION_READINESS,enabled=local||process.env.LIVE_PRODUCTION_READINESS;
const root=path.join(__dirname,'..'),base=process.env.SITE_BASE_URL||'https://florian-mfg.github.io/NK-Test-II/';
const runtime=['index.html','app.js','style.css','contrast.js','frontpage-boot.js','frontpage-loading.js','frontpage-media-fade.js','frontpage-media.js','sanity-data.js','projects.js','project-modules.js','project-video.js','project-categories.js'];
for(const engine of ['chromium','webkit'])test(`${engine}: ${local?'local candidate':'live commit'} with published Sanity data and content integrity`,{skip:!enabled,timeout:180000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const expected=JSON.parse(fs.readFileSync(process.env.SANITY_REVISION_BASELINE||'/tmp/nk-production-release/content-before.json','utf8'));
  const revisions=async()=>{const response=await page.request.get('https://ck6xe2er.api.sanity.io/v2025-02-19/data/query/production',{params:{perspective:'published',query:'*[!(_id in path("drafts.**")) && !(_id in path("versions.**"))] | order(_id asc) {_id,_rev,_type}'},timeout:45000});assert.ok(response.ok());return(await response.json()).result;};
  assert.deepEqual(await revisions(),expected,'published content matches the pre-release baseline');
  if(local)await page.route(base+'**',r=>{const u=new URL(r.request().url());return r.fulfill({path:path.join(root,u.pathname.slice(new URL(base).pathname.length)||'index.html')});});
  else {
   assert.ok(process.env.EXPECTED_COMMIT,'exact expected commit required for deployed verification');
   for(const file of runtime){const response=await page.request.get(`${base}${file}?release=${process.env.EXPECTED_COMMIT}`);assert.ok(response.ok());assert.equal(crypto.createHash('sha256').update(await response.body()).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),`${file}: exact candidate bytes`);}
  }
  await page.goto(base+'#home');await page.waitForFunction(()=>typeof sanityLoadSettled!=='undefined'&&sanityLoadSettled&&sanityContent);await page.waitForFunction(()=>document.querySelector('.frontpage-fade')?.dataset.ready==='true',null,{timeout:45000});
  const home=await page.evaluate(()=>({limit:sanityContent.homePage?.visibleMediaLimit,configured:sanityContent.homePage?.media?.length,prepared:JSON.parse(document.querySelector('.frontpage-fade').dataset.preparation),project:SanityData.config.projectId,dataset:SanityData.config.dataset}));
  assert.equal(home.project,'ck6xe2er');assert.equal(home.dataset,'production');assert.ok(home.limit>=1&&home.limit<=10);assert.ok(home.prepared.every(r=>r.status==='ready'),JSON.stringify(home));
  await page.mouse.move(400,200);await page.mouse.move(401,200);assert.equal(await page.locator('.frontpage-fade-media').count(),1);
  const hash=new URL(page.url()).hash;await page.locator('.work-toggle').click();assert.equal(new URL(page.url()).hash,hash);assert.equal(await page.locator('.work-toggle').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');
  await page.goto(base+'#info');await page.waitForSelector('.info-intro-scroll');await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await page.locator('.info-intro').first().textContent(),await page.evaluate(()=>sanityContent.infoPage.introduction.replace(/\r?\n/g,'')));
  const info=await page.evaluate(()=>{const s=document.querySelector('.info'),g=s.querySelector('.info-introduction'),rows=s.querySelector('.info-columns'),p=s.querySelector('.info-intro-content').lastElementChild;return {rowTop:rows.getBoundingClientRect().top,target:innerHeight/2+parseFloat(getComputedStyle(s).getPropertyValue('--info-baseline-offset')),introBottom:p.getBoundingClientRect().bottom,gap:parseFloat(getComputedStyle(g).paddingBottom),overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.ok(Math.abs(info.rowTop-info.target)<.1);assert.ok(Math.abs(info.introBottom-(info.rowTop-info.gap))<.1);assert.equal(info.overflow,false);
  const categories={};
  for(const category of ['video','commissioned','graphic']){await page.goto(base+'#work/'+category);await page.waitForSelector('.work[data-source="sanity"]');const ids=await page.locator('.project-preview:not([hidden])').evaluateAll(ns=>ns.map(n=>n.dataset.project));assert.deepEqual(ids,await page.evaluate(c=>sanityContent.selectedWork[c],category));categories[category]=ids.length;}
  await page.goto(base+'#archive');await page.waitForSelector('.archive[data-source="sanity"]');await page.mouse.move(1400,850);
  const rows=page.locator('.archive-row');assert.equal(await rows.count(),await page.evaluate(()=>sanityContent.indexPage.entries.length));
  const visible=()=>rows.locator('.archive-additional-info').evaluateAll(ns=>ns.map((n,i)=>getComputedStyle(n).visibility==='visible'?i:-1).filter(i=>i>=0));
  assert.deepEqual(await visible(),[]);await rows.nth(0).hover();assert.deepEqual(await visible(),[0]);await rows.nth(1).hover();assert.deepEqual(await visible(),[1]);
  const project=await page.evaluate(()=>sanityContent.projects.find(p=>p.detailPageEnabled&&p.modulesValid&&p.modules.length)?.id);assert.ok(project);await page.goto(base+'#project/'+project);await page.waitForSelector('.detail[data-project-source="sanity"]');assert.equal(await page.locator('.detail').getAttribute('data-project-id'),project);
  await page.setViewportSize({width:390,height:844});await page.goto(base+'#info');await page.waitForSelector('.info-intro-scroll');assert.equal(await page.locator('.info-introduction').evaluate(n=>getComputedStyle(n).height==='auto'||n.getBoundingClientRect().height>0),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('.mobile-menu-toggle').click();await page.locator('.mobile-menu-label').click();assert.equal(await page.locator('.mobile-menu-label').getAttribute('aria-expanded'),'true');await page.locator('.mobile-work-submenu a').first().click();assert.equal(new URL(page.url()).hash,'#work/video');
  assert.deepEqual(errors,[]);assert.deepEqual(await revisions(),expected,'published documents/assets unchanged by verification');
  const result={engine,local,commit:process.env.EXPECTED_COMMIT||null,home,info,categories,project,contentUnchanged:true};const out=process.env.RELEASE_REPORT_DIR||'/tmp/nk-production-release';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`${local?'candidate':'live'}-${engine}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
});
