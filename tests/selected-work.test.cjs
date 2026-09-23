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
function setup(hash = '#work/video') {
  const dom = new JSDOM(read('index.html'), {url: `https://example.com/portfolio/${hash}`, runScripts: 'outside-only', pretendToBeVisual: true});
  const {window} = dom;
  const scrollCalls = [];
  window.scrollTo = (x, y) => {scrollCalls.push([x, y]); window.scrollY = y;};
  window.matchMedia = () => ({matches: false, addEventListener() {}});
  window.ResizeObserver = class {observe() {} disconnect() {}};
  const players = [];
  window.Vimeo = {Player: class {
    constructor(frame) {this.frame = frame; this.events = {}; this.calls = []; players.push(this);}
    on(event, handler) {this.events[event] = handler;}
    off(event) {delete this.events[event];}
    ready() {return Promise.resolve();}
    getVideoWidth() {return Promise.resolve(1920);}
    getVideoHeight() {return Promise.resolve(1080);}
    play() {this.calls.push("play"); this.events.play(); return Promise.resolve();}
    pause() {this.calls.push("pause"); this.events.pause(); return Promise.resolve();}
    destroy() {this.calls.push("destroy"); return Promise.resolve();}
  }};
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
  return {window, dom, scrollCalls, players, requests: () => requests, reject: async () => {reject(new Error('offline')); await flush();},
    settle: async result => {resolve(result); await flush();}};
}
const success = data => ({ok: true, data, error: null});

const project = (id, category = 'Video', extra = {}) => ({_id: `doc-${id}`, _type: 'project', slug: {current: id}, title: id, category,
  modules: [{_type: 'full', type: 'full', height: 'medium', slots: [{type: 'video', vimeoUrl: 'https://vimeo.com/12345/secret'}]}], ...extra});
const content = (fields = {}, projects = [project('one'), project('two'), project('graphic', 'Graphic'), project('commissioned', 'Commissioned')]) => adapter.normalize({projects, selectedWork: doc('selectedWork', {video: [{_ref: 'doc-two'}, {_ref: 'doc-one'}], commissioned: [{_ref: 'doc-commissioned'}], graphic: [{_ref: 'doc-graphic'}], ...fields})});
const ids = app => [...app.window.document.querySelectorAll('.project-preview:not([hidden])')].map(element => element.dataset.project);
const flush = () => new Promise(resolve => setImmediate(resolve));

test('published references control category grouping and exact ordering; teasers reuse existing playback mode', async () => {
  const app = setup();
  try {
    assert.ok(app.window.document.querySelector('.work[aria-busy]'));
    assert.deepEqual(ids(app), []);
    const scrolls = app.scrollCalls.length;
    app.window.scrollY = 100;
    await app.settle(success(content()));
    assert.deepEqual(ids(app), ['two', 'one']);
    assert.deepEqual([...app.window.document.querySelectorAll('.project-preview')].map(e => e.dataset.category), ['Video', 'Video', 'Commissioned', 'Graphic']);
    assert.equal(app.window.document.querySelector('.work').dataset.source, 'sanity');
    assert.equal(app.window.scrollY, 100);
    assert.equal(app.scrollCalls.length, scrolls);
    const frame = app.window.document.querySelector('.project-preview:not([hidden]) iframe');
    const url = new URL(frame.src);
    for (const name of ['background', 'autoplay', 'muted', 'loop']) assert.equal(url.searchParams.get(name), '1');
    assert.equal(url.searchParams.get('controls'), '0');
    assert.equal(url.searchParams.get('h'), 'secret');
    assert.equal(app.window.document.querySelector('.project-video-toggle'), null);
    app.window.renderWork('Video'); app.window.route();
    assert.equal(app.window.document.querySelector('.project-preview:not([hidden]) iframe'), frame);
    assert.equal(app.players.length, 2);
    assert.ok(app.players.every(p => !p.calls.includes('destroy')));
    assert.equal(app.requests(), 1);
    const link = app.window.document.querySelector('.project-preview:not([hidden]) .project-link');
    assert.equal(link.getAttribute('href'), '#project/two');
    app.window.location.hash = link.hash; app.window.route(); await flush();
    assert.equal(app.window.document.querySelector('.detail').dataset.projectSource, 'sanity');
    assert.equal(app.window.document.querySelector('.detail').dataset.projectId, 'two');
    assert.ok(app.players[0].calls.includes('destroy'));
  } finally {app.dom.window.close();}
});

