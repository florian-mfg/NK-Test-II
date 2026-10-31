const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
for(const engine of ['chromium','webkit'])test(`${engine}: real published Index retains its frame through an injected asset timeout`,{skip:!process.env.LIVE_SANITY_INDEX_FAILURE_TEST,timeout:40000},async(t)=>{
 const loaded=await require('../sanity-data.js').load({timeoutMs:45000});
 assert.equal(loaded.ok,true,JSON.stringify(loaded.error));
 const entries=loaded.data.indexPage?.entries || [];
 const candidate=entries.slice(1,3).find(entry=>entry.media[0]?.type==='image'&&entry.media[0].src!==entries[0]?.media[0]?.src);
 if(entries[0]?.media[0]?.type!=='image'||!candidate){t.skip('Timeout scenario requires distinct initial image previews');return;}
 const withheldIndex=entries.indexOf(candidate);
 const withheld=new URL(candidate.media[0].src).pathname;
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core'),browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 let release;const gate=new Promise(r=>release=r),result={engine,withheld};
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://cdn.sanity.io/**',async r=>{if(new URL(r.request().url()).pathname===withheld){await gate;return r.abort().catch(()=>{});}return r.continue();});
  const start=Date.now();await page.goto((process.env.SITE_BASE_URL||'http://127.0.0.1:5500/')+'#archive',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.archive-background img');
  assert.equal(await page.locator('.archive').getAttribute('aria-busy'),'true');
  await page.touchscreen.tap(350,650);assert.equal(await page.locator('.archive-row[aria-current]').getAttribute('data-index'),'0');
  await page.waitForSelector('.archive[data-prepared="true"]',{timeout:22000});result.completedMs=Date.now()-start;
  assert.ok(await page.locator('.archive-background img').evaluate(n=>n.complete&&n.naturalWidth>0));
  assert.equal(await page.locator('.index-loading-indicator').count(),0);
  for(let i=0;i<withheldIndex;i++)await page.touchscreen.tap(350,650);await page.waitForFunction(i=>document.querySelector('.archive').dataset.activeProject===String(i)&&!document.querySelector('.archive-list-track').classList.contains('is-moving'),withheldIndex);
  assert.ok(await page.locator('.archive-background img').evaluate(n=>n.complete&&n.naturalWidth>0),'failed entry keeps the previous good frame');
  await page.touchscreen.tap(350,650);await page.waitForFunction(i=>document.querySelector('.archive').dataset.activeProject===String(i)&&!document.querySelector('.archive-list-track').classList.contains('is-moving'),(withheldIndex+1)%entries.length);
  assert.deepEqual(errors,[]);result.errors=errors;result.passed=true;release();await page.close();
 }finally{release();const out=path.join(__dirname,'..','reports','sanity-live-verification');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`timeout-${engine}.json`),JSON.stringify(result,null,2));await browser.close();}
});
