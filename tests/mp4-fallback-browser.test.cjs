'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
test('metadata readiness, posterless manual frame, autoplay rejection, poster removal and optional frontpage MP4',{skip:!process.env.BROWSER_TEST},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
 for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900},hasTouch:width===390});const errors=[];page.on('pageerror',e=>errors.push(e.message));const bytes=await require('./native-media-fixture.cjs').recordMP4(page);
 await page.route('https://fixture.test/**',r=>r.request().url().endsWith('.svg')?r.fulfill({body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="red"/></svg>',contentType:'image/svg+xml'}):r.request().url().endsWith('.mp4')?r.fulfill({body:bytes,contentType:'video/mp4'}):r.fulfill({body:'<!doctype html><html><body><main></main></body></html>',contentType:'text/html'}));
 await page.goto('https://fixture.test/');for(const file of ['project-modules.js','project-video.js','frontpage-media-fade.js'])await page.addScriptTag({path:path.join(__dirname,'..',file)});await page.addStyleTag({path:path.join(__dirname,'..','style.css')});
 await page.evaluate(()=>{
  window.originalPlay=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){return window.rejectAutoplay?Promise.reject(new DOMException('Blocked by test policy','NotAllowedError')):window.originalPlay.call(this)};
  window.rejectAutoplay=true;
  const main=document.querySelector('main');main.innerHTML=renderProjectModules([{type:'full',height:'auto',slots:[{type:'mp4',src:'https://fixture.test/demo.mp4',playback:'autoplay',poster:'https://fixture.test/poster.svg'}]}],'','overview');main.querySelector('video').autoplay=false;window.dispose=initProjectVideos(main);
 });
 await page.waitForSelector('.project-video-toggle');const box=page.locator('.project-video'),video=box.locator('video'),poster=box.locator('.project-video-poster');await page.waitForFunction(v=>v.readyState>=2,await video.elementHandle());assert.equal(await poster.isVisible(),true);assert.equal(await video.evaluate(v=>v.paused),true);assert.match(await box.locator('button').getAttribute('title'),/blocked/);
 await page.evaluate(()=>window.rejectAutoplay=false);await box.locator('button').click();await page.waitForFunction(v=>!v.paused&&v.currentTime>0,await video.elementHandle());await page.waitForFunction(p=>p.hidden,await poster.elementHandle());assert.equal(await poster.isVisible(),false);assert.equal(await video.evaluate(v=>getComputedStyle(v).visibility),'visible');await box.locator('button').click();assert.equal(await video.evaluate(v=>v.paused),true);
 await page.evaluate(()=>{window.dispose();const main=document.querySelector('main');main.innerHTML=renderProjectModules([{type:'full',height:'auto',slots:[{type:'mp4',src:'https://fixture.test/demo.mp4',playback:'manual'}]}]);window.dispose=initProjectVideos(main)});
 const manual=page.locator('video');await page.waitForFunction(v=>v.readyState>=2,await manual.elementHandle());assert.equal(await manual.evaluate(v=>getComputedStyle(v).visibility),'visible');assert.equal(await manual.evaluate(v=>v.paused),true);const geometry=await manual.boundingBox();assert.ok(Math.abs(geometry.width/geometry.height-16/9)<.01);
 await page.evaluate(()=>{window.dispose();const main=document.querySelector('main');main.innerHTML='<div class="frontpage-fade"></div>';window.disposeFade=FrontpageMediaFade.init(main.firstChild,[{type:'mp4',src:'https://fixture.test/demo.mp4'},{type:'image',src:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E'}])});
 await page.evaluate(()=>{const main=document.querySelector('main');main.setPointerCapture=()=>{};main.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:77}));});
 await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&!v.paused&&v.currentTime>0});assert.equal(await page.locator('video').evaluate(v=>v.muted&&v.loop&&v.playsInline),true);const old=await page.locator('video').elementHandle();await page.evaluate(()=>window.disposeFade());assert.equal(await old.evaluate(v=>v.paused&&!v.hasAttribute('src')),true);assert.deepEqual(errors,[]);await page.close();
 }
 }finally{await browser.close()}
});