test('valid empty and unset category arrays stay empty; no local projects are merged', async () => {
  for (const value of [[], null, undefined]) {
    const app = setup();
    try {
      await app.settle(success(content({video: value})));
      assert.deepEqual(ids(app), []);
      assert.equal(app.window.document.querySelector('.work').dataset.source, 'sanity');
      app.window.location.hash = '#work/graphic'; app.window.route(); await flush();
      assert.deepEqual(ids(app), ['graphic']);
      assert.equal(app.requests(), 1);
    } finally {app.dom.window.close();}
  }
});

test('only request/document/category failures use local fallback; bad references never add local projects', async () => {
  for (const result of [{ok:false}, success(adapter.normalize({projects:[]})), success(content({video:'malformed'}))]) {
    const app = setup();
    try {
      await app.settle(result);
      const expected = vm.runInContext('WORK_PROJECTS.filter(p => p.category === "Video").map(p => p.id)', app.dom.getInternalVMContext());
      assert.deepEqual(ids(app), Array.from(expected));
      assert.equal(app.window.document.querySelector('.work').dataset.source, 'local');
    } finally {app.dom.window.close();}
  }
  const app = setup();
  try {
    await app.settle(success(content({video:[{_ref:'missing'}, {_ref:'doc-graphic'}]})));
    assert.deepEqual(ids(app), []);
    assert.equal(app.window.document.querySelector('.work').dataset.source, 'sanity');
  } finally {app.dom.window.close();}
});

test('disabled detail projects remain visible without detail links; malformed compositions are omitted', async () => {
  const app = setup();
  try {
    await app.settle(success(content({}, [project('one', 'Video', {detailPageEnabled:false}), project('two', 'Video', {modules:[{type:'invalid',slots:[]}]})])));
    assert.deepEqual(ids(app), ['one']);
    const article = app.window.document.querySelector('.project-preview:not([hidden])');
    assert.equal(article.querySelector('a'), null);
    assert.equal(article.querySelector('.project-title').textContent, 'one');
    assert.ok(article.querySelector('iframe'));
  } finally {app.dom.window.close();}
});

test('late Selected Work response respects the active category and does not replace unrelated routes', async () => {
  for (const hash of ['#info', '#home', '#imprint', '#privacy-policy']) {
    const app = setup();
    try {
      app.window.location.hash=hash; app.window.route();
      const initial=app.window.document.querySelector('#app').innerHTML;
      await app.settle(success(content()));
      assert.equal(app.window.document.querySelector('#app').innerHTML, initial);
    } finally {app.dom.window.close();}
  }
  const app = setup();
  try {
    app.window.location.hash='#work/commissioned'; app.window.route();
    await app.settle(success(content()));
    assert.deepEqual(ids(app), ['commissioned']);
    assert.equal(app.window.location.hash, '#work/commissioned');
  } finally {app.dom.window.close();}
});

test('live Selected Work uses the published explicit image preview and opens its Sanity detail', {skip:!process.env.INFO_LIVE_SMOKE}, async () => {
  const result=await adapter.load();
  assert.equal(result.ok,true,JSON.stringify(result.error));
  assert.ok(result.data.selectedWork);
  const project = result.data.selectedWork.video.map(id=>result.data.projectsById[id]).find(p=>
    p?.selectedWorkPreview?.type==='full' && p.selectedWorkPreview.slots[0]?.type==='image' && p.detailPageEnabled && p.modules.some(m=>m.slots.some(s=>s?.type==='video')));
  assert.ok(project, 'A published Video project with an image preview and Vimeo detail is required');
  const app=setup();
  try {
    await app.settle(result);
    const expected=result.data.selectedWork.video.filter(id=>{
      const project=result.data.projectsById[id];
      return project && (project.selectedWorkPreview || project.modulesValid);
    });
    assert.deepEqual(ids(app),expected);
    const article=app.window.document.querySelector(`[data-project="${project.id}"]`);
    assert.ok(article);
    assert.equal(app.window.document.querySelectorAll(`[data-project="${project.id}"]`).length,1);
    assert.equal(article.querySelectorAll('.project-module-preview').length,1);
    assert.equal(article.querySelectorAll('.project-title').length,1);
    const preview=project.selectedWorkPreview.slots[0];
    assert.equal(preview?.type,'image');
    const image=article.querySelector('.project-module-preview img');
    assert.ok(image);
    assert.equal(image.getAttribute('src'),preview.src);
    assert.equal(image.getAttribute('alt'),preview.alt ?? project.title);
    assert.equal(article.querySelector('iframe'),null);
    assert.equal(article.querySelector('button'),null);
    app.window.location.hash=article.querySelector('.project-link').hash;
    app.window.route(); await flush();
    assert.equal(app.window.document.querySelector('.detail').dataset.projectSource,'sanity');
    assert.equal(new URL(app.window.document.querySelector('.detail iframe').src).searchParams.get('autoplay'),'0');
    assert.ok(app.window.document.querySelector('.project-video-toggle img'));
    for (const category of ['commissioned','graphic']) {
      app.window.location.hash=`#work/${category}`; app.window.route(); await flush();
      assert.deepEqual(ids(app),result.data.selectedWork[category].filter(id=>{
        const p=result.data.projectsById[id];return p && (p.selectedWorkPreview || p.modulesValid);
      }));
      assert.equal(app.window.document.querySelector('.work').dataset.source,'sanity');
    }
    assert.equal(app.requests(),1);
  } finally {app.dom.window.close();}
});


