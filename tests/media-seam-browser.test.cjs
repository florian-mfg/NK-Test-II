'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),out=process.env.MEDIA_SEAM_OUTPUT_DIR||path.join(root,'reports/media-seams');
const layouts={full:[12],'half-half':[6,6],'half-quarter-quarter':[6,3,3],'quarter-quarter-quarter-quarter':[3,3,3,3],'third-third-third':[4,4,4],'two-thirds-one-third':[8,4]};
for(const engine of ['chromium','webkit'])test(`${engine}: intrinsic mixed media, exact module boundaries and raster seams at DPR 1/2/3`,{skip:!process.env.BROWSER_TEST,timeout:180000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const encoder=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const recorder=await encoder.newPage();const solid=await recorder.evaluate(()=>{const c=document.createElement('canvas');c.width=997;c.height=563;const x=c.getContext('2d');x.fillStyle='#555';x.fillRect(0,0,c.width,c.height);return c.toDataURL('image/png').split(',')[1];});const video=await require('./native-media-fixture.cjs').recordMP4(recorder,90,160);await encoder.close();
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');const work=app.slice(app.indexOf('function renderWorkModule'),app.indexOf('function workCategory'));
 let cases=0,pixelChecks=0,maxGap=0,maxRatioError=0;const videoIssues=[],imageIssues=[];
 fs.mkdirSync(out,{recursive:true});
 try{
 for(const dpr of [1,2,3])for(const width of [390,701,1025,1440]){
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:dpr,hasTouch:width<=700,isMobile:width<=700});
  page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://media.test/**',r=>{const u=new URL(r.request().url());if(u.pathname.endsWith('.png'))return r.fulfill({body:Buffer.from(solid,'base64'),contentType:'image/png'});return u.pathname.endsWith('.mp4')?r.fulfill({body:video,contentType:'video/mp4'}):r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${u.searchParams.get('w')}" height="${u.searchParams.get('h')}"><rect width="100%" height="100%" fill="#555"/></svg>`});});
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="is-work"><main class="project-modules"></main></body></html>');
  // Pixel probes and screenshots must use the same scroll position. Production
   // smooth scrolling can otherwise move the boundary between these two reads.
   await page.addStyleTag({content:fs.readFileSync(path.join(root,'style.css'),'utf8')+' html { scroll-behavior: auto !important; }'});
  await page.addScriptTag({path:path.join(root,'project-modules.js')});await page.addScriptTag({content:work});await page.addScriptTag({path:path.join(root,'project-video.js')});
  for(const mode of ['detail','overview']){
   await page.evaluate(({layouts,mode})=>{
    const rows=[];const ratios=[[403,701],[997,563],[641,641],[1301,401]];
    for(const [type,spans]of Object.entries(layouts))for(const pattern of ['crop','auto','mixed','opposite'])for(const kind of ['image','mp4','mixed'])for(const height of ['auto','medium']){
     const slots=spans.map((_,i)=>{const [w,h]=ratios[i%4],mediaDisplay=pattern==='mixed'?(i%2?'auto':'crop'):pattern==='opposite'?(i%2?'crop':'auto'):pattern;
      return kind==='mp4'||kind==='mixed'&&i%2?{type:'mp4',mediaDisplay,playback:'manual',aspectRatio:90/160,src:'https://media.test/portrait.mp4'}:{type:'image',mediaDisplay,image:{width:w,height:h},src:`https://media.test/img.svg?w=${w}&h=${h}`};});
     rows.push({type,height,slots});
    }
    const render=row=>mode==='detail'?renderProjectModule(row):renderWorkModule(row,{title:'Test',id:'test'});
    document.querySelector('main').innerHTML=rows.map(render).join('');
    for(const img of document.images)img.loading='eager';
    window.clean=initProjectVideos(document.querySelector('main'));
   },{layouts,mode});
   await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
   await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.videoWidth>0&&Math.abs(parseFloat(getComputedStyle(v.parentElement).getPropertyValue('--video-ratio'))-v.videoWidth/v.videoHeight)<1e-7));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const rows=await page.evaluate(()=>[...document.querySelectorAll('.project-module')].map(row=>{
    const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom}};
    return{...rect(row),parent:rect(row.parentElement),slots:[...row.children].map(slot=>{const media=slot.querySelector('video,img'),s=getComputedStyle(media);return{...rect(slot),span:+slot.style.getPropertyValue('--slot-span'),auto:slot.classList.contains('media-display-auto'),media:rect(media),ratio:media.tagName==='VIDEO'?media.videoWidth/media.videoHeight:media.naturalWidth/media.naturalHeight,fit:s.objectFit,border:s.borderWidth,padding:s.padding,shadow:s.boxShadow,outline:s.outlineStyle};})};
   }));
   for(let i=0;i<rows.length;i++){
    const row=rows[i];cases++;
    if(i){const gap=row.y-rows[i-1].b;maxGap=Math.max(maxGap,Math.abs(gap));assert.ok(Math.abs(gap)<.03,`${engine}/${width}/${dpr}/${mode}: gap ${gap}`);}
    if(mode==='overview'){assert.ok(Math.abs(row.y-row.parent.y)<.03);assert.ok(Math.abs(row.b-row.parent.b)<.03);}
    assert.ok(Math.abs(row.b-Math.max(...row.slots.map(s=>s.b)))<.03,'row ends at tallest media');
    let bottom=row.y;
    for(const slot of row.slots){
     assert.ok(Math.abs(slot.w-(width<=700?width:width*slot.span/12))<.06,`assigned column width: ${slot.w} at ${width}, span ${slot.span}`);
     assert.ok(slot.auto?Math.abs(slot.media.w-slot.w)<.03:slot.media.w>=slot.w-1.01/dpr,'media covers its assigned width');
     assert.ok(Math.abs(slot.media.h-slot.media.w/slot.ratio)<.04,`source ratio: ${engine}/${width}/DPR${dpr}/${mode}/row${i}: ${JSON.stringify(slot)}`);
     if(slot.auto){const delta=Math.abs(slot.media.h-slot.media.w/slot.ratio);maxRatioError=Math.max(maxRatioError,delta);assert.ok(delta<.04,'intrinsic height within CSS layout quantization');assert.ok(Math.abs(slot.h-slot.media.h)<.03,'no inner whitespace');assert.notEqual(slot.fit,'cover');}
     assert.equal(slot.border,'0px');assert.equal(slot.padding,'0px');assert.equal(slot.shadow,'none');assert.equal(slot.outline,'none');
     assert.ok(Math.abs(slot.y-(width<=700?bottom:row.y))<.03,'top aligned or contiguous mobile stack');bottom=slot.b;
    }
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.evaluate(()=>clean());
   // Editorial spacers retain their own measurable height and no surrounding gap.
   const spacers=await page.evaluate(({mode})=>{
    const img={type:'full',slots:[{type:'image',mediaDisplay:'auto',image:{width:997,height:563},src:'https://media.test/img.svg?w=997&h=563'}]};
    const render=row=>mode==='detail'?renderProjectModule(row):renderWorkModule(row,{title:'Test',id:'test'});
    document.querySelector('main').innerHTML=[img,...['small','medium','large'].flatMap(size=>[{type:'spacer',size},img])].map(render).join('');
    const nodes=[...document.querySelector('main').children];return{pad:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pad')),boxes:nodes.map(n=>{const r=n.getBoundingClientRect();return{y:r.y,h:r.height,b:r.bottom,spacer:n.classList.contains('project-module-spacer')}})};
   },{mode});
   for(let i=1;i<spacers.boxes.length;i++){assert.ok(Math.abs(spacers.boxes[i].y-spacers.boxes[i-1].b)<.03);if(spacers.boxes[i].spacer)assert.equal(spacers.boxes[i].h,spacers.pad*[4,8,16][(i-1)/2]);}
   // Solid source fixtures make a white raster seam distinguishable from source pixels.
   await page.evaluate(({layouts,mode})=>{
    const rows=Object.entries(layouts).flatMap(([type,spans])=>['crop','auto'].map(mediaDisplay=>({type,height:'small',slots:spans.map(()=>({type:'image',mediaDisplay,image:{width:997,height:563},src:'https://media.test/solid.png?w=997&h=563'}))})));
    document.querySelector('main').innerHTML=rows.map(row=>mode==='detail'?renderProjectModule(row):renderWorkModule(row,{title:'',id:'test'})).join('');for(const i of document.images)i.loading='eager';
   },{layouts,mode});
   await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const count=await page.locator('.project-module').count();
   for(let i=0;i<count-1;i++){
    await page.locator('.project-module').nth(i).evaluate(n=>{window.scrollTo(0,n.getBoundingClientRect().bottom+scrollY-innerHeight/2);});
    const clip=await page.locator('.project-module').nth(i).evaluate(n=>{const slots=[...n.children].map(s=>s.getBoundingClientRect()),tall=slots.reduce((a,b)=>b.bottom>a.bottom?b:a);return{x:tall.left+tall.width/2-2,y:n.getBoundingClientRect().bottom-3,width:4,height:6,edges:[...((n.closest('.project-module-preview')?.nextElementSibling?.querySelector('.project-module')||n.nextElementSibling)?.children||[])].map(s=>s.getBoundingClientRect()).filter(r=>r.right<innerWidth-1).map(r=>({x:r.right-2,y:r.top+2,width:4,height:4}))};});
    const png=await page.screenshot();if(i===0)fs.writeFileSync(path.join(out,`${engine}-${mode}-${width}-dpr${dpr}-boundary.png`),png);
    const light=await page.evaluate(async ({src,clip,dpr})=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);let max=0;for(const region of [clip,...clip.edges]){const a=ctx.getImageData(Math.round(region.x*dpr),Math.round(region.y*dpr),Math.round(region.width*dpr),Math.round(region.height*dpr)).data;for(let i=0;i<a.length;i+=4)max=Math.max(max,a[i],a[i+1],a[i+2]);}return max;},{src:'data:image/png;base64,'+png.toString('base64'),clip,dpr});
    if(light>110)fs.writeFileSync(path.join(out,`${engine}-${mode}-${width}-dpr${dpr}-failed-${i}.png`),png);
    pixelChecks++;if(light>110)imageIssues.push({width,dpr,mode,boundary:i,maxPixel:light});
   }
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,`${engine}-${mode}-${width}-dpr${dpr}.png`)});
   // Exercise both proportional Crop painting and native Auto Height video joins.
   // Loop the short MP4 fixture so it cannot end during frame synchronization.
   for(const mediaDisplay of ['crop','auto']){
    await page.evaluate(({mode,mediaDisplay})=>{
     const rows=[{type:'full',height:'small',slots:[{type:'mp4',mediaDisplay,aspectRatio:90/160,src:'https://media.test/portrait.mp4',playback:'manual'}]},
       {type:'full',height:'small',slots:[{type:'image',mediaDisplay:'auto',image:{width:997,height:563},src:'https://media.test/solid.png?w=997&h=563'}]}];
     document.querySelector('main').innerHTML=rows.map(row=>mode==='detail'?renderProjectModule(row):renderWorkModule(row,{title:'',id:'test'})).join('');
     for(const img of document.images)img.loading='eager';window.clean=initProjectVideos(document.querySelector('main'));scrollTo(0,0);
    },{mode,mediaDisplay});
    await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(async()=>{const v=document.querySelector('video');v.loop=true;try{await v.play();}catch(error){if(error.name!=='AbortError')throw error;await new Promise(resolve=>requestAnimationFrame(resolve));await v.play();}if(v.requestVideoFrameCallback)await new Promise(resolve=>v.requestVideoFrameCallback(resolve));});
    await page.waitForFunction(()=>document.querySelector('video').readyState>=2&&[...document.images].every(i=>i.complete));
    await page.locator('.project-module').first().evaluate(n=>scrollTo(0,n.getBoundingClientRect().bottom+scrollY-innerHeight/2));
    const y=await page.locator('.project-module').first().evaluate(n=>n.getBoundingClientRect().bottom);
    const png=await page.screenshot();
    const light=await page.evaluate(async({src,y,dpr})=>{const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const data=x.getImageData(Math.round((innerWidth/2-2)*dpr),Math.round((y-2)*dpr),4*dpr,4*dpr).data;return Math.max(...data.filter((_,i)=>i%4!==3));},{src:'data:image/png;base64,'+png.toString('base64'),y,dpr});
    if(light>110)fs.writeFileSync(path.join(out,`${engine}-${mode}-${width}-dpr${dpr}-video-${mediaDisplay}-failed.png`),png);
    pixelChecks++;if(light>110)videoIssues.push({width,dpr,mode,mediaDisplay,maxPixel:light});await page.evaluate(()=>clean());
   }
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log(JSON.stringify({engine,cases,pixelChecks,maxGap,maxRatioError,imageIssues,videoIssues}));
 assert.deepEqual({imageIssues,videoIssues},{imageIssues:[],videoIssues:[]},'Native video/image pixel boundaries must be seamless');
 }catch(error){console.error(error);throw error;}finally{await browser.close();}
});
