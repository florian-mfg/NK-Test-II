const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../frontpage-media-fade.js');
const connected=(a,b)=>((Math.abs(a.left+a.width-b.left)<.01||Math.abs(b.left+b.width-a.left)<.01)&&Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top)>0)||((Math.abs(a.top+a.height-b.top)<.01||Math.abs(b.top+b.height-a.top)<.01)&&Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left)>0);
test('direction prefers the matching shared edge',()=>{
 const anchor={left:300,top:300,width:100,height:80},size={width:70,height:60};
 for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]]){
 const rect=api.placement(anchor,size,[anchor],{x:350+x*150,y:340+y*150},{x,y},{width:1000,height:1000});
 assert.ok(connected(anchor,rect));assert.ok(!api.overlaps(anchor,rect));
 if(x===1)assert.equal(rect.left,400);if(x===-1)assert.equal(rect.left+rect.width,300);
 if(y===1)assert.equal(rect.top,380);if(y===-1)assert.equal(rect.top+rect.height,300);
 }
});
test('rapid turns and boundaries keep every new rectangle attached, contained and collision free',()=>{
 for(const [width,height] of [[1440,900],[390,844],[320,568],[844,390]]){
 let active=[];
 for(let i=0;i<2000;i++){
 const angle=i*.73,point={x:width/2+Math.sin(angle)*width/2,y:height/2+Math.cos(angle)*height/2},vector={x:Math.cos(angle),y:-Math.sin(angle)};
 const size=api.dimensions({size:['small','medium','large'][i%3],aspectRatio:[.6,1,1.8][i%3]},width,height);
 const rest=active.length===6?active.slice(1):active;
 const rect=api.placement(active.at(-1),size,rest,point,vector,{width,height});
 if(!rect)continue;
 assert.ok(rect.left>=0&&rect.top>=0&&rect.left+rect.width<=width+.01&&rect.top+rect.height<=height+.01);
 assert.ok(rest.every(b=>!api.overlaps(rect,b)));
 assert.ok(api.centerDistance(rect,point)<=api.MAX_CURSOR_DISTANCE);
 if(active.length)assert.ok(connected(active.at(-1),rect));
 assert.ok(Math.abs(rect.width/rect.height-size.width/size.height)<1e-8);
 active=[...rest,rect];assert.ok(active.length<=6);
 }
 assert.ok(active.length>0 && active.length<=6);
 }
});

test('cursor proximity rejects remote edges rather than extending a remote chain',()=>{
 const anchor={left:100,top:100,width:150,height:100};
 assert.equal(api.placement(anchor,{width:100,height:70},[anchor],{x:900,y:600},{x:1,y:0},{width:1200,height:800},80),null);
 const point={x:260,y:150};
 const rect=api.placement(anchor,{width:100,height:70},[anchor],point,{x:1,y:0},{width:1200,height:800},80);
 assert.ok(rect);assert.ok(api.centerDistance(rect,point)<=80);
 assert.equal(api.placement(anchor,{width:100,height:70},[anchor],point,{x:1,y:0},{width:1200,height:800},10),null);
});
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{JSDOM}=require('../studio/node_modules/jsdom');
function inputSetup(config={}){
 const dom=new JSDOM('<section class="home"><div id="layer"></div></section>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,layer=w.document.querySelector('#layer');
 layer.getBoundingClientRect=()=>({left:0,top:0,width:1440,height:900});Object.defineProperty(layer,'clientWidth',{value:1440});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','frontpage-media-fade.js'),'utf8'),dom.getInternalVMContext());
 const audit=[],append=layer.append.bind(layer);layer.append=n=>{append(n);audit.push({serial:+n.dataset.serial,x:+n.dataset.brushX,y:+n.dataset.brushY,w:parseFloat(n.style.width),h:parseFloat(n.style.height),left:parseFloat(n.style.left),top:parseFloat(n.style.top),count:layer.children.length});};
 const sequence=Array.from({length:9},(_,i)=>({type:'image',src:`photo-${i}.jpg`,size:'medium',aspectRatio:1.5}));
 const dispose=w.FrontpageMediaFade.init(layer,sequence,config);
 function move(x,y,samples){const e=new w.MouseEvent('pointermove',{bubbles:true,clientX:x,clientY:y});Object.defineProperty(e,'pointerType',{value:'mouse'});if(samples)Object.defineProperty(e,'getCoalescedEvents',{value:()=>samples.map(p=>({clientX:p.x,clientY:p.y}))});w.document.querySelector('.home').dispatchEvent(e);}
 return {w,layer,audit,move,close:()=>{dispose();dom.window.close();}};
}
test('rapid first movement samples from the start, preserves sizes, ordering and the six-node bound',()=>{
 const s=inputSetup();try{
 s.move(100,200);s.move(1200,200);
 assert.equal(s.audit[0].x,101);assert.ok(s.audit.length>=6);
 for(const mark of s.audit){assert.equal(mark.y,200);assert.ok(mark.x>=100&&mark.x<=1200);assert.ok(api.centerDistance({...mark,width:mark.w,height:mark.h},{x:mark.x,y:mark.y})<=96);assert.ok(mark.count<=6);assert.equal(mark.w,156);assert.equal(mark.h,104);}
 assert.deepEqual([...s.layer.children].map(n=>+n.dataset.serial),Array.from({length:6},(_,i)=>s.audit.length-6+i));
 const html=s.layer.innerHTML;s.move(1200,200);assert.equal(s.layer.innerHTML,html);
 }finally{s.close();}
});
test('coalesced input follows its bent trajectory rather than connecting its endpoints diagonally',()=>{
 const s=inputSetup();try{
 s.move(100,100);s.move(600,600,[{x:600,y:100},{x:600,y:600}]);
 assert.ok(s.audit.length>=6);
 for(const mark of s.audit)assert.ok(Math.abs(mark.y-100)<.001||Math.abs(mark.x-600)<.001);
 assert.ok(s.audit.some(mark=>mark.x===600&&mark.y>100));
 }finally{s.close();}
});
test('a strict configured cursor limit defers blocked placement without shrinking or skipping media',()=>{
 const s=inputSetup({maxCursorDistance:1});try{
 s.move(200,200);s.move(201,200);const first=s.layer.innerHTML;
 s.move(1000,200);assert.equal(s.layer.innerHTML,first);assert.equal(s.layer.dataset.progress,'1');assert.equal(s.layer.dataset.maxCursorDistance,'1');
 }finally{s.close();}
});