test('each ordered reference renders one preview regardless of its detail module count', async () => {
  const image = src => ({_type:'full', type:'full', height:'medium', slots:[{type:'image', image:{asset:{_ref:src}}}]});
  const video = {_type:'half-half', type:'half-half', height:'large', order:'reverse', slots:[{type:'video', vimeoUrl:'https://vimeo.com/12345/secret'}, {type:'empty'}]};
  const first = image('image-first-1200x800-jpg');
  const second = image('image-second-1200x800-jpg');
  const projects = [project('one','Video',{modules:[first, second, video, first]}), project('two','Video',{modules:[second,first]})];
  const app = setup();
  try {
    await app.settle(success(content({commissioned:[],graphic:[]},projects)));
    assert.deepEqual(ids(app),['two','one']);
    const rows = [...app.window.document.querySelectorAll('.project-preview:not([hidden])')];
    for (const row of rows) {
      assert.equal(row.querySelectorAll('.project-module-preview').length,1);
      assert.equal(row.querySelectorAll('.project-title').length,1);
    }
    assert.ok(rows[0].querySelector('.project-slot > img').src.includes('/second-1200x800.jpg'));
    const teaser = rows[1].querySelector('.project-module');
    assert.equal(teaser.dataset.moduleType,'half-half');
    assert.ok(teaser.classList.contains('height-large'));
    assert.ok(teaser.children[0].classList.contains('is-empty'));
    assert.ok(teaser.children[1].querySelector('iframe'));
    app.window.location.hash='#project/one'; app.window.route(); await flush();
    assert.equal(app.window.document.querySelectorAll('.detail .project-module').length,4);
  } finally {app.dom.window.close();}
});

test('explicit image/Vimeo previews win independently of details and still produce one entry', async () => {
  for (const selectedWorkPreview of [
    {type:'image', image:{asset:{_ref:'image-preview-1200x800-jpg'}, hotspot:{x:.25,y:.75,width:.2,height:.2}}, alt:'Overview image'},
    {type:'video', vimeoUrl:'https://vimeo.com/98765/private', poster:{asset:{_ref:'image-poster-1200x800-jpg'}}, alt:'Overview video'}
  ]) {
    const app=setup();
    try {
      await app.settle(success(content({video:[{_ref:'doc-one'}],commissioned:[],graphic:[]},[project('one','Video',{selectedWorkPreview})])));
      assert.deepEqual(ids(app),['one']);
      const article=app.window.document.querySelector('.project-preview');
      assert.equal(article.querySelectorAll('.project-module-preview').length,1);
      assert.equal(article.querySelectorAll('.project-title').length,1);
      assert.equal(article.querySelector('.project-module').dataset.moduleType,'full');
      if(selectedWorkPreview.type==='image') {
        const img=article.querySelector('.project-slot > img');
        assert.ok(img.src.includes('/preview-1200x800.jpg'));
        assert.equal(img.alt,'Overview image');
        assert.equal(img.style.objectPosition,'25% 75%');
        assert.equal(article.querySelector('iframe'),null);
      } else {
        const url=new URL(article.querySelector('iframe').src);
        assert.equal(url.pathname,'/video/98765');
        assert.equal(url.searchParams.get('h'),'private');
        for(const flag of ['autoplay','muted','loop']) assert.equal(url.searchParams.get(flag),'1');
        assert.equal(url.searchParams.get('controls'),'0');
        assert.ok(article.querySelector('.project-video-poster').src.includes('/poster-1200x800.jpg'));
        assert.equal(article.querySelector('button'),null);
      }
      app.window.location.hash='#project/one';app.window.route();await flush();
      assert.equal(new URL(app.window.document.querySelector('.detail iframe').src).pathname,'/video/12345');
      assert.ok(app.window.document.querySelector('.project-video-toggle'));
    } finally {app.dom.window.close();}
  }
});

