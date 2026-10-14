const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../frontpage-media-fade.js');
const bounds={viewLeft:0,viewTop:0,viewRight:390,viewBottom:844,width:390,height:844};
test('off-screen continuation requires a directional crossing of the visible edge band',()=>{
 const r={left:310,top:100,width:175,height:120};
 assert.equal(api.boundaryExit(r,{x:350,y:160},{x:389,y:160}),null,'physical right edge is unreachable');
 const hit=api.viewportExit(r,{x:350,y:160},{x:389,y:160},bounds);
 assert.equal(hit.edge,'right');assert.equal(hit.point.x,382);assert.equal(hit.continuation,true);
 assert.equal(api.viewportExit(r,{x:389,y:160},{x:388,y:160},bounds),null,'outside-band movement does not repeatedly spawn');
 assert.equal(api.viewportExit(r,{x:389,y:160},{x:350,y:160},bounds),null,'entering the visible portion does not spawn');
 const contained={left:10,top:100,width:175,height:120};
 assert.equal(api.viewportExit(contained,{x:100,y:160},{x:200,y:160},bounds),null,'normal exits stay normal');
 for(const [r,from,to,edge] of [
  [{left:-50,top:100,width:175,height:120},{x:50,y:160},{x:1,y:160},'left'],
  [{left:100,top:-50,width:175,height:120},{x:160,y:50},{x:160,y:1},'top'],
  [{left:100,top:800,width:175,height:120},{x:160,y:820},{x:160,y:843},'bottom']
 ])assert.equal(api.viewportExit(r,from,to,bounds).edge,edge);
});
function setup() {
 const {JSDOM}=require('../studio/node_modules/jsdom'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
 const dom=new JSDOM('<section class="home"><div id="layer"></div></section>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,layer=w.document.querySelector('#layer');
 Object.defineProperty(w,'innerWidth',{value:390,writable:true});Object.defineProperty(w,'innerHeight',{value:844,writable:true});
 let measurements=0;layer.getBoundingClientRect=()=>{measurements++;return {left:0,top:0,width:w.innerWidth,height:w.innerHeight};};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','frontpage-media-fade.js'),'utf8'),dom.getInternalVMContext());
 const dispose=w.FrontpageMediaFade.init(layer,[{type:'image',src:'local.jpg',aspectRatio:1.5}]);
 const move=(x,y,samples)=>{const e=new w.MouseEvent('pointermove',{clientX:x,clientY:y,bubbles:true});Object.defineProperty(e,'pointerType',{value:'mouse'});if(samples)Object.defineProperty(e,'getCoalescedEvents',{value:()=>samples.map(([clientX,clientY])=>({clientX,clientY}))});layer.dispatchEvent(e);};
 return {w,layer,move,measurements:()=>measurements,close:()=>{dispose();w.close();}};
}
test('continuation is immediate, full-size, one per event, and requires a fresh crossing',()=>{
 const s=setup();try{
  s.move(350,160);s.move(351,160);const n=s.layer.lastElementChild,originalWidth=n.style.width;
  assert.ok(parseFloat(n.style.left)+parseFloat(n.style.width)>390,'off-screen rectangle is intentional');
  s.move(389,160,[[383,160],[385,160],[387,160]]);assert.equal(s.layer.dataset.progress,'2');
  assert.equal(s.layer.lastElementChild.dataset.sharedEdge,'continuation');assert.equal(s.layer.lastElementChild.style.width,originalWidth);
  const html=s.layer.innerHTML;s.move(388,160);s.move(389,160);assert.equal(s.layer.innerHTML,html);
  s.move(350,160);s.move(389,160);assert.equal(s.layer.dataset.progress,'3');s.move(350,160);s.move(389,160);assert.equal(s.layer.dataset.progress,'4');
  assert.equal(s.layer.children.length,3);assert.deepEqual([...s.layer.children].map(n=>n.dataset.serial),['1','2','3']);
  assert.equal(s.measurements(),1,'pointer movement never measures layout');
 }finally{s.close();}
});
test('resize keeps existing nodes stationary and resumes when the active item becomes unreachable',()=>{
 const s=setup();try{
  s.move(300,600);s.move(301,600);const node=s.layer.lastElementChild,html=s.layer.innerHTML;
  s.w.innerHeight=250;s.w.dispatchEvent(new s.w.Event('resize'));assert.equal(s.layer.innerHTML,html);assert.equal(s.layer.lastElementChild,node);
  s.move(200,100);s.move(201,100);assert.equal(s.layer.dataset.progress,'2');assert.equal(s.layer.lastElementChild.dataset.sharedEdge,'continuation');assert.equal(s.layer.firstElementChild,node);
  assert.equal(s.measurements(),2);
 }finally{s.close();}
});
test('ordinary inside motion performs no DOM writes or layout reads',()=>{
 const s=setup();try{
  s.move(150,160);s.move(151,160);const html=s.layer.outerHTML;
  for(let i=0;i<1000;i++)s.move(150+i%20,155+i%10);
  assert.equal(s.layer.outerHTML,html);assert.equal(s.measurements(),1);
 }finally{s.close();}
});
