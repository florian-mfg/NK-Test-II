const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.join(__dirname,'..'),site=process.env.SITE_BASE_URL;
const output=process.env.RELEASE_REPORT_DIR||path.join(root,'reports','brush-fluid');
for(const engine of ['chromium','webkit'])test(`${engine}: 300 full-size real-photo placements, timing and off-screen continuation`,{skip:!process.env.BROWSER_TEST,timeout:300000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const results=[];
 try{for(const [width,height,touch] of [[1920,1080,false],[1440,900,false],[760,900,false],[390,844,true],[844,390,true]]) {
  const page=await browser.newPage({viewport:{width,height},isMobile:touch,hasTouch:touch});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(!site)await page.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='preview.test'?r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname)}):r.abort();});
  await page.addInitScript(()=>{
   window.brushTimings=[];window.brushStart=0;
   const add=document.addEventListener.bind(document);
   document.addEventListener=(type,callback,options)=>add(type,type==='pointermove'&&callback.name==='move'?function(event){
    const start=performance.now();window.brushStart=start;
    try{return callback.call(this,event);}finally{brushTimings.push(performance.now()-start);}
   }:callback,options);
  });
  await page.mouse.move(5,height/4);await page.goto(site?`${site}?brush=${process.env.EXPECTED_COMMIT||Date.now()}#home`:'https://preview.test/#home');await page.evaluate(()=>document.fonts.ready);
  if(site){await page.waitForFunction(()=>sanityLoadSettled&&sanityContent);assert.equal(await page.evaluate(()=>sanityContent.homePage?.media==null),true,'published Frontpage keeps its local fallback');}
  const realRatios=await page.evaluate(()=>Promise.all(FrontpageMedia.map(source=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({actual:image.naturalWidth/image.naturalHeight,expected:source.aspectRatio});image.onerror=reject;image.src=source.src;}))));
  for(const ratio of realRatios)assert.ok(Math.abs(ratio.actual-ratio.expected)<1e-7,'fallback metadata agrees with actual photograph dimensions');
  await page.evaluate(()=>{
   window.audit=[];const layer=document.querySelector('.frontpage-fade'),append=layer.append.bind(layer);
   const read=n=>({left:parseFloat(n.style.left),top:parseFloat(n.style.top),width:parseFloat(n.style.width),height:parseFloat(n.style.height),serial:+n.dataset.serial,index:+n.dataset.sequence,edge:n.dataset.sharedEdge,overlapFallback:n.dataset.overlapFallback});
   layer.append=n=>{const before=[...layer.children].map(read);append(n);audit.push({rect:read(n),before,count:layer.children.length,latency:performance.now()-brushStart});};
  });
  const cdp=touch&&engine==='chromium'?await page.context().newCDPSession(page):null;let down=false;
  const move=async(p)=>{if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:down?'touchMove':'touchStart',touchPoints:[{id:1,...p}]});down=true;await page.evaluate(()=>new Promise(requestAnimationFrame));}
   else if(touch){await page.evaluate(({p,type})=>document.querySelector('.home').dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:7,pointerType:'touch',clientX:p.x,clientY:p.y})),{p,type:down?'pointermove':'pointerdown'});down=true;}
   else await page.mouse.move(p.x,p.y);};
  await move({x:width/2,y:height/4});await move({x:width/2+12,y:height/4});assert.equal(await page.evaluate(()=>+document.querySelector('.frontpage-fade').dataset.progress),1,JSON.stringify({engine,width,height,errors,debug:await page.evaluate(()=>({timings:brushTimings,audit,html:document.querySelector('.frontpage-fade').outerHTML}))}));
  for(let step=1;step<300;step++) {
   const plan=await page.evaluate(step=>{
    const api=FrontpageMediaFade,n=document.querySelector('.frontpage-fade').lastElementChild;
    const r={left:parseFloat(n.style.left),top:parseFloat(n.style.top),width:parseFloat(n.style.width),height:parseFloat(n.style.height)};
    const bounds={viewLeft:0,viewTop:0,viewRight:innerWidth,viewBottom:innerHeight,width:innerWidth,height:innerHeight};
    const visible=api.visiblePortion(r,bounds,api.EDGE_MARGIN);
    const free=p=>p.x>1&&p.y>1&&p.x<innerWidth-1&&p.y<innerHeight-1&&[p.y-1,p.y,p.y+1].every(y=>[p.x-1,p.x,p.x+1].every(x=>!document.elementFromPoint(x,y)?.closest('a,button,.site-header,.mobile-menu')));
    const sides=['right','bottom','left','top'];
    for(let i=0;i<4;i++)for(const f of [.5,.25,.75,.1,.9]) {
     const edge=sides[(Math.floor(step/15)+i)%4],horizontal=['left','right'].includes(edge);
     const from={x:visible.left+visible.width*(horizontal?.5:f),y:visible.top+visible.height*(horizontal?f:.5)};
     let to={x:horizontal?(edge==='right'?r.left+r.width+3:r.left-3):from.x,y:horizontal?from.y:(edge==='bottom'?r.top+r.height+3:r.top-3)};
     // Reach an inaccessible physical edge by crossing its visible 8px band.
     if(to.x<=0)to.x=2;if(to.x>=innerWidth)to.x=innerWidth-2;
     if(to.y<=0)to.y=2;if(to.y>=innerHeight)to.y=innerHeight-2;
     const crossing=api.boundaryExit(r,from,to)||api.viewportExit(r,from,to,bounds);
     if(free(from)&&free(to)&&crossing)return {from,to};
    }return null;
   },step);
   assert.ok(plan,`${width}x${height} placement ${step}: reachable active rectangle`);
   await move(plan.from);assert.equal(await page.evaluate(()=>+document.querySelector('.frontpage-fade').dataset.progress),step,`${engine} ${width}x${height} step ${step} entry ${JSON.stringify(plan)}`);
   await move(plan.to);assert.equal(await page.evaluate(()=>+document.querySelector('.frontpage-fade').dataset.progress),step+1,`${engine} ${width}x${height} step ${step} exit ${JSON.stringify(plan)}`);
  }
  await page.waitForFunction(()=>[...document.querySelectorAll('.frontpage-fade img')].every(n=>n.complete&&n.naturalWidth));
  const result=await page.evaluate(()=>{
   const api=FrontpageMediaFade,failures=[];
   // Chromium serializes CSS numbers to six significant digits; summed coordinates need .011px tolerance.
   for(const {rect:r,before,count} of audit){
    if(count>3)failures.push('count');const size=api.dimensions(FrontpageMedia[r.index],innerWidth,innerHeight);if(Math.abs(r.width-size.width)>.01||Math.abs(r.height-size.height)>.01)failures.push('reduced dimensions');
    if(r.index!==r.serial%FrontpageMedia.length||Math.abs(r.width/r.height-FrontpageMedia[r.index].aspectRatio)>1e-5)failures.push('sequence/ratio');
    if(before.map(b=>b.serial).join()!==Array.from({length:Math.min(2,r.serial)},(_,i)=>r.serial-Math.min(2,r.serial)+i).join())failures.push('FIFO');
    for(const b of before){if(r.edge!=='continuation'&&!r.overlapFallback&&r.left<b.left+b.width-.01&&r.left+r.width>b.left+.01&&r.top<b.top+b.height-.01&&r.top+r.height>b.top+.01)failures.push({kind:'overlap',r,b});if(JSON.stringify(b)!==JSON.stringify(audit[b.serial].rect))failures.push('stationary');}
    if(before.length&&r.edge!=='continuation') {const b=before.at(-1);const h=(Math.abs(b.left+b.width-r.left)<.011||Math.abs(r.left+r.width-b.left)<.011)&&Math.min(b.top+b.height,r.top+r.height)>Math.max(b.top,r.top);const v=(Math.abs(b.top+b.height-r.top)<.011||Math.abs(r.top+r.height-b.top)<.011)&&Math.min(b.left+b.width,r.left+r.width)>Math.max(b.left,r.left);if(!h&&!v)failures.push({kind:'flush',r,b});}
   }
   const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)],max:sorted.at(-1)};};
   return {placements:audit.length,failures,continuations:audit.filter(a=>a.rect.edge==='continuation').length,
    overlapFallbacks:audit.filter(a=>a.rect.overlapFallback).length,
    offscreen:audit.filter(({rect:r})=>r.left<0||r.top<0||r.left+r.width>innerWidth||r.top+r.height>innerHeight).length,
    pointerMs:summarize(brushTimings),earlyPointerMs:summarize(brushTimings.slice(0,100)),latePointerMs:summarize(brushTimings.slice(-100)),appendMs:summarize(audit.map(a=>a.latency))};
  });
  assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);
  assert.ok(result.offscreen>0,'full-size media extend past the viewport');
  assert.ok(result.continuations>0,'real-media paths exercise off-screen continuation');
  assert.ok(result.pointerMs.p95<16.7,'95% of brush callbacks fit within one 60Hz frame');
  assert.ok(result.appendMs.p95<16.7,'95% of appends happen within one frame of the pointer callback');
  // Resizing retains every existing media element and its inline geometry.
  const beforeResize=await page.locator('.frontpage-fade').innerHTML();
  await page.setViewportSize({width:width-20,height:height-20});assert.equal(await page.locator('.frontpage-fade').innerHTML(),beforeResize);
  results.push({width,height,touch,...result,resizeRetained:true});console.log(JSON.stringify({engine,...results.at(-1)}));await page.close();
 }
 fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,`${site?'live-':''}${engine}.json`),JSON.stringify(results,null,2));
 }catch(error){console.error(engine,error.message);throw error;}finally{await browser.close();}
});
