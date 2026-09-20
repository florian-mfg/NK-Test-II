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
function setup(hash = '#home') {
  const dom = new JSDOM(read('index.html'), {url: `https://example.com/portfolio/${hash}`, runScripts: 'outside-only', pretendToBeVisual: true});
  const {window} = dom;
  const scrollCalls = [];
  window.scrollTo = (x, y) => {scrollCalls.push([x, y]); window.scrollY = y;};
  window.matchMedia = () => ({matches: false, addEventListener() {}});
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

const source = 'https://player.vimeo.com/video/1223949127?background=1&autoplay=1&autopause=0&muted=1&loop=1&controls=0&badge=0&player_id=0&app_id=58479';
const title = 'Nicolas Kawohl — Background Video';
const content = (fields = {}) => adapter.normalize({projects: [], homePage: doc('homePage', {
  backgroundVideoUrl: source, videoTitle: title, ...fields
})});
function assertBackground(frame, id = '1223949127') {
  const url = new URL(frame.src);
  assert.equal(url.origin, 'https://player.vimeo.com');
  assert.equal(url.pathname, `/video/${id}`);
  for (const [key, value] of Object.entries({background: '1', autoplay: '1', autopause: '0', muted: '1', loop: '1', controls: '0', badge: '0', player_id: '0', app_id: '58479'})) {
    assert.equal(url.searchParams.get(key), value, key);
  }
  assert.equal(frame.getAttribute('allow'), 'autoplay; fullscreen; picture-in-picture');
  assert.equal(frame.tabIndex, -1);
}

test('published Frontpage updates the existing iframe without reloading the same video', async () => {
  const app = setup();
  try {
    const section = app.window.document.querySelector('.home');
    const frame = section.querySelector('iframe');
    const header = app.window.document.querySelector('.site-header').outerHTML;
    const mutations = [];
    const observer = new app.window.MutationObserver(records => mutations.push(...records));
    observer.observe(frame, {attributes: true});
    app.window.scrollY = 150;
    const scrolls = app.scrollCalls.length;
    await app.settle(success(content()));
    assert.equal(app.window.document.querySelector('.home'), section);
    assert.equal(section.querySelector('iframe'), frame);
    assert.equal(section.children.length, 1);
    assert.equal(frame.title, title);
    assert.equal(frame.src, source);
    assertBackground(frame);
    assert.equal(mutations.some(record => record.attributeName === 'src'), false);
    assert.equal(section.getAttribute('style'), null);
    assert.equal(app.scrollCalls.length, scrolls);
    assert.equal(app.window.scrollY, 150);
    assert.equal(app.window.document.querySelector('.site-header').outerHTML, header);
    app.window.renderHome();
    assert.equal(app.window.document.querySelector('iframe').title, title);
    assert.equal(app.requests(), 1);
    observer.disconnect();
  } finally {app.dom.window.close();}
});

test('new Vimeo source preserves privacy hash and forces background playback; poster stays behind iframe', async () => {
  const app = setup();
  try {
    await app.settle(success(content({backgroundVideoUrl: 'https://player.vimeo.com/video/98765?h=private&controls=1&muted=0',
      poster: {asset: {_ref: 'image-poster123-1200x800-jpg'}, alt: 'Poster description', hotspot: {x: .25, y: .75, width: .2, height: .2}}
    })));
    const section = app.window.document.querySelector('.home');
    assertBackground(section.querySelector('iframe'), '98765');
    assert.equal(new URL(section.querySelector('iframe').src).searchParams.get('h'), 'private');
    assert.ok(section.style.backgroundImage.includes('https://cdn.sanity.io/images/ck6xe2er/production/poster123-1200x800.jpg'));
    assert.equal(section.style.backgroundPosition, '25% 75%');
    assert.equal(section.children.length, 1);
  } finally {app.dom.window.close();}
});

test('request/document/video failures retain the exact local homepage', async () => {
  for (const result of [
    {ok: false, data: null}, success(adapter.normalize({projects: []})),
    ...['', 'javascript:alert(1)', 'https://example.com/movie', 'https://example.com/movie.mp4'].map(backgroundVideoUrl => success(content({backgroundVideoUrl})))
  ]) {
    const app = setup();
    try {
      const initial = app.window.document.querySelector('.home').outerHTML;
      await app.settle(result);
      assert.equal(app.window.document.querySelector('.home').outerHTML, initial);
    } finally {app.dom.window.close();}
  }
  const app = setup();
  try {
    const initial = app.window.document.querySelector('.home').outerHTML;
    await app.reject();
    assert.equal(app.window.document.querySelector('.home').outerHTML, initial);
  } finally {app.dom.window.close();}
});

test('late Frontpage response leaves every other route intact and is cached for Home', async () => {
  for (const hash of ['#info', '#archive', '#imprint', '#privacy-policy']) {
    const app = setup(hash);
    try {
      const initial = app.window.document.querySelector('#app').innerHTML;
      await app.settle(success(content()));
      assert.equal(app.window.document.querySelector('#app').innerHTML, initial, hash);
      assert.equal(app.window.location.hash, hash);
      app.window.renderHome();
      assert.equal(app.window.document.querySelector('iframe').title, title);
      assert.equal(app.requests(), 1);
    } finally {app.dom.window.close();}
  }
  const app = setup();
  try {
    app.window.renderInfo();
    const initial = app.window.document.querySelector('#app').innerHTML;
    await app.settle(success(content()));
    assert.equal(app.window.document.querySelector('#app').innerHTML, initial);
  } finally {app.dom.window.close();}
});

test('live published Frontpage reaches the existing homepage renderer', {skip: !process.env.INFO_LIVE_SMOKE}, async () => {
  const result = await adapter.load();
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(result.data.homePage?.video?.src, source);
  assert.equal(result.data.homePage.videoTitle, title);
  const app = setup();
  try {
    await app.settle(result);
    const frame = app.window.document.querySelector('.home-media');
    assert.equal(frame.src, source);
    assert.equal(frame.title, title);
    assertBackground(frame);
    app.window.renderInfo();
    assert.equal(app.window.document.querySelector('.info-intro').textContent, 'Berliner Boy');
    assert.equal(app.window.document.querySelector('.info-work p').textContent, 'Eps51');
    assert.equal(app.window.document.querySelector('.info-skills p').textContent, 'Tattooboss');
    assert.equal(app.requests(), 1);
  } finally {app.dom.window.close();}
});
