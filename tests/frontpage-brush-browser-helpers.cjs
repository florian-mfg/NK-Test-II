const path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
exports.setup=async(browser,engine,mobile,raw=null,bytes=null)=>{
 const viewport=mobile?{width:390,height:844}:{width:1440,height:900};
 const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(!bytes && raw?.homePage?.media?.some(item=>item.type==='mp4'))
  bytes=await require('./native-media-fixture.cjs').recordMP4(page);
 await page.route('**/*',r=>{const u=new URL(r.request().url());
  if(u.hostname==='preview.test')return r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname)});
  if(raw&&u.pathname.includes('/data/query/'))return r.fulfill({json:{result:raw}});
  if(u.hostname==='cdn.sanity.io') {
   if(u.pathname.endsWith('.mp4'))return r.fulfill({body:bytes,contentType:'video/mp4'});
   const index=Number(u.pathname.match(/demo(\d+)/)[1]);const ratio=raw.homePage.media[index].image.asset.metadata.dimensions.width/100;
   return r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${ratio*100}" height="100"><rect width="100%" height="100%" fill="hsl(${index*60},40%,40%)"/></svg>`});
  }
  return r.abort();
 });
 const cdp=mobile&&engine==='chromium'?await page.context().newCDPSession(page):null;
 let down=false,loadSerial=0;
 const load=async()=>{down=false;await page.mouse.move(5,viewport.height/2);await page.goto(`https://preview.test/?boundary=${++loadSerial}#home`);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>document.querySelector('.frontpage-fade')?.dataset.ready==='true');if(raw)await page.waitForFunction(()=>document.querySelector('.frontpage-fade')?.dataset.source==='sanity');await page.evaluate(()=>{
  const layer=document.querySelector('.frontpage-fade'),append=layer.append.bind(layer);window.brushAudit=[];
  const read=n=>({serial:+n.dataset.serial,index:+n.dataset.sequence,x:parseFloat(n.style.left),y:parseFloat(n.style.top),w:parseFloat(n.style.width),h:parseFloat(n.style.height),stamp:{x:+n.dataset.brushX,y:+n.dataset.brushY},exit:n.dataset.exitEdge,edge:n.dataset.sharedEdge,overlapFallback:n.dataset.overlapFallback,opacity:n.style.opacity});
  layer.append=n=>{const before=[...layer.children].map(read);append(n);brushAudit.push({rect:read(n),before,count:layer.children.length});};
 });};
 const move=async(x,y)=>{
  if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:down?'touchMove':'touchStart',touchPoints:[{id:1,x,y}]});down=true;await page.evaluate(()=>new Promise(requestAnimationFrame));}
  else if(mobile){await page.evaluate(({x,y,type})=>document.querySelector('.home').dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',pointerId:7,clientX:x,clientY:y})),{x,y,type:down?'pointermove':'pointerdown'});down=true;}
  else await page.mouse.move(x,y);
 };
 const snapshot=()=>page.locator('.frontpage-fade-media').evaluateAll(ns=>ns.map(n=>({serial:+n.dataset.serial,index:+n.dataset.sequence,x:parseFloat(n.style.left),y:parseFloat(n.style.top),w:parseFloat(n.style.width),h:parseFloat(n.style.height),opacity:getComputedStyle(n).opacity,transition:getComputedStyle(n).transitionProperty,animation:getComputedStyle(n).animationName,ratio:n.tagName==='VIDEO'?n.videoWidth/n.videoHeight:n.naturalWidth/n.naturalHeight,exit:n.dataset.exitEdge,edge:n.dataset.sharedEdge,overlapFallback:n.dataset.overlapFallback,stamp:{x:+n.dataset.brushX,y:+n.dataset.brushY}})));
 const progress=async()=>+(await page.locator('.frontpage-fade').getAttribute('data-progress'));
 const current=async()=>(await snapshot()).at(-1);
 const seed=async(x=mobile?195:500,y=mobile?200:250)=>{const before=await progress();await move(x,y);await move(x+(cdp?12:1),y);assert.equal(await progress(),1,JSON.stringify({engine,mobile,before,audit:await page.evaluate(()=>brushAudit)}));};
 const end=async()=>{if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else if(mobile)await page.evaluate(()=>document.querySelector('.home').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',pointerId:7})));down=false;};
 return {page,viewport,errors,load,move,snapshot,progress,current,seed,end};
};
exports.connected=(a,b)=>((Math.abs(a.x+a.w-b.x)<.01||Math.abs(b.x+b.w-a.x)<.01)&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>0)||((Math.abs(a.y+a.h-b.y)<.01||Math.abs(b.y+b.h-a.y)<.01)&&Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>0);
exports.overlap=(a,b)=>a.x<b.x+b.w-.01&&a.x+a.w>b.x+.01&&a.y<b.y+b.h-.01&&a.y+a.h>b.y+.01;
exports.verify=async(s)=>{
 await s.page.waitForFunction(()=>[...document.querySelectorAll('.frontpage-fade img')].every(n=>n.complete&&n.naturalWidth));
 const nodes=await s.snapshot();assert.ok(nodes.length<=3);
 for(const n of nodes){assert.equal(n.opacity,'1');assert.equal(n.transition,'none');assert.equal(n.animation,'none');assert.ok(Math.abs(n.w/n.h-n.ratio)<.01);const target=await s.page.evaluate(({index})=>{const source=frontpageSequence()[index];return FrontpageMediaFade.dimensions(source,innerWidth,innerHeight);},{index:n.index});assert.ok(Math.abs(n.w-target.width)<.01&&Math.abs(n.h-target.height)<.01,'full responsive dimensions');}
 const audit=await s.page.evaluate(()=>brushAudit);
 for(const {rect,before,count} of audit){
  assert.ok(count<=3);assert.deepEqual(before.map(b=>b.serial),Array.from({length:Math.min(2,rect.serial)},(_,i)=>rect.serial-Math.min(2,rect.serial)+i));
  for(const b of before){assert.deepEqual(b,audit.find(a=>a.rect.serial===b.serial).rect,'retained media remain stationary');if(rect.edge!=='continuation'&&!rect.overlapFallback)assert.ok(!exports.overlap(rect,b));}
  if(before.length&&rect.edge!=='continuation')assert.ok(exports.connected(before.at(-1),rect),'attached to current media');
 }
 assert.deepEqual(s.errors,[]);
};
exports.fixture=()=>({projects:[],homePage:{_id:'homePage',_type:'homePage',media:[1,.6,1.5,16/9,1,2].map((ratio,i)=>({_key:`item-${i}`,type:i===3?'mp4':'image',size:['small','small','medium','large','medium','small'][i],image:{asset:{_id:`image-demo${i}-100x100-svg`,url:`https://cdn.sanity.io/images/ck6xe2er/production/demo${i}.svg`,metadata:{dimensions:{width:ratio*100,height:100}}}},video:{asset:{_id:'file-demo-mp4',url:'https://cdn.sanity.io/files/ck6xe2er/production/demo.mp4',metadata:{dimensions:{width:160,height:90}}}}}))}});
