const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const layouts={full:[12],'half-half':[6,6],'half-quarter-quarter':[6,3,3],'quarter-quarter-quarter-quarter':[3,3,3,3],'third-third-third':[4,4,4],'two-thirds-one-third':[8,4]};
for(const engine of ['chromium','webkit']) test(`${engine}: all media layouts, independent heights, loading stability and MP4 metadata`,{skip:!process.env.BROWSER_TEST,timeout:180000},async()=>{
  const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
  const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  try {
    const page=await browser.newPage();
    const landscape=await require('./native-media-fixture.cjs').recordMP4(page,160,90);
    const portrait=await require('./native-media-fixture.cjs').recordMP4(page,90,160);
    await page.route('https://media.test/**',route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith('.svg')) return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${url.searchParams.get('w')}" height="${url.searchParams.get('h')}"><rect width="100%" height="100%" fill="gray"/></svg>`});
      return route.fulfill({body:url.pathname.includes('portrait')?portrait:landscape,contentType:'video/mp4'});
    });
    await page.setContent('<!doctype html><html><head></head><body><main></main></body></html>');
    await page.addStyleTag({content:fs.readFileSync(path.join(__dirname,'../style.css'),'utf8')+' body {margin:0} main {width:100%}'});
    await page.addScriptTag({path:path.join(__dirname,'../project-modules.js')});
    await page.addScriptTag({path:path.join(__dirname,'../project-video.js')});
    // Measure before the lazy images load as well as after: intrinsic dimensions reserve space.
    for(const width of [1440,820,390]) for(const height of ['auto','small','medium','large','viewport']) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(({layouts,height})=>{
        const ratios=[[400,800],[1200,800],[800,800],[1600,200]];
        const rows=[];
        for(const [type,spans] of Object.entries(layouts)) for(const pattern of ['crop','auto','mixed','opposite']) for(const order of ['default','reverse']) {
          const slots=spans.map((_,i)=>{
            const [w,h]=ratios[i%4];
            const mediaDisplay=pattern==='mixed'?(i%2?'auto':'crop'):pattern==='opposite'?(i%2?'crop':'auto'):pattern;
            return {type:'image',mediaDisplay,image:{width:w,height:h},src:`https://media.test/image.svg?w=${w}&h=${h}`};
          });
          rows.push({type,height,order,slots});
        }
        document.querySelector('main').innerHTML=renderProjectModules(rows)+'<div id="next">Next module</div>';
      },{layouts,height});
      const measure=()=>page.evaluate(()=>[...document.querySelectorAll('.project-module')].map(row=>{
        const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom}};
        return {...rect(row),auto:row.classList.contains('has-auto-media'),slots:[...row.children].map(slot=>({
          ...rect(slot),span:Number(slot.style.getPropertyValue('--slot-span')),auto:slot.classList.contains('media-display-auto'),
          media:rect(slot.firstElementChild),ratio:Number(slot.firstElementChild.getAttribute('width'))/Number(slot.firstElementChild.getAttribute('height')),
          fit:getComputedStyle(slot.firstElementChild).objectFit
        }))};
      }));
      const before=await measure();
      await page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(img=>img.decode()));});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const rows=await measure();
      const rem=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize));
      rows.forEach((row,index)=>{
        let bottom=row.y;
        for(const slot of row.slots) {
          const expected=width<=700?row.w:row.w*slot.span/12;
          assert.ok(Math.abs(slot.w-expected)<1,`${width}/${height}: column width`);
          assert.ok(slot.auto||height==='auto'?Math.abs(slot.media.w-slot.w)<1:slot.media.w>=slot.w-1.01,'media covers its assigned width');
          if(slot.auto) {
            assert.ok(Math.abs(slot.media.h-slot.media.w/slot.ratio)<1,'original aspect ratio');
            assert.ok(Math.abs(slot.h-slot.media.h)<1,'no empty container space');
            assert.equal(slot.fit,'fill');
            assert.ok(Math.abs(before[index].slots[row.slots.indexOf(slot)].h-slot.h)<1,'no image loading shift');
          } else if(height!=='auto') {
            const expectedHeight=height==='small'?Math.min(24*rem,Math.max(12*rem,width*.25)):height==='medium'?Math.min(42*rem,Math.max(20*rem,width*.45)):height==='large'?Math.min(width*.75,900):900;
            assert.ok(Math.abs(slot.h-expectedHeight)<1,`Crop dimensions ${slot.h} vs ${expectedHeight}`);
            assert.equal(slot.fit,'fill');
          }
          if(width>700) assert.ok(Math.abs(slot.y-row.y)<1,'top alignment');
          else {assert.ok(slot.y>=bottom-1,'stacked without overlap');bottom=slot.b;}
          assert.ok(slot.b<=row.b+1,'row contains every slot');
        }
        if(rows[index+1])assert.ok(rows[index+1].y>=row.b-1,'next row clears tallest media');
      });
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    }
    // Every layout supports every video display combination as well as images.
    for(const width of [1440,820,390]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(({layouts})=>{
        const rows=[];
        for(const [type,spans] of Object.entries(layouts)) for(const pattern of ['crop','auto','mixed','opposite']) {
          rows.push({type,height:'medium',slots:spans.map((_,i)=>({type:'mp4',playback:'manual',
            mediaDisplay:pattern==='mixed'?(i%2?'auto':'crop'):pattern==='opposite'?(i%2?'crop':'auto'):pattern,
            src:`https://media.test/${i%2?'landscape':'portrait'}.mp4`,aspectRatio:i%2?160/90:90/160}))});
        }
        document.querySelector('main').innerHTML=renderProjectModules(rows);
        window.cleanupVideos=initProjectVideos(document.querySelector('main'));
      },{layouts});
      await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.videoWidth&&v.videoHeight));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const measured=await page.evaluate(()=>[...document.querySelectorAll('.project-module')].map(row=>{
        const r=row.getBoundingClientRect();
        return {width:r.width,bottom:r.bottom,top:r.top,slots:[...row.children].map(slot=>{
          const v=slot.querySelector('video'),r=slot.getBoundingClientRect();
          return {width:r.width,height:r.height,bottom:r.bottom,top:r.top,span:Number(slot.style.getPropertyValue('--slot-span')),
            auto:slot.classList.contains('media-display-auto'),ratio:v.videoWidth/v.videoHeight,fit:getComputedStyle(v).objectFit};
        })};
      }));
      measured.forEach((row,i)=>{
        for(const slot of row.slots) {
          assert.ok(Math.abs(slot.width-(width<=700?row.width:row.width*slot.span/12))<1);
          if(slot.auto) {assert.ok(Math.abs(slot.height-slot.width/slot.ratio)<1);assert.equal(slot.fit,'fill');}
          else assert.equal(slot.fit,'fill');
          assert.ok(slot.bottom<=row.bottom+1);
          if(width>700)assert.ok(Math.abs(slot.top-row.top)<1);
        }
        if(measured[i+1])assert.ok(measured[i+1].top>=row.bottom-1);
      });
      await page.evaluate(()=>cleanupVideos());
    }
    // Native metadata replaces a temporary ratio; configured ratios reserve the right height immediately.
    for(const width of [1440,820,390]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>{
        document.querySelector('main').innerHTML=renderProjectModules([
          {type:'half-half',height:'small',slots:[{type:'mp4',mediaDisplay:'auto',src:'https://media.test/portrait.mp4',aspectRatio:90/160,playback:'manual'},{type:'mp4',src:'https://media.test/landscape.mp4',playback:'autoplay'}]},
          {type:'half-half',height:'medium',slots:[{type:'mp4',src:'https://media.test/landscape.mp4',mediaDisplay:'auto'},{type:'mp4',src:'https://media.test/portrait.mp4',mediaDisplay:'auto'}]}
        ])+'<div id="next">Next</div>';
        window.initialBoxes=[...document.querySelectorAll('.project-video')].map(box=>({w:box.clientWidth,h:box.clientHeight}));
        window.cleanupVideos=initProjectVideos(document.querySelector('main'));
      });
      await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(video=>video.videoWidth&&video.videoHeight));
      const videos=await page.evaluate(()=>[...document.querySelectorAll('video')].map((v,i)=>{
        const box=v.parentElement,slot=box.parentElement,r=box.getBoundingClientRect(),row=slot.parentElement.getBoundingClientRect();
        return {auto:slot.classList.contains('media-display-auto'),w:r.width,h:r.height,ratio:v.videoWidth/v.videoHeight,fit:getComputedStyle(v).objectFit,b:r.bottom,rowBottom:row.bottom,initial:initialBoxes[i],button:!!box.querySelector('button'),muted:v.muted};
      }));
      for(const [i,v] of videos.entries()) {
        if(v.auto) {assert.ok(Math.abs(v.h-v.w/v.ratio)<1,'native MP4 ratio');assert.equal(v.fit,'fill');}
        if(i===0) {assert.ok(Math.abs(v.h-v.initial.h)<1,'known video ratio stable');assert.equal(v.button,true);assert.equal(v.muted,true);}
        if(i===3) assert.ok(Math.abs(v.initial.w/v.initial.h-16/9)<.02,'unknown video stable temporary 16:9');
        assert.ok(v.b<=v.rowBottom+1,'video fits module');
      }
      const manual=page.locator('.project-video').first();
      await manual.locator('button').click();
      await page.waitForFunction(()=>!document.querySelector('video').paused);
      await manual.locator('button').click();
      await page.waitForFunction(()=>document.querySelector('video').paused);
      await page.evaluate(()=>cleanupVideos());
    }
  } finally {await browser.close();}
});
