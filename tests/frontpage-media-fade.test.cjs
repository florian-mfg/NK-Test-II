const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('../studio/node_modules/jsdom'),api=require('../frontpage-media-fade.js');
test('collage reveals in order, crossfades oldest with newest, bounds settled window and loops',()=>{
 assert.equal(api.collageState(0)[0].opacity,0);
 assert.deepEqual(api.collageState(.4).map(n=>[n.index,n.opacity]),[[0,.4]]);
 assert.deepEqual(api.collageState(6).map(n=>n.index),[0,1,2,3,4,5]);
 const halfway=api.collageState(6.5);assert.equal(halfway.length,7);assert.equal(halfway[0].opacity,.5);assert.equal(halfway.at(-1).opacity,.5);
 assert.deepEqual(api.collageState(7).map(n=>n.index),[1,2,3,4,5,6]);
 assert.deepEqual(api.collageState(8).map(n=>n.index),[2,3,4,5,6,7]);
 assert.equal(api.collageState(20.5).at(-1).index,0);
 for(let p=0;p<1000;p+=.25){const state=api.collageState(p);assert.ok(state.length<=7);assert.equal(new Set(state.map(n=>n.index)).size,state.length);if(Number.isInteger(p)&&p>0)assert.ok(state.length<=6);}
 for(const source of api.media)assert.ok(fs.existsSync(path.join(__dirname,'..',source.src)));
 assert.equal(api.distance({x:0,y:0},{x:3,y:4}),5);
});
test('deterministic varied placements retain proportions and stay within responsive viewports',()=>{
 for(const [w,h] of [[1440,900],[390,844],[844,390],[320,568]]){
 const sizes=new Set(),positions=new Set();
 for(let i=0;i<40;i++){const ratio=api.media[i%20].aspectRatio,b=api.layout(i,w,h,ratio);assert.ok(b.left>=0&&b.top>=0&&b.left+b.width<=w+1e-8&&b.top+b.height<=h+1e-8);assert.ok(Math.abs(b.width/b.height-ratio)<1e-10);sizes.add(b.width);positions.add(b.left);}
 assert.ok(sizes.size>6&&positions.size>6);
 }
});
function setup(){
 const dom=new JSDOM('<section class="home"><div id="layer"></div></section><button>Menu</button>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let fine=true,now=0,id=0;const frames=new Map();w.matchMedia=()=>({get matches(){return fine},addEventListener(){}});
 w.requestAnimationFrame=cb=>{frames.set(++id,cb);return id};w.cancelAnimationFrame=id=>frames.delete(id);Object.defineProperty(w.performance,'now',{value:()=>now});
 for(const file of ['frontpage-media.js','frontpage-media-fade.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),dom.getInternalVMContext());
 const layer=w.document.querySelector('#layer'),home=w.document.querySelector('.home'),dispose=w.FrontpageMediaFade.init(layer);
 const event=(type,pointerType='mouse',x=0,y=0,target=home,pointerId=1)=>{const e=new w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y});Object.defineProperties(e,{pointerType:{value:pointerType},pointerId:{value:pointerId}});target.dispatchEvent(e)};
 const advance=ms=>{now+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb(now))};
 return {w,dom,layer,home,dispose,event,advance,frames,setFine:value=>fine=value};
}
test('mouse rAF retains excess travel without skipping media or progressing while stopped',()=>{
 const s=setup();try{
 s.event('pointermove');s.event('pointermove','mouse',api.DISTANCE_PER_IMAGE*6.5);assert.equal(s.frames.size,1);s.advance(0);assert.equal(s.layer.dataset.progress,'0.5');
 const frozen=s.layer.innerHTML;s.advance(5000);assert.equal(s.layer.innerHTML,frozen);
 for(let i=2;i<=12;i++){s.event('pointermove','mouse',api.DISTANCE_PER_IMAGE*6.5+i);s.advance(0);assert.equal(Number(s.layer.dataset.progress),i*.5);}
 s.event('pointermove','mouse',api.DISTANCE_PER_IMAGE*6.5+13);s.advance(0);assert.ok(Number(s.layer.dataset.progress)===6.5);assert.equal(s.layer.children.length,7);
 const p=s.layer.dataset.progress;s.w.dispatchEvent(new s.w.Event('resize'));s.advance(0);assert.equal(s.layer.dataset.progress,p);
 s.setFine(false);s.event('pointermove','mouse',4000);s.advance(1000);assert.equal(s.layer.dataset.progress,p);
 s.dispose();assert.equal(s.layer.children.length,0);assert.equal(s.frames.size,0);
 }finally{s.dom.window.close()}
});
test('touch hold advances once for multiple fingers; release freezes exactly and resumes; controls excluded',()=>{
 const s=setup();try{
 s.setFine(false);s.event('pointerdown','touch',0,0,s.w.document.querySelector('button'));s.advance(1000);assert.equal(s.layer.dataset.progress,'0');
 s.event('pointerdown','touch');s.advance(50);assert.ok(Math.abs(Number(s.layer.dataset.progress)-api.MOBILE_TRANSITIONS_PER_SECOND*.05)<1e-12);
 s.event('pointerdown','touch',0,0,s.home,2);s.advance(50);assert.ok(Math.abs(Number(s.layer.dataset.progress)-api.MOBILE_TRANSITIONS_PER_SECOND*.10)<1e-12);
 s.event('pointerup','touch');s.advance(50);assert.ok(Math.abs(Number(s.layer.dataset.progress)-api.MOBILE_TRANSITIONS_PER_SECOND*.15)<1e-12);
 s.event('pointerup','touch',0,0,s.home,2);const frozen=s.layer.innerHTML;s.advance(2000);assert.equal(s.layer.innerHTML,frozen);assert.equal(s.frames.size,0);
 s.event('pointerdown','touch');s.advance(1000);assert.ok(Number(s.layer.dataset.progress)>api.MOBILE_TRANSITIONS_PER_SECOND*.15);s.event('pointercancel','touch');const resumed=s.layer.innerHTML;s.advance(1000);assert.equal(s.layer.innerHTML,resumed);
 s.dispose();assert.equal(s.frames.size,0);
 }finally{s.dom.window.close()}
});

