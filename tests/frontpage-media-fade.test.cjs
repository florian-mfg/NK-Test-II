const test = require('node:test'), assert = require('node:assert/strict');
const api = require('../frontpage-media-fade.js');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), {JSDOM} = require('../studio/node_modules/jsdom');
const anchor = {left: 300, top: 200, width: 200, height: 100};
const center = {x: 400, y: 250};
const endpoints = {right: {x: 600, y: 275}, left: {x: 200, y: 225}, top: {x: 430, y: 100}, bottom: {x: 370, y: 400}};
const connected = (a,b) => ((Math.abs(a.left+a.width-b.left)<.01||Math.abs(b.left+b.width-a.left)<.01)&&Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top)>0)||((Math.abs(a.top+a.height-b.top)<.01||Math.abs(b.top+b.height-a.top)<.01)&&Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left)>0);
test('segment clipping reports the exact exit point on all four edges', () => {
 for (const [edge, endpoint] of Object.entries(endpoints)) {
  const hit = api.boundaryExit(anchor, center, endpoint);
  assert.equal(hit.edge, edge);
  assert.equal(hit.point.x, center.x+(endpoint.x-center.x)*hit.t);
  assert.equal(hit.point.y, center.y+(endpoint.y-center.y)*hit.t);
  assert.equal(api.inside(anchor, hit.point), true);
 }
 assert.equal(api.boundaryExit(anchor, center, {x:450,y:280}), null);
 assert.equal(api.boundaryExit(anchor, center, {x:500,y:250}), null, 'touching an edge is not leaving it');
 assert.equal(api.boundaryExit(anchor, {x:500,y:250}, {x:501,y:250}).edge, 'right');
 assert.equal(api.boundaryExit(anchor, {x:600,y:400}, {x:700,y:500}), null);
 assert.equal(api.boundaryExit(anchor, {x:200,y:250}, {x:600,y:250}).edge, 'right', 'outside-to-outside segment traverses media');
 assert.equal(api.boundaryExit(anchor, {x:200,y:100}, {x:300,y:200}), null, 'corner touch is not an exit');
 assert.equal(api.boundaryExit(anchor, center, {x:600,y:350}).edge, 'right', 'exact corner ties choose horizontal edge');
});
test('requested side is flush and the precise exit point sets tangential alignment for different aspect ratios', () => {
 for(const [edge, endpoint] of Object.entries(endpoints)) for(const ratio of [.6,1,1.8]) {
  const hit=api.boundaryExit(anchor,center,endpoint), size={width:120*ratio,height:120};
  const rect=api.exitPlacement(anchor,size,[anchor],hit,{width:1440,height:900},168);
  assert.equal(rect.edge,edge); assert.ok(connected(anchor,rect)); assert.ok(!api.overlaps(anchor,rect));
  assert.ok(api.inside(rect,hit.point));
  if(['right','left'].includes(edge)) assert.equal(rect.top,hit.point.y-size.height/2);
  else assert.equal(rect.left,hit.point.x-size.width/2);
  assert.ok(Math.abs(rect.width/rect.height-ratio)<1e-8);
 }
});
test('viewport edges keep the crossed side and full size without containment',()=>{
 for(const edge of ['left','right','top','bottom']) {
  const box={left:edge==='left'?0:edge==='right'?1320:600,top:edge==='top'?0:edge==='bottom'?800:400,width:120,height:100};
  const from={x:box.left+60,y:box.top+50},to={x:from.x+({left:-200,right:200}[edge]||0),y:from.y+({top:-200,bottom:200}[edge]||0)};
  const size={width:140,height:110},rect=api.exitPlacement(box,size,[box],api.boundaryExit(box,from,to),{width:1440,height:900});
  assert.equal(rect.edge,edge);assert.equal(rect.width,size.width);assert.equal(rect.height,size.height);assert.ok(connected(box,rect));assert.ok(!api.overlaps(box,rect));
  assert.ok(rect.left<0||rect.top<0||rect.left+rect.width>1440||rect.top+rect.height>900);
 }
});
test('one retained obstacle uses a tangential shift, or an explicitly marked unavoidable overlap',()=>{
 const crossing={edge:'right',point:{x:500,y:250}},size={width:120,height:100};
 const small={left:510,top:200,width:60,height:30};
 const shifted=api.exitPlacement(anchor,size,[anchor,small],crossing);
 assert.equal(shifted.top,230);assert.ok(connected(anchor,shifted));assert.ok(!api.overlaps(small,shifted));assert.ok(api.inside(shifted,crossing.point));
 const full={left:500,top:150,width:200,height:200};
 const fallback=api.exitPlacement(anchor,size,[anchor,full],crossing);
 assert.equal(fallback.edge,'right');assert.equal(fallback.width,120);assert.equal(fallback.overlapFallback,true);
});
test('enlarged CMS sizing is unchanged', () => {
 for(const [width,height] of [[1440,900],[390,844],[320,568],[844,390]]) {
  for(const size of ['small','medium','large']) for(const ratio of [.4,1,16/9,3]) {
   const box=api.dimensions({size,aspectRatio:ratio},width,height);
   assert.ok(Math.abs(box.width/box.height-ratio)<1e-8);
   assert.ok(box.width<=width*.48&&box.height<=height*.48);
  }
 }
 assert.deepEqual(['small','medium','large'].map(size=>api.dimensions({size,aspectRatio:1},1440,900).width),[175,273,381.5]);
});
function setup() {
 const dom=new JSDOM('<section class="home"><div id="layer"></div></section>',{runScripts:'outside-only',pretendToBeVisual:true}), w=dom.window, layer=w.document.querySelector('#layer');
 Object.defineProperty(w,'innerWidth',{value:1440});Object.defineProperty(w,'innerHeight',{value:900});layer.getBoundingClientRect=()=>({left:0,top:0,width:1440,height:900}); Object.defineProperty(layer,'clientWidth',{value:1440});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','frontpage-media-fade.js'),'utf8'),dom.getInternalVMContext());
 const audit=[], append=layer.append.bind(layer);layer.append=n=>{append(n);audit.push({serial:+n.dataset.serial,count:layer.children.length});};
 const dispose=w.FrontpageMediaFade.init(layer,Array.from({length:5},(_,i)=>({type:'image',src:`photo-${i}.jpg`,size:'medium',aspectRatio:1.5})));
 const move=(x,y,samples)=>{const e=new w.MouseEvent('pointermove',{bubbles:true,clientX:x,clientY:y});Object.defineProperty(e,'pointerType',{value:'mouse'});if(samples)Object.defineProperty(e,'getCoalescedEvents',{value:()=>samples.map(p=>({clientX:p.x,clientY:p.y}))});w.document.querySelector('.home').dispatchEvent(e);};
 const rect=()=>{const n=layer.lastElementChild;return {left:parseFloat(n.style.left),top:parseFloat(n.style.top),width:parseFloat(n.style.width),height:parseFloat(n.style.height)};};
 return {w,layer,audit,move,rect,close:()=>{dispose();dom.window.close();}};
}
test('inside movement never spawns; exact exits drive a three-node FIFO and sequence looping', () => {
 const s=setup();try {
  s.move(300,200);s.move(301,200);assert.equal(s.audit.length,1);
  for(let i=0;i<12;i++) {
   const r=s.rect();s.move(r.left+r.width/2,r.top+r.height/2);
   const html=s.layer.innerHTML;
   s.move(r.left+r.width*.8,r.top+r.height*.8);s.move(r.left+r.width*.2,r.top+r.height*.2);
   assert.equal(s.layer.innerHTML,html);
   s.move(r.left+r.width/2,r.top+r.height/2);
   const active=[...s.layer.children].slice(s.layer.children.length===3?1:0).map(n=>({left:parseFloat(n.style.left),top:parseFloat(n.style.top),width:parseFloat(n.style.width),height:parseFloat(n.style.height)}));
   const from={x:r.left+r.width/2,y:r.top+r.height/2};
   const points=[{x:r.left+r.width+1,y:from.y},{x:from.x,y:r.top+r.height+1},{x:r.left-1,y:from.y},{x:from.x,y:r.top-1}];
   const point=[...points.slice(i%4),...points.slice(0,i%4)].find(to=>api.exitPlacement(r,{width:273,height:182},active,api.boundaryExit(r,from,to),{width:1440,height:900},168));
   assert.ok(point);s.move(point.x,point.y);
   assert.equal(s.audit.length,i+2);
   const nodes=[...s.layer.children],count=Math.min(3,i+2);
   assert.equal(nodes.length,count);assert.deepEqual(nodes.map(n=>+n.dataset.serial),Array.from({length:count},(_,j)=>i+2-count+j));
   assert.ok(nodes.every(n=>+n.dataset.sequence===+n.dataset.serial%5&&n.style.opacity==='1'));
  }
  assert.ok(s.audit.every(a=>a.count<=3));
 } finally {s.close();}
});
test('fast and coalesced moves emit at most once and do not catch up while outside', () => {
 const s=setup();try {
  s.move(300,200);s.move(1200,200);assert.equal(s.audit.length,1);
  s.move(1300,210);assert.equal(s.audit.length,1,'outside-only movement has no crossing');
  let r=s.rect();s.move(r.left+r.width/2,r.top+r.height/2);
  const n=s.audit.length;
  s.move(1200,700,[{x:r.left+r.width+30,y:r.top+r.height/2},{x:1100,y:600}]);
  assert.equal(s.audit.length,n+1);
  const html=s.layer.innerHTML;s.move(1300,800);assert.equal(s.layer.innerHTML,html);
 } finally {s.close();}
});
test('a nearby flush alignment can avoid an obstacle even when it no longer contains the cursor',()=>{
 const obstacle={left:510,top:220,width:60,height:40},crossing={edge:'right',point:{x:500,y:250}};
 const rect=api.exitPlacement(anchor,{width:120,height:100},[anchor,obstacle],crossing);
 assert.equal(rect.top,260);assert.equal(rect.edge,'right');assert.ok(connected(anchor,rect));assert.ok(!api.overlaps(obstacle,rect));assert.equal(rect.overlapFallback,undefined);
});
