'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {JSDOM} = require('../studio/node_modules/jsdom');
const {parseVimeoUrl} = require('../vimeo-media.js');
const adapter = require('../sanity-data.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const layouts = {'full': [12], 'half-half': [6, 6], 'half-quarter-quarter': [6, 3, 3], 'quarter-quarter-quarter-quarter': [3, 3, 3, 3], 'third-third-third': [4, 4, 4], 'two-thirds-one-third': [8, 4]};
const video = {type: 'video', vimeoUrl: 'https://vimeo.com/12345/private?autoplay=1&controls=1', alt: 'Film'};
const row = (type = 'full', slots = [video], extra = {}) => ({_type: type, type, height: 'auto', slots, ...extra});
const flush = () => new Promise(resolve => setImmediate(resolve));
function environment() {
  const dom = new JSDOM('<main></main>', {url: 'https://example.com/portfolio/', runScripts: 'outside-only'});
  const {window} = dom;
  for (const file of ['vimeo-media.js', 'project-modules.js', 'project-video.js']) vm.runInContext(read(file), dom.getInternalVMContext());
  return {dom, window, root: window.document.querySelector('main')};
}

test('shared Vimeo URL parser accepts public/player/unlisted forms and strips pasted playback policy', () => {
  for (const url of ['https://vimeo.com/12345', 'https://www.vimeo.com/12345/', 'https://player.vimeo.com/video/12345']) {
    assert.equal(parseVimeoUrl(url).embedUrl, 'https://player.vimeo.com/video/12345');
  }
  for (const url of ['https://vimeo.com/12345/private', 'https://vimeo.com/12345?h=private&share=copy', 'https://player.vimeo.com/video/12345?h=private&controls=1&autoplay=1#t=20s']) {
    assert.equal(parseVimeoUrl(url).embedUrl, 'https://player.vimeo.com/video/12345?h=private');
    assert.equal(parseVimeoUrl(url).src, url);
  }
  for (const url of [null, '', 123, 'javascript:alert(1)', 'http://vimeo.com/12345', 'https://vimeo.com.evil.test/12345', 'https://vimeo.com@evil.test/12345', 'https://user:password@vimeo.com/12345', 'https://vimeo.com/0', 'https://vimeo.com/channels/test', 'https://vimeo.com/12345/extra/path', 'https://player.vimeo.com/12345', 'https://vimeo.com/12345?h=', 'https://vimeo.com/12345?h=a&h=b', 'https://vimeo.com/12345?h=%22bad', 'https://vimeo.com:8443/12345', 'https://vimeo.com/12345\n']) {
    assert.equal(parseVimeoUrl(url), null, String(url));
  }
});

test('all compositions/heights/arrangements retain slot geometry in both video modes', () => {
  const env = environment();
  try {
    for (const [type, spans] of Object.entries(layouts)) {
      for (const height of ['auto', 'small', 'medium', 'large', 'viewport']) {
        for (const order of ['default', 'reverse', ...(type === 'half-quarter-quarter' ? ['middle'] : [])]) {
          const slots = spans.map((_, index) => ({...video, vimeoUrl: `https://player.vimeo.com/video/${12345 + index}?h=private&autoplay=1&muted=0&controls=1`}));
          const result = adapter.normalizeModule(row(type, slots, {height, order}));
          assert.deepEqual(result.issues, []);
          const indices = order === 'middle' ? [1, 0, 2] : spans.map((_, i) => i);
          if (order === 'reverse') indices.reverse();
          for (const mode of ['overview', 'detail']) {
            env.root.innerHTML = env.window.renderProjectModule(result.module, 'Title', mode);
            const module = env.root.firstElementChild;
            assert.ok(module.classList.contains(`height-${height}`));
            assert.equal(module.dataset.moduleType, type);
            assert.deepEqual([...module.children].map(slot => Number(slot.style.getPropertyValue('--slot-span'))), indices.map(i => spans[i]));
            for (const [index, frame] of [...module.querySelectorAll('iframe')].entries()) {
              const url = new URL(frame.dataset.projectVideoSrc);
              assert.equal(url.pathname, `/video/${12345 + indices[index]}`);
              assert.equal(url.searchParams.get('h'), 'private');
              for (const key of ['background', 'autoplay', 'muted', 'loop']) assert.equal(url.searchParams.get(key), mode === 'overview' ? '1' : '0');
              for (const key of ['controls', 'title', 'byline', 'portrait', 'badge', 'keyboard']) assert.equal(url.searchParams.get(key), '0');
              assert.equal(frame.title, 'Film');
              assert.equal(frame.hasAttribute('src'), false); // mounted only for visible routes/categories
            }
            assert.equal(module.querySelectorAll('button').length, mode === 'detail' ? spans.length : 0);
          }
        }
      }
    }
  } finally {env.dom.window.close();}
});

test('empty slots discard stale Vimeo/uploads; invalid or legacy videos invalidate composition without losing metadata', () => {
  const empty = adapter.normalizeModule(row('half-quarter-quarter', [{type: 'empty', ...{vimeoUrl: 'bad', video: {asset: {_ref: 'file-old-mp4'}}}}, video], {order: 'middle'}));
  assert.equal(empty.module.slots[0], null);
  assert.equal(empty.module.slots[2], null);
  assert.deepEqual(empty.module.order, [1, 0, 2]);
  for (const slot of [{type: 'video', vimeoUrl: 'https://example.com/file.mp4'}, {type: 'video', video: {asset: {_ref: 'file-old-mp4'}}}]) {
    const result = adapter.normalize({projects: [{_id: 'project', _type: 'project', title: 'Film', slug: {current: 'film'}, category: 'Video', modules: [row('full', [slot])]}]});
    assert.equal(result.projects[0].title, 'Film');
    assert.equal(result.projects[0].modulesValid, false);
    assert.deepEqual(result.projects[0].modules, []);
    assert.ok(result.issues.some(issue => issue.code === (slot.video ? 'legacy_video_requires_migration' : 'invalid_vimeo')));
  }
  assert.ok(adapter.normalizeModule(row('full', [{...video, video: {asset: {_ref: 'file-old-mp4'}}}])).module);
});

test('mixed images, Vimeo, text and empties keep image crop/hotspot, alt, poster and text sizes', () => {
  const img = {asset: {_ref: 'image-abc123-1200x800-jpg'}, crop: {left: .1, right: 0, top: 0, bottom: 0}, hotspot: {x: .5, y: .5, width: .5, height: .5}};
  const result = adapter.normalizeModule(row('quarter-quarter-quarter-quarter', [{type: 'image', image: img, alt: ''}, {...video, alt: '<script>name</script>', poster: img}, {type: 'text', text: 'Line\nTwo', textSize: 'l'}, {type: 'empty'}]));
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.module.slots[0].image.hotspot, img.hotspot);
  assert.equal(new URL(result.module.slots[0].src).searchParams.get('rect'), '120,0,1080,800');
  const env = environment();
  try {
    env.root.innerHTML = env.window.renderProjectModule(result.module, 'Title');
    assert.equal(env.root.querySelector('figure > img').alt, '');
    assert.equal(env.root.querySelector('iframe').title, '<script>name</script>');
    assert.equal(env.root.querySelector('script'), null);
    assert.equal(env.root.querySelectorAll('.is-empty').length, 1);
    assert.ok(env.root.querySelector('.text-size-l'));
    assert.equal(env.root.querySelector('.project-video-poster').getAttribute('aria-hidden'), 'true');
    assert.throws(() => env.window.renderProjectModule(row('full', [{type: 'video', src: 'https://evil.test/video.mp4'}])));
  } finally {env.dom.window.close();}
});

