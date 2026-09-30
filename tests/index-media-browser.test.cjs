'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

test('Index mixed media cover, playback cleanup, contrast and desktop/mobile interactions', {skip:!process.env.BROWSER_TEST},async()=>{
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const page=await browser.newPage({hasTouch:true});
    // Generate a real, silent MP4 locally: no external fixture or CMS write.
    const encoded=await page.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
      const context=canvas.getContext('2d');
      const stream=canvas.captureStream(20),chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:'video/mp4'});
      const done=new Promise(resolve=>recorder.onstop=resolve);
      recorder.ondataavailable=e=>chunks.push(e.data);
      recorder.start();
      const timer=setInterval(()=>{context.fillStyle=`hsl(${Date.now()%360},80%,50%)`;context.fillRect(0,0,160,90);},50);
      await new Promise(resolve=>setTimeout(resolve,600));recorder.stop();await done;
      clearInterval(timer);stream.getTracks().forEach(track=>track.stop());
      const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());
      return btoa(String.fromCharCode(...bytes));
    });
    const mp4Bytes=Buffer.from(encoded,'base64');
    const img={asset:{_ref:'image-portrait-800x1200-jpg'},portraitPosition:'left'};
    const vimeo={mediaType:'vimeo',vimeoUrl:'https://vimeo.com/123456/secret'};
    const mp4={mediaType:'mp4',video:{asset:{_ref:'file-demo-mp4'}}};
    const raw={projects:[],indexPage:{_id:'indexPage',_type:'indexPage',entries:[
      {displayTitle:'Mixed',previewImages:[img,vimeo,mp4]},
      {displayTitle:'Vimeo',textColor:'black',previewImages:[vimeo]},
      {displayTitle:'MP4',textColor:'white',previewImages:[mp4]},
      {displayTitle:'Image',previewImages:[img]},
    ]}};
    await page.addInitScript(()=>{
      window.indexVideoEvents=[];
      window.Vimeo={Player:class {
        constructor(frame){this.frame=frame;window.indexVideoEvents.push('create');}
        on(){} off(){} ready(){return Promise.resolve();}
        getVideoWidth(){return Promise.resolve(800);} getVideoHeight(){return Promise.resolve(1200);}
        destroy(){window.indexVideoEvents.push('destroy');this.frame.remove();return Promise.resolve();}
      }};
      const originalPause=HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.pause=function(){window.indexVideoEvents.push('pause');return originalPause.call(this);};
    });
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='preview.test') {
        const file=path.join(__dirname,'..',url.pathname==='/'?'index.html':url.pathname);
        return route.fulfill({path:file,contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.otf':'font/otf','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream'});
      }
      if(url.pathname.includes('/data/query/'))return route.fulfill({json:{result:raw}});
      if(url.pathname.endsWith('.mp4'))return route.fulfill({body:mp4Bytes,contentType:'video/mp4'});
      if(url.hostname==='cdn.sanity.io')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="white"/></svg>'});
      return route.fulfill({body:'<!doctype html><html></html>',contentType:'text/html'});
    });
    const geometry=()=>page.locator('.archive-background').evaluate(bg=>{
      const b=bg.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,overflow:getComputedStyle(bg).overflow};
    });
    const checkVimeo=async(width)=>{
      await page.waitForSelector('.archive-background iframe[src]');
      const frame=page.locator('.archive-background iframe');
      const url=new URL(await frame.getAttribute('src'));
      for(const key of ['autoplay','muted','loop','background','playsinline'])assert.equal(url.searchParams.get(key),'1');
      for(const key of ['controls','title','portrait','byline','badge','keyboard'])assert.equal(url.searchParams.get(key),'0');
      assert.equal(url.searchParams.get('h'),'secret');
      await page.waitForFunction(()=>document.querySelector('.archive-background iframe').style.width!=='');
      assert.deepEqual(await geometry(),{x:0,y:0,width,height:900,overflow:'hidden'});
      const box=await frame.boundingBox();assert.ok(box.width>=width&&box.height>=900);
      assert.ok(Math.abs(box.width/box.height-2/3)<.002);
      assert.ok(Math.abs(box.x+box.width/2-width/2)<1&&Math.abs(box.y+box.height/2-450)<1);
    };
    const checkMP4=async(width)=>{
      await page.waitForFunction(()=>{const v=document.querySelector('.archive-background video');return v&&!v.paused&&v.currentTime>0;});
      const properties=await page.locator('.archive-background video').evaluate(v=>({autoplay:v.autoplay,muted:v.muted,loop:v.loop,playsInline:v.playsInline,controls:v.controls,fit:getComputedStyle(v).objectFit}));
      assert.deepEqual(properties,{autoplay:true,muted:true,loop:true,playsInline:true,controls:false,fit:'cover'});
      assert.deepEqual(await geometry(),{x:0,y:0,width,height:900,overflow:'hidden'});
      const box=await page.locator('.archive-background video').boundingBox();assert.deepEqual(box,{x:0,y:0,width,height:900});
      assert.equal(await page.locator('.archive-background iframe').count(),0);
    };
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:900});await page.goto('https://preview.test/#archive');
      await page.waitForSelector('.archive[data-source="sanity"]');
      const rows=page.locator('.archive-row');
      assert.equal(await page.locator('.archive-background video, .archive-background iframe').count(),0);
      if(width>700) {
        await rows.first().click();await checkVimeo(width);
        await page.waitForFunction(()=>document.querySelector('.archive-list').style.getPropertyValue('--contrast-color')==='#ffffff');
        await rows.first().click();await checkMP4(width);
        assert.ok((await page.evaluate(()=>window.indexVideoEvents)).includes('destroy'));
        await rows.first().click();
        await page.waitForSelector('.archive-background.half.portrait-left img');
        assert.ok((await page.evaluate(()=>window.indexVideoEvents)).includes('pause'));
        await rows.nth(1).hover();await checkVimeo(width);
      } else {
        // Preserve existing mobile blank-area tap: advance entries, not media frames.
        await page.touchscreen.tap(width/2,600);await checkVimeo(width);
      }
      await page.waitForFunction(()=>document.querySelector('.archive-list').style.getPropertyValue('--contrast-color')==='#000000');
      if(width>700)await rows.nth(2).hover();else await page.touchscreen.tap(width/2,600);
      await checkMP4(width);
      await page.waitForFunction(()=>document.querySelector('.archive-list').style.getPropertyValue('--contrast-color')==='#ffffff');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
      await page.evaluate(()=>location.hash='#info');
      await page.waitForSelector('.info');
      assert.equal(await page.locator('video, .archive-background iframe').count(),0);
      assert.ok((await page.evaluate(()=>window.indexVideoEvents)).includes('pause'));
    }
  } finally {await browser.close();}
});