test('invalid preview uses migration fallback; valid preview does not depend on healthy detail modules', async () => {
  for(const invalidModules of [false,true]) {
    const app=setup();
    try {
      const fields=invalidModules ? {modules:[{type:'bad',slots:[]}],selectedWorkPreview:{type:'video',vimeoUrl:'https://vimeo.com/98765'}}
        : {selectedWorkPreview:{type:'video',vimeoUrl:'bad'}};
      await app.settle(success(content({video:[{_ref:'doc-one'}],commissioned:[],graphic:[]},[project('one','Video',fields)])));
      assert.deepEqual(ids(app),['one']);
      assert.equal(new URL(app.window.document.querySelector('.work iframe').src).pathname, invalidModules?'/video/98765':'/video/12345');
    } finally {app.dom.window.close();}
  }
});

const previewLayouts = {full:[12], 'half-half':[6,6], 'half-quarter-quarter':[6,3,3],
  'quarter-quarter-quarter-quarter':[3,3,3,3], 'third-third-third':[4,4,4], 'two-thirds-one-third':[8,4]};
const previewImage = index => ({type:'image',alt:`Image ${index}`,image:{asset:{_ref:`image-preview${index}-1200x800-jpg`},
  crop:{left:.25,right:.25,top:0,bottom:0},hotspot:{x:.375,y:.6,width:.1,height:.1}}});
const previewVideo = index => ({type:'video',vimeoUrl:`https://vimeo.com/${90000+index}/private?autoplay=0&controls=1`,alt:`Video ${index}`});
const composedPreview = (type, slots, extra={}) => ({composition:[{_type:`preview-${type}`,type,height:'medium',order:'default',slots,...extra}]});

test('all six explicit preview compositions reuse exact spans, heights, arrangements and media handling', async () => {
  const app=setup();
  try {
    await app.settle(success(content({video:[],commissioned:[],graphic:[]})));
    const container=app.window.document.createElement('div');
    for(const [type,spans] of Object.entries(previewLayouts)) {
      for(const height of ['auto','small','medium','large','viewport']) {
        for(const order of ['default','reverse',...(type==='half-quarter-quarter'?['middle']:[])]) {
          for(const mode of ['images','videos','mixed','empty']) {
            const slots=spans.map((_,i)=>mode==='images'?previewImage(i):mode==='videos'?previewVideo(i):
              mode==='empty'?{type:'empty',vimeoUrl:'stale-invalid'}:i%3===0?previewImage(i):i%3===1?previewVideo(i):{type:'empty'});
            const p=content({video:[{_ref:'doc-one'}],commissioned:[],graphic:[]},[
              project('one','Video',{selectedWorkPreview:composedPreview(type,slots,{height,order})})]).projectsById.one;
            container.innerHTML=app.window.renderWorkPreview(p);
            assert.equal(container.querySelectorAll('.project-module-preview').length,1);
            assert.equal(container.querySelectorAll('.project-title').length,1);
            assert.equal(container.querySelector('.project-title').getAttribute('href'),'#project/one');
            const row=container.querySelector('.project-module');
            assert.equal(row.dataset.moduleType,type);
            assert.ok(row.classList.contains(`height-${height}`));
            const indices=order==='middle'?[1,0,2]:spans.map((_,i)=>i);
            if(order==='reverse')indices.reverse();
            assert.deepEqual([...row.children].map(e=>Number(e.style.getPropertyValue('--slot-span'))),indices.map(i=>spans[i]));
            for(const [position,index] of indices.entries()) {
              const slot=slots[index],element=row.children[position];
              if(slot.type==='empty') assert.ok(element.classList.contains('is-empty'));
              if(slot.type==='image') {
                const image=element.querySelector('img');
                assert.ok(image.src.includes(`/preview${index}-1200x800.jpg`));
                assert.equal(new URL(image.src).searchParams.get('rect'),'300,0,600,800');
                assert.equal(image.style.objectPosition,'25% 60%');
                assert.equal(image.alt,slot.alt);
              }
              if(slot.type==='video') {
                const frame=element.querySelector('iframe'),url=new URL(frame.dataset.projectVideoSrc);
                assert.equal(url.pathname,`/video/${90000+index}`);
                assert.equal(url.searchParams.get('h'),'private');
                for(const key of ['autoplay','muted','loop','background']) assert.equal(url.searchParams.get(key),'1');
                for(const key of ['controls','title','byline','portrait','badge','keyboard']) assert.equal(url.searchParams.get(key),'0');
              }
            }
            assert.equal(container.querySelector('button'),null);
          }
        }
      }
    }
  } finally {app.dom.window.close();}
});

