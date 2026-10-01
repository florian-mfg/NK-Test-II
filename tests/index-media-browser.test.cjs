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
    const mp4Bytes={};
    for(const [name,w,h] of [['demo',160,90],['portrait',90,160],['square',120,120]]) {
    const encoded=await page.evaluate(async({w,h})=>{
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const context=canvas.getContext('2d');
      const stream=canvas.captureStream(20),chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:'video/mp4'});
      const done=new Promise(resolve=>recorder.onstop=resolve);
      recorder.ondataavailable=e=>chunks.push(e.data);
      recorder.start();
      const timer=setInterval(()=>{context.fillStyle=`hsl(${Date.now()%360},80%,50%)`;context.fillRect(0,0,w,h);},50);
      await new Promise(resolve=>setTimeout(resolve,600));recorder.stop();await done;
      clearInterval(timer);stream.getTracks().forEach(track=>track.stop());
      const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());
      return btoa(String.fromCharCode(...bytes));
    },{w,h});
    mp4Bytes[name]=Buffer.from(encoded,'base64');
    }
    const img={asset:{_ref:'image-portrait-800x1200-jpg'},portraitPosition:'left'};
    const vimeo={mediaType:'vimeo',vimeoUrl:'https://vimeo.com/123456/secret'};
    const mp4={mediaType:'mp4',video:{asset:{_ref:'file-demo-mp4'}}};
    const raw={projects:[],indexPage:{_id:'indexPage',_type:'indexPage',entries:[
      {displayTitle:'Mixed',previewImages:[img,vimeo,mp4]},
      {displayTitle:'Vimeo',textColor:'black',previewImages:[vimeo]},
      {displayTitle:'MP4',textColor:'white',previewImages:[mp4]},
      {displayTitle:'Image',previewImages:[img]},
      {displayTitle:'Portrait MP4',previewImages:[{mediaType:'mp4',video:{asset:{_ref:'file-portrait-mp4'}}}]},
      {displayTitle:'Square MP4',previewImages:[{mediaType:'mp4',video:{asset:{_ref:'file-square-mp4'}}}]},
      ...[123457,123458,123459].map(id=>({displayTitle:`Vimeo ${id}`,previewImages:[{mediaType:'vimeo',vimeoUrl:`https://vimeo.com/${id}/secret`}]})),
    ]}};
    await page.addInitScript(()=>{
      window.indexVideoEvents=[];
      window.Vimeo={Player:class {
        constructor(frame){this.frame=frame;window.indexVideoEvents.push('create');}
        on(){} off(){} ready(){return Promise.resolve();}
        getVideoWidth(){return Promise.resolve(this.dimensions()[0]);} getVideoHeight(){return Promise.resolve(this.dimensions()[1]);}
        dimensions(){return ({123456:[800,1200],123457:[1600,900],123458:[900,900],123459:[0,0]})[new URL(this.frame.src).pathname.split('/').pop()];}
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
      if(url.pathname.endsWith('.mp4'))return route.fulfill({body:mp4Bytes[path.basename(url.pathname,'.mp4')],contentType:'video/mp4'});
      if(url.hostname==='cdn.sanity.io')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="white"/></svg>'});
      return route.fulfill({body:'<!doctype html><html></html>',contentType:'text/html'});
    });
    const geometry=()=>page.locator('.archive-background').evaluate(bg=>{
      const b=bg.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,overflow:getComputedStyle(bg).overflow};
    });
    const checkVimeo=async(width,ratio=2/3)=>{
      await page.waitForSelector('.archive-background iframe[src]');
      const frame=page.locator('.archive-background iframe');
      const url=new URL(await frame.getAttribute('src'));
      for(const key of ['autoplay','muted','loop','background','playsinline'])assert.equal(url.searchParams.get(key),'1');
      for(const key of ['controls','title','portrait','byline','badge','keyboard'])assert.equal(url.searchParams.get(key),'0');
      assert.equal(url.searchParams.get('h'),'secret');
      await page.waitForFunction(()=>document.querySelector('.archive-background iframe').style.width!=='');
      assert.deepEqual(await geometry(),{x:0,y:0,width,height:900,overflow:'hidden'});
      const box=await frame.boundingBox();
      const portrait=width>700 && ratio<1;
      const expectedWidth=portrait?900*ratio:Math.max(width,900*ratio);
      const expectedHeight=portrait?900:Math.max(900,width/ratio);
      assert.ok(Math.abs(box.width-expectedWidth)<1);
      assert.ok(Math.abs(box.height-expectedHeight)<1);
      assert.ok(Math.abs(box.width/box.height-ratio)<.002,'Vimeo frame retains its intrinsic ratio');
      if(portrait) assert.ok(box.x>=0&&box.x+box.width<=width&&box.y===0,'complete portrait Vimeo frame is visible');
      assert.ok(Math.abs(box.x+box.width/2-width/2)<1&&Math.abs(box.y+box.height/2-450)<1);
    };
    const checkMP4=async(width,ratio=16/9)=>{
      await page.waitForFunction(()=>{const v=document.querySelector('.archive-background video');return v&&!v.paused&&v.currentTime>0;});
      const properties=await page.locator('.archive-background video').evaluate(v=>({autoplay:v.autoplay,muted:v.muted,loop:v.loop,playsInline:v.playsInline,controls:v.controls,fit:getComputedStyle(v).objectFit}));
      const portrait=width>700 && ratio<1;
      assert.deepEqual(properties,{autoplay:true,muted:true,loop:true,playsInline:true,controls:false,fit:portrait?'contain':'cover'});
      assert.deepEqual(await geometry(),{x:0,y:0,width,height:900,overflow:'hidden'});
      const video=page.locator('.archive-background video');
      const box=await video.boundingBox();
      if(portrait) {
        assert.equal(box.height,900);
        assert.ok(Math.abs(box.width-900*ratio)<1);
        assert.ok(Math.abs(box.x+box.width/2-width/2)<1);
        assert.ok(Math.abs(box.width/box.height-ratio)<.002,'native frame is not distorted');
        assert.ok(box.x>=0&&box.x+box.width<=width&&box.y===0,'complete portrait MP4 frame is visible');
      } else assert.deepEqual(box,{x:0,y:0,width,height:900});
      assert.equal(await video.evaluate(v=>v.videoWidth/v.videoHeight),ratio);
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
      for(const [index,kind,ratio] of [[4,'mp4',9/16],[5,'mp4',1],[6,'vimeo',16/9],[7,'vimeo',1],[8,'vimeo',16/9]]) {
        if(width>700) await rows.nth(index).hover();
        else {
          await rows.nth(index).evaluate(row=>row.closest('.archive-list').scrollTo({top:row.offsetTop,behavior:'instant'}));
          await page.waitForFunction(index=>document.querySelectorAll('.archive-row')[index].getAttribute('aria-current')==='true',index);
        }
        if(kind==='mp4') await checkMP4(width,ratio);else await checkVimeo(width,ratio);
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
      await page.evaluate(()=>location.hash='#info');
      await page.waitForSelector('.info');
      assert.equal(await page.locator('video, .archive-background iframe').count(),0);
      assert.ok((await page.evaluate(()=>window.indexVideoEvents)).includes('pause'));
    }
  } finally {await browser.close();}
});
