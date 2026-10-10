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
  for (const file of ['projects.js', 'project-modules.js', 'project-video.js', 'frontpage-media-fade.js', 'app.js']) vm.runInContext(read(file), dom.getInternalVMContext());
  window.fitWorkMenu();
  const flush = () => new Promise(yes => setImmediate(yes));
  return {window, dom, scrollCalls, requests: () => requests, reject: async () => {reject(new Error('offline')); await flush();},
    settle: async result => {resolve(result); await flush();}};
}
const success = data => ({ok: true, data, error: null});

const title = 'Nicolas Kawohl — Background Video';
const content = (fields = {}) => adapter.normalize({projects: [], homePage: doc('homePage', {
  video: {asset:{_ref:"file-demo-mp4"}}, videoTitle: title, ...fields
})});
test('Frontpage initially shows two fade layers and ignores late Sanity hero/video/poster settings', async () => {
  const app = setup();
  try {
    const section = app.window.document.querySelector('.home');
    const header = app.window.document.querySelector('.site-header').outerHTML;
    const initial = section.outerHTML;
    assert.equal(section.querySelector('iframe, video'), null);
    assert.equal(section.querySelector('[data-role="current"]').style.opacity,'1');
    assert.equal(section.querySelector('[data-role="incoming"]').style.opacity,'0');
    assert.equal(section.querySelector('.frontpage-fade').children.length, 2);
    await app.settle(success(content({video:{asset:{_ref:'file-second-mp4'}},
      poster: {asset: {_ref: 'image-poster123-1200x800-jpg'}}})));
    assert.equal(section.outerHTML, initial);
    assert.equal(app.window.document.querySelector('.site-header').outerHTML, header);
    assert.equal(app.requests(), 1);
  } finally {app.dom.window.close();}
});

test('failed content requests retain the fullscreen fade Frontpage', async () => {
  const app = setup();
  try {
    const initial = app.window.document.querySelector('.home').outerHTML;
    await app.reject();
    assert.equal(app.window.document.querySelector('.home').outerHTML, initial);
  } finally {app.dom.window.close();}
});

test('late Frontpage response leaves other routes intact; returning Home stays clean', async () => {
  for (const hash of ['#info', '#imprint', '#privacy-policy']) {
    const app = setup(hash);
    try {
      const initial = app.window.document.querySelector('#app').innerHTML;
      await app.settle(success(content()));
      assert.equal(app.window.document.querySelector('#app').innerHTML, initial, hash);
      app.window.renderHome();
      assert.equal(app.window.document.querySelector('.home iframe'), null);
      assert.equal(app.window.document.querySelector('.frontpage-fade').children.length, 2);
      assert.equal(app.requests(), 1);
    } finally {app.dom.window.close();}
  }
});