function mockPlayers(window) {
  const players = [], observers = [];
  window.ResizeObserver = class {
    constructor(callback) {this.callback = callback; observers.push(this);}
    observe() {}
    disconnect() {this.disconnected = true;}
  };
  window.Vimeo = {Player: class {
    constructor(frame) {this.frame = frame; this.events = {}; this.calls = []; players.push(this);}
    on(name, handler) {this.events[name] = handler;}
    off(name) {delete this.events[name];}
    ready() {return Promise.resolve();}
    getVideoWidth() {return Promise.resolve(1920);}
    getVideoHeight() {return Promise.resolve(1080);}
    play() {this.calls.push('play'); this.events.play(); return Promise.resolve();}
    pause() {this.calls.push('pause'); this.events.pause(); return Promise.resolve();}
    destroy() {this.calls.push('destroy'); return Promise.resolve();}
  }};
  return {players, observers};
}

test('detail custom button follows Vimeo events, handles rejection, covers slot and cleans up', async () => {
  const env = environment();
  const {players, observers} = mockPlayers(env.window);
  try {
    env.root.innerHTML = env.window.renderProjectModule(adapter.normalizeModule(row()).module, 'Title');
    const box = env.root.querySelector('.project-vimeo');
    box.getBoundingClientRect = () => ({width: 400, height: 500});
    const dispose = env.window.initProjectVideos(env.root);
    await flush();
    const player = players[0], button = box.querySelector('button'), frame = box.querySelector('iframe');
    assert.deepEqual(player.calls, []); // no detail autoplay, including API calls
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, '');
    assert.equal(button.querySelector('img').getAttribute('width'), '60');
    assert.equal(button.querySelector('img').getAttribute('height'), '59');
    assert.equal(button.querySelector('img').alt, '');
    assert.equal(frame.style.height, '500px');
    assert.ok(Math.abs(parseFloat(frame.style.width) - 500 * 1920 / 1080) < .001);
    assert.equal(box.style.getPropertyValue('--video-ratio'), String(1920 / 1080));
    button.click(); await flush();
    assert.equal(button.querySelector('img').getAttribute('src'), 'material/pause.svg');
    assert.equal(button.getAttribute('aria-label'), 'Pause Film');
    button.click(); await flush();
    assert.equal(button.querySelector('img').getAttribute('src'), 'material/play.svg');
    assert.equal(button.getAttribute('aria-label'), 'Play Film');
    assert.deepEqual(player.calls, ['play', 'pause']);
    player.events.play();
    player.events.ended();
    assert.equal(button.querySelector('img').getAttribute('src'), 'material/play.svg');
    assert.equal(button.getAttribute('aria-label'), 'Play Film');
    player.play = () => Promise.reject(Error('Denied'));
    button.click(); await flush();
    assert.equal(button.querySelector('img').getAttribute('src'), 'material/play.svg');
    assert.equal(button.getAttribute('aria-label'), 'Play Film');
    assert.ok(button.title.includes('retry'));
    dispose();
    assert.equal(observers[0].disconnected, true);
    assert.deepEqual(player.events, {});
    assert.equal(player.calls.at(-1), 'destroy');
  } finally {env.dom.window.close();}
});

