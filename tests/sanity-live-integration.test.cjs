'use strict';
// Explicitly opt-in, read-only: real production GETs, local frontend and local reports.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.join(__dirname,'..'),out=process.env.SANITY_INTEGRATION_REPORT_DIR||path.join(require('node:os').tmpdir(),'nk-sanity-integration');
async function publishedQuery(query){const {projectId,dataset,apiVersion}=adapter.config;const url=new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);url.searchParams.set('perspective','published');url.searchParams.set('query',query);const response=await fetch(url,{signal:AbortSignal.timeout(45000)});assert.equal(response.ok,true);const payload=await response.json();assert.equal(payload.error,undefined);return payload.result;}
const revisionQuery='*[!(_id in path("drafts.**")) && !(_id in path("versions.**"))] | order(_id asc) {_id,_type,_rev,_updatedAt}';
const adapter=require('../sanity-data.js');
for(const engine of ['chromium','webkit'])test(`${engine}: existing published Sanity content, order, Info, Frontpage and native media`,{skip:!process.env.LIVE_SANITY_TEST,timeout:300000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 fs.mkdirSync(out,{recursive:true});
 const raw=await publishedQuery(adapter.query),expected=adapter.normalize(raw);
 assert.deepEqual(expected.issues,[]);
 const metadata=await publishedQuery(revisionQuery);
 fs.writeFileSync(path.join(out,`sanity-before-${engine}.json`),JSON.stringify(metadata,null,2));
 assert.deepEqual(raw.projects.map(p=>p._id),metadata.filter(p=>p._type==='project').map(p=>p._id),'all published project IDs retrieved');
 const byDocument=new Map(expected.projects.map(p=>[p.documentId,p]));
 for(const category of ['video','commissioned','graphic'])assert.deepEqual(expected.selectedWork[category],raw.selectedWork[category].map(r=>byDocument.get(r._ref).id),'saved ordering retained');
 assert.deepEqual(expected.indexPage.entries.slice(0,raw.indexPage.entries.length).map(e=>e.key),raw.indexPage.entries.map(e=>e._key),'editorial Index ordering retained before deterministic project fallback');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const server=http.createServer((req,res)=>{const file=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(path.join(root,file)));}catch{res.statusCode=404;res.end();}});
 // Port 5500 is already allowed by this project's Sanity CORS configuration.
 const base=process.env.SITE_BASE_URL||'http://127.0.0.1:5500/';
 if(!process.env.SITE_BASE_URL){await new Promise((resolve,reject)=>{server.once('error',error=>error.code==='EADDRINUSE'?resolve():reject(error));server.listen(5500,'127.0.0.1',resolve);});assert.equal(await (await fetch(base+'style.css')).text(),fs.readFileSync(path.join(root,'style.css'),'utf8'),'local server serves the current workspace');}
 const results=[],httpErrors=[],queries=[],forbidden=[],requestFailures=[];
 try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},hasTouch:width===390});page.setDefaultTimeout(45000);const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{const item={url:r.url().split('?')[0],failure:r.failure()};requestFailures.push(item);if(r.url().includes('/data/query/'))console.log('CMS REQUEST FAILED',JSON.stringify(item));});
  page.on('response',r=>{if(r.url().includes('/data/query/'))queries.push({url:r.url().split('?')[0],status:r.status()});if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});
  await page.route('**/*',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())){forbidden.push(r.request().url());return r.abort();}return r.continue();});
  await page.goto(base+'#info');await page.waitForFunction(()=>typeof sanityLoadSettled!=='undefined'&&sanityLoadSettled&&!!sanityContent?.infoPage);await page.evaluate(()=>document.fonts.ready);
  const actual=await page.evaluate(()=>({config:SanityData.config,projects:sanityContent.projects.map(p=>({id:p.id,documentId:p.documentId,categories:p.categories})),selectedWork:sanityContent.selectedWork,indexKeys:sanityContent.indexPage.entries.map(e=>e.key),issues:sanityContent.issues,intro:document.querySelector('.info-intro').textContent,cvCount:document.querySelectorAll('.info-cv').length,sections:[...document.querySelectorAll('.info-columns section')].map(n=>n.className),info:sanityContent.infoPage}));
  assert.equal(actual.config.projectId,'ck6xe2er');assert.equal(actual.config.dataset,'production');assert.equal(actual.config.perspective,'published');
  assert.deepEqual(actual.projects,expected.projects.map(p=>({id:p.id,documentId:p.documentId,categories:p.categories})));assert.deepEqual(actual.selectedWork,expected.selectedWork);assert.deepEqual(actual.indexKeys,expected.indexPage.entries.map(e=>e.key));assert.deepEqual(actual.issues,[]);assert.deepEqual(actual.info,expected.infoPage);assert.equal(actual.intro,expected.infoPage.introduction);assert.equal(actual.cvCount,0);
  for(const key of ['work','skills','news','publications','selectedClients','contactLinks']){const selector={selectedClients:'clients',contactLinks:'contact'}[key]||key;assert.equal(await page.locator('.info-'+selector).count(),expected.infoPage[key].length?1:0,'published empty sections hidden: '+key);}
  const infoGeometry=await page.evaluate(()=>{const nodes=[...document.querySelectorAll('.info-intro,.info-columns section')].filter(n=>n.getClientRects().length),last=Math.max(...nodes.map(n=>n.getBoundingClientRect().bottom));return{width:document.querySelector('.info-intro').getBoundingClientRect().width,gap:document.querySelector('.project-footer').getBoundingClientRect().top-last};});
  assert.ok(Math.abs(infoGeometry.gap-(width===390?844:900)*.375)<.1);assert.ok(Math.abs(infoGeometry.width-(width===390?374:1440*.49))<.03);
  for(const category of ['video','commissioned','graphic']){await page.evaluate(c=>location.hash='work/'+c,category);await page.waitForSelector(`.work[data-source="sanity"][data-category="${category[0].toUpperCase()+category.slice(1)}"]`);const ids=await page.locator('.project-preview:not([hidden])').evaluateAll(ns=>ns.map(n=>n.dataset.project));assert.deepEqual(ids,expected.selectedWork[category]);}
  await page.evaluate(()=>location.hash='archive');await page.waitForSelector('.archive[data-source="sanity"]');const entries=await page.locator('.archive-row').evaluateAll(ns=>[...new Map(ns.map(n=>[+n.dataset.index,n.firstElementChild.textContent])).entries()].sort((a,b)=>a[0]-b[0]).map(e=>e[1]));assert.deepEqual(entries,expected.indexPage.entries.map(e=>e.title));
  const details=[];let playback=null;
  for(const project of expected.projects){
   if(!project.detailPageEnabled){details.push({id:project.id,disabled:true});continue;}
   await page.evaluate(id=>location.hash='project/'+id,project.id);await page.waitForSelector(`.detail[data-project-id="${project.id}"][data-project-source="sanity"]`);
   const modules=(project.detailModules||project.modules).filter(Boolean);const rendered=await page.locator('.detail .project-module').evaluateAll(ns=>ns.map(n=>({type:n.dataset.moduleType,auto:n.querySelectorAll('.media-display-auto').length})));
   assert.deepEqual(rendered.map(r=>r.type),modules.map(m=>m.type));
   const auto=modules.flatMap(m=>m.slots||[]).filter(s=>s&&['image','mp4'].includes(s.type)&&s.mediaDisplay==='auto').length;assert.equal(rendered.reduce((sum,r)=>sum+r.auto,0),auto,'Auto Height flags reach rendered slots');
   if(!playback&&await page.locator('.detail video[autoplay]').count()){
    const video=page.locator('.detail video[autoplay]').first();await video.scrollIntoViewIfNeeded();await page.waitForFunction(v=>v.videoWidth>0&&v.videoHeight>0&&v.currentTime>0,await video.elementHandle());playback=await video.evaluate(v=>({src:v.currentSrc,width:v.videoWidth,height:v.videoHeight,time:v.currentTime,error:v.error?.message||null}));assert.equal(playback.error,null);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   details.push({id:project.id,modules:rendered.length,auto});
  }
  assert.ok(playback,'real published MP4 decoded and played');
  await page.evaluate(()=>location.hash='home');await page.waitForFunction(()=>document.querySelector('.frontpage-fade')?.dataset.source==='sanity'&&!!document.querySelector('.frontpage-fade').dataset.visibleMediaLimit);
  const home=await page.evaluate(()=>({limit:+document.querySelector('.frontpage-fade').dataset.visibleMediaLimit,count:sanityContent.homePage.media.length}));assert.equal(home.limit,expected.homePage.visibleMediaLimit);assert.equal(home.count,expected.homePage.media.length);
  assert.deepEqual(errors,[]);results.push({width,infoGeometry,projectCount:actual.projects.length,indexCount:entries.length,details,playback,home,errors});await page.close();
 }
 assert.deepEqual(forbidden,[]);assert.deepEqual(httpErrors,[]);assert.ok(queries.length>0&&queries.every(q=>q.status===200));
 const after=await publishedQuery(revisionQuery);fs.writeFileSync(path.join(out,`sanity-after-${engine}.json`),JSON.stringify(after,null,2));assert.deepEqual(after,metadata,'published revisions unchanged throughout browser verification');
 }finally{fs.writeFileSync(path.join(out,`live-${engine}.json`),JSON.stringify({results,httpErrors,queries,forbidden,requestFailures},null,2));await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
 console.log(JSON.stringify({engine,base,viewports:results.length,projects:expected.projects.length,indexEntries:expected.indexPage.entries.length,homeMedia:expected.homePage.media.length,httpErrors}));
});
