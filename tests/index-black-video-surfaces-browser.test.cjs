'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
test('Index stays black during loading/transitions and Auto contrast reads uncovered black areas',{skip:!process.env.BROWSER_TEST},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},hasTouch:width===390});
  const raw={projects:[],indexPage:{_id:'indexPage',_type:'indexPage',entries:[{displayTitle:'Portrait',previewImages:[{asset:{_ref:'image-one-300x600-jpg'}},{asset:{_ref:'image-two-300x600-jpg'}}]}]}};
  await page.addInitScript(()=>{window.backgroundSamples=[];function sample(){if(document.body?.classList.contains('is-index')&&document.styleSheets.length){window.backgroundSamples.push([...document.querySelectorAll('body, .archive, .archive-background')].map(n=>getComputedStyle(n).backgroundColor));}requestAnimationFrame(sample)}requestAnimationFrame(sample)});
  await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname==='preview.test')return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});if(u.pathname.includes('/data/query/')){await new Promise(resolve=>setTimeout(resolve,250));return r.fulfill({json:{result:raw}})}if(u.hostname==='cdn.sanity.io'){await new Promise(resolve=>setTimeout(resolve,150));return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="600"><rect width="300" height="600" fill="gray"/></svg>'})}return r.fulfill({body:''})});
  await page.goto('https://preview.test/#archive');await page.waitForSelector('.archive-background img');
  await page.waitForFunction(()=>document.querySelector('.site-header .brand').style.getPropertyValue('--contrast-color')==='#ffffff');
  if(width>700)await page.locator('.archive-row').click();else await page.touchscreen.tap(195,700);
  await page.waitForFunction(()=>document.querySelector('.archive-background img')?.currentSrc.includes('two-'));
  const samples=await page.evaluate(()=>window.backgroundSamples);assert.ok(samples.length>5);assert.ok(samples.every(s=>s.every(c=>c==='rgb(0, 0, 0)')));
  const png=(await page.screenshot()).toString('base64');const corner=await page.evaluate(async png=>{const i=new Image();i.src='data:image/png;base64,'+png;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return [...x.getImageData(1,c.height-2,1,1).data]},png);assert.deepEqual(corner,[0,0,0,255]);
  await page.close();
 }}finally{await browser.close()}
});
test('video media and stretched auto-grid slots have black surfaces without scaling or geometry gaps',{skip:!process.env.BROWSER_TEST},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{const page=await browser.newPage();const bytes=await require('./native-media-fixture.cjs').recordMP4(page);await page.route('https://fixture.test/**',r=>r.request().url().endsWith('.mp4')?r.fulfill({body:bytes,contentType:'video/mp4'}):r.fulfill({body:'<!doctype html><body class="is-work"><main></main></body>',contentType:'text/html'}));await page.goto('https://fixture.test/');for(const file of ['project-modules.js','project-video.js'])await page.addScriptTag({path:path.join(__dirname,'..',file)});await page.addStyleTag({path:path.join(__dirname,'..','style.css')});
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});for(const type of ['full','half-half','half-quarter-quarter','quarter-quarter-quarter-quarter','third-third-third','two-thirds-one-third']){
 await page.evaluate(type=>{window.cleanup?.();const spans=PROJECT_MODULE_TYPES[type];document.querySelector('main').innerHTML=renderProjectModules([{type,height:'auto',slots:spans.map((_,i)=>i===0?{type:'mp4',src:'https://fixture.test/video.mp4',playback:'manual'}:{type:'text',text:'Tall companion\n\n'.repeat(15),textSize:'s'})}]);window.cleanup=initProjectVideos(document.querySelector('main'))},type);
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
 const g=await page.locator('.project-video').evaluate(box=>{const v=box.querySelector('video'),slot=box.parentElement,b=box.getBoundingClientRect(),r=v.getBoundingClientRect(),s=getComputedStyle(v);return{background:getComputedStyle(box).backgroundColor,slotBackground:getComputedStyle(slot).backgroundColor,dimensions:[b.width,b.height,r.width,r.height],ratio:v.videoWidth/v.videoHeight,margin:s.margin,padding:s.padding,border:s.borderWidth}});
 assert.equal(g.background,'rgb(0, 0, 0)');assert.equal(g.slotBackground,'rgb(0, 0, 0)');assert.ok(Math.abs(g.dimensions[0]-g.dimensions[2])<.1&&Math.abs(g.dimensions[1]-g.dimensions[3])<.1);assert.ok(Math.abs(g.dimensions[0]/g.dimensions[1]-g.ratio)<.01);assert.equal(g.margin,'0px');assert.equal(g.padding,'0px');assert.equal(g.border,'0px');
 }}await page.evaluate(()=>window.cleanup());}finally{await browser.close()}
});
