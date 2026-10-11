'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {JSDOM} = require('../studio/node_modules/jsdom');
const flush = () => new Promise(setImmediate);
for (const type of ['mp4']) for (const touch of [false, true]) for (const playback of ['manual', 'autoplay']) {
  test(`Project ${type}, ${touch ? 'touch' : 'desktop'}, ${playback}: playback, audio, visibility and cleanup`, async () => {
    const dom = new JSDOM('<main></main>', {url:'https://preview.test', runScripts:'outside-only', pretendToBeVisual:true});
    const w = dom.window;
    let intersection, destroyed = false;
    const calls = [];
    w.matchMedia = () => ({matches:touch});
    w.ResizeObserver = class {observe() {} disconnect() {}};
    w.IntersectionObserver = class {constructor(fn) {intersection=fn;} observe() {} disconnect() {}};
    let player;
    for (const file of ['project-modules.js','project-video.js']) vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),dom.getInternalVMContext());
    const root=w.document.querySelector('main');
    root.innerHTML=w.renderProjectModule({type:'full',slots:[{type, playback, src:'https://preview.test/movie.mp4'}]});
    const box=root.querySelector('.project-video'), frame=box.querySelector('video'), button=box.querySelector('button');
    if(type==='mp4') {
      player=frame;
      frame.play=()=>{calls.push('play');frame.dispatchEvent(new w.Event('play'));return Promise.resolve();};
      frame.pause=()=>{calls.push('pause');frame.dispatchEvent(new w.Event('pause'));};
      frame.load=()=>{destroyed=true;};
    }
    const cleanup=w.initProjectVideos(root);
    for (const video of root.querySelectorAll("video")) {Object.defineProperty(video,"videoWidth",{value:160});Object.defineProperty(video,"videoHeight",{value:90});video.dispatchEvent(new w.Event("loadedmetadata"));}
    await flush();
    assert.ok(!calls.includes('play'),'offscreen startup cannot play');
    intersection([{isIntersecting:true}]);await flush();
    const sound=root.querySelector('.detail-sound-control');
    const auto=playback==='autoplay';
    assert.equal(box.dataset.videoPlaying,String(auto));
    assert.equal(sound.textContent,'(Sound)');
    assert.equal(player.muted,true);
    assert.equal(frame.autoplay,auto);assert.equal(frame.playsInline,true);assert.equal(frame.controls,false);
    assert.equal(frame.loop,playback==='autoplay');
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
  for(const file of ['project-modules.js','project-video.js']) vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),dom.getInternalVMContext());
  root.innerHTML=w.renderProjectModule({type:'half-half',slots:[
    {type:'mp4',src:'https://preview.test/first.mp4',playback:'autoplay'},
    {type:'mp4',src:'https://preview.test/second.mp4',playback:'autoplay'}
  ]});
  const boxes=[...root.querySelectorAll('.project-video')], native=boxes[1].querySelector('video');
  for (const video of root.querySelectorAll('video')) {
    video.play=()=>{video.dispatchEvent(new w.Event('play'));return Promise.resolve();};
    video.pause=()=>video.dispatchEvent(new w.Event('pause'));video.load=()=>{};
    let muted=true;
    Object.defineProperty(video,'muted',{get:()=>muted,set:value=>{muted=value;check();}});
    players.push(video);
  }
  const adapt=w.nativeProjectPlayer;
  w.nativeProjectPlayer=video=>{
    const player=adapt(video);
    const mute=player.setMuted;
    player.setMuted=async value=>{
      if(video===players[0] && value && delayMute) await new Promise(resolve=>{releaseMute=resolve;});
      return mute(value);
    };
    video.audioPlayer=player;
    return player;
  };
  const cleanup=w.initProjectVideos(root);
    for (const video of root.querySelectorAll("video")) {Object.defineProperty(video,"videoWidth",{value:160});Object.defineProperty(video,"videoHeight",{value:90});video.dispatchEvent(new w.Event("loadedmetadata"));}await flush();
  const first=players[0], sound=root.querySelector('.detail-sound-control');
  const show=(index,value)=>intersections.get(boxes[index])([{isIntersecting:value}]);
  show(0,true);show(1,false);await flush();
  sound.click();await flush();
  assert.equal(first.muted,false);assert.equal(native.muted,true);
  delayMute=true;
  show(0,false);show(1,true);await flush();
  assert.equal(sound.textContent,'(Mute)','page preference survives scrolling');
  assert.equal(native.muted,true,'new video waits for old mute acknowledgement');
  delayMute=false;releaseMute();await flush();
  assert.equal(first.muted,true);assert.equal(native.muted,false);
  show(0,true);await flush();
  boxes[0].querySelector('button').click();await flush(); // pause
  boxes[0].querySelector('button').click();await flush(); // user selects first video
  assert.equal(first.muted,false);assert.equal(native.muted,true);
  const mute=first.audioPlayer.setMuted.bind(first);
  let rejectMute=true;
  first.audioPlayer.setMuted=value=>value&&rejectMute ? Promise.reject(Error('mute failed')) : mute(value);
  show(0,false);await flush();
  assert.equal(native.muted,true,'failed mute prevents a second audible video');
  assert.equal(sound.textContent,'(Sound)');
  assert.match(sound.title,/retry/);
  rejectMute=false;
  show(0,true);await flush();
  sound.click();await flush();
  sound.click();sound.click();sound.click();await flush();
  assert.equal(sound.textContent,'(Sound)');assert.equal(first.muted,true);assert.equal(native.muted,true);
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

test('a visible manual Play survives stale offscreen notifications and late media readiness events', async () => {
  const dom = new JSDOM('<main></main>', {url:'https://preview.test',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,root=w.document.querySelector('main');
  let intersection,visible=false,plays=0,pauses=0;
  w.ResizeObserver=class {observe(){} disconnect(){}};
  w.IntersectionObserver=class {constructor(fn){intersection=fn}observe(){}disconnect(){}};
  for(const file of ['project-modules.js','project-video.js'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),dom.getInternalVMContext());
  root.innerHTML=w.renderProjectModule({type:'full',slots:[{type:'mp4',src:'https://preview.test/video.mp4',playback:'manual'}]});
  const box=root.querySelector('.project-video'),v=box.querySelector('video'),button=box.querySelector('button');
  box.getBoundingClientRect=()=>({width:640,height:360,left:0,right:640,top:visible?0:2000,bottom:visible?360:2360});
  v.play=()=>{plays++;v.dispatchEvent(new w.Event('play'));return Promise.resolve()};
  v.pause=()=>{pauses++;v.dispatchEvent(new w.Event('pause'))};v.load=()=>{};
  Object.defineProperty(v,'videoWidth',{value:1920});Object.defineProperty(v,'videoHeight',{value:1080});
  const cleanup=w.initProjectVideos(root);
  try {
    v.dispatchEvent(new w.Event('loadedmetadata'));intersection([{isIntersecting:false}]);
    visible=true; // Current geometry changed before the observer catches up.
    button.click();await flush();
    assert.equal(plays,1);assert.equal(button.textContent,'(Pause)');
    const before=pauses;
    intersection([{isIntersecting:false}]);v.dispatchEvent(new w.Event('loadeddata'));
    assert.equal(pauses,before,'stale visibility and late data cannot immediately stop the visible video');
    button.click();await flush();assert.equal(button.textContent,'(Play)');
    button.click();await flush();assert.equal(plays,2);
    visible=false;intersection([{isIntersecting:true}]);assert.equal(button.textContent,'(Play)','current offscreen geometry wins over a stale visible notification');
  } finally {cleanup();dom.window.close()}
});
