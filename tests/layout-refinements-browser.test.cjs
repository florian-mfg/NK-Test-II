const test=require('node:test'), assert=require('node:assert/strict'), path=require('node:path'), fs=require('node:fs');
for(const engine of ['chromium','webkit']) test(`${engine}: equal Selected Work text rows on desktop and mobile`,{skip:!process.env.BROWSER_TEST,timeout:60000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true}), results=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{
   const u=new URL(r.request().url());
   if(u.hostname==='preview.test')return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});
   if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:{projects:[],infoPage:{_id:'infoPage',_type:'infoPage',introduction:'Artist Statement'}}}});
   return r.abort();
  });
  await page.goto('https://preview.test/#info');await page.evaluate(()=>document.fonts.ready);
  for(const width of [1440,1920,760,390,320]){
   await page.setViewportSize({width,height:900});
   const mobile=width<=700;
   if(mobile){await page.locator('.mobile-menu-toggle').click();await page.locator('.mobile-menu-label').click();}
   else await page.locator('.work-toggle').hover();
   const measure=()=>page.evaluate(mobile=>{
    const root=document.querySelector(mobile?'.mobile-menu-work':'.work-menu');
    const nodes=[root.querySelector(mobile?'.mobile-menu-label':'.work-toggle'),...root.querySelectorAll('a')];
    const rows=nodes.map(n=>{
     const r=n.getBoundingClientRect(),s=getComputedStyle(n),marker=document.createElement('span');
     marker.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';n.prepend(marker);
     const baseline=marker.getBoundingClientRect().top;marker.remove();
     return{text:n.textContent,x:r.x,y:r.y,bottom:r.bottom,baseline,font:s.fontSize,line:s.lineHeight};
    });
    return {rows,gaps:rows.slice(1).map((r,i)=>r.y-rows[i].bottom),steps:rows.slice(1).map((r,i)=>r.baseline-rows[i].baseline),links:nodes.slice(1).map(n=>n.getAttribute('href')),
     other:[...document.querySelectorAll('.main-nav > a')].map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,font:getComputedStyle(n).fontSize}))};
   },mobile);
   const current=await measure();
   assert.deepEqual(current.rows.map(r=>r.text),['Selected Work','Video','Photography','Graphic']);
   assert.deepEqual(current.links,['#work/video','#work/commissioned','#work/graphic']);
   assert.ok(Math.max(...current.gaps)-Math.min(...current.gaps)<.06,JSON.stringify(current));
   assert.ok(Math.max(...current.steps)-Math.min(...current.steps)<.06,JSON.stringify(current));
   const old=await page.addStyleTag({content:'.work-submenu{padding-top:0;row-gap:0}.mobile-work-submenu{padding-top:0;row-gap:0}'});
   const prior=await measure();await old.evaluate(n=>n.remove());
   assert.deepEqual(current.other,prior.other,'unrelated navigation geometry preserved');
   assert.deepEqual(current.rows.map(r=>r.font),prior.rows.map(r=>r.font),'font sizes preserved');
   for(let i=0;i<3;i++)assert.ok(Math.abs(current.steps[i]/prior.steps[i]-1.25)<.003,JSON.stringify({current,prior}));
   current.previousSteps=prior.steps;
   results.push({width,mobile,...current});
   if(mobile){await page.locator('.mobile-menu-label').click();assert.equal(await page.locator('.mobile-work-submenu').isVisible(),false);await page.locator('.mobile-menu-close').click();}
   else {await page.mouse.move(400,300);assert.equal(await page.locator('.work-submenu').isVisible(),false);}
  }
  assert.deepEqual(errors,[]);
  const out=path.join(__dirname,'..','reports','credits-menu-refinements');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`${engine}-submenu.json`),JSON.stringify(results,null,2));
  console.log(JSON.stringify({engine,measurements:results}));
 }finally{await browser.close();}
});
