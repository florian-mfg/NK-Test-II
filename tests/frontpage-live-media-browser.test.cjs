// Reads public content/assets, serves only the local frontend; never writes to Sanity.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
for(const engine of ['chromium','webkit'])test(`${engine}: published Frontpage assets on local code and encoded video edges`,{skip:!process.env.LIVE_MEDIA_TEST,timeout:120000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core'),browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try{const base=process.env.SITE_BASE_URL||'https://florian-mfg.github.io/NK-Test-II/';const page=await browser.newPage({viewport:{width:1440,height:900}}),adapter=require('../sanity-data.js'),url=new URL(`https://${adapter.config.projectId}.apicdn.sanity.io/v${adapter.config.apiVersion}/data/query/${adapter.config.dataset}`);url.searchParams.set('query',adapter.query);url.searchParams.set('perspective','published');
 const response=await page.request.get(url.href);assert.ok(response.ok());const raw=await response.json();
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(r.request().url().startsWith(base))return r.fulfill({path:path.join(__dirname,'..',u.pathname.slice(new URL(base).pathname.length)||'index.html')});if(u.hostname.endsWith('apicdn.sanity.io'))return r.fulfill({json:raw});if(u.hostname==='cdn.sanity.io')return r.continue();return r.abort();});
 await page.goto(base+'#home');await page.waitForFunction(()=>document.querySelector('.frontpage-fade').dataset.ready==='true',null,{timeout:45000});
 const results=await page.evaluate(()=>JSON.parse(document.querySelector('.frontpage-fade').dataset.preparation));assert.ok(results.every(r=>r.status==='ready'),JSON.stringify(results));
 const sources=adapter.normalize(raw.result).homePage.media.filter(s=>s.type==='mp4'||s.type==='video');
 for(const source of sources){
  const samples=await page.evaluate(async src=>{
   const v=document.createElement('video');v.crossOrigin='anonymous';v.muted=true;v.playsInline=true;v.preload='auto';v.src=src;document.body.append(v);
   await new Promise((ok,fail)=>{v.onloadeddata=ok;v.onerror=fail;});
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=Math.round(640*v.videoHeight/v.videoWidth);const c=canvas.getContext('2d'),frames=[];
   for(const fraction of [0,.25,.5,.75]){
    const time=Math.max(.01,v.duration*fraction);v.currentTime=time;await new Promise(ok=>v.onseeked=ok);c.drawImage(v,0,0,canvas.width,canvas.height);const {data}=c.getImageData(0,0,canvas.width,canvas.height),w=canvas.width,h=canvas.height;
    const white=(x,y)=>{const i=(y*w+x)*4;return data[i]>245&&data[i+1]>245&&data[i+2]>245;};
    const row=y=>Array.from({length:w},(_,x)=>white(x,y)).filter(Boolean).length/w;
    const col=x=>Array.from({length:h},(_,y)=>white(x,y)).filter(Boolean).length/h;
    frames.push({time,whiteEdges:{top:row(0),bottom:row(h-1),left:col(0),right:col(w-1)},png:fraction===0?canvas.toDataURL():null});
   }
   const result={width:v.videoWidth,height:v.videoHeight,duration:v.duration,frames};v.pause();v.removeAttribute('src');v.load();v.remove();return result;
  },source.src);
  const out=process.env.RELEASE_REPORT_DIR||path.join(__dirname,'..','reports','frontpage-improvements');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`${engine}-published-frame.png`),Buffer.from(samples.frames[0].png.split(',')[1],'base64'));for(const f of samples.frames)delete f.png;
  fs.writeFileSync(path.join(out,`${engine}-published-audit.json`),JSON.stringify({src:source.src,results,samples},null,2));console.log(JSON.stringify({engine,src:source.src,results,samples}));
 }
 }finally{await browser.close();}
});
