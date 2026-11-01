const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),out=process.env.RELEASE_REPORT_DIR||path.join(require('node:os').tmpdir(),'nk-overview-raster');
for(const engine of ['chromium','webkit'])test(`${engine}: overview paint edges meet without white raster seams`,{skip:!process.env.BROWSER_TEST,timeout:180000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core'),browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const results=[];fs.mkdirSync(out,{recursive:true});
 try{
  const recorder=await browser.newPage(),bytes=await require('./native-media-fixture.cjs').recordMP4(recorder,160,90);await recorder.close();
  for(const dpr of [1,2,3])for(const width of [390,701,1025,1440]){
   const p=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:dpr});
   await p.route('https://media.test/**',r=>r.request().url().endsWith('.mp4')?r.fulfill({body:bytes,contentType:'video/mp4'}):r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="997" height="563"><rect width="997" height="563" fill="#555"/></svg>'}));
   await p.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="is-work"><section class="work"><main></main></section></body></html>');
   await p.addStyleTag({path:path.join(root,'style.css')});await p.addStyleTag({content:'html{scroll-behavior:auto!important}'});
   await p.addScriptTag({path:path.join(root,'project-modules.js')});await p.addScriptTag({path:path.join(root,'project-video.js')});
   await p.evaluate(()=>{
    const rows=[];
    for(const [type,spans]of Object.entries(PROJECT_MODULE_TYPES))for(const display of ['crop','auto','mixed']){
     rows.push({type,height:display==='auto'?'auto':'medium',slots:spans.map((_,i)=>i%2?{type:'mp4',src:'https://media.test/test.mp4',playback:'manual',mediaDisplay:display==='mixed'?'crop':display,aspectRatio:16/9}:{type:'image',src:'https://media.test/image.svg',mediaDisplay:display==='mixed'?'auto':display,image:{width:997,height:563}})});
    }
    document.querySelector('main').innerHTML=rows.map(row=>renderProjectModule(row)).join('');
    for(const i of document.images)i.loading='eager';window.clean=initProjectVideos(document.querySelector('main'));
   });
   await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await p.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.videoWidth>0));await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const rows=await p.evaluate(()=>[...document.querySelectorAll('.project-module')].map(row=>{const r=row.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY,slots:[...row.children].map(slot=>{const box=slot.getBoundingClientRect(),m=slot.querySelector('img,video'),b=m.getBoundingClientRect(),c=m.style.clip.match(/[\d.e+-]+(?=px)/g).map(Number);return {left:box.left,right:box.right,top:box.top+scrollY,bottom:box.bottom+scrollY,paintTop:b.top+scrollY+c[0],paintBottom:b.top+scrollY+c[2],ratio:m.tagName==='VIDEO'?m.videoWidth/m.videoHeight:m.naturalWidth/m.naturalHeight,width:b.width,height:b.height};})};}));
   for(let i=0;i<rows.length;i++){
    const row=rows[i];if(i)assert.ok(Math.abs(row.top-rows[i-1].bottom)<.03,'module geometry is contiguous');
    for(const s of row.slots){assert.ok(Math.abs(s.paintTop-Math.round(s.top*dpr)/dpr)<.04,'paint top matches the shared physical edge');assert.ok(Math.abs(s.paintBottom-Math.round(s.bottom*dpr)/dpr)<.04,'paint bottom matches the shared physical edge');assert.ok(Math.abs(s.height-s.width/s.ratio)<.04,'uniform source scaling');}
   }
   let probes=0;
   for(let i=0;i<rows.length-1;i+=3){
    const row=rows[i],last=row.slots.reduce((a,b)=>a.bottom>=b.bottom?a:b),x=(last.left+last.right)/2;
    await p.evaluate(y=>scrollTo(0,Math.max(0,Math.round(y-450))),row.bottom);
    const y=await p.evaluate(y=>y-scrollY,row.bottom);if(y<4||y>896)continue;
    const png=await p.screenshot({path:path.join(out,`${engine}-solid-${width}-dpr${dpr}-join${i}.png`)});
    const white=await p.evaluate(async({data,x,y,dpr})=>{const i=new Image();i.src='data:image/png;base64,'+data;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);const a=ctx.getImageData(Math.round(x*dpr)-1,Math.round(y*dpr)-3,3,6).data;let max=0;for(let j=0;j<a.length;j+=4)max=Math.max(max,a[j],a[j+1],a[j+2]);return max;},{data:png.toString('base64'),x,y,dpr});
    assert.ok(white<115,`${engine}/${width}/DPR${dpr}/join${i}: exposed white pixel ${white}`);probes++;
   }
   await p.setViewportSize({width:width+7,height:703});
   await p.waitForTimeout(80);
   const resized=await p.evaluate(()=>[...document.querySelectorAll('.project-module')].map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom};}));
   assert.ok(resized.slice(1).every((r,i)=>Math.abs(r.top-resized[i].bottom)<.03),'resized overview stays contiguous');
   results.push({width,dpr,rows:rows.length,probes,resized:true});await p.evaluate(()=>clean());await p.close();
  }
 }finally{fs.writeFileSync(path.join(out,engine+'-solid-probes.json'),JSON.stringify(results,null,2));await browser.close();}
});
