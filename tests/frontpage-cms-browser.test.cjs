const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const helper=require('./frontpage-brush-browser-helpers.cjs');
for(const engine of ['chromium','webkit'])test(`${engine}: Sanity sequence, three-item FIFO, native MP4, sizes and touch`,{skip:!process.env.BROWSER_TEST,timeout:120000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const out=path.join(__dirname,'..','reports','brush-boundary');fs.mkdirSync(out,{recursive:true});
 try{
  const recorder=await browser.newPage(),bytes=await require('./native-media-fixture.cjs').recordMP4(recorder);await recorder.close();
  for(const mobile of [false,true]){
   const raw=helper.fixture(),original=JSON.stringify(raw),s=await helper.setup(browser,engine,mobile,raw,bytes);
   await s.load();await s.seed();
   const targets=await s.page.evaluate(()=>['small','medium','large'].map(size=>FrontpageMediaFade.dimensions({size,aspectRatio:1},innerWidth,innerHeight).width));
   assert.deepEqual(targets,mobile?[115.5,175,187.2]:[175,273,381.5]);
   const videos=[];
   for(let step=2;step<=20;step++){
    const plan=await s.page.evaluate(()=>{
     const api=FrontpageMediaFade,layer=document.querySelector('.frontpage-fade');
     const read=n=>({left:parseFloat(n.style.left),top:parseFloat(n.style.top),width:parseFloat(n.style.width),height:parseFloat(n.style.height)});
     const previous=read(layer.lastElementChild),active=[...layer.children].slice(layer.children.length===3?1:0).map(read);
     const index=+layer.dataset.progress%sanityContent.homePage.media.length,source=sanityContent.homePage.media[index];
     const size=api.dimensions(source,innerWidth,innerHeight),bounds={width:innerWidth,height:innerHeight,viewLeft:0,viewTop:0,viewRight:innerWidth,viewBottom:innerHeight};
     const visible=api.visiblePortion(previous,bounds,api.EDGE_MARGIN);
     const unblocked=p=>p.x>=1&&p.y>=1&&p.x<innerWidth-1&&p.y<innerHeight-1&&[p.y-1,p.y,p.y+1].every(y=>[p.x-1,p.x,p.x+1].every(x=>!document.elementFromPoint(x,y)?.closest('a,button,.site-header,.mobile-menu')));
     for(const fraction of [.5,.25,.75])for(const edge of ['right','bottom','left','top']){
      const horizontal=['right','left'].includes(edge);
      const from={x:visible.left+visible.width*(horizontal?.5:fraction),y:visible.top+visible.height*(horizontal?fraction:.5)};
      const to={x:horizontal?(edge==='right'?previous.left+previous.width+2:previous.left-2):from.x,y:horizontal?from.y:(edge==='bottom'?previous.top+previous.height+2:previous.top-2)};
      to.x=Math.max(2,Math.min(innerWidth-2,to.x));to.y=Math.max(2,Math.min(innerHeight-2,to.y));
      if(unblocked(from)&&unblocked(to)&&(api.boundaryExit(previous,from,to)||api.viewportExit(previous,from,to,bounds)))return {from,to};
     }
     return null;
    });
    assert.ok(plan,`step ${step}: a usable exit remains`);
    await s.move(plan.from.x,plan.from.y);const before=await s.progress();
    await s.move(plan.to.x,plan.to.y);assert.equal(await s.progress(),before+1);
    assert.equal(await s.progress(),step);
    const nodes=await s.snapshot();assert.equal(nodes.length,Math.min(3,step));assert.deepEqual(nodes.map(n=>n.serial),Array.from({length:Math.min(3,step)},(_,i)=>step-Math.min(3,step)+i));assert.ok(nodes.every(n=>n.index===n.serial%6));
    const video=await s.page.locator('video.frontpage-fade-media').count()?await s.page.locator('video.frontpage-fade-media').elementHandle():null;
    if(video){await s.page.waitForFunction(v=>!v.paused&&v.currentTime>0&&v.videoWidth===160,video);assert.ok(await video.evaluate(v=>v.muted&&v.loop&&v.playsInline&&!v.controls));videos.push(video);}
    await helper.verify(s);
   }
   for(const video of videos)if(!await video.evaluate(v=>v.isConnected))assert.ok(await video.evaluate(v=>v.paused&&!v.hasAttribute('src')));
   const audit=await s.page.evaluate(()=>brushAudit);assert.ok(audit.some(a=>a.rect.serial===3),'fourth emitted');
   assert.deepEqual(audit.find(a=>a.rect.serial===3).before.map(n=>n.serial),[1,2],'fourth removes first before insertion');
   await s.page.screenshot({path:path.join(out,`${engine}-${mobile?'touch':'mouse'}-mixed.png`)});
   await s.end();const frozen=await s.snapshot();await s.page.waitForTimeout(120);assert.deepEqual(await s.snapshot(),frozen);
   await s.page.evaluate(()=>{window.retainedVideos=[...document.querySelectorAll('.frontpage-fade video')];window.videoCalls=[];for(const video of retainedVideos)for(const name of ['play','load']){const original=video[name].bind(video);video[name]=(...args)=>{videoCalls.push(name);return original(...args);};}});
   const html=await s.page.locator('.frontpage-fade').innerHTML();
   await s.page.setViewportSize({width:s.viewport.width-10,height:s.viewport.height-10});
   assert.equal(await s.page.locator('.frontpage-fade').innerHTML(),html);assert.deepEqual(await s.page.evaluate(()=>videoCalls),[],'resize does not restart or reload video');
   assert.ok(await s.page.evaluate(()=>retainedVideos.every(v=>v.isConnected&&!v.paused)));
   const progress=await s.progress();await s.page.locator('.site-header a').first().hover();assert.equal(await s.progress(),progress);
   await s.page.evaluate(()=>location.hash='info');await s.page.waitForSelector('.info');assert.equal(await s.page.locator('.frontpage-fade-media').count(),0);
   for(const video of videos)assert.ok(await video.evaluate(v=>!v.isConnected&&v.paused&&!v.hasAttribute('src')));
   assert.equal(JSON.stringify(raw),original);assert.deepEqual(s.errors,[]);await s.page.close();
  }
 }finally{await browser.close();}
});
