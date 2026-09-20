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
function content(extra = {}) {
  return adapter.normalize({projects: [], siteSettings: doc('siteSettings', {brandName: 'CMS Brand', email: 'published@example.com'}),
    infoPage: doc('infoPage', {introduction: 'Berliner Boy', work: ['Eps51'], skills: ['Tattooboss'], contactLinks: [{label: 'Email', destination: 'email'}]}), ...extra});
}

function setup(hash = '#info') {
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

test('Info updates only existing paragraphs and respects published empty arrays', async () => {
  const app = setup();
  try {
    const {document} = app.window;
    const root = document.querySelector('.info');
    const wrappers = [...root.querySelectorAll('section, div, h2, p')];
    const header = document.querySelector('.main-nav').outerHTML;
    const menu = document.querySelector('.mobile-menu nav').outerHTML;
    const scrollCount = app.scrollCalls.length;
    await app.settle(success(content()));
    assert.equal(document.querySelector('.info-intro').textContent, 'Berliner Boy');
    assert.equal(document.querySelector('.info-work p').textContent, 'Eps51');
    assert.equal(document.querySelector('.info-skills p').textContent, 'Tattooboss');
    assert.equal(document.querySelector('.info-cv p').innerHTML, '');
    assert.equal(document.querySelector('.info-clients p').innerHTML, '');
    assert.equal(document.querySelector('.info-contact a').href, 'mailto:published@example.com');
    assert.deepEqual([...root.querySelectorAll('section, div, h2, p')], wrappers);
    assert.equal(document.querySelector('.main-nav').outerHTML, header);
    assert.equal(document.querySelector('.mobile-menu nav').outerHTML, menu);
    assert.equal(app.scrollCalls.length, scrollCount);
    assert.equal(app.requests(), 1);
    app.window.renderInfo();
    assert.equal(app.requests(), 1);
    assert.equal(document.querySelector('.info-intro').textContent, 'Berliner Boy');
  } finally {app.dom.window.close();}
});

test('failed requests and missing or malformed Info retain the exact local fallback', async () => {
  for (const result of [
    {ok: false, data: null, error: {code: 'timeout'}},
    success(content({infoPage: null})),
    success(content({infoPage: doc('infoPage', {work: 'malformed'})}))
  ]) {
    const app = setup();
    try {
      const initial = app.window.document.querySelector('.info').outerHTML;
      await app.settle(result);
      assert.equal(app.window.document.querySelector('.info').outerHTML, initial);
    } finally {app.dom.window.close();}
  }
  const app = setup();
  try {
    const initial = app.window.document.querySelector('.info').outerHTML;
    await app.reject();
    assert.equal(app.window.document.querySelector('.info').outerHTML, initial);
  } finally {app.dom.window.close();}
});

test('missing settings retain only local contacts while published Info wins', async () => {
  const app = setup();
  try {
    const contacts = app.window.document.querySelector('.info-contact p').innerHTML;
    await app.settle(success(content({siteSettings: null})));
    assert.equal(app.window.document.querySelector('.info-intro').textContent, 'Berliner Boy');
    assert.equal(app.window.document.querySelector('.info-work p').textContent, 'Eps51');
    assert.equal(app.window.document.querySelector('.info-skills p').textContent, 'Tattooboss');
    assert.equal(app.window.document.querySelector('.info-contact p').innerHTML, contacts);
  } finally {app.dom.window.close();}
});

test('CMS contact emptiness is respected; settings are optional when no contacts need them', async () => {
  const app = setup();
  try {
    await app.settle(success(content({siteSettings: null, infoPage: doc('infoPage', {introduction: 'Berliner Boy', contactLinks: []})})));
    assert.equal(app.window.document.querySelector('.info-intro').textContent, 'Berliner Boy');
    assert.equal(app.window.document.querySelector('.info-contact p').innerHTML, '');
  } finally {app.dom.window.close();}
});

test('late published content wins after scrolling or focus without resetting scrolling', async () => {
  for (const interaction of ['scroll', 'focus']) {
    const app = setup();
    try {
      const section = app.window.document.querySelector('.info');
      if (interaction === 'scroll') app.window.scrollY = 150;
      else app.window.document.querySelector('.info-contact a').focus();
      const calls = app.scrollCalls.length;
      await app.settle(success(content()));
      assert.equal(app.window.document.querySelector('.info'), section);
      assert.equal(section.querySelector('.info-intro').textContent, 'Berliner Boy');
      assert.equal(section.querySelector('.info-work p').textContent, 'Eps51');
      assert.equal(section.querySelector('.info-skills p').textContent, 'Tattooboss');
      assert.equal(app.scrollCalls.length, calls);
      if (interaction === 'scroll') assert.equal(app.window.scrollY, 150);
      // A later explicit visit uses the cached snapshot, without another fetch.
      app.window.renderInfo();
      assert.equal(app.window.document.querySelector('.info-intro').textContent, 'Berliner Boy');
      assert.equal(app.requests(), 1);
    } finally {app.dom.window.close();}
  }
});

test('other routes keep their local DOM and direct project routing during async loading', async () => {
  for (const hash of ['#home', '#imprint', '#privacy-policy']) {
    const app = setup(hash);
    try {
      const initial = app.window.document.querySelector('#app').innerHTML;
      await app.settle(success(content()));
      assert.equal(app.window.location.hash, hash);
      assert.equal(app.window.document.querySelector('#app').innerHTML, initial, hash);
      assert.equal(app.requests(), 1);
      app.window.renderInfo();
      assert.equal(app.window.document.querySelector('.info-work p').textContent, 'Eps51');
    } finally {app.dom.window.close();}
  }
});

test('navigating away from Info before completion does not render it again', async () => {
  const app = setup();
  try {
    app.window.renderHome();
    const initial = app.window.document.querySelector('#app').innerHTML;
    await app.settle(success(content()));
    assert.equal(app.window.document.querySelector('#app').innerHTML, initial);
  } finally {app.dom.window.close();}
});

test('ordered arrays and line breaks remain ordered, and CMS strings are escaped', async () => {
  const app = setup();
  try {
    await app.settle(success(content({infoPage: doc('infoPage', {introduction: '<img src=x onerror=alert(1)>',
      cv: [{period: '2025', text: 'Second'}, {period: '2020', text: 'First'}], work: ['Two', 'One\nMore'], skills: ['B', 'A'], selectedClients: ['Z', 'Y'], contactLinks: [{label: '<b>Mail</b>', destination: 'email'}]})})));
    const {document} = app.window;
    assert.equal(document.querySelector('.info-intro img'), null);
    assert.equal(document.querySelector('.info-intro').textContent, '<img src=x onerror=alert(1)>');
    assert.equal(document.querySelector('.info-cv p').innerHTML, '2025 Second<br>2020 First');
    assert.equal(document.querySelector('.info-work p').innerHTML, 'Two<br>One<br>More');
    assert.equal(document.querySelector('.info-skills p').innerHTML, 'B<br>A');
    assert.equal(document.querySelector('.info-clients p').innerHTML, 'Z<br>Y');
    assert.equal(document.querySelector('.info-contact b'), null);
  } finally {app.dom.window.close();}
});

test('live published Info values are retrieved and rendered', {skip: !process.env.INFO_LIVE_SMOKE}, async () => {
  const result = await adapter.load();
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(result.data.infoPage?.introduction, 'Berliner Boy');
  assert.ok(result.data.infoPage?.work.includes('Eps51'));
  assert.ok(result.data.infoPage?.skills.includes('Tattooboss'));
  assert.equal(result.data.siteSettings?.brandName, 'Nicolas Kawohl');
  assert.ok(result.data.siteSettings?.contacts.email);
  const app = setup();
  try {
    await app.settle(result);
    assert.equal(app.window.document.querySelector('.info-intro').textContent, 'Berliner Boy');
    assert.ok(app.window.document.querySelector('.info-work p').textContent.includes('Eps51'));
    assert.ok(app.window.document.querySelector('.info-skills p').textContent.includes('Tattooboss'));
  } finally {app.dom.window.close();}
});
