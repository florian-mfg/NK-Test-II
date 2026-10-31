'use strict';
// Maintained replacement for the reverted shadow design.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
for(const engine of ['webkit','chromium'])test(`${engine}: dynamic Frontpage images/video, no shadow, fixed other routes`,{skip:!process.env.BROWSER_TEST,timeout:90000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const encoder=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),recorder=await encoder.newPage();
 const bytes=Buffer.from(await recorder.evaluate(async()=>{const c=document.createElement('canvas');c.width=160;c.height=90;const x=c.getContext('2d'),stream=c.captureStream(20),chunks=[],m=new MediaRecorder(stream,{mimeType:'video/mp4'});m.ondataavailable=e=>chunks.push(e.data);const done=new Promise(r=>m.onstop=r);m.start();const start=performance.now(),draw=()=>{x.fillStyle=Math.floor((performance.now()-start)/900)%2?'#fff':'#000';x.fillRect(0,0,160,90);};draw();const timer=setInterval(draw,40);await new Promise(r=>setTimeout(r,3600));m.stop();await done;clearInterval(timer);stream.getTracks().forEach(t=>t.stop());return btoa(String.fromCharCode(...new Uint8Array(await new Blob(chunks).arrayBuffer())));}), 'base64');await encoder.close();
 const b=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),root=path.join(__dirname,'..');
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='preview.test')return r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname)});if(u.hostname==='fixture.test')return r.fulfill(u.pathname.endsWith('.mp4')?{body:bytes,contentType:'video/mp4',headers:{'access-control-allow-origin':'*'}}:{body:`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="${u.pathname.includes('dark')?'#000':'#fff'}"/></svg>`,contentType:'image/svg+xml',headers:{'access-control-allow-origin':'*'}});if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:{}}});return r.fulfill({body:''});});
 await p.addInitScript(()=>{window.videoReadbacks=0;const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(source?.tagName==='VIDEO')window.videoReadbacks++;return draw.call(this,source,...args);};});
 await p.goto('https://preview.test/#home');await p.waitForFunction(()=>sanityLoadSettled&&document.querySelector('.frontpage-fade')?.dataset.ready==='true');
 const colors=expected=>p.waitForFunction(expected=>[...document.querySelectorAll('.site-header :is(.brand,.work-toggle,.main-nav>a,.mobile-menu-toggle)')].filter(n=>n.getClientRects().length).every(n=>getComputedStyle(n).color===expected),expected);
 const insert=async kind=>{await p.evaluate(kind=>{const layer=document.querySelector('.frontpage-fade');layer.replaceChildren();if(kind==='empty'){Contrast.refresh();return;}const n=document.createElement(kind==='video'?'video':'img');n.className='frontpage-fade-media';n.style.cssText='left:0;top:0;width:100%;height:100%;opacity:1';n.crossOrigin='anonymous';if(kind==='video'){n.muted=true;n.loop=true;n.autoplay=true;n.playsInline=true;}n.src='https://fixture.test/'+(kind==='video'?'moving.mp4':kind+'.svg');layer.append(n);if(kind==='video')n.play();},kind);};
 for(const width of [1440,390]){
 await p.setViewportSize({width,height:900});
 for(const [kind,color]of [['empty','rgb(0, 0, 0)'],['light','rgb(0, 0, 0)'],['dark','rgb(255, 255, 255)'],['light','rgb(0, 0, 0)']]){await insert(kind);await colors(color);assert.ok((await p.locator('.site-header a,.site-header button').evaluateAll(ns=>ns.filter(n=>n.getClientRects().length).map(n=>getComputedStyle(n).textShadow))).every(s=>s==='none'));}
 await insert('video');await colors('rgb(255, 255, 255)');await colors('rgb(0, 0, 0)');await colors('rgb(255, 255, 255)');
 const reads=await p.evaluate(()=>videoReadbacks);await p.waitForTimeout(1400);const delta=await p.evaluate(()=>videoReadbacks)-reads;assert.ok(delta>=2&&delta<=6,'video readback is throttled to at most four per second');
 }
 await p.evaluate(()=>{const original=Contrast.refresh;window.brushContrastCalls=0;Contrast.refresh=()=>{brushContrastCalls++;original();};document.querySelector('.frontpage-fade').replaceChildren();});
 await p.setViewportSize({width:1440,height:900});await p.mouse.move(200,200);await p.mouse.move(700,200,{steps:10});await p.waitForFunction(()=>brushContrastCalls>0);
 await p.locator('.main-nav>a[href="#archive"]').click();await p.waitForSelector('.archive');
 for(const route of ['archive','work/video']){await p.evaluate(r=>location.hash='#'+r,route);await p.waitForFunction(r=>document.body.classList.contains(r==='archive'?'is-index':'is-work'),route);await colors('rgb(255, 255, 255)');}
 await p.evaluate(()=>location.hash='#info');await p.waitForSelector('.info');await colors('rgb(0, 0, 0)');
 }finally{await b.close();}
});
