'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

test('standalone and Project-linked Index share cycling, native playback, contrast and desktop/mobile interactions', {skip:!process.env.BROWSER_TEST},async()=>{
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
    const legacy={mediaType:'vimeo',vimeoUrl:'https://vimeo.com/123456/secret'};
    const mp4={mediaType:'mp4',video:{asset:{_ref:'file-demo-mp4'}}};
    const linkedProject = (id,title,media,textColor) => ({_id:id,_type:'project',title,slug:{current:id},categories:['Graphic'],year:2026,additionalInfo:'Project client',textColor:'white',modules:[],indexmaterial:{media,textColor}});
    const raw={projects:[
      linkedProject('mixed','Mixed',[{mediaType:'image',image:img},mp4,{mediaType:'image',image:img}]),
      linkedProject('black','Black MP4',[mp4],'black'),
      linkedProject('square','Square MP4',[{mediaType:'mp4',video:{asset:{_ref:'file-square-mp4'}}}]),
    ],indexPage:{_id:'indexPage',_type:'indexPage',entries:[
      {_type:'indexProjectReference',project:{_ref:'mixed'}},
      {_type:'indexProjectReference',project:{_ref:'black'}},
      {displayTitle:'MP4',textColor:'white',previewImages:[mp4]},
      {displayTitle:'Image',previewImages:[img]},
      {displayTitle:'Portrait MP4',previewImages:[{mediaType:'mp4',video:{asset:{_ref:'file-portrait-mp4'}}}]},
      {displayTitle:'Unsupported legacy',previewImages:[legacy]},
      {displayTitle:'Linked duplicate',project:{_ref:'mixed'},previewImages:[img]},
    ]}};
    const before = JSON.stringify(raw);
    await page.addInitScript(()=>{
      window.indexVideoEvents=[];
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
    const checkMP4=async(width,ratio=16/9)=>{
      await page.waitForFunction(()=>{const v=document.querySelector('.archive-background video');return v&&!v.paused&&v.currentTime>0;});
      const properties=await page.locator('.archive-background video').evaluate(v=>({autoplay:v.autoplay,muted:v.muted,loop:v.loop,playsInline:v.playsInline,controls:v.controls,fit:getComputedStyle(v).objectFit}));
      const portrait=width>700 && ratio<1;
      assert.deepEqual(properties,{autoplay:true,muted:true,loop:true,playsInline:true,controls:false,fit:portrait?'contain':'cover'});
      assert.deepEqual(await geometry(),{x:0,y:0,width,height:900,overflow:'hidden'});
      assert.equal(await page.locator('body').evaluate(b=>getComputedStyle(b).backgroundColor),'rgb(255, 255, 255)');
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
      assert.equal(await rows.count(),6);
      assert.deepEqual(await rows.locator('span:first-child').allTextContents(),['Mixed','Black MP4','MP4','Image','Portrait MP4','Square MP4']);
      assert.equal(await rows.first().getAttribute('data-year'),'2026');
      assert.equal(await rows.first().locator('.archive-additional-info').textContent(),'Project client');
      assert.equal(await page.locator('iframe').count(),0);
      assert.equal(await page.locator('.detail-sound-control').textContent(),'(Sound)');
      assert.equal(await page.locator('.archive-background video, .archive-background iframe').count(),0);
      if(width>700) {
        await rows.first().click();await checkMP4(width);
        await rows.first().click();
        await page.waitForSelector('.archive-background.half.portrait-left img');
        assert.ok((await page.evaluate(()=>window.indexVideoEvents)).includes('pause'));
        await rows.nth(1).hover();await checkMP4(width);
      } else {
        await page.touchscreen.tap(width/2,600);await checkMP4(width);
      }
      await page.waitForFunction(()=>document.querySelector('.archive-list').style.getPropertyValue('--contrast-color')==='#000000');
      if(width>700)await rows.nth(2).hover();else await page.touchscreen.tap(width/2,600);
      await checkMP4(width);
      await page.waitForFunction(()=>document.querySelector('.archive-list').style.getPropertyValue('--contrast-color')==='#ffffff');
      for(const [index,kind,ratio] of [[4,'mp4',9/16],[5,'mp4',1]]) {
        if(width>700) await rows.nth(index).hover();
        else {
          await rows.nth(index).evaluate(row=>row.closest('.archive-list').scrollTo({top:row.offsetTop,behavior:'instant'}));
          await page.waitForFunction(index=>document.querySelectorAll('.archive-row')[index].getAttribute('aria-current')==='true',index);
        }
        await checkMP4(width,ratio);
      }
      const sound = page.locator('.detail-sound-control');
      assert.equal(await sound.textContent(), '(Sound)');
      const before = await page.locator('.archive-row[aria-current="true"]').getAttribute('data-index');
      await sound.click();
      assert.equal(await sound.textContent(), '(Mute)');
      assert.equal(await page.locator('.archive-row[aria-current="true"]').getAttribute('data-index'), before);
      await page.waitForFunction(() => !document.querySelector('.archive-background video')?.muted);
      // Move to native media with sound enabled, then to an image and back.
      const select = async index => {
        if (width > 700) await rows.nth(index).hover();
        else await rows.nth(index).evaluate(row => row.closest('.archive-list').scrollTo({top:row.offsetTop,behavior:'instant'}));
        await page.waitForFunction(index => document.querySelectorAll('.archive-row')[index].getAttribute('aria-current')==='true',index);
      };
      await select(2);
      await page.waitForFunction(() => {const v=document.querySelector('.archive-background video');return v&&!v.muted&&!v.paused;});
      const oldVideo = await page.locator('.archive-background video').evaluateHandle(v=>v);
      await select(3);
      await page.waitForSelector('.archive-background img');
      assert.equal(await oldVideo.evaluate(v=>v.paused && !v.getAttribute('src')),true);
      assert.equal(await sound.textContent(), '(Mute)');
      assert.equal(await page.locator('.archive-background video, .archive-background iframe').count(),0);
      await select(2);
      await page.waitForFunction(() => !document.querySelector('.archive-background video')?.muted);
      await sound.click();
      await page.waitForFunction(() => document.querySelector('.archive-background video')?.muted);
      assert.equal(await sound.textContent(), '(Sound)');
      const placement = await sound.evaluate(b=>{const r=b.getBoundingClientRect();const info=document.querySelector('.detail-info-label');return {right:innerWidth-r.right,bottom:innerHeight-r.bottom,infoBottom:info?innerHeight-info.getBoundingClientRect().bottom:null};});
      assert.ok(placement.right>0 && placement.bottom>0);
      if(placement.infoBottom!==null) assert.ok(Math.abs(placement.bottom-placement.infoBottom)<1);
      assert.equal(await page.locator('body').evaluate(b=>getComputedStyle(b).backgroundColor),'rgb(255, 255, 255)');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
      await page.evaluate(()=>location.hash='#info');
      await page.waitForSelector('.info');
      assert.equal(await page.locator('video, .archive-background iframe, .detail-sound-control').count(),0);
      assert.ok((await page.evaluate(()=>window.indexVideoEvents)).includes('pause'));
    }
    assert.equal(JSON.stringify(raw),before);
    raw.projects = [];
    raw.indexPage.entries = [{displayTitle:'Only image', previewImages:[img]}];
    await page.goto('https://preview.test/#archive');
    await page.reload();
    await page.waitForSelector('.archive-background img');
    assert.equal(await page.locator('.detail-sound-control').count(),0);
  } finally {await browser.close();}
});
