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


const nav = (extra={}) => doc('navigation', {items:[{destination:'info',label:'About'},{destination:'work',label:'Films'},{destination:'archive',label:'Archive'}],categories:[{destination:'work/graphic',label:'Design'},{destination:'work/video',label:'Motion'},{destination:'work/commissioned',label:'Clients'}],mobileContact:{destination:'phone',label:'Call'},...extra});
const settings = (extra={}) => doc('siteSettings',{brandName:'Studio Name',email:'hello@example.com',instagram:'https://instagram.com/example',phone:'+49 12345678',defaultPageTitle:'Studio browser title',defaultDescription:'Studio description',socialImage:{asset:{_ref:'image-social-1200x800-jpg'}},footerLinks:[{destination:'phone',label:'Call'},{destination:'email',label:'Email'},{destination:'instagram',label:'Social'},{destination:'imprint',label:'Legal'}],...extra});
const visible = container => [...container.children].filter(n=>!n.hidden);
const categories = d => ['.work-submenu','.mobile-menu-work'].map(selector=>[...d.querySelectorAll(`${selector} [data-route^="work/"]`)].map(n=>n.textContent));

test('shared CMS order, editable labels, stable routes and existing menu nodes/interactions',async()=>{
 const app=setup('#info',true),d=app.window.document;
 try{
  const toggle=d.querySelector('.work-toggle'),submenu=d.querySelector('.work-submenu'),page=d.querySelector('#app').firstElementChild;
  const scrolls=app.scrollCalls.length;
  await app.settle(success(adapter.normalize({navigation:nav(),siteSettings:settings()})));
  assert.equal(d.querySelector('.work-toggle'),toggle);assert.equal(d.querySelector('.work-submenu'),submenu);
  assert.equal(d.querySelector('#app').firstElementChild,page);assert.equal(app.scrollCalls.length,scrolls);
  for(const selector of ['.main-nav','.mobile-menu nav']) assert.deepEqual(visible(d.querySelector(selector)).map(n=>n.matches('a')?n.dataset.route:'work'),['info','work','archive']);
  assert.deepEqual(categories(d),[['Design','Motion','Clients'],['Design','Motion','Clients']]);
  assert.equal(d.querySelector('.main-nav [data-route="info"]').getAttribute('aria-current'),'page');
  assert.equal(d.querySelector('.main-nav [data-route="archive"]').getAttribute('href'),'#archive');
  app.window.setWorkMenu(true);assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.equal(submenu.inert,false);
  d.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(toggle.getAttribute('aria-expanded'),'false');
  d.querySelector('.mobile-menu-toggle').click();assert.equal(d.querySelector('dialog').open,true);
  d.querySelector('.mobile-menu [data-route="archive"]').click();assert.equal(d.querySelector('dialog').open,false);
  await new Promise(r=>setTimeout(r,20));assert.equal(app.window.location.hash,'#archive');
  app.window.applySanityGlobals();assert.equal(d.querySelectorAll('.work-toggle').length,1);assert.equal(app.requests(),1);
 }finally{app.dom.window.close();}
});

test('brand, contacts, metadata and ordered footer bind on initial and subsequent detail renders',async()=>{
 const app=setup('#info'),d=app.window.document;
 try{
  await app.settle(success(adapter.normalize({siteSettings:settings(),navigation:nav({homeLabel:'Home name'})})));
  assert.deepEqual([...d.querySelectorAll('.brand')].map(n=>n.textContent),['Home name','Home name']);
  assert.equal(d.title,'Studio browser title');assert.equal(d.querySelector('meta[name="description"]').content,'Studio description');
  assert.match(d.querySelector('meta[property="og:image"]').content,/social-1200x800/);
  assert.equal(d.querySelector('.mobile-menu-mail').getAttribute('href'),'tel:+4912345678');
  const id=vm.runInContext('WORK_PROJECTS.find(p=>p.detailPageEnabled !== false).id',app.dom.getInternalVMContext());
  app.window.renderProject(id);
  assert.deepEqual([...d.querySelectorAll('.project-footer-links a')].map(n=>n.getAttribute('href')),['mailto:hello@example.com','https://instagram.com/example','#imprint','#privacy-policy']);
  const detail=d.querySelector('.detail');app.window.applySanityGlobals();assert.equal(d.querySelector('.detail'),detail);
 }finally{app.dom.window.close();}
});

test('published optional emptiness stays empty and schema title fallback uses CMS brand',async()=>{
 const app=setup(),d=app.window.document;
 try{
  await app.settle(success(adapter.normalize({siteSettings:doc('siteSettings',{brandName:'Brand'}),navigation:nav({items:[],categories:[],mobileContact:null})})));
  assert.equal(d.title,'Brand');assert.equal(d.querySelector('meta[name="description"]').content,'');assert.equal(d.querySelector('meta[property="og:image"]'),null);
  assert.equal(d.querySelector('.mobile-menu-mail').hidden,true);assert.equal(d.querySelector('.mobile-menu-mail').hasAttribute('href'),false);
  assert.equal(visible(d.querySelector('.main-nav')).length,0);
  assert.deepEqual(categories(d),[['Video','Commissioned','Graphic'],['Video','Commissioned','Graphic']]);
  const id=vm.runInContext('WORK_PROJECTS.find(p=>p.detailPageEnabled !== false).id',app.dom.getInternalVMContext());app.window.renderProject(id);
  assert.deepEqual([...d.querySelectorAll('.project-footer-links a')].map(a=>a.textContent),['Imprint','Privacy Policy']);
 }finally{app.dom.window.close();}
});

