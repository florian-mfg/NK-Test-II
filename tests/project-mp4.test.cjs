'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {JSDOM} = require('../studio/node_modules/jsdom');
const adapter = require('../sanity-data.js');
const slot = {type: 'mp4', video: {asset: {_ref: 'file-demo-mp4'}}};
const layouts = {full: 1, 'half-half': 2, 'half-quarter-quarter': 3, 'quarter-quarter-quarter-quarter': 4, 'third-third-third': 3, 'two-thirds-one-third': 2};
function environment() {
  const dom = new JSDOM('<main></main>', {url: 'https://preview.test/', runScripts: 'outside-only'});
  for (const file of ['vimeo-media.js', 'project-modules.js', 'project-video.js']) vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8'), dom.getInternalVMContext());
  return {dom, window: dom.window, root: dom.window.document.querySelector('main')};
}
test('MP4 normalization and rendering retain every layout, height, order and context default', () => {
  const {dom, window, root} = environment();
  try {
    for (const [type, count] of Object.entries(layouts)) for (const height of ['auto','small','medium','large','viewport']) for (const mode of ['overview','detail']) for (const playback of [undefined,'autoplay','manual']) {
      const result = adapter.normalizeModule({type, height, order:'reverse', slots:Array.from({length:count},()=>({...slot, playback}))});
      assert.deepEqual(result.issues, []);
      root.innerHTML = window.renderProjectModule(result.module, 'Film', mode);
      assert.equal(root.firstElementChild.classList.contains('height-'+height),true);
      assert.equal(root.querySelectorAll('video').length,count);
      const autoplay = (playback || (mode==='overview'?'autoplay':'manual'))==='autoplay';
      for (const video of root.querySelectorAll('video')) {
        assert.equal(video.autoplay,autoplay);
        assert.equal(video.defaultMuted,autoplay);
        assert.equal(video.loop,autoplay);
        assert.equal(video.controls,false);
        assert.equal(video.playsInline,true);
        assert.equal(video.hasAttribute('src'),false);
      }
      assert.equal(root.querySelectorAll('button').length,autoplay?0:count);
    }
    for (const asset of [{_ref:'file-demo-webm'}, {url:'https://evil.test/demo.mp4'}, {url:'https://cdn.sanity.io/files/other/production/demo.mp4'}, {_ref:'file-demo-mp4',mimeType:'video/webm'}]) {
      const result=adapter.normalizeModule({type:'full',slots:[{...slot,video:{asset}}]});
      assert.equal(result.module,null);
      assert.ok(result.issues.some(issue=>issue.code==='invalid_video'));
    }
  } finally {dom.window.close();}
});
test('native manual events, denied playback, hidden slots and cleanup use shared controls without SDK', async () => {
  const {dom, window, root} = environment();
  try {
    window.ResizeObserver=class {observe(){} disconnect(){}};
    const html=window.renderProjectModule(adapter.normalizeModule({type:'full',slots:[slot]}).module);
    root.innerHTML='<article hidden>'+html+'</article>'+html;
    const video=root.lastElementChild.querySelector('video');
    let plays=0, pauses=0, loads=0;
    video.play=()=>{plays++;video.dispatchEvent(new window.Event('play'));return Promise.resolve();};
    video.pause=()=>{pauses++;video.dispatchEvent(new window.Event('pause'));};
    video.load=()=>{loads++;};
    const cleanup=window.initProjectVideos(root);
    await new Promise(setImmediate);
    assert.equal(root.querySelector('article video').hasAttribute('src'),false);
    assert.equal(window.document.querySelector('script'),null);
    const button=video.parentElement.querySelector('button');
    assert.equal(plays,0);
    button.click();await new Promise(setImmediate);assert.equal(button.textContent,'(Pause)');
    button.click();await new Promise(setImmediate);assert.equal(button.textContent,'(Play)');
    video.play=()=>Promise.reject(Error('denied'));
    button.click();await new Promise(setImmediate);
    assert.equal(button.textContent,'(Play)');assert.match(button.title,/retry/);
    cleanup();cleanup();
    assert.equal(video.hasAttribute('src'),false);
    assert.equal(loads,1);assert.ok(pauses>=2);
  } finally {dom.window.close();}
});
