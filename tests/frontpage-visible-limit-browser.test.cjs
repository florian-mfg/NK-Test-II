const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.join(__dirname,'..');
for(const engine of ['chromium','webkit'])test(`${engine}: configurable visible media, prepared short loops, FIFO and pointer performance`,{skip:!process.env.BROWSER_TEST,timeout:180000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const results=[];
 try{
  const recorder=await browser.newPage(),video=await require('./native-media-fixture.cjs').recordMP4(recorder);await recorder.close();
  for(const mobile of [false,true])for(const value of [1,2,3,4,5,6,7,8,9,10,undefined,null,0,11,1.5,'5','ten-videos','ten-images']){
   const cmsValue=['ten-videos','ten-images'].includes(value)?10:value;
   const limit=Number.isInteger(cmsValue)&&cmsValue>=1&&cmsValue<=10?cmsValue:3;
   const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
   let requests=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let media=Array.from({length:3},(_,i)=>({_key:`source-${i}`,type:i===2?'mp4':'image',size:'medium',image:{asset:{_id:`image-fixture${i}-160x90-svg`,url:`https://cdn.sanity.io/images/ck6xe2er/production/fixture${i}.svg`,metadata:{dimensions:{width:160,height:90}}}},video:{asset:{_id:'file-fixture-mp4',url:'https://cdn.sanity.io/files/ck6xe2er/production/fixture.mp4'}}}));
   if(value==='ten-videos')media=[media[2]];
   if(value==='ten-images')media=[media[0]];
   await page.route('**/*',r=>{const u=new URL(r.request().url());
    if(u.hostname==='preview.test')return r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname)});
    if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:{projects:[],homePage:{_id:'homePage',_type:'homePage',visibleMediaLimit:cmsValue,media}}}});
    if(u.hostname==='cdn.sanity.io'){requests++;return u.pathname.endsWith('.mp4')?r.fulfill({body:video,contentType:'video/mp4'}):r.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#555"/></svg>'});}
    return r.abort();
   });
   await page.goto('https://preview.test/#home');
   await page.waitForFunction(()=>document.querySelector('.frontpage-fade').dataset.ready==='true');
   assert.equal(await page.evaluate(()=>sanityContent.homePage.visibleMediaLimit),limit);
   const preparedRequests=requests;
   const audit=await page.evaluate(({limit,mobile,placements,sequenceLength})=>{
    const layer=document.querySelector('.frontpage-fade'),home=document.querySelector('.home'),api=FrontpageMediaFade;
    let measures=0;const get=layer.getBoundingClientRect.bind(layer);layer.getBoundingClientRect=()=>{measures++;return get();};
    const unique=new Set(),failures=[],times=[];let events=0,max=0;
    const read=n=>({serial:+n.dataset.serial,index:+n.dataset.sequence,left:n.style.left,top:n.style.top,width:n.style.width,height:n.style.height,src:n.getAttribute('src')});
    const move=(x,y,type='pointermove')=>{
     const before=+layer.dataset.progress,old=[...layer.children].map(read),start=performance.now();
     home.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:7,pointerType:mobile?'touch':'mouse',clientX:x,clientY:y}));
     times.push(performance.now()-start);events++;
     const now=+layer.dataset.progress,ns=[...layer.children],state=ns.map(read);max=Math.max(max,ns.length);
     if(now-before>1)failures.push('multiple placements per event');
     if(ns.length>limit)failures.push('exceeded limit');
     if(now!==before){
      if(state.map(n=>n.serial).join()!==Array.from({length:Math.min(limit,now)},(_,i)=>now-Math.min(limit,now)+i).join())failures.push('FIFO');
      const n=ns.at(-1);unique.add(n);
      if(+n.dataset.sequence!==(+n.dataset.serial)%sequenceLength)failures.push('sequence');
      const ratio=n.tagName==='VIDEO'?n.videoWidth/n.videoHeight:n.naturalWidth/n.naturalHeight;
      if(Math.abs(parseFloat(n.style.width)/parseFloat(n.style.height)-ratio)>.001)failures.push('ratio');
      if(getComputedStyle(n).opacity!=='1')failures.push('opacity');
      for(const prior of old){const retained=state.find(n=>n.serial===prior.serial);if(retained&&JSON.stringify(prior)!==JSON.stringify(retained))failures.push('stationary');}
     }
    };
    if(mobile)move(150,200,'pointerdown');else move(150,200);move(151,200);
    for(let step=1;step<placements;step++){
     const n=layer.lastElementChild,r={left:parseFloat(n.style.left),top:parseFloat(n.style.top),width:parseFloat(n.style.width),height:parseFloat(n.style.height)};
     const bounds={viewLeft:0,viewTop:0,viewRight:innerWidth,viewBottom:innerHeight};
     const visible=api.visiblePortion(r,bounds,api.EDGE_MARGIN),from={x:visible.left+visible.width/2,y:visible.top+visible.height/2};
     const candidates=[{x:Math.min(innerWidth-1,r.left+r.width+2),y:from.y},{x:Math.max(1,r.left-2),y:from.y},{x:from.x,y:Math.min(innerHeight-1,r.top+r.height+2)},{x:from.x,y:Math.max(1,r.top-2)}];
     const to=candidates.find(p=>api.boundaryExit(r,from,p)||api.viewportExit(r,from,p,bounds));
     if(!to){failures.push('unreachable');break;}
     const before=+layer.dataset.progress;move(from.x,from.y);move(to.x,to.y);
     if(+layer.dataset.progress!==before+1){failures.push('stall or unexpected entry placement');break;}
    }
    times.sort((a,b)=>a-b);
    return {progress:+layer.dataset.progress,max,count:layer.children.length,unique:unique.size,failures,measures,events,p95:times[Math.floor(times.length*.95)],maxMs:times.at(-1),limit:+layer.dataset.visibleMediaLimit,preparation:JSON.parse(layer.dataset.preparation),loadingProgress:+layer.dataset.loadingProgress};
   },{limit,mobile,placements:limit===10?300:40,sequenceLength:media.length});
   assert.deepEqual(audit.failures,[],JSON.stringify({engine,value,mobile,audit}));assert.equal(audit.max,limit);assert.equal(audit.count,limit);assert.equal(audit.limit,limit);assert.equal(audit.measures,0);assert.equal(audit.loadingProgress,1);assert.ok(audit.preparation.every(r=>r.status==='ready'));assert.ok(audit.unique<=media.length*Math.ceil(limit/media.length));
   await page.waitForTimeout(150);assert.equal(requests,preparedRequests,'no new resource requests while looping');assert.deepEqual(errors,[]);
   await page.goto('https://preview.test/#info');assert.equal(await page.locator('.frontpage-fade-media').count(),0);
   results.push({mobile,value:value===undefined?'missing':value,limit,placements:audit.progress,unique:audit.unique,p95:audit.p95,maxMs:audit.maxMs,requests:preparedRequests});await page.close();
  }
  const out=path.join(root,'reports','frontpage-visible-limit');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`${engine}.json`),JSON.stringify(results,null,2));console.log(JSON.stringify({engine,results}));
 }finally{await browser.close();}
});