test('missing documents/request failures keep local globals with shared default category order',async()=>{
 for(const result of [{ok:false},success(adapter.normalize({}))]){
  const app=setup('#imprint'),d=app.window.document;
  try{
   const header=d.querySelector('.site-header').innerHTML,legal=d.querySelector('#app').innerHTML;
   await app.settle(result);
   assert.equal(d.querySelector('.site-header').innerHTML,header);assert.equal(d.querySelector('#app').innerHTML,legal);
   assert.equal(d.title,'Nicolas Kawohl');assert.equal(d.querySelector('.mobile-menu-mail').getAttribute('href'),'mailto:mail@nicolas-kawohl.com');
   assert.deepEqual(categories(d),[['Video','Commissioned','Graphic'],['Video','Commissioned','Graphic']]);
  }finally{app.dom.window.close();}
 }
});

test('settings and navigation can independently succeed without inventing missing contacts',async()=>{
 for(const raw of [{siteSettings:settings({email:''})},{navigation:nav()}]){
  const app=setup(),d=app.window.document;
  try{await app.settle(success(adapter.normalize(raw)));
   if(raw.siteSettings){assert.equal(d.querySelector('.brand').textContent,'Studio Name');assert.equal(d.querySelector('.mobile-menu-mail').hidden,true);}
   else {assert.equal(d.querySelector('.brand').textContent,'Nicolas Kawohl');assert.equal(d.querySelector('.mobile-menu-mail').getAttribute('href'),'mailto:mail@nicolas-kawohl.com');}
  }finally{app.dom.window.close();}
 }
});

test('live published Navigation and Site Settings reach global bindings', {skip:!process.env.INFO_LIVE_SMOKE},async()=>{
 const result=await adapter.load();assert.equal(result.ok,true,JSON.stringify(result.error));
 console.log('Published globals:',JSON.stringify({navigation:result.data.availability.navigation,siteSettings:result.data.availability.siteSettings,categories:result.data.navigation.categories.map(c=>c.label)}));
 const app=setup();try{await app.settle(result);if(result.data.siteSettings)assert.equal(app.window.document.title,result.data.siteSettings.defaultPageTitle);if(result.data.availability.navigation==='present')assert.deepEqual(categories(app.window.document)[0],result.data.navigation.categories.map(c=>c.label));}finally{app.dom.window.close();}
});

test('optional Home item is routed safely and duplicate destinations never add menu nodes',async()=>{
 const app=setup('#info'),d=app.window.document;
 try{
  await app.settle(success(adapter.normalize({navigation:nav({items:[{destination:'home',label:'Start'},{destination:'home',label:'Duplicate'},{destination:'info',label:'<b>About</b>'}]})})));
  app.window.applySanityGlobals();
  for(const selector of ['.main-nav','.mobile-menu nav']){
   const container=d.querySelector(selector);
   assert.equal(container.querySelectorAll('[data-route="home"]').length,1);
   assert.equal(container.querySelector('[data-route="home"]').getAttribute('href'),'#home');
   assert.equal(container.querySelector('[data-route="info"]').textContent,'<b>About</b>');
   assert.equal(container.querySelector('b'),null);
  }
 }finally{app.dom.window.close();}
});


test('valid settings cannot remove the four fixed footer destinations or move the footer',async()=>{
 for(const footerLinks of [undefined,[],[{destination:'email',label:'Duplicate'},{destination:'email',label:'Mail'},{destination:'instagram',label:'Social'},{destination:'privacy-policy',label:'Privacy'}],[{destination:'email',label:'Mail'}],[{destination:'imprint',label:'Imprint'},{destination:'privacy-policy',label:'Privacy Policy'}]]){
  const app=setup(),d=app.window.document;
  try{
   await app.settle(success(adapter.normalize({siteSettings:settings({footerLinks})})));
   const id=vm.runInContext('WORK_PROJECTS.find(p=>p.detailPageEnabled !== false).id',app.dom.getInternalVMContext());
   app.window.renderProject(id);
   const footer=d.querySelector('.project-footer'),detail=d.querySelector('.detail');
   assert.equal(d.querySelector('#app').lastElementChild,footer);
   assert.ok(detail.compareDocumentPosition(footer)&app.window.Node.DOCUMENT_POSITION_FOLLOWING);
   app.window.applySanityFooter();
   assert.equal(d.querySelector('.project-footer'),footer);
   assert.deepEqual([...footer.querySelectorAll('a')].map(a=>a.textContent),['Mail','Instagram','Imprint','Privacy Policy']);
   for(const href of ['mailto:hello@example.com','https://instagram.com/example','#imprint','#privacy-policy'])assert.equal(footer.querySelectorAll(`a[href="${href}"]`).length,1);
  }finally{app.dom.window.close();}
 }
});


test('unset or invalid CMS contacts omit only their own footer links',async()=>{
 for(const contacts of [{email:'',instagram:''},{email:'invalid',instagram:'javascript:alert(1)'},{email:'',instagram:'https://instagram.com/example'},{email:'hello@example.com',instagram:''}]){
  const app=setup(),d=app.window.document;
  try{
   const normalized=adapter.normalize({siteSettings:settings(contacts)});
   await app.settle(success(normalized));
   const id=vm.runInContext('WORK_PROJECTS.find(p=>p.detailPageEnabled !== false).id',app.dom.getInternalVMContext());app.window.renderProject(id);
   const expected=[normalized.siteSettings.contacts.email&&'Mail',normalized.siteSettings.contacts.instagram&&'Instagram','Imprint','Privacy Policy'].filter(Boolean);
   assert.deepEqual([...d.querySelectorAll('.project-footer-links a')].map(a=>a.textContent),expected);
  }finally{app.dom.window.close();}
 }
});
