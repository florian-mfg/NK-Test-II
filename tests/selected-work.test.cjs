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
    p?.selectedWorkPreview?.type==='image' && p.detailPageEnabled && p.modules.some(m=>m.slots.some(s=>s?.type==='video')));
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
    const preview=project.selectedWorkPreview;
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
