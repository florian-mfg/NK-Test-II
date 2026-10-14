'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const local=!!process.env.LOCAL_APPROVED_RELEASE_TEST,enabled=local||process.env.LIVE_APPROVED_RELEASE_TEST;
const root=path.join(__dirname,'..'),base=process.env.SITE_BASE_URL||'https://florian-mfg.github.io/NK-Test-II/';
const out=process.env.RELEASE_REPORT_DIR||'/tmp/nk-fluid-release',baseline=process.env.SANITY_BASELINE_PATH||'/tmp/nk-fluid-release/sanity-before.json';
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const engine of ['chromium','webkit'])test(`${local?'local':'LIVE'} approved release: real Sanity and Desktop Index (${engine})`,{skip:!enabled,timeout:180000},async()=>{
 fs.mkdirSync(out,{recursive:true});const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  if(local)await page.route(base+'**',r=>r.fulfill({path:path.join(root,new URL(r.request().url()).pathname.slice(new URL(base).pathname.length)||'index.html')}));
  const revisions=async()=>{const response=await page.request.get('https://ck6xe2er.api.sanity.io/v2025-02-19/data/query/production',{params:{query:'*[!(_id in path("drafts.**")) && !(_id in path("versions.**"))] | order(_id asc) {_id,_rev,_type}',perspective:'published'},timeout:45000});assert.ok(response.ok());return (await response.json()).result;};
  const documents=await revisions();
  if(local&&!fs.existsSync(baseline)){fs.mkdirSync(path.dirname(baseline),{recursive:true});fs.writeFileSync(baseline,JSON.stringify(documents,null,2));}
  const expected=JSON.parse(fs.readFileSync(baseline,'utf8'));assert.deepEqual(documents,expected,'published document and asset revisions match the pre-release snapshot');
  if(!local){
   assert.ok(process.env.EXPECTED_COMMIT,'live verification requires the approved commit');
   for(const file of ['frontpage-media-fade.js','style.css','app.js','sanity-data.js','frontpage-media.js','index.html','project-video.js','project-modules.js','projects.js','project-categories.js','contrast.js']){
    const response=await page.request.get(`${base}${file}?approved=${process.env.EXPECTED_COMMIT}`);assert.ok(response.ok());assert.equal(digest(await response.body()),digest(fs.readFileSync(path.join(root,file))),`${file}: exact approved runtime bytes`);
   }
  }
  await page.goto(`${base}?release=${process.env.EXPECTED_COMMIT||'local'}#home`);await page.waitForFunction(()=>sanityLoadSettled&&sanityContent);
  assert.deepEqual(await page.evaluate(()=>({project:SanityData.config.projectId,dataset:SanityData.config.dataset,fallback:sanityContent.homePage?.media==null,fluid:FrontpageMediaFade.EDGE_MARGIN,maxVisible:FrontpageMediaFade.WINDOW_SIZE})),{project:'ck6xe2er',dataset:'production',fallback:true,fluid:8,maxVisible:3});
  assert.equal(await page.locator('.frontpage-fade').getAttribute('data-source'),null);
  await page.mouse.move(5,450);await page.goto(`${base}?index=${process.env.EXPECTED_COMMIT||'local'}#archive`);await page.waitForSelector('.archive[data-source="sanity"]');await page.evaluate(()=>document.fonts.ready);
  const rows=page.locator('.archive-row'),count=await rows.count();assert.ok(count>2);
  const visible=()=>rows.locator('.archive-additional-info').evaluateAll(ns=>ns.map((n,i)=>getComputedStyle(n).visibility==='visible'?i:-1).filter(i=>i>=0));
  const geometry=()=>rows.evaluateAll(ns=>ns.map(n=>[n,...n.children].map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];})));
  const initial=await geometry();assert.deepEqual(await visible(),[]);
  const published=await page.evaluate(()=>sanityContent.indexPage.entries);assert.equal(count,published.length);
  assert.deepEqual(await rows.locator('span:first-child').allTextContents(),published.map(n=>n.title),'published ordering preserved');
  for(const i of [0,1,0]){const box=await rows.nth(i).boundingBox();await page.mouse.move(box.x+box.width-10,box.y+box.height/2);assert.deepEqual(await visible(),[i]);assert.deepEqual(await geometry(),initial);await page.waitForFunction(i=>document.querySelector('.archive-row[aria-current="true"]')?.dataset.index===String(i),i);}
  await page.mouse.move(1400,850);assert.deepEqual(await visible(),[]);await rows.nth(1).focus();assert.deepEqual(await visible(),[1]);await rows.nth(0).hover();assert.deepEqual(await visible(),[0],'hover takes priority over another focused row');
  const before=await page.locator('.archive-background').evaluate(n=>n.firstElementChild?.getAttribute('src'));
  await rows.nth(0).click();assert.equal(new URL(page.url()).hash,'#archive');if(published[0].media.length>1)await page.waitForFunction(src=>document.querySelector('.archive-background').firstElementChild?.getAttribute('src')!==src,before);
  await page.evaluate(()=>document.activeElement.blur());await page.mouse.move(1400,850);assert.deepEqual(await visible(),[]);assert.deepEqual(await geometry(),initial);
  await page.screenshot({path:path.join(out,`${local?'local':'live'}-${engine}-desktop-index.png`)});
  assert.deepEqual(await revisions(),expected,'Sanity content unchanged after verification');assert.deepEqual(errors,[]);
  const summary={engine,version:browser.version(),local,base,commit:process.env.EXPECTED_COMMIT||null,desktopIndex:{projects:count,hover:true,focus:true,hoverPriority:true,stableLayout:true,previewClick:true},sanity:{project:'ck6xe2er',dataset:'production',fallback:true,documents:expected.length,unchanged:true}};
  fs.writeFileSync(path.join(out,`${local?'local':'live'}-${engine}-release.json`),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 }finally{await browser.close();}
});
