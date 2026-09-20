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



const block = (text, extra={}) => ({_type:'block',style:'normal',markDefs:[],children:[{_type:'span',text,marks:[]}],...extra});
const legal = (page,extra={}) => ({_id:`legal-${page}`,_type:'legalPage',pageType:page,title:`Published ${page}`,body:[block(`Test text for ${page}`)],...extra});
const content = (...pages) => adapter.normalize({projects:[],legalPages:pages});

test('both published Legal pages replace fallback in place without resetting scroll or navigation',async()=>{
 for(const page of ['imprint','privacy-policy']){
  const app=setup(`#${page}`),d=app.window.document;
  try{
   const article=d.querySelector('.legal-page'),nav=article.querySelector('nav'),scrolls=app.scrollCalls.length;
   app.window.scrollY=100;nav.querySelector('a').focus();
   await app.settle(success(content(legal('imprint'),legal('privacy-policy'))));
   assert.equal(d.querySelector('.legal-page'),article);assert.equal(article.querySelector('nav'),nav);
   assert.equal(article.querySelector('h1').textContent,`Published ${page}`);
   assert.equal(article.querySelector('.legal-copy p').textContent,`Test text for ${page}`);
   assert.equal(article.querySelector('.legal-placeholder'),null);assert.equal(article.querySelector('section'),null);
   assert.equal(nav.querySelector('[aria-current]').getAttribute('href'),`#${page}`);
   assert.equal(app.scrollCalls.length,scrolls);assert.equal(app.window.scrollY,100);assert.equal(d.activeElement,nav.querySelector('a'));
   app.window.applySanityLegal();assert.equal(article.querySelector('nav'),nav);assert.equal(app.requests(),1);
   const other=page==='imprint'?'privacy-policy':'imprint';app.window.location.hash=`#${other}`;app.window.route();
   assert.equal(d.querySelector('.legal-copy p').textContent,`Test text for ${other}`);assert.equal(app.requests(),1);
  }finally{app.dom.window.close();}
 }
});

test('restricted formatting, nested/mixed lists, links and hostile content render safely',async()=>{
 const app=setup('#imprint'),d=app.window.document;
 try{
  const body=[block('Heading',{style:'h2'}),block('<img src=x onerror=alert(1)>\nNext',{children:[{_type:'span',text:'<img src=x onerror=alert(1)>\nNext',marks:['strong','em']}]}),
   block('One',{listItem:'bullet',level:1}),block('Nested',{listItem:'number',level:2}),block('Two',{listItem:'bullet',level:1}),block('Number',{listItem:'number',level:1}),block('After'),
   ...['https://example.com/path','http://example.com','mailto:hello@example.com','tel:+4912345678','javascript:alert(1)','data:text/html,bad'].map((href,index)=>block(`Link ${index}`,{markDefs:[{_type:'link',_key:'link',href}],children:[{_type:'span',text:`Link ${index}`,marks:['link']}]})),
   {_type:'html',html:'<script>alert(1)</script>'}];
  await app.settle(success(content(legal('imprint',{title:'<script>Title</script>',body}))));
  const copy=d.querySelector('.legal-copy');
  assert.equal(d.querySelector('h1').textContent,'<script>Title</script>');assert.equal(copy.querySelector('h2').textContent,'Heading');
  assert.equal(copy.querySelector('em strong').textContent,'<img src=x onerror=alert(1)>Next');assert.ok(copy.querySelector('br'));
  assert.equal(copy.querySelectorAll(':scope > ul').length,1);assert.equal(copy.querySelectorAll(':scope > ol').length,1);
  assert.equal(copy.querySelector('ul > li > ol > li').textContent,'Nested');assert.equal(copy.querySelectorAll(':scope > ul > li').length,2);
  assert.equal(copy.querySelectorAll('p a').length,4);assert.equal(copy.querySelector('a[href^="javascript:"]'),null);
  assert.equal(d.querySelector('script:not([src]), .legal-copy img'),null);assert.ok(copy.textContent.includes('Link 5'));
 }finally{app.dom.window.close();}
});

test('valid empty title and body are authoritative, without local contact or placeholder',async()=>{
 for(const extra of [{title:'',body:[]},{title:undefined,body:undefined}]){
  const app=setup('#imprint'),d=app.window.document;
  try{await app.settle(success(content(legal('imprint',extra))));assert.equal(d.querySelector('h1').textContent,'');assert.equal(d.querySelector('.legal-copy').children.length,1);assert.ok(d.querySelector('.legal-copy nav'));}finally{app.dom.window.close();}
 }
});

test('request failures and independently missing or invalid documents keep exact local fallback',async()=>{
 for(const page of ['imprint','privacy-policy'])for(const result of [{ok:false},success(content()),success(content(legal(page==='imprint'?'privacy-policy':'imprint'))),success(content(legal(page,{_id:'wrong'})))]){
  const app=setup(`#${page}`),d=app.window.document;
  try{const html=d.querySelector('.legal-page').outerHTML;await app.settle(result);assert.equal(d.querySelector('.legal-page').outerHTML,html);}finally{app.dom.window.close();}
 }
});

test('late Legal response never recreates an unrelated page; returning uses the cached document',async()=>{
 const app=setup('#imprint'),d=app.window.document;
 try{app.window.location.hash='#info';app.window.route();await new Promise(resolve=>setTimeout(resolve,20));const info=d.querySelector('.info');await app.settle(success(content(legal('imprint'))));assert.equal(d.querySelector('.info'),info);app.window.location.hash='#imprint';app.window.route();assert.equal(d.querySelector('h1').textContent,'Published imprint');assert.equal(app.requests(),1);}finally{app.dom.window.close();}
});

test('live published Imprint and Privacy Policy text reaches both renderers',{skip:!process.env.INFO_LIVE_SMOKE},async()=>{
 const result=await adapter.load();assert.equal(result.ok,true,JSON.stringify(result.error));
 for(const page of ['imprint','privacy-policy']){
  const published=result.data.legalPages[page];assert.ok(published,`Published ${page} missing`);
  const app=setup(`#${page}`);try{await app.settle(result);const article=app.window.document.querySelector('.legal-page');assert.equal(article.querySelector('h1').textContent,published.title);for(const block of published.body)for(const span of block.children)assert.ok(article.textContent.includes(span.text.replace(/\r?\n/g,'')));assert.equal(article.querySelector('.legal-placeholder'),null);console.log(JSON.stringify({page,title:published.title,text:published.body.map(b=>b.children.map(s=>s.text).join('')).join('\n')}));}finally{app.dom.window.close();}
 }
});
