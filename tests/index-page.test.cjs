'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {JSDOM} = require('../studio/node_modules/jsdom');
const adapter = require('../sanity-data.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const doc = (type, fields = {}) => ({_id: type, _type: type, ...fields});
function setup(hash = '#archive', mobile = false) {
  const dom = new JSDOM(read('index.html'), {url: `https://example.com/portfolio/${hash}`, runScripts: 'outside-only', pretendToBeVisual: true});
  const {window} = dom;
  const scrollCalls = [];
  window.scrollTo = (x, y) => {scrollCalls.push([x, y]); window.scrollY = y;};
  window.matchMedia = () => ({matches: mobile, addEventListener() {}});
  window.HTMLElement.prototype.scrollTo = function({top}) { this.scrollTop = top; };
  window.ResizeObserver = class {observe() {}};
  window.HTMLCanvasElement.prototype.getContext = () => ({measureText: text => ({width: text.length * 50, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 50})});
  Object.defineProperty(window.document, 'fonts', {value: {ready: Promise.resolve(), addEventListener() {}}});
  const dialog = window.document.querySelector('.mobile-menu');
  dialog.close = () => {dialog.open = false;};
  dialog.showModal = () => {dialog.open = true;};
  let resolve, reject, requests = 0;
  const pending = new Promise((yes, no) => {resolve = yes; reject = no;});
  window.SanityData = {load: () => {requests++; return pending;}};
  for (const file of ['projects.js', 'vimeo-media.js', 'project-modules.js', 'project-video.js', 'app.js']) vm.runInContext(read(file), dom.getInternalVMContext());
  window.fitWorkMenu();
  const flush = () => new Promise(yes => setImmediate(yes));
  return {window, dom, scrollCalls, requests: () => requests, reject: async () => {reject(new Error('offline')); await flush();},
    settle: async result => {resolve(result); await flush();}};
}
const success = data => ({ok: true, data, error: null});

const img = (id, extra = {}) => ({asset:{_ref:`image-${id}-1200x800-jpg`}, ...extra});
const project = (id, extra = {}) => ({_id:id,_type:'project',slug:{current:id},title:`Project ${id}`,category:'Video',year:2026,additionalInfo:'Inherited info',modules:[],...extra});
const entry = (title, extra = {}) => ({displayTitle:title,previewImages:[img('index')],...extra});
const content = (entries, projects=[]) => adapter.normalize({projects,indexPage:doc('indexPage',{entries})});
const rows = app => [...app.window.document.querySelectorAll('.archive-row')];
const titles = app => rows(app).map(row=>row.firstElementChild.textContent);
const fire = (app, row, name) => {
 if (name === 'mousemove') {
  rows(app).forEach((item,index)=>{item.getBoundingClientRect=()=>({top:100+index*40,bottom:140+index*40});});
  app.window.dispatchEvent(new app.window.MouseEvent('mousemove',{clientY:120+Number(row.dataset.index)*40}));
 } else row.dispatchEvent(new app.window.MouseEvent(name,{bubbles:true}));
};
const flush = () => new Promise(resolve=>setImmediate(resolve));

test('Index preserves CMS order and independent metadata; legacy references never create links',async()=>{
 const app=setup();
 try {
  assert.ok(app.window.document.querySelector('.archive[aria-busy]'));
  assert.deepEqual(titles(app),[]);
  app.window.arrangeArchive=()=>{throw Error('CMS must not use local ordering');};
  const scrolls=app.scrollCalls.length;
  app.window.scrollY=90;
  await app.settle(success(content([
   entry('Z independent',{year:1999,additionalInfo:'Own'}),
   entry('Own title',{project:{_ref:'enabled'}}),
   entry('A override',{project:{_ref:'enabled'},year:2001,additionalInfo:''}),
   entry('Disabled',{project:{_ref:'disabled'}}),
   entry('Missing reference',{project:{_ref:'missing'}})
  ],[project('enabled'),project('disabled',{detailPageEnabled:false})])));
  assert.deepEqual(titles(app),['Z independent','Own title','A override','Disabled','Missing reference']);
  assert.deepEqual(rows(app).map(row=>row.dataset.year),['1999','','2001','','']);
  assert.deepEqual(rows(app).map(row=>row.querySelector('.archive-additional-info').textContent),['Own','','','','']);
  assert.ok(rows(app).every(row=>row.tagName==='BUTTON' && !row.querySelector('a')));
  for(const row of rows(app)) {row.firstElementChild.click();row.querySelector('.archive-additional-info').click();}
  assert.equal(app.window.location.hash,'#archive');
  assert.equal(app.scrollCalls.length,scrolls);
  assert.equal(app.window.scrollY,90);
  const list=app.window.document.querySelector('.archive-list');
  list.scrollTop=55;
  app.window.renderArchive();app.window.route();
  assert.equal(app.window.document.querySelector('.archive-list'),list);
  assert.equal(list.scrollTop,55);
  assert.equal(app.requests(),1);
 }finally{app.dom.window.close();}
});

test('desktop hover/click cycles only Index images and uses cropped orientation while retaining crop and hotspot',async()=>{
 const app=setup();
 try {
  const crop={left:.25,right:.25,top:0,bottom:0};
  await app.settle(success(content([entry('Images',{project:{_ref:'enabled'},initialLayout:'half',previewImages:[img('first',{crop,hotspot:{x:.375,y:.6,width:.1,height:.1},alt:'First alt'}),img('second',{alt:'Second alt'})]})],[project('enabled')])));
  const row=rows(app)[0], bg=app.window.document.querySelector('.archive-background'), image=bg.querySelector('img');
  fire(app,row,'mousemove');
  assert.ok(image.src.includes('/first-1200x800.jpg'));
  assert.equal(new URL(image.src).searchParams.get('rect'),'300,0,600,800');
  assert.equal(image.style.objectPosition,'25% 60%');
  assert.equal(image.alt,'First alt');
  assert.ok(bg.classList.contains('half'));
  row.querySelector('.archive-additional-info').click();
  assert.ok(image.src.includes('/second-1200x800.jpg'));
  assert.equal(image.style.objectPosition,'');
  assert.equal(image.alt,'Second alt');
  assert.ok(bg.classList.contains('full'));
  assert.equal(app.window.location.hash,'#archive');
  fire(app,row,'click');
  assert.ok(image.src.includes('/first-1200x800.jpg'));
  assert.ok(bg.classList.contains('half'));
  fire(app,row,'mouseleave');
  assert.equal(bg.classList.contains('visible'),true);
  fire(app,row,'mousemove');
  row.firstElementChild.click();await flush();
  assert.ok(image.src.includes('/second-1200x800.jpg'));
  assert.equal(app.window.location.hash,'#archive');
  assert.equal(row.querySelector('a'),null);
 }finally{app.dom.window.close();}
});

test('mobile scroll/selection still drives previews and full-width layout',async()=>{
 const app=setup('#archive',true);
 try {
  await app.settle(success(content([entry('One',{initialLayout:'half',previewImages:[img('one')]}),entry('Two',{previewImages:[img('two')]})])));
  const list=app.window.document.querySelector('.archive-list');
  list.getBoundingClientRect=()=>({top:0});
  for(const [index,row] of rows(app).entries()) {
   Object.defineProperty(row,'offsetTop',{value:index*30});
   row.getBoundingClientRect=()=>({bottom:(index+1)*30-list.scrollTop});
  }
  rows(app)[0].click();
  assert.equal(rows(app)[0].getAttribute('aria-current'),'true');
  assert.ok(app.window.document.querySelector('.archive-background').classList.contains('full'));
  rows(app)[1].click();
  assert.equal(list.scrollTop,30);
  assert.equal(rows(app)[1].getAttribute('aria-current'),'true');
  assert.ok(app.window.document.querySelector('.archive-background img').src.includes('/two-1200x800.jpg'));
  list.scrollTop=0;list.dispatchEvent(new app.window.Event('scroll'));
  await new Promise(resolve=>app.window.requestAnimationFrame(resolve));
  assert.equal(rows(app)[0].getAttribute('aria-current'),'true');
 }finally{app.dom.window.close();}
});

test('1, 2 and 3 images wrap in order with the existing arrow-cursor click interaction',async()=>{
 for(const count of [1,2,3]) {
  const app=setup();
  try {
   await app.settle(success(content([entry('Cycle',{previewImages:Array.from({length:count},(_,i)=>img(`image${i}`))})])));
   const row=rows(app)[0], bg=app.window.document.querySelector('.archive-background');
   fire(app,row,'mousemove');
   for(let i=0;i<count*2+1;i++) {
    assert.ok(bg.querySelector('img').src.includes(`/image${i%count}-1200x800.jpg`));
    assert.equal(bg.classList.contains('half'),false);
    assert.ok(bg.classList.contains('full'));
    assert.equal(app.window.location.hash,'#archive');
    row.firstElementChild.click();
   }
  }finally{app.dom.window.close();}
 }
});

test('published empty Index and entries without images do not crash or pull in local content',async()=>{
 for(const mobile of [false,true]) for(const entries of [[],[entry('No image',{previewImages:[]})]]) {
  const app=setup('#archive',mobile);
  try {
   await app.settle(success(content(entries)));
   assert.deepEqual(titles(app),[]);
   assert.equal(app.window.document.querySelector('.archive').dataset.source,'sanity');
   assert.equal(app.window.document.querySelector('.archive-background img'),null);
   app.window.dispatchEvent(new app.window.Event('resize'));
  }finally{app.dom.window.close();}
 }
});

test('request, document and malformed entries-array failures preserve arranged local fallback',async()=>{
 for(const result of [{ok:false},success(adapter.normalize({projects:[]})),success(content('malformed'))]) {
  const app=setup();
  try {
   await app.settle(result);
   const expected=vm.runInContext('ARCHIVE_DISPLAY_PROJECTS.map(p=>p.title)',app.dom.getInternalVMContext());
   assert.deepEqual(titles(app),Array.from(expected));
   assert.equal(app.window.document.querySelector('.archive').dataset.source,'local');
   fire(app,rows(app)[0],'mousemove');fire(app,rows(app)[0],'click');
   assert.ok(app.window.document.querySelector('.archive-background').classList.contains('visible'));
  }finally{app.dom.window.close();}
 }
 const app=setup();
 try{await app.reject();assert.ok(rows(app).length>0);}finally{app.dom.window.close();}
});

test('late Index data cannot replace another route and returning uses the cached snapshot',async()=>{
 const app=setup();
 try {
  app.window.location.hash='#imprint';app.window.route();
  const initial=app.window.document.querySelector('#app').innerHTML;
  await app.settle(success(content([entry('<b>Safe</b>')])));
  assert.equal(app.window.document.querySelector('#app').innerHTML,initial);
  app.window.location.hash='#archive';app.window.route();await flush();
  assert.deepEqual(titles(app),['<b>Safe</b>']);
  assert.equal(app.window.document.querySelector('.archive-row b'),null);
  assert.equal(app.requests(),1);
 }finally{app.dom.window.close();}
});

test('live Index document or its actual absence reaches the Index renderer', {skip:!process.env.INFO_LIVE_SMOKE},async()=>{
 const result=await adapter.load();assert.equal(result.ok,true,JSON.stringify(result.error));
 const app=setup();
 try {
  await app.settle(result);
  if(result.data.indexPage) {
   assert.deepEqual(titles(app),result.data.indexPage.entries.map(entry=>entry.title));
   assert.equal(app.window.document.querySelector('.archive').dataset.source,'sanity');
   assert.equal(app.window.document.querySelector('.archive-row a'),null);
   for (const row of rows(app)) row.firstElementChild.click();
   assert.equal(app.window.location.hash,'#archive');
  }else{
   assert.equal(app.window.document.querySelector('.archive').dataset.source,'local');
   assert.deepEqual(titles(app),Array.from(vm.runInContext('ARCHIVE_DISPLAY_PROJECTS.map(p=>p.title)',app.dom.getInternalVMContext())));
  }
 }finally{app.dom.window.close();}
});

const portrait = (id, portraitPosition) => ({asset: {_ref: `image-${id}-800x1200-jpg`}, portraitPosition});
test('per-image desktop positions follow the active image, including portrait/landscape transitions', async () => {
 const app = setup();
 try {
  const images = [portrait('left','left'), portrait('center','center'), portrait('right','right')];
  await app.settle(success(content([entry('Portraits',{previewImages:images}),
   entry('Mixed',{initialLayout:'half',previewImages:[portrait('p','right'),img('wide',{portraitPosition:'left'}),portrait('p2','center')]})])));
  const bg=app.window.document.querySelector('.archive-background');
  const check=(half,left=false,center=false)=>{
   assert.equal(bg.classList.contains('half'),half);
   assert.equal(bg.classList.contains('full'),!half);
   assert.equal(bg.classList.contains('portrait-left'),left);
   assert.equal(bg.classList.contains('portrait-center'),center);
  };
  fire(app,rows(app)[0],'mousemove'); check(true,true);
  rows(app)[0].click(); check(true,false,true);
  rows(app)[0].click(); check(true);
  rows(app)[0].click(); check(true,true);
  fire(app,rows(app)[1],'mousemove'); check(true);
  rows(app)[1].click(); check(false);
  rows(app)[1].click(); check(true,false,true);
 } finally {app.dom.window.close();}
});

test('landscape ignores every portrait position on desktop and mobile; mobile portraits stay full width', async () => {
 for(const mobile of [false,true]) for(const position of ['left','center','right']) for(const isPortrait of [false,true]) {
  const app=setup('#archive',mobile);
  try {
   await app.settle(success(content([entry('Image',{previewImages:[isPortrait?portrait('p',position):img('wide',{portraitPosition:position})]})])));
   if(!mobile) fire(app,rows(app)[0],'mousemove');
   const bg=app.window.document.querySelector('.archive-background');
   assert.equal(bg.classList.contains('half'),!mobile&&isPortrait);
   assert.equal(bg.classList.contains('full'),mobile||!isPortrait);
  }finally{app.dom.window.close();}
 }
});

test('legacy portrait positions preserve first-cycle alignment and remain stable on subsequent cycles',async()=>{
 for(const initialLayout of ['half','full',undefined]) {
  const app=setup();
  try {
   await app.settle(success(content([entry('Legacy',{initialLayout,previewImages:[portrait('a'),portrait('b'),portrait('c')]})])));
   fire(app,rows(app)[0],'mousemove');
   const bg=app.window.document.querySelector('.archive-background');
   for(let i=0;i<7;i++) {
    assert.ok(bg.classList.contains('half'));
    const right=(initialLayout==='half')!==((i%3)%2===1);
    assert.equal(bg.classList.contains('portrait-center'),!right);
    rows(app)[0].click();
   }
  }finally{app.dom.window.close();}
 }
});

test('desktop starts on the first preview and changes only inside actual vertical row bounds', async()=>{
 const app=setup();
 try {
  await app.settle(success(content([
   entry('First',{previewImages:[portrait('first','left'),portrait('cycle','center')]}),
   entry('Second',{previewImages:[img('landscape')]}),
   entry('Third',{previewImages:[portrait('third','right')]})
  ])));
  const bg=app.window.document.querySelector('.archive-background');
  const image=bg.querySelector('img');
  const selected=()=>rows(app).findIndex(row=>row.getAttribute('aria-current')==='true');
  const move=(y,x=0)=>app.window.dispatchEvent(new app.window.MouseEvent('mousemove',{clientY:y,clientX:x}));
  rows(app).forEach((row,index)=>{row.getBoundingClientRect=()=>({top:100+index*50,bottom:150+index*50});});
  assert.equal(selected(),0);
  assert.ok(bg.classList.contains('visible'));
  assert.ok(bg.classList.contains('portrait-left'));
  assert.ok(image.src.includes('/first-'));
  for(const y of [0,100,125,149.99]) {move(y);assert.equal(selected(),0);}
  rows(app)[0].click();
  assert.ok(image.src.includes('/cycle-'));
  move(149,1200);
  assert.ok(image.src.includes('/cycle-')); // Moving within a row never resets cycling.
  move(150);
  assert.equal(selected(),1);
  assert.ok(image.src.includes('/landscape-'));
  assert.ok(bg.classList.contains('full'));
  move(199.99);assert.equal(selected(),1);
  move(200);assert.equal(selected(),2);
  assert.ok(image.src.includes('/third-'));
  assert.ok(bg.classList.contains('half'));
  move(300);assert.equal(selected(),2);
  assert.ok(bg.classList.contains('visible'));
  move(149.99);
  assert.equal(selected(),0);
  assert.ok(image.src.includes('/first-'));
  assert.ok(bg.classList.contains('portrait-left'));
 }finally{app.dom.window.close();}
});

function mobileGestureFixture(app) {
 const list=app.window.document.querySelector('.archive-list');
 list.getBoundingClientRect=()=>({top:50});
 rows(app).forEach((row,index)=>{
  Object.defineProperty(row,'offsetTop',{value:index*37});
  row.getBoundingClientRect=()=>({top:50+index*37-list.scrollTop,bottom:50+(index+1)*37-list.scrollTop});
 });
 app.window.dispatchEvent(new app.window.Event('resize'));
 const scrolls=[];
 list.scrollTo=options=>{scrolls.push({...options});list.scrollTop=options.top;list.dispatchEvent(new app.window.Event('scroll'));};
 const pointer=(type,{target=list,x=150,y=300,id=1,primary=true}={})=>{
  const event=new app.window.Event(type,{bubbles:true});
  Object.assign(event,{pointerId:id,isPrimary:primary,button:0,clientX:x,clientY:y});
  target.dispatchEvent(event);
 };
 const tick=()=>new Promise(resolve=>app.window.requestAnimationFrame(resolve));
 const active=()=>rows(app).findIndex(row=>row.getAttribute('aria-current')==='true');
 return {list,scrolls,pointer,tick,active};
}

test('mobile background taps advance, scroll to actual row offsets and wrap; previews remain full width',async()=>{
 const app=setup('#archive',true);
 try {
  await app.settle(success(content([entry('One',{previewImages:[portrait('one','left')]}),entry('Two'),entry('Three')])));
  const {pointer,tick,active,scrolls}=mobileGestureFixture(app);
  assert.equal(active(),0);
  assert.ok(app.window.document.querySelector('.archive-background.visible.full'));
  for(const next of [1,2,0]) {
   pointer('pointerdown');pointer('pointerup');await tick();
   assert.equal(active(),next);
   assert.deepEqual(scrolls.at(-1),{top:next*37,behavior:'smooth'});
   assert.ok(app.window.document.querySelector('.archive-background.visible.full'));
  }
 }finally{app.dom.window.close();}
});

test('mobile drags, cancelled gestures, multitouch, controls and manual scrolling do not advance',async()=>{
 const app=setup('#archive',true);
 try {
  await app.settle(success(content([entry('One'),entry('Two'),entry('Three')])));
  const {list,pointer,tick,active,scrolls}=mobileGestureFixture(app);
  pointer('pointerdown');pointer('pointermove',{y:320});pointer('pointermove',{y:300});pointer('pointerup');
  pointer('pointerdown');pointer('pointercancel');pointer('pointerup');
  pointer('pointerdown');pointer('pointerdown',{id:2,primary:false});pointer('pointerup');
  for(const target of [rows(app)[0],rows(app)[0].firstElementChild]) {
   pointer('pointerdown',{target});pointer('pointerup',{target});
  }
  const link=app.window.document.createElement('a');link.href='#info';list.append(link);
  pointer('pointerdown',{target:link});pointer('pointerup',{target:link});
  assert.equal(scrolls.length,0);
  assert.equal(active(),0);
  pointer('pointerdown');
  list.scrollTop=37;list.dispatchEvent(new app.window.Event('scroll'));await tick();
  pointer('pointerup');await tick();
  assert.equal(scrolls.length,0);
  assert.equal(active(),1);
  pointer('pointerdown');pointer('pointerup');await tick();
  assert.equal(active(),2); // A tap continues from the manually scrolled entry.
 }finally{app.dom.window.close();}
});

test('desktop ignores background tap gestures',async()=>{
 const app=setup();
 try {
  await app.settle(success(content([entry('One'),entry('Two')])));
  const {pointer,tick,active,scrolls}=mobileGestureFixture(app);
  pointer('pointerdown');pointer('pointerup');await tick();
  assert.equal(active(),0);assert.equal(scrolls.length,0);
 }finally{app.dom.window.close();}
});
