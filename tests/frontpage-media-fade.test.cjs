const test = require('node:test'), assert = require('node:assert/strict');
const {JSDOM} = require('../studio/node_modules/jsdom');
const fs = require('node:fs'), vm = require('node:vm');
const api = require('../frontpage-media-fade.js');
test('linear input reveal promotes at exactly 1 and preserves excess across transitions',()=>{
 assert.equal(api.DISTANCE_PER_IMAGE,1200);assert.equal(api.MOBILE_TRANSITIONS_PER_SECOND,.28);
 assert.deepEqual(api.transitionState(0),{serial:0,currentIndex:0,incomingIndex:1,opacity:0});
 assert.equal(api.transitionState(.47).opacity,.47);
 assert.deepEqual(api.transitionState(1),{serial:1,currentIndex:1,incomingIndex:2,opacity:0});
 const excess=api.transitionState((1200-50+120)/1200);assert.equal(excess.currentIndex,1);assert.ok(Math.abs(excess.opacity-70/1200)<1e-12);
 assert.deepEqual(api.transitionState(20),{serial:20,currentIndex:0,incomingIndex:1,opacity:0});
 assert.equal(api.transitionState(1e9+.25).opacity,.25);
 assert.equal(api.trajectories,undefined);assert.equal(api.lifecycle,undefined);assert.equal(api.firstContact,undefined);
});
test('Euclidean mouse distance always advances positively regardless of direction',()=>{
 for(const p of [{x:200,y:0},{x:-200,y:0},{x:0,y:200},{x:0,y:-200}])assert.equal(api.distance({x:0,y:0},p),200);
 assert.equal(api.distance({x:0,y:0},{x:3,y:4}),5);
 for(const source of api.media)assert.ok(fs.existsSync(require('node:path').join(__dirname,'..',source.src)));
});
test('mouse input freezes exactly, resumes, resizes, cleans up and ignores coarse mouse input', async () => {
 const dom=new JSDOM('<div id="layer"></div>',{runScripts:'outside-only'}),w=dom.window;
 let fine=true,change;
 w.matchMedia=()=>({get matches(){return fine;},addEventListener(type,cb){change=cb;}});
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../frontpage-media-fade.js'),'utf8'),dom.getInternalVMContext());
 const layer=w.document.querySelector('#layer');let dispose=w.FrontpageMediaFade.init(layer);
  // jsdom has no PointerEvent constructor.
 const send=(x,y)=>{const e=new w.MouseEvent('pointermove',{clientX:x,clientY:y});Object.defineProperty(e,'pointerType',{value:'mouse'});w.document.dispatchEvent(e);};
 assert.equal(layer.children.length,2);send(0,0);assert.equal(layer.children.length,2);send(300,400);assert.equal(layer.dataset.distance,'500');
 const frozen=layer.innerHTML;await new Promise(r=>setTimeout(r,650));assert.equal(layer.innerHTML,frozen);
 send(303,404);assert.equal(layer.dataset.distance,'505');assert.notEqual(layer.innerHTML,frozen);
 for(let i=0;i<500;i++)send(i%2?1000:0,0);
 assert.ok(layer.children.length===2);const progress=layer.dataset.progress;w.dispatchEvent(new w.Event('resize'));assert.equal(layer.dataset.progress,progress);
 fine=false;change();const coarseFrozen=layer.innerHTML;send(500,0);assert.equal(layer.innerHTML,coarseFrozen);
 dispose();fine=true;dispose=w.FrontpageMediaFade.init(layer);send(0,0);send(3,4);assert.equal(layer.dataset.distance,'5');dispose();send(100,100);assert.equal(layer.children.length,0);dom.window.close();
});

test('touch time shares renderer, ignores position/UI, freezes and cleans up with multiple fingers', () => {
 const dom=new JSDOM('<section class="home"><div id="layer"></div></section><button>Menu</button>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.matchMedia=()=>({matches:false,addEventListener(){}});
 let now=0,next=0,frames=new Map();
 w.requestAnimationFrame=cb=>{frames.set(++next,cb);return next;};w.cancelAnimationFrame=id=>frames.delete(id);
 Object.defineProperty(w.performance,'now',{value:()=>now});
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../frontpage-media-fade.js'),'utf8'),dom.getInternalVMContext());
 const layer=w.document.querySelector('#layer'),home=w.document.querySelector('.home');
 let dispose=w.FrontpageMediaFade.init(layer);
 const pointer=(type,id=1,target=home,x=10,y=10)=>{const e=new w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y});Object.defineProperties(e,{pointerType:{value:'touch'},pointerId:{value:id}});target.dispatchEvent(e);};
 const advance=ms=>{now+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb(now));};
 const progress=()=>Number(layer.dataset.progress);
 advance(1000);assert.equal(progress(),0);assert.equal(frames.size,0);
 pointer('pointerdown',1,w.document.querySelector('button'));advance(1000);assert.equal(progress(),0);
 pointer('pointerdown');advance(1000);assert.equal(progress(),api.MOBILE_TRANSITIONS_PER_SECOND);
 const state=w.FrontpageMediaFade.transitionState(progress());
 assert.equal(layer.querySelector('[data-role="incoming"]').style.opacity,String(state.opacity));
 pointer('pointermove',1,home,900,600);assert.equal(progress(),api.MOBILE_TRANSITIONS_PER_SECOND);
 pointer('pointerdown',2);advance(1000);assert.equal(progress(),api.MOBILE_TRANSITIONS_PER_SECOND*2);
 pointer('pointerup',1);advance(1000);assert.ok(Math.abs(progress()-api.MOBILE_TRANSITIONS_PER_SECOND*3)<1e-12);
 pointer('pointerup',2);const frozen=layer.innerHTML,atRelease=progress();advance(3000);assert.equal(layer.innerHTML,frozen);assert.equal(progress(),atRelease);assert.equal(frames.size,0);
 pointer('pointerdown',3,home,950,700);advance(1000);assert.ok(progress()>atRelease);pointer('pointercancel',3);const cancelled=layer.innerHTML;advance(1000);assert.equal(layer.innerHTML,cancelled);
 pointer('pointerdown',4);w.dispatchEvent(new w.Event('blur'));assert.equal(frames.size,0);
 pointer('pointerdown',5);Object.defineProperty(w.document,'hidden',{configurable:true,value:true});w.document.dispatchEvent(new w.Event('visibilitychange'));assert.equal(frames.size,0);Object.defineProperty(w.document,'hidden',{configurable:true,value:false});
 pointer('pointerdown',6);advance(100000);assert.ok(layer.children.length===2);const preResize=progress();w.dispatchEvent(new w.Event('resize'));assert.equal(progress(),preResize);
 dispose();assert.equal(frames.size,0);assert.equal(layer.children.length,0);advance(1000);
 dispose=w.FrontpageMediaFade.init(layer);pointer('pointerdown',7);advance(1000);assert.equal(progress(),api.MOBILE_TRANSITIONS_PER_SECOND);pointer('lostpointercapture',7);assert.equal(frames.size,0);
 dispose();
 const states=[];
 for(const [x,y] of [[10,10],[500,400],[950,700]]) {
  const cleanup=w.FrontpageMediaFade.init(layer);pointer('pointerdown',8,home,x,y);advance(1000);pointer('pointerup',8);states.push(layer.innerHTML);cleanup();
 }
 assert.equal(states[0],states[1]);assert.equal(states[1],states[2]);
 dom.window.close();
});