test('hidden overview categories do not load players; visible teasers have no custom controls', async () => {
  const env = environment();
  const {players} = mockPlayers(env.window);
  try {
    const html = env.window.renderProjectModule(adapter.normalizeModule(row()).module, 'Title', 'overview');
    env.root.innerHTML = `<article hidden>${html}</article><article>${html}</article>`;
    const dispose = env.window.initProjectVideos(env.root);
    await flush();
    assert.equal(players.length, 1);
    assert.equal(env.root.querySelector('article[hidden] iframe').hasAttribute('src'), false);
    assert.equal(env.root.querySelectorAll('button').length, 0);
    assert.equal(new URL(players[0].frame.src).searchParams.get('autoplay'), '1');
    dispose();
  } finally {env.dom.window.close();}
});

test('route cleanup before SDK readiness prevents late players; SDK failures are contained', async () => {
  for (const failure of [false, true]) {
    const env = environment();
    try {
      env.root.innerHTML = env.window.renderProjectModule(adapter.normalizeModule(row()).module, 'Title');
      let resolve, reject;
      env.window.loadProjectVimeoSDK = () => new Promise((yes, no) => {resolve = yes; reject = no;});
      const dispose = env.window.initProjectVideos(env.root);
      if (failure) {
        reject(Error('offline')); await flush();
        assert.equal(env.root.querySelector('button img').getAttribute('src'), 'material/play.svg');
        assert.equal(env.root.querySelector('button').getAttribute('aria-label'), 'Video unavailable. Reload to retry.');
        assert.equal(env.root.querySelector('button').disabled, true);
        dispose();
      } else {
        dispose();
        resolve({Player: class {constructor() {assert.fail('Late player created');}}});
        await flush();
        assert.equal(env.root.querySelector('iframe').hasAttribute('src'), false);
      }
    } finally {env.dom.window.close();}
  }
});
