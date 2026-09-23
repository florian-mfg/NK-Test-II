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
function setup(hash = '#project/ethereal-tides') {
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

const slot = {type: 'video', vimeoUrl: 'https://vimeo.com/12345/secret?autoplay=1', alt: 'Published film'};
const moduleRow = (type = 'full', slots = [slot], extra = {}) => ({_type: type, type, height: 'auto', slots, ...extra});
const project = (extra = {}) => ({_id: 'published-project', _type: 'project', slug: {current: 'ethereal-tides'}, title: 'Published Tides', category: 'Video', year: 2026, additionalInfo: 'Client', description: 'First paragraph\nSecond line\n\n<script>plain text</script>', modules: [moduleRow()], ...extra});
const content = (projects = [project()], extra = {}) => adapter.normalize({projects, ...extra});
const flush = () => new Promise(resolve => setImmediate(resolve));

test('direct detail waits for Sanity, renders published metadata/modules safely and never resets scroll or restarts a player', async () => {
  const app = setup();
  try {
    const {document} = app.window;
    assert.ok(document.querySelector('.detail[aria-busy="true"]'));
    assert.equal(app.players.length, 0);
    assert.equal(app.window.location.hash, '#project/ethereal-tides');
    const header = document.querySelector('.site-header').outerHTML;
    app.window.scrollY = 150;
    const scrolls = app.scrollCalls.length;
    await app.settle(success(content()));
    const detail = document.querySelector('.detail');
    assert.equal(detail.dataset.projectSource, 'sanity');
    assert.equal(detail.dataset.projectId, 'ethereal-tides');
    assert.equal(detail.dataset.projectYear, '2026');
    assert.equal(detail.dataset.projectAdditionalInfo, 'Client');
    assert.equal(detail.dataset.projectCategory, 'Video');
    assert.equal(document.querySelector('.detail-back').textContent, 'Published Tides');
    assert.equal(document.querySelector('.header-overview').getAttribute('href'), '#work/video');
    assert.deepEqual([...document.querySelectorAll('.detail-info-popup p')].map(p => p.innerHTML), ['First paragraph<br>Second line', '&lt;script&gt;plain text&lt;/script&gt;']);
    assert.equal(document.querySelector('.detail-info-popup script'), null);
    assert.equal(app.scrollCalls.length, scrolls);
    assert.equal(app.window.scrollY, 150);
    assert.equal(document.querySelector('.site-header').outerHTML, header);
    const frame = document.querySelector('[data-project-video-src]');
    const url = new URL(frame.src);
    assert.equal(url.pathname, '/video/12345');
    assert.equal(url.searchParams.get('h'), 'secret');
    assert.equal(url.searchParams.get('autoplay'), '0');
    assert.equal(url.searchParams.get('controls'), '0');
    assert.equal(app.players.length, 1);
    assert.deepEqual(app.players[0].calls, []);
    const button = document.querySelector('.project-video-toggle');
    button.click(); await flush();
    assert.equal(button.querySelector('img').getAttribute('src'), 'material/pause.svg');
    button.click(); await flush();
    assert.equal(button.querySelector('img').getAttribute('src'), 'material/play.svg');
    app.window.renderProject('ethereal-tides');
    app.window.route();
    assert.equal(document.querySelector('iframe'), frame);
    assert.deepEqual(app.players[0].calls, ['play', 'pause']);
    assert.equal(app.requests(), 1);
  } finally {app.dom.window.close();}
});

test('CMS-only project lookup is independent of Selected Work and only explicit false disables details', async () => {
  for (const enabled of [undefined, null, 0, '', 'false', true, false]) {
    const app = setup('#project/cms-only');
    try {
      assert.equal(app.window.location.hash, '#project/cms-only');
      await app.settle(success(content([project({slug: {current: 'cms-only'}, category: 'Graphic', detailPageEnabled: enabled})], {selectedWork: doc('selectedWork', {video: [], graphic: [], commissioned: []})})));
      if (enabled === false) {
        assert.equal(app.window.location.hash, '#work/graphic');
      } else {
        assert.equal(app.window.location.hash, '#project/cms-only');
        assert.equal(app.window.document.querySelector('.detail').dataset.projectSource, 'sanity');
      }
    } finally {app.dom.window.close();}
  }
});

test('missing published project or failed request uses local fallback; truly missing routes wait before returning', async () => {
  for (const result of [success(content([])), {ok: false, error: {code: 'timeout'}}]) {
    const app = setup();
    try {
      await app.settle(result);
      assert.equal(app.window.document.querySelector('.detail').dataset.projectSource, 'local');
      assert.equal(app.window.document.querySelector('.detail-back').textContent, vm.runInContext('WORK_PROJECTS.find(p => p.id === "ethereal-tides").title', app.dom.getInternalVMContext()));
      assert.equal(app.window.document.querySelectorAll('.detail-info-popup p').length, 3);
      assert.equal(app.window.location.hash, '#project/ethereal-tides');
    } finally {app.dom.window.close();}
  }
  const failed = setup();
  try {
    await failed.reject();
    assert.equal(failed.window.document.querySelector('.detail').dataset.projectSource, 'local');
  } finally {failed.dom.window.close();}
  for (const hash of ['#project/absent', '#project']) {
    const missing = setup(hash);
    try {
      assert.equal(missing.window.location.hash, hash);
      await missing.settle(success(content([])));
      assert.equal(missing.window.location.hash, '#work');
    } finally {missing.dom.window.close();}
  }
});

test('late responses do not replace another page; navigating between local and Sanity details uses one snapshot', async () => {
  const app = setup();
  try {
    app.window.location.hash = '#imprint';
    app.window.route();
    const initial = app.window.document.querySelector('#app').innerHTML;
    await app.settle(success(content()));
    assert.equal(app.window.document.querySelector('#app').innerHTML, initial);
    const local = vm.runInContext('WORK_PROJECTS.find(project => project.id !== "ethereal-tides").id', app.dom.getInternalVMContext());
    for (const id of ['ethereal-tides', local, 'ethereal-tides']) {
      app.window.location.hash = `#project/${id}`;
      app.window.route();
      await flush();
      assert.equal(app.window.document.querySelector('.detail').dataset.projectSource, id === local ? 'local' : 'sanity');
    }
    assert.equal(app.requests(), 1);
    assert.ok(app.players[0].calls.includes('destroy'));
  } finally {app.dom.window.close();}
});

test('malformed rows are isolated; valid modules keep order and known invalid rows retain empty geometry', async () => {
  const app = setup();
  try {
    const modules = [moduleRow('full', [{type: 'text', text: 'First', textSize: 'l'}]),
      moduleRow('half-quarter-quarter', [{type: 'video', vimeoUrl: 'invalid'}], {height: 'medium', order: 'middle'}),
      moduleRow('unknown'), moduleRow('half-half', [null, slot], {order: 'reverse'})];
    const data = content([project({modules})]);
    assert.equal(data.projects[0].modulesValid, false);
    assert.deepEqual(data.projects[0].modules, []); // strict overview contract retained
    assert.equal(data.projects[0].detailModules.length, 4);
    await app.settle(success(data));
    const rows = [...app.window.document.querySelectorAll('.detail .project-module')];
    assert.deepEqual(rows.map(row => row.dataset.moduleType), ['full', 'half-quarter-quarter', 'half-half']);
    assert.ok(rows[0].querySelector('.text-size-l'));
    assert.deepEqual([...rows[1].children].map(slot => slot.style.getPropertyValue('--slot-span')), ['3', '6', '3']);
    assert.equal(rows[1].querySelectorAll('.is-empty').length, 3);
    assert.ok(rows[2].children[0].querySelector('iframe'));
    assert.equal(app.window.document.querySelector('.detail').dataset.projectSource, 'sanity');
  } finally {app.dom.window.close();}
});

test('published empty description/modules stay empty; image crop/hotspot and alt bind without changing geometry', async () => {
  const app = setup();
  try {
    const image = {asset: {_ref: 'image-abc123-1200x800-jpg'}, crop: {left: .25, right: .25, top: 0, bottom: 0}, hotspot: {x: .375, y: .6, width: .1, height: .1}};
    await app.settle(success(content([project({description: '', modules: [moduleRow('full', [{type: 'image', image, alt: 'Alt <text>'}], {height: 'medium'})]})])));
    const img = app.window.document.querySelector('.project-slot > img');
    assert.equal(new URL(img.src).searchParams.get('rect'), '300,0,600,800');
    assert.equal(img.alt, 'Alt <text>');
    assert.equal(img.style.objectPosition, '25% 60%');
    assert.equal(app.window.document.querySelectorAll('.detail-info-popup p').length, 0);
  } finally {app.dom.window.close();}
  const empty = setup();
  try {
    await empty.settle(success(content([project({modules: []})])));
    assert.equal(empty.window.document.querySelectorAll('.detail .project-module').length, 0);
    assert.equal(empty.window.document.querySelector('.detail').dataset.projectSource, 'sanity');
  } finally {empty.dom.window.close();}
});

test('live published project modules and Vimeo source reach detail DOM and custom controls', {skip: !process.env.INFO_LIVE_SMOKE}, async () => {
  const result = await adapter.load();
  assert.equal(result.ok, true, JSON.stringify(result.error));
  const project = result.data.projects.find(p=>p.detailPageEnabled && p.modulesValid && p.modules.some(m=>m.slots.some(s=>s?.type==='video')));
  assert.ok(project?.modulesValid);
  const app = setup(`#project/${project.id}`);
  try {
    await app.settle(result);
    const {document} = app.window;
    assert.equal(document.querySelector('.detail').dataset.projectSource, 'sanity');
    assert.equal(document.querySelector('.detail').dataset.projectYear, project.year);
    const rows = [...document.querySelectorAll('.detail .project-module')];
    assert.deepEqual(rows.map(row => row.dataset.moduleType), project.modules.map(row => row.type));
    for (const [index, module] of project.modules.entries()) {
      const order = Array.isArray(module.order) ? module.order : module.slots.map((_, i) => i);
      if (module.order === 'reverse') order.reverse();
      assert.equal(rows[index].children.length, module.slots.length);
      for (const [renderIndex, slotIndex] of order.entries()) {
        const slot = module.slots[slotIndex], element = rows[index].children[renderIndex];
        if (!slot) assert.ok(element.classList.contains('is-empty'));
        if (slot?.type === 'image') {
          assert.equal(element.querySelector('img').src, slot.src);
          assert.equal(element.querySelector('img').alt, slot.alt ?? project.title);
        }
        if (slot?.type === 'video') {
          const url = new URL(element.querySelector('iframe').src);
          assert.equal(url.pathname, `/video/${slot.vimeo.id}`);
          assert.equal(url.searchParams.get('autoplay'), '0');
          assert.equal(url.searchParams.get('controls'), '0');
        }
      }
    }
    assert.ok(app.players.length > 0, 'Published Vimeo slot must exist');
    const button = document.querySelector('.project-video-toggle');
    button.click(); await flush();
    assert.equal(button.querySelector('img').getAttribute('src'), 'material/pause.svg');
    button.click(); await flush();
    assert.equal(button.querySelector('img').getAttribute('src'), 'material/play.svg');
  } finally {app.dom.window.close();}
});
