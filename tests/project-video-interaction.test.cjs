'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {JSDOM} = require('../studio/node_modules/jsdom');
const flush = () => new Promise(setImmediate);
for (const type of ['video', 'mp4']) for (const touch of [false, true]) for (const playback of ['manual', 'autoplay']) {
  test(`Project ${type}, ${touch ? 'touch' : 'desktop'}, ${playback}: playback, audio, visibility and cleanup`, async () => {
    const dom = new JSDOM('<main></main>', {url:'https://preview.test', runScripts:'outside-only', pretendToBeVisual:true});
    const w = dom.window;
    let intersection, destroyed = false;
    const calls = [];
    w.matchMedia = () => ({matches:touch});
    w.ResizeObserver = class {observe() {} disconnect() {}};
    w.IntersectionObserver = class {constructor(fn) {intersection=fn;} observe() {} disconnect() {}};
    let player;
    w.Vimeo = {Player: class {
      constructor() {player=this;this.events={};this.muted=true;}
      on(name, fn) {this.events[name]=fn;}
      off(name) {delete this.events[name];}
      ready() {return Promise.resolve();}
      getVideoWidth() {return Promise.resolve(1920);}
      getVideoHeight() {return Promise.resolve(1080);}
      play() {calls.push('play');this.events.play();return Promise.resolve();}
      pause() {calls.push('pause');this.events.pause();return Promise.resolve();}
      setMuted(value) {this.muted=value;return Promise.resolve();}
      setVolume() {return Promise.resolve();}
      destroy() {destroyed=true;return Promise.resolve();}
    }};
    for (const file of ['vimeo-media.js','project-modules.js','project-video.js']) vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),dom.getInternalVMContext());
    const root=w.document.querySelector('main');
    root.innerHTML=w.renderProjectModule({type:'full',slots:[{type, playback, src:type==='mp4'?'https://preview.test/movie.mp4':'https://vimeo.com/12345/private'}]});
    const box=root.querySelector('.project-vimeo'), frame=box.querySelector('video,iframe'), button=box.querySelector('button');
    if(type==='mp4') {
      player=frame;
      frame.play=()=>{calls.push('play');frame.dispatchEvent(new w.Event('play'));return Promise.resolve();};
      frame.pause=()=>{calls.push('pause');frame.dispatchEvent(new w.Event('pause'));};
      frame.load=()=>{destroyed=true;};
    }
    const cleanup=w.initProjectVideos(root);
    await flush();
    assert.ok(!calls.includes('play'),'offscreen startup cannot play');
    intersection([{isIntersecting:true}]);await flush();
    const sound=root.querySelector('.detail-sound-control');
    const auto=playback==='autoplay';
    assert.equal(box.dataset.videoPlaying,String(auto));
    assert.equal(sound.textContent,'(Sound)');
    assert.equal(player.muted,true);
    if(type==='video') {
      const url=new URL(frame.src);
      assert.equal(url.searchParams.get('h'),'private');
      assert.equal(url.searchParams.get('controls'),'0');
      assert.equal(url.searchParams.get('playsinline'),'1');
      assert.equal(url.searchParams.get('loop'),playback==='autoplay'?'1':'0');
    } else {
      assert.equal(frame.autoplay,auto);assert.equal(frame.playsInline,true);assert.equal(frame.controls,false);
      assert.equal(frame.loop,playback==='autoplay');
    }
    const before=calls.length;
    sound.click();await flush();
    assert.equal(sound.textContent,'(Mute)');assert.equal(player.muted,!auto);
    sound.click();await flush();
    assert.equal(sound.textContent,'(Sound)');assert.equal(player.muted,true);
    assert.equal(calls.length,before,'audio must not toggle playback');
    assert.equal(button.textContent,auto?'(Pause)':'(Play)');
    box.click();await flush();
    assert.equal(box.dataset.videoPlaying,String(auto),'video-area clicks do not toggle playback');
    button.click();await flush();
    assert.equal(box.dataset.videoPlaying,String(!auto));
    assert.equal(button.textContent,auto?'(Play)':'(Pause)');
    button.click();await flush();
    assert.equal(box.dataset.videoPlaying,String(auto));
    intersection([{isIntersecting:false}]);await flush();
    assert.equal(box.dataset.videoPlaying,'false');
    const pausedCalls=calls.length;button.click();box.click();await flush();assert.equal(calls.length,pausedCalls);
    intersection([{isIntersecting:true}]);await flush();
    assert.equal(box.dataset.videoPlaying,String(auto));
    cleanup();assert.equal(root.querySelector('.detail-sound-control'),null);assert.equal(destroyed,true);assert.equal(box.hasAttribute('data-video-ready'),false);
    const after=calls.length;box.click();button.click();await flush();assert.equal(calls.length,after);
    dom.window.close();
  });
}