test('additional 2.5x progression and connected spreads have deliberate scale hierarchy',()=>{
 assert.ok(Math.abs((480/3.5)/api.DISTANCE_PER_IMAGE-2.5)<1e-12);assert.ok(Math.abs(api.MOBILE_TRANSITIONS_PER_SECOND/2.45-2.5)<1e-12);
 for(const [w,h] of [[1440,900],[390,844]])for(const first of [0,6,12,18,24,30]){
 const boxes=Array.from({length:6},(_,i)=>api.layout(first+i,w,h,api.media[(first+i)%20].aspectRatio));
 assert.ok(Math.max(...boxes.map(b=>b.width))/Math.min(...boxes.map(b=>b.width))>2.5);
 const overlap=(a,b)=>a.left<b.left+b.width&&b.left<a.left+a.width&&a.top<b.top+b.height&&b.top<a.top+a.height;
 assert.ok(boxes.slice(1).filter((b,i)=>boxes.slice(0,i+1).some(a=>overlap(a,b))).length>=4,'at least four images attach to an existing image');
 assert.ok(boxes.some(b=>b.left===0||Math.abs(b.left+b.width-w)<1e-8),'spread reaches viewport edge');
 for(const [index,box] of boxes.entries()){
 let visible=0;
 for(let y=0;y<20;y++)for(let x=0;x<20;x++){
 const px=box.left+(x+.5)/20*box.width,py=box.top+(y+.5)/20*box.height;
 if(!boxes.slice(index+1).some(b=>px>b.left&&px<b.left+b.width&&py>b.top&&py<b.top+b.height))visible++;
 }
 assert.ok(visible>=20,`source ${first+index} at ${w} retains a recognizable exposed fragment (${visible})`);
 }

 }
});
