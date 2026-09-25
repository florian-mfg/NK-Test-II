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
function setup(hash = '#project/ethereal-tides', mobile = false) {
  const dom = new JSDOM(read('index.html'), {url: `https://example.com/portfolio/${hash}`, runScripts: 'outside-only', pretendToBeVisual: true});
  const {window} = dom;
  const scrollCalls = [];
  window.scrollTo = (x, y) => {if (typeof x === "object") {y = x.top; x = x.left;} scrollCalls.push([x, y]); window.scrollY = y; window.scrollX = x;};
  window.matchMedia = () => ({matches: mobile, addEventListener() {}});
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

const snapshot = adapter.normalize({
  projects: [{_type: 'project', _id: 'p', slug: {current: 'scroll-project'}, title: 'Scroll project', category: 'Video', categories: ['video', 'commissioned', 'graphic'], modules: [{_type: 'full', type: 'full', height: 'large', slots: [null]}, {_type: 'spacer', type: 'spacer', size: 'large'}]}],
  selectedWork: doc('selectedWork', {video: [{_ref: 'p'}], commissioned: [{_ref: 'p'}], graphic: [{_ref: 'p'}]})
});
const frame = window => new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
async function clickRoute(window, link) {
  // Exercise the delegated native click handlers; drive the same hash router
  // explicitly because jsdom queues anchor navigation separately.
  window.addEventListener('click', event => event.preventDefault(), {once: true});
  link.dispatchEvent(new window.MouseEvent('click', {bubbles: true, cancelable: true, button: 0}));
  window.location.hash = link.getAttribute('href');
  window.route();
  await new Promise(resolve => setImmediate(resolve));
}
for (const mobile of [false, true]) {
  for (const hash of ['#work', '#work/video', '#work/commissioned', '#work/graphic', '#/work/graphic']) {
    test(`Overview restores exact origin and offset repeatedly: ${hash}, mobile=${mobile}`, async () => {
      const app = setup(hash, mobile);
      const {window} = app;
      try {
        await app.settle(success(snapshot));
        for (const y of [937, 1423]) {
          window.scrollTo(0, y);
          const link = window.document.querySelector('.project-preview:not([hidden]) .project-link');
          await clickRoute(window, link);
          assert.equal(window.location.hash, '#project/scroll-project');
          assert.equal(window.scrollY, 0);
          const overview = window.document.querySelector('.header-overview');
          assert.equal(overview.getAttribute('href'), hash);
          const start = app.scrollCalls.length;
          await clickRoute(window, overview);
          assert.equal(window.document.querySelector('#app').style.visibility, 'hidden');
          await frame(window);
          assert.equal(window.location.hash, hash);
          assert.equal(window.scrollY, y);
          assert.deepEqual(app.scrollCalls.slice(start), [[0, y]]);
          assert.equal(window.document.querySelector('#app').style.visibility, '');
        }
      } finally {window.close();}
    });
  }
}
test('direct project URL retains category fallback and normal top navigation', async () => {
  const app = setup('#project/scroll-project');
  try {
    await app.settle(success(snapshot));
    const link = app.window.document.querySelector('.header-overview');
    assert.equal(link.getAttribute('href'), '#work/video');
    await clickRoute(app.window, link);
    assert.equal(app.window.scrollY, 0);
    assert.equal(app.window.document.querySelector('#app').style.visibility, '');
  } finally {app.window.close();}
});
for (const cancel of [false, true]) test(`restoration waits for image layout; cancellation=${cancel}`, async () => {
  const app = setup('#work/graphic');
  const {window} = app;
  try {
    await app.settle(success(snapshot));
    window.scrollTo(0, 800);
    const link = window.document.querySelector('.project-preview:not([hidden]) .project-link');
    await clickRoute(window, link);
    // Simulate a newly rendered image whose natural height is not ready yet.
    const original = window.restoreOverviewPosition;
    window.restoreOverviewPosition = () => {
      const img = window.document.createElement('img');
      img.src = 'https://example.com/pending.jpg';
      window.document.querySelector('.project-preview:not([hidden])').append(img);
      original();
    };
    await clickRoute(window, window.document.querySelector('.header-overview'));
    await frame(window);
    assert.equal(window.document.querySelector('#app').style.visibility, 'hidden');
    const img = window.document.querySelector('.project-preview:not([hidden]) img');
    assert.equal(img.loading, 'eager');
    if (cancel) {window.location.hash = '#info'; window.route();}
    img.dispatchEvent(new window.Event('load'));
    await frame(window);
    assert.equal(window.scrollY, cancel ? 0 : 800);
    assert.equal(window.location.hash, cancel ? '#info' : '#work/graphic');
    assert.equal(window.document.querySelector('#app').style.visibility, '');
  } finally {window.close();}
});