test('page audio persists across mixed videos, serializes handoffs and cancels pending unmute on cleanup', async () => {
  const dom=new JSDOM('<main></main>',{url:'https://preview.test',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window, root=w.document.querySelector('main'), intersections=new Map(), players=[];
  w.matchMedia=()=>({matches:true});
  w.ResizeObserver=class {observe(){} disconnect(){}};
  w.IntersectionObserver=class {constructor(fn){this.fn=fn;} observe(box){intersections.set(box,this.fn);} disconnect(){}};
  let releaseMute, delayMute=false, overlap=false;
  const check=()=>{if(players.filter(p=>!p.muted).length>1) overlap=true;};
  w.Vimeo={Player:class {
    constructor(){this.events={};this.muted=true;players.push(this);}
    on(n,fn){this.events[n]=fn;} off(n){delete this.events[n];}
    ready(){return Promise.resolve();} getVideoWidth(){return Promise.resolve(160);} getVideoHeight(){return Promise.resolve(90);}
    play(){this.events.play();return Promise.resolve();} pause(){this.events.pause();return Promise.resolve();}
    setVolume(){return Promise.resolve();}
    async setMuted(value){if(value&&delayMute) await new Promise(resolve=>{releaseMute=resolve;});this.muted=value;check();}
    destroy(){this.muted=true;return Promise.resolve();}
  }};
  for(const file of ['vimeo-media.js','project-modules.js','project-video.js']) vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),dom.getInternalVMContext());
  root.innerHTML=w.renderProjectModule({type:'half-half',slots:[
    {type:'video',src:'https://vimeo.com/12345/secret',playback:'autoplay'},
    {type:'mp4',src:'https://preview.test/movie.mp4',playback:'autoplay'}
  ]});
  const boxes=[...root.querySelectorAll('.project-vimeo')], native=boxes[1].querySelector('video');
  native.play=()=>{native.dispatchEvent(new w.Event('play'));return Promise.resolve();};
  native.pause=()=>native.dispatchEvent(new w.Event('pause'));native.load=()=>{};
  let nativeMuted=true;
  Object.defineProperty(native,'muted',{get:()=>nativeMuted,set:value=>{nativeMuted=value;check();}});
  players.push(native);
  const cleanup=w.initProjectVideos(root);await flush();
  const vimeo=players[1], sound=root.querySelector('.detail-sound-control');
  const show=(index,value)=>intersections.get(boxes[index])([{isIntersecting:value}]);
  show(0,true);show(1,false);await flush();
  sound.click();await flush();
  assert.equal(vimeo.muted,false);assert.equal(native.muted,true);
  delayMute=true;
  show(0,false);show(1,true);await flush();
  assert.equal(sound.textContent,'(Mute)','page preference survives scrolling');
  assert.equal(native.muted,true,'new video waits for old mute acknowledgement');
  delayMute=false;releaseMute();await flush();
  assert.equal(vimeo.muted,true);assert.equal(native.muted,false);
  show(0,true);await flush();
  boxes[0].querySelector('button').click();await flush(); // pause
  boxes[0].querySelector('button').click();await flush(); // user selects Vimeo
  assert.equal(vimeo.muted,false);assert.equal(native.muted,true);
  const mute=vimeo.setMuted.bind(vimeo);
  let rejectMute=true;
  vimeo.setMuted=value=>value&&rejectMute ? Promise.reject(Error('mute failed')) : mute(value);
  show(0,false);await flush();
  assert.equal(native.muted,true,'failed mute prevents a second audible video');
  assert.equal(sound.textContent,'(Sound)');
  assert.match(sound.title,/retry/);
  rejectMute=false;
  show(0,true);await flush();
  sound.click();await flush();
  sound.click();sound.click();sound.click();await flush();
  assert.equal(sound.textContent,'(Sound)');assert.equal(vimeo.muted,true);assert.equal(native.muted,true);
  sound.click();await flush();
  delayMute=true;show(0,false);await flush();
  assert.ok(releaseMute);
  cleanup();delayMute=false;releaseMute();await flush();
  assert.equal(native.muted,true,'cleanup cancels queued unmute');
  assert.equal(overlap,false);
  assert.equal(root.querySelector('.detail-sound-control'),null);
  dom.window.close();
});

test('image/text projects do not create page audio controls',()=>{
  const dom=new JSDOM('<main><p>Text-only project</p></main>',{runScripts:'outside-only'});
  const w=dom.window,root=w.document.querySelector('main');
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..','project-video.js'),'utf8'),dom.getInternalVMContext());
  w.initProjectVideos(root)();
  assert.equal(root.querySelector('.detail-sound-control'),null);
  dom.window.close();
});
