'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

test('manual overview controls are reachable on desktop/mobile without stealing project navigation', {skip:!process.env.BROWSER_TEST},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const layouts={full:1,'half-half':2,'half-quarter-quarter':3,'quarter-quarter-quarter-quarter':4,'third-third-third':3,'two-thirds-one-third':2};
 const projects=Object.entries(layouts).map(([type,count],index)=>{
  const slots=Array.from({length:count},(_,i)=>({type:'video',vimeoUrl:`https://vimeo.com/${12345+i}`,playback:i%2?'autoplay':'manual'}));
  const module={type,height:'medium',slots};
  return {_id:`p${index}`,_type:'project',slug:{current:`p${index}`},title:type,category:'Commissioned',textColor:index===0?'auto':index%2?'black':'white',modules:[module],
   selectedWorkPreview:{composition:[{...module,_type:`preview-${type}`}]}};
 });
 const raw={projects,selectedWork:{_id:'selectedWork',_type:'selectedWork',commissioned:projects.map(p=>({_ref:p._id})),video:[],graphic:[]}};
 try {
  const page=await browser.newPage({hasTouch:true});
  await page.addInitScript(()=>{
   window.playbackCalls=[];
   window.Vimeo={Player:class {
    constructor(frame){this.frame=frame;this.events={};}
    on(name,callback){this.events[name]=callback;} off(name){delete this.events[name];}
    ready(){return Promise.resolve();} destroy(){return Promise.resolve();}
    getVideoWidth(){return Promise.resolve(1920);} getVideoHeight(){return Promise.resolve(1080);}
    play(){window.playbackCalls.push('play');this.events.play();return Promise.resolve();}
    pause(){window.playbackCalls.push('pause');this.events.pause();return Promise.resolve();}
   }};
  });
  await page.context().route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='preview.test') {
    const file=path.join(__dirname,'..',url.pathname==='/'?'index.html':url.pathname);
    return route.fulfill({path:file,headers:{'content-security-policy':"frame-src 'none'"},contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.otf':'font/otf','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream'});
   }
   if(url.pathname.includes('/data/query/'))return route.fulfill({json:{result:raw}});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html></html>'});
  });
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:900});
   await page.goto('https://preview.test/#work/commissioned');
   await page.waitForSelector('.project-video-toggle:not([disabled])');
   for(let index=0;index<projects.length;index++) {
    const article=page.locator('.project-preview').nth(index);
    const frames=article.locator('.project-vimeo');
    for(const box of await frames.all()) {
     const mode=await box.getAttribute('data-playback');
     const url=new URL(await box.locator('iframe').getAttribute('src'));
     assert.equal(url.searchParams.get('autoplay'),mode==='autoplay'?'1':'0');
     assert.equal(url.searchParams.get('controls'),'0');
     assert.equal(await box.locator('iframe').evaluate(node=>getComputedStyle(node).pointerEvents),'none');
     const button=box.locator('button');
     if(mode==='autoplay') {assert.equal(await button.count(),0);continue;}
     await button.scrollIntoViewIfNeeded();
     const before=await box.boundingBox(),buttonBox=await button.boundingBox();
     assert.equal(await button.textContent(),'(Play)');
     assert.equal(await button.locator('img, svg').count(),0);
     const typography=await button.evaluate(node=>{
      const style=getComputedStyle(node),standard=getComputedStyle(document.querySelector('.site-header .brand'));
      return {font:style.fontFamily,size:style.fontSize,weight:style.fontWeight,line:style.lineHeight,
       expectedFont:standard.fontFamily,expectedSize:standard.fontSize,expectedWeight:standard.fontWeight,expectedLine:standard.lineHeight,
       bottom:style.bottom,right:style.right,pad:getComputedStyle(document.documentElement).getPropertyValue('--pad').trim(),
       touchHeight:getComputedStyle(node,'::after').minHeight};
     });
     assert.equal(typography.font,typography.expectedFont);assert.equal(typography.size,typography.expectedSize);
     assert.equal(typography.weight,typography.expectedWeight);assert.equal(typography.line,typography.expectedLine);
     assert.equal(typography.bottom,typography.pad);assert.equal(typography.right,typography.pad);
     if(width===390) assert.equal(typography.touchHeight,'44px');
     await page.waitForFunction(({index,expected})=>[...document.querySelectorAll('.project-preview')][index].querySelector('.project-video-toggle')?.style.getPropertyValue('--contrast-color')===expected,{index,expected:index%2?'#000000':'#ffffff'});
     const point={x:buttonBox.x+buttonBox.width/2,y:buttonBox.y+buttonBox.height/2};
     assert.equal(await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('.project-video-toggle')),point),true,`control hit area at width ${width}, project ${index}`);
     if(width>700) await button.click();else await button.tap();
     assert.equal(await button.textContent(),'(Pause)');
     assert.equal(await button.getAttribute('aria-label'),'Pause video');
     assert.equal(new URL(page.url()).hash,'#work/commissioned');
     assert.deepEqual(await box.boundingBox(),before);
     if(width>700) await button.click();else await button.tap();
     assert.equal(await button.textContent(),'(Play)');
     assert.equal(await button.getAttribute('aria-label'),'Play video');
    }
   }
   const first=page.locator('.project-preview').first();
   await first.scrollIntoViewIfNeeded();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const rect=await first.boundingBox(),point={x:rect.x+20,y:rect.y+rect.height/3};
   if(width>700) {
    await page.mouse.move(point.x,point.y);
    await page.waitForSelector('.open-cursor:not([hidden])');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.open-cursor')).color==='rgb(255, 255, 255)');
    await page.mouse.click(point.x,point.y);
   }else await page.touchscreen.tap(point.x,point.y);
   await page.waitForURL('**/#project/p0');
   await page.waitForSelector('.detail .project-video-toggle:not([disabled])');
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.detail .project-video-toggle')).color==='rgb(255, 255, 255)');
   const detailButton=page.locator('.detail .project-video-toggle');
   if(width>700) await detailButton.click();else await detailButton.tap();
   assert.equal(await detailButton.textContent(),'(Pause)');
   assert.equal(new URL(page.url()).hash,'#project/p0');
  }
  assert.ok((await page.evaluate(()=>window.playbackCalls)).includes('pause'));
 }finally{await browser.close();}
});
