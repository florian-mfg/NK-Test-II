'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
for(const engine of ['webkit','chromium'])test(`${engine}: portrait Crop video paints only within its cell across scroll and resize`,{skip:!process.env.BROWSER_TEST,timeout:90000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core'),encoder=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const recorder=await encoder.newPage(),portrait=await require('./native-media-fixture.cjs').recordMP4(recorder,90,160),landscape=await require('./native-media-fixture.cjs').recordMP4(recorder,160,90);await encoder.close();
 const b=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try{
 const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
 await p.route('https://fixture.test/**',async r=>{await new Promise(resolve=>setTimeout(resolve,100));return r.request().url().endsWith('.svg')?r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1248"><path fill="#00aa00" d="M0 0h960v1248H0z"/></svg>'}):r.fulfill({body:r.request().url().includes('portrait')?portrait:landscape,contentType:'video/mp4'});});
 await p.setContent('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><main class="project-modules"></main>');
 await p.addStyleTag({path:path.join(__dirname,'../style.css')});await p.addStyleTag({content:'html{scroll-behavior:auto}body{background:#fff}.project-video-toggle{visibility:hidden}'});
 await p.addScriptTag({path:path.join(__dirname,'../project-modules.js')});await p.addScriptTag({path:path.join(__dirname,'../project-video.js')});
 await p.evaluate(()=>{const image={type:'image',src:'https://fixture.test/green.svg'},video=src=>({type:'mp4',src:'https://fixture.test/'+src+'.mp4',playback:'autoplay'});document.querySelector('main').innerHTML=renderProjectModules([{type:'full',height:'small',slots:[image]},{type:'half-quarter-quarter',height:'medium',order:'reverse',slots:[video('portrait'),image,null]},{type:'full',height:'small',slots:[image]},{type:'full',height:'medium',slots:[video('landscape')]},{type:'full',height:'small',slots:[image]},{type:'half-half',height:'auto',slots:[{...video('portrait'),mediaDisplay:'auto'},null]}]);for(const i of document.images)i.loading='eager';initProjectVideos(document.querySelector('main'));});
 await p.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.readyState>=2)&&[...document.images].every(i=>i.complete));
 let probes=0;
 for(const width of [1440,1025,390,1440]){
 await p.setViewportSize({width,height:900});await p.waitForTimeout(150);
 for(const rowIndex of [1,3,1]){
 const row=p.locator('.project-module').nth(rowIndex);await row.evaluate(n=>scrollTo(0,n.getBoundingClientRect().top+scrollY));
 await p.waitForTimeout(150);
 const data=await row.evaluate(n=>{const video=n.querySelector('video'),r=video.getBoundingClientRect(),slot=video.closest('.project-slot').getBoundingClientRect();return {slot:{x:slot.x,y:slot.y,w:slot.width,h:slot.height,b:slot.bottom},video:{x:r.x,y:r.y,w:r.width,h:r.height},clip:getComputedStyle(video).clip,border:getComputedStyle(video).borderWidth,padding:getComputedStyle(video).padding,outline:getComputedStyle(video).outlineStyle};});
 assert.equal(data.border,'0px');assert.equal(data.padding,'0px');assert.equal(data.outline,'none');assert.notEqual(data.clip,'auto');
 // Place the boundary in the viewport and probe the neighboring green image.
 for(const edge of ['top','bottom']){
 await row.evaluate((n,edge)=>{const v=n.querySelector('video').closest('.project-slot').getBoundingClientRect();scrollTo(0,scrollY+(edge==='top'?v.top:v.bottom)-450);},edge);await p.waitForTimeout(80);
 const points=await row.evaluate((n,edge)=>{const s=n.querySelector('video').closest('.project-slot').getBoundingClientRect();return [{x:s.left+s.width/2,y:(edge==='top'?s.top-6:s.bottom+6),expected:[0,170,0]},{x:s.left+s.width/2,y:(edge==='top'?s.top+6:s.bottom-6),expected:[85,85,85]}];},edge);
 // On mobile the portrait video follows the image within the same stacked row;
 // the surrounding modules are still green at its upper and lower edges.
 const png=await p.screenshot();const colors=await p.evaluate(async({png,points})=>{const i=new Image();i.src=png;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return points.map(pt=>[...ctx.getImageData(Math.round(pt.x*2),Math.round(pt.y*2),1,1).data].slice(0,3));},{png:'data:image/png;base64,'+png.toString('base64'),points});
 colors.forEach((color,i)=>{assert.ok(color.every((v,k)=>Math.abs(v-points[i].expected[k])<8),`${engine}/${width}/row${rowIndex}/${edge}: ${JSON.stringify({points,colors,data})}`);probes++;});
 }
 }
 }
 console.log(JSON.stringify({engine,probes}));
 }finally{await b.close();}
});