test('composed previews keep curated project order, mount every video, and leave details unchanged',async()=>{
  const app=setup();
  try {
    const original=project('one');
    const baseline=adapter.normalize({projects:[original]}).projects[0];
    const raw=[{...original,selectedWorkPreview:composedPreview('half-quarter-quarter',[previewImage(0),{type:'empty'},previewVideo(2)],{order:'middle'})},
      project('two','Video',{selectedWorkPreview:composedPreview('half-half',[previewVideo(0),previewVideo(1)])})];
    const data=content({commissioned:[],graphic:[]},raw);
    assert.deepEqual(data.projectsById.one.modules,baseline.modules);
    assert.deepEqual(data.projectsById.one.detailModules,baseline.detailModules);
    await app.settle(success(data));
    assert.deepEqual(ids(app),['two','one']);
    assert.equal(app.window.document.querySelectorAll('.project-preview').length,2);
    assert.equal(app.window.document.querySelectorAll('.project-module-preview').length,2);
    assert.equal(app.players.length,3);
    app.window.location.hash='#project/one';app.window.route();await flush();
    assert.equal(app.window.document.querySelectorAll('.detail .project-module').length,1);
    const frame=app.window.document.querySelector('.detail iframe'),url=new URL(frame.src);
    assert.equal(url.pathname,'/video/12345');
    assert.equal(url.searchParams.get('autoplay'),'0');
    assert.ok(app.window.document.querySelector('.project-video-toggle'));
    assert.ok(app.players.slice(0,3).every(player=>player.calls.includes('destroy')));
  } finally {app.dom.window.close();}
});

test('empty previews are intentional; malformed compositions use existing fallback without reviving retained legacy media',async()=>{
  const bad=[{composition:'bad'}, {composition:[{},{}]}, composedPreview('full',[{type:'text',text:'No text previews'}]),
    composedPreview('full',[previewImage(0),previewImage(1)]),composedPreview('half-half',[previewImage(0)],{order:'middle'}),
    {composition:[{_type:'preview-half-half',type:'full',slots:[previewImage(0)]}]},
    composedPreview('full',[{type:'video',vimeoUrl:'bad'}])];
  for(const selectedWorkPreview of [...bad,composedPreview('half-half',[{type:'empty'},{type:'empty'}])]) {
    const app=setup();
    try {
      const data=content({video:[{_ref:'doc-one'}],commissioned:[],graphic:[]},[
        project('one','Video',{selectedWorkPreview:{...previewImage(9),...selectedWorkPreview}})]);
      await app.settle(success(data));
      assert.deepEqual(ids(app),['one']);
      if(bad.includes(selectedWorkPreview)) {
        assert.equal(data.projectsById.one.selectedWorkPreview,null);
        assert.ok(data.issues.some(issue=>issue.path.includes('selectedWorkPreview')));
        assert.equal(new URL(app.window.document.querySelector('.work iframe').src).pathname,'/video/12345');
      } else {
        assert.equal(app.window.document.querySelector('.work iframe'),null);
        assert.equal(app.window.document.querySelectorAll('.project-slot.is-empty').length,2);
      }
    } finally {app.dom.window.close();}
  }
});
