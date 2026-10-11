'use strict';
const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const adapter=require('../sanity-data.js');
// Opt-in, read-only live CMS/CDN audit. Writes only a local diagnostic report.
test('published MP4 assets decode and play in Chrome; Revoshock manual frames and controls remain visible',{skip:!process.env.LIVE_MP4_TEST,timeout:360000},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const {config,query}=adapter;
 const response=await fetch(`https://${config.projectId}.api.sanity.io/v${config.apiVersion}/data/query/${config.dataset}?perspective=published&query=${encodeURIComponent(query)}`);
 assert.equal(response.ok,true);const {result:raw,error}=await response.json();assert.equal(error,undefined);
 const normalized=adapter.normalize(raw);assert.deepEqual(normalized.issues.filter(i=>i.code==='invalid_video'),[]);
 const references=[];
 function walk(value,slot){if(!value||typeof value!=='object')return;if(value.asset?.url?.endsWith('.mp4'))references.push({slot,url:value.asset.url});for(const [key,v]of Object.entries(value))walk(v,`${slot}.${key}`)}walk(raw,'result');
 const report={references,assets:[],routes:[]};
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
 for(const url of [...new Set(references.map(r=>r.url))]){
  const page=await browser.newPage();const session=await page.context().newCDPSession(page),properties={},statuses=[];
  session.on('Media.playerPropertiesChanged',e=>{for(const property of e.properties)properties[property.name]=property.value});await session.send('Media.enable');
  page.on('response',r=>{if(r.url()===url)statuses.push(r.status())});await page.goto('about:blank');
  await page.evaluate(url=>{const video=document.createElement('video');video.muted=true;video.playsInline=true;video.src=url;document.body.append(video);video.play().catch(e=>window.playError=e.message)},url);
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v.videoWidth>0&&v.videoHeight>0&&v.currentTime>0},{},{timeout:30000});
  await page.waitForTimeout(800);
  const state=await page.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,time:v.currentTime,ready:v.readyState,error:v.error?.message||null}));
  report.assets.push({url,...state,statuses,properties});assert.equal(state.error,null);assert.ok(statuses.some(s=>s===200||s===206));await page.close();
 }
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://preview.test/**',r=>{const url=new URL(r.request().url());return r.fulfill({path:path.join(__dirname,'..',url.pathname==='/'?'index.html':url.pathname)})});
  await page.route('**/data/query/**',r=>r.fulfill({json:{result:raw}}));
  await page.goto('https://preview.test/#project/revoshock');await page.waitForSelector('.detail [data-video-ready]');
  const boxes=page.locator('.detail .project-video');assert.equal(await boxes.count(),3);
  for(const box of await boxes.all()){
   await box.scrollIntoViewIfNeeded();const video=box.locator('video');await page.waitForFunction(v=>v.readyState>=2,await video.elementHandle());
   const before=await video.evaluate(v=>({visible:getComputedStyle(v).visibility,paused:v.paused,width:v.getBoundingClientRect().width,height:v.getBoundingClientRect().height,ratio:v.videoWidth/v.videoHeight,inline:v.playsInline}));
   assert.equal(before.visible,'visible');assert.equal(before.paused,true);assert.equal(before.inline,true);assert.ok(before.width>0&&before.height>0);assert.ok(Math.abs(before.width/before.height-before.ratio)<.01);
   const button=box.locator('.project-video-toggle');await button.click();await page.waitForFunction(v=>!v.paused&&v.currentTime>0,await video.elementHandle());
   const sound=page.locator('.detail-sound-control');await sound.click();await page.waitForFunction(v=>!v.muted,await video.elementHandle());assert.equal(await page.locator('video').evaluateAll(vs=>vs.filter(v=>!v.muted).length),1);
   await sound.click();await page.waitForFunction(v=>v.muted,await video.elementHandle());await button.click();await page.waitForFunction(v=>v.paused,await video.elementHandle());
  }
  await page.evaluate(()=>{window.oldVideos=[...document.querySelectorAll('video')];location.hash='#info'});await page.waitForSelector('.info');assert.equal(await page.evaluate(()=>window.oldVideos.every(v=>v.paused&&!v.hasAttribute('src'))),true);
  report.routes.push({width,project:'revoshock',manualPlayback:true,soundMute:true,cleanup:true,errors});assert.deepEqual(errors,[]);await page.close();
 }
 }finally{fs.writeFileSync(process.env.MP4_AUDIT_REPORT||'/tmp/nk-live-mp4-audit.json',JSON.stringify(report,null,2));await browser.close()}
});
