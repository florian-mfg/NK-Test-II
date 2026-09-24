'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

test('shared contrast adapts real images, Index changes, cursor, Vimeo overrides and mobile navigation', {skip:!process.env.BROWSER_TEST},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const image=id=>({asset:{_ref:`image-${id}-1200x800-png`}});
 const project=(id,textColor='auto',video=false)=>({_id:id,_type:'project',slug:{current:id},title:id,category:'Commissioned',textColor,description:'Project information',modules:[{type:'full',height:'viewport',slots:[{type:'image',image:image(id)}]}],
  selectedWorkPreview:{composition:[{_type:'preview-full',type:'full',height:'viewport',slots:[video?{type:'video',vimeoUrl:'https://vimeo.com/12345'}:{type:'image',image:image(id)}]}]}});
 let homeColor='auto', allowImageCors=true;
 const projects=[project('light'),project('dark'),project('light','white'),project('video','black',true),project('videoauto','auto',true)];
 projects[2]._id='forced';projects[2].slug.current='forced';
 const raw=()=>({projects,homePage:{_id:'homePage',_type:'homePage',backgroundVideoUrl:'https://vimeo.com/12345',textColor:homeColor},
  selectedWork:{_id:'selectedWork',_type:'selectedWork',commissioned:projects.map(p=>({_ref:p._id})),video:[],graphic:[]},
  indexPage:{_id:'indexPage',_type:'indexPage',entries:[{displayTitle:'Cycle',previewImages:[image('light'),image('dark')]},{displayTitle:'Next',textColor:'black',previewImages:[image('dark')]}]}});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true,serviceWorkers:'block'});
  const errors=[];page.on('pageerror',error=>errors.push(error.stack));
  await page.addInitScript(()=>{
   window.Vimeo={Player:class {on(){} off(){} destroy(){return Promise.resolve()} ready(){return Promise.resolve()} getVideoWidth(){return Promise.resolve(1920)} getVideoHeight(){return Promise.resolve(1080)}}};
   window.pixelReads=0;
   const original=CanvasRenderingContext2D.prototype.getImageData;
   CanvasRenderingContext2D.prototype.getImageData=function(...args){window.pixelReads++;return original.apply(this,args);};
  });
  await page.context().route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='preview.test') {
    const file=path.join(__dirname,'..',url.pathname==='/'?'index.html':url.pathname);
    // Keep cross-origin player documents out of this deterministic UI test.
    // The Vimeo SDK is stubbed; iframe URLs and playback parameters remain intact.
    return route.fulfill({path:file,headers:{'content-security-policy':"frame-src 'none'"},contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.otf':'font/otf','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream'});
   }
   if(url.pathname.includes('/data/query/')) return route.fulfill({json:{result:raw()}});
   if(url.hostname==='cdn.sanity.io') return route.fulfill({headers:allowImageCors?{'access-control-allow-origin':'*'}:{},contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="${url.pathname.includes('dark-')?'black':'white'}"/></svg>`});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html></html>'});
  });
  const color=async(selector,expected)=>page.waitForFunction(({selector,expected})=>getComputedStyle(document.querySelector(selector)).color===expected,{selector,expected},{timeout:5000});
  await page.goto('https://preview.test/#work/commissioned');
  await page.waitForSelector('.project-title',{timeout:5000});
  for(const [index,expected] of [[0,'rgb(0, 0, 0)'],[1,'rgb(255, 255, 255)'],[2,'rgb(255, 255, 255)'],[3,'rgb(0, 0, 0)'],[4,'rgb(255, 255, 255)']]) {
   const article=page.locator('.project-preview').nth(index);
   await article.scrollIntoViewIfNeeded();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.evaluate(()=>window.Contrast.refresh());
   await color(`.project-preview:nth-child(${index+1}) .project-title > span`,expected);
   const box=await article.boundingBox();await page.mouse.move(301,Math.max(100,Math.min(800,box.y+box.height/2)));
   await color('.open-cursor',expected);
   if(index===0) await page.screenshot({path:'/tmp/nk-contrast-desktop.png'});
  }
  const reads=await page.evaluate(()=>window.pixelReads);
  for(let i=0;i<10;i++) await page.mouse.move(300+i,450);
  assert.equal(await page.evaluate(()=>window.pixelReads),reads);
  await page.goto('https://preview.test/#archive');
  await color('.archive-list','rgb(0, 0, 0)');
  await page.locator('.archive-row').first().click();
  await color('.archive-list','rgb(255, 255, 255)');
  await color('.brand','rgb(255, 255, 255)');
  await page.locator('.archive-row').nth(1).hover();
  await color('.archive-list','rgb(0, 0, 0)');
  await color('.brand','rgb(0, 0, 0)');
  for(const [setting,expected] of [['auto','rgb(255, 255, 255)'],['black','rgb(0, 0, 0)'],['white','rgb(255, 255, 255)']]) {
   homeColor=setting;await page.goto('https://preview.test/#home');await page.reload();
   await color('.site-header .brand',expected);
   assert.equal(await page.evaluate(()=>window.pixelReads),0);
   const frameURL=new URL(await page.locator('.home-media').getAttribute('src'));
   for(const key of ['autoplay','muted','loop','background']) assert.equal(frameURL.searchParams.get(key),'1');
   assert.equal(frameURL.searchParams.get('controls'),'0');
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('https://preview.test/#archive');
  await color('.archive-list','rgb(0, 0, 0)');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.archive-background img')).opacity==='1');
  await page.screenshot({path:'/tmp/nk-contrast-mobile-index.png'});
  await page.setViewportSize({width:1440,height:900});
  await page.goto('https://preview.test/#project/dark');
  await color('.detail-back','rgb(255, 255, 255)');
  await page.locator('[data-project-info-open]').click();
  await page.waitForSelector('.detail-info-layer.open');
  await color('.detail-info-popup p','rgb(0, 0, 0)');
  await page.locator('.detail-info-close').click();
  await page.locator('.header-overview').click();
  await page.waitForURL('**/#work/commissioned');
  // Cross-origin image reads fail safely when the CDN omits CORS permission.
  allowImageCors=false;
  await page.reload();
  await page.waitForSelector('.project-title');
  await color('.project-title > span','rgb(255, 255, 255)');
  allowImageCors=true;
  // Simulate tainted/unavailable canvas data: cached fallback, no frontend errors.
  await page.addInitScript(()=>{
    CanvasRenderingContext2D.prototype.getImageData=function(){throw new DOMException('Unavailable image data','SecurityError');};
  });
  await page.goto('https://preview.test/#work/commissioned');await page.reload();
  await page.waitForSelector('.project-title');
  await color('.project-title > span','rgb(255, 255, 255)');
  await page.evaluate(()=>window.Contrast.refresh());
  await color('.project-title > span','rgb(255, 255, 255)');
  await page.setViewportSize({width:390,height:844});

  await page.goto('https://preview.test/#info');
  await color('.site-header .brand','rgb(0, 0, 0)');
  await page.locator('.mobile-menu-toggle').tap();
  assert.equal(await page.locator('.mobile-menu').evaluate(node=>node.open),true);
  assert.equal(await page.locator('.mobile-menu-header').evaluate(node=>getComputedStyle(node).color),'rgb(0, 0, 0)');
  await page.screenshot({path:'/tmp/nk-contrast-mobile.png'});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
