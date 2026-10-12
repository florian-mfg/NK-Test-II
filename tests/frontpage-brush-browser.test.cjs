'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const modulePath=process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core';
const root=path.join(__dirname,'..');
const names=['horizontal','vertical','diagonal','curved','zigzag','rapid','reversal','edges'];
function trajectory(name,w,h){
 let points;
 switch(name){
 case 'horizontal':points=[[.12,.23],[.88,.23]];break;
 case 'vertical':points=[[.32,.12],[.32,.86]];break;
 case 'diagonal':points=[[.12,.12],[.86,.86]];break;
 case 'curved':points=Array.from({length:33},(_,i)=>{const t=i/32;return [.12+.76*t,.23+.18*Math.sin(t*Math.PI)];});break;
 case 'zigzag':points=[[.12,.15],[.78,.3],[.12,.45],[.78,.6],[.12,.8]];break;
 case 'rapid':points=[[.12,.23],[.88,.23]];break;
 case 'reversal':points=[[.12,.23],[.88,.23],[.12,.23],[.88,.23]];break;
 case 'edges':points=[[.08,.08],[.92,.08],[.92,.9],[.08,.9],[.08,.08]];break;
 }
 return points.map(([x,y])=>({x:x*w,y:y*h}));
}
function near(a,b){return Math.hypot(a.x+a.w/2-b.x,a.y+a.h/2-b.y);}
function overlap(a,b){return a.x<b.x+b.w-.05&&a.x+a.w>b.x+.05&&a.y<b.y+b.h-.05&&a.y+a.h>b.y+.05;}
function connected(a,b){return ((Math.abs(a.x+a.w-b.x)<.05||Math.abs(b.x+b.w-a.x)<.05)&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.05)||((Math.abs(a.y+a.h-b.y)<.05||Math.abs(b.y+b.h-a.y)<.05)&&Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.05);}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
for(const engine of ['chromium','webkit'])test(`${engine}: actual brush trajectories, proximity, collision deferrals and path screenshots`,{skip:!process.env.BROWSER_TEST,timeout:120000},async()=>{
 const browser=await require(modulePath)[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const summary=[];fs.mkdirSync(path.join(root,'reports','brush'),{recursive:true});
 try{for(const mobile of [false,true]){
 const viewport=mobile?{width:390,height:844}:{width:1440,height:900};
 const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='preview.test')return r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname),contentType:({'.woff':'font/woff','.woff2':'font/woff2'})[path.extname(u.pathname)]});return r.abort();});
 const cdp=mobile&&engine==='chromium'?await page.context().newCDPSession(page):null;
 for(const name of names){
 await page.goto(`https://preview.test/?brush=${name}-${mobile}#home`);await page.evaluate(()=>document.fonts.ready);
 const points=trajectory(name,viewport.width,viewport.height),visited=[points[0]];
 if(!mobile){await page.mouse.move(points[0].x,points[0].y);await page.evaluate(()=>renderHome());}
 await page.evaluate(()=>{
 const layer=document.querySelector('.frontpage-fade'),append=layer.append.bind(layer);
 window.brushAudit=[];
 layer.append=function(node){
   const read=n=>({serial:+n.dataset.serial,x:parseFloat(n.style.left),y:parseFloat(n.style.top),w:parseFloat(n.style.width),h:parseFloat(n.style.height),stamp:{x:+n.dataset.brushX,y:+n.dataset.brushY},opacity:n.style.opacity});
   const before=[...layer.children].map(read);append(node);
   brushAudit.push({rect:read(node),before,count:layer.children.length});
 };
 });
 if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...points[0]}]});
 else if(mobile)await page.evaluate(p=>document.querySelector('.home').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:17,clientX:p.x,clientY:p.y})),points[0]);
 else await page.mouse.move(points[0].x,points[0].y);
 for(let i=1;i<points.length;i++){
 const a=points[i-1],b=points[i],steps=name==='rapid'?1:Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/16);
 for(let j=1;j<=steps;j++){
 const p={x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps};visited.push(p);
 if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,...p}]});
 else if(mobile)await page.evaluate(p=>document.querySelector('.home').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'touch',pointerId:17,clientX:p.x,clientY:p.y})),p);
 else await page.mouse.move(p.x,p.y);
 }
 }
 if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 else if(mobile)await page.evaluate(()=>document.querySelector('.home').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',pointerId:17})));
 await page.waitForFunction(()=>[...document.querySelectorAll('.frontpage-fade img')].every(n=>n.complete&&n.naturalWidth));
 const result=await page.evaluate(()=>({audit:brushAudit,limit:+document.querySelector('.frontpage-fade').dataset.maxCursorDistance,html:document.querySelector('.frontpage-fade').innerHTML,count:document.querySelector('.frontpage-fade').children.length}));
 assert.ok(result.audit.length>=(mobile?2:6),`${name}: enough brush marks (${result.audit.length})`);assert.equal(result.count,Math.min(6,result.audit.length));
 for(const {rect,before,count} of result.audit){
 assert.equal(rect.opacity,'1');assert.ok(count<=6);assert.ok(near(rect,rect.stamp)<=result.limit+.01,'hard cursor-to-center limit');
 assert.ok(points.slice(1).some((p,i)=>segmentDistance(rect.stamp,points[i],p)<2),`${name}: stamp ${JSON.stringify(rect.stamp)} lies on the actual path`);
 assert.ok(before.every(b=>!overlap(rect,b)),'no overlaps');if(before.length)assert.ok(before.some(b=>connected(rect,b)),'new mark shares a retained edge');
 assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.w<=viewport.width+.05&&rect.y+rect.h<=viewport.height+.05);
 }
 if(name==='rapid')assert.ok(Math.hypot(result.audit[0].rect.stamp.x-points[0].x,result.audit[0].rect.stamp.y-points[0].y)<2,'first rapid mark starts the trajectory');
 const last=result.audit.at(-1).rect,end=points.at(-1),endDistance=near(last,end);
 let deferred = false;
 if (endDistance > result.limit + 32) {
   // Retracing occupied marks may forbid a new full-sized image. Verify the
   // exact placement/fallback policy really has no permitted endpoint candidate.
   const canPlace = await page.evaluate(end=>{
     const api=FrontpageMediaFade,layer=document.querySelector('.frontpage-fade'),count=layer.children.length;
     const active=[...layer.children].slice(count===6?1:0).map(n=>({left:parseFloat(n.style.left),top:parseFloat(n.style.top),width:parseFloat(n.style.width),height:parseFloat(n.style.height)}));
     const bounds={width:innerWidth,height:innerHeight},limit=+layer.dataset.maxCursorDistance,source=FrontpageMedia[+layer.dataset.progress%FrontpageMedia.length],size=api.dimensions(source,innerWidth,innerHeight);
     for(const scale of [1,.75,.5,.3]){
       const fragment={width:size.width*scale,height:size.height*scale};
       if(active.some(anchor=>api.placement(anchor,fragment,active,end,{x:1,y:0},bounds,limit)))return true;
       if(active.some(anchor=>api.placement(anchor,fragment,active,end,{x:1,y:0},bounds,Infinity)))return false;
     }
     return false;
   },end);
   assert.equal(canPlace,false,`${name}: a valid nearby endpoint placement must not be missed (${endDistance})`);deferred=true;
 }

 summary.push({engine,mobile,name,marks:result.audit.length,limit:result.limit,deferred,maxStampDistance:Math.max(...result.audit.map(a=>near(a.rect,a.rect.stamp))),endDistance});
 await page.waitForTimeout(80);assert.equal(await page.locator('.frontpage-fade').innerHTML(),result.html,'idle freezes geometry');
 assert.ok(await page.evaluate(()=>scrollY===0&&document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
 // Test-only overlay documents both input and final stationary rectangles.
 await page.evaluate(({visited,end})=>{
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);Object.assign(svg.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:10000});
 svg.innerHTML=`<polyline points="${visited.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="#f04" stroke-width="2" stroke-dasharray="5 4"/><circle cx="${end.x}" cy="${end.y}" r="5" fill="#f04"/>`;
 for(const n of document.querySelector('.frontpage-fade').children){const x=parseFloat(n.style.left),y=parseFloat(n.style.top),w=parseFloat(n.style.width),h=parseFloat(n.style.height);svg.innerHTML+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#0086ff" stroke-width="1"/><text x="${x+4}" y="${y+14}" fill="#0086ff" font-size="12">${n.dataset.serial}</text>`;}
 document.body.append(svg);
 },{visited,end});
 await page.screenshot({path:path.join(root,'reports','brush',`${engine}-${mobile?'touch':'mouse'}-${name}.png`)});
 }
 assert.deepEqual(errors,[]);await page.close();
 }
 fs.writeFileSync(path.join(root,'reports','brush',`${engine}-measurements.json`),JSON.stringify(summary,null,2));
 console.log(JSON.stringify(summary.map(r=>({mobile:r.mobile,path:r.name,marks:r.marks,endDistance:Math.round(r.endDistance),deferred:r.deferred}))));
 }finally{await browser.close();}
});
