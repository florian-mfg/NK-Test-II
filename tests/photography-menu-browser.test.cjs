const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
for(const engine of ['chromium','webkit'])test(`${engine}: Photography compatibility and halved menu gap`,{skip:!process.env.BROWSER_TEST,timeout:90000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const measurements=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const image={asset:{_ref:'image-fixture-160x90-svg'}};
  const projects=['one','two'].map((id,i)=>({_id:id,_type:'project',slug:{current:id},title:`Photo ${id}`,category:i?'commissioned':'Commissioned',description:'Commissioned editorial text',modules:[{type:'full',height:'viewport',slots:[{type:'image',image}]}],selectedWorkPreview:{composition:[{_type:'preview-full',type:'full',height:'viewport',slots:[{type:'image',image}]}]}}));
  const raw={projects,selectedWork:{_id:'selectedWork',_type:'selectedWork',video:[],commissioned:[{_ref:'two'},{_ref:'one'}],graphic:[]},navigation:{_id:'navigation',_type:'navigation',items:[{label:'Selected Work',destination:'work'},{label:'Index',destination:'archive'},{label:'Info',destination:'info'}],categories:[{label:'Commissioned',destination:'work/commissioned'},{label:'Graphic',destination:'work/graphic'},{label:'Video',destination:'work/video'}]}};
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='preview.test')return r.fulfill({path:path.join(__dirname,'..',u.pathname==='/'?'index.html':u.pathname)});if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:raw}});if(u.hostname==='cdn.sanity.io')return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"/>'});return r.abort();});
  await page.goto('https://preview.test/#work/commissioned');await page.waitForSelector('.work[data-source="sanity"]');await page.evaluate(()=>document.fonts.ready);
  assert.deepEqual(await page.locator('.project-preview:not([hidden])').evaluateAll(nodes=>nodes.map(n=>n.dataset.project)),['two','one']);
  assert.equal(await page.locator('.project-kind').textContent(),'Photography');
  const measure=()=>page.evaluate(()=>{
   const rect=n=>{const r=n.getBoundingClientRect();const m=document.createElement('span');Object.assign(m.style,{display:'inline-block',width:'0',height:'0',verticalAlign:'baseline'});n.prepend(m);const baseline=m.getBoundingClientRect().top;m.remove();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,baseline,font:getComputedStyle(n).fontSize,line:getComputedStyle(n).lineHeight};};
   const menu=document.querySelector('.mobile-menu');const items=[menu.querySelector('.mobile-menu-label'),...menu.querySelectorAll('nav a')].filter(n=>n.getClientRects().length).map(rect);
   return{logo:rect(document.querySelector('.site-header .brand')),toggle:rect(document.querySelector('.mobile-menu-toggle')),menuLogo:rect(menu.querySelector('.brand')),close:rect(menu.querySelector('.mobile-menu-close')),items,gap:items[0].y-menu.querySelector('.brand').getBoundingClientRect().bottom};
  });
  for(const [width,height] of [[320,568],[390,844],[430,932]]){
   await page.setViewportSize({width,height});
   for(const route of ['info','archive','work/commissioned','project/one']){
    await page.evaluate(route=>location.hash=route,route);await page.waitForTimeout(70);
    await page.locator('.mobile-menu-toggle').click();
    const after=await measure();
    const beforeStyle=await page.addStyleTag({content:'.mobile-menu nav { margin-top: calc(1.1 * var(--menu-text-size) + var(--pad)) !important; }'});
    const before=await measure();await beforeStyle.evaluate(n=>n.remove());
    assert.ok(Math.abs(after.gap-before.gap/2)<.05,JSON.stringify({width,route,before:before.gap,after:after.gap}));
    for(let i=1;i<after.items.length;i++)assert.ok(Math.abs((after.items[i].y-after.items[i-1].bottom)-(before.items[i].y-before.items[i-1].bottom))<.1,JSON.stringify({width,route,i,after:after.items,before:before.items}));
    for(const k of ['x','y','baseline','font','line'])assert.equal(after.logo[k],after.menuLogo[k]);
    for(const k of ['right','y','baseline','font','line'])assert.equal(after.toggle[k],after.close[k]);
    assert.deepEqual(after.items.map(n=>n.font),before.items.map(n=>n.font));
    assert.deepEqual(await page.locator('.mobile-work-submenu a').allTextContents(),['Video','Photography','Graphic']);
    if(!await page.locator('.mobile-work-submenu').isVisible())await page.locator('.mobile-menu-label').click();
    await page.locator('.mobile-menu-label').click();
    assert.equal(await page.locator('.mobile-work-submenu').isVisible(),false);
    await page.locator('.mobile-menu-label').click();
    await page.locator('.mobile-work-submenu [data-route="work/commissioned"]').click();
    await page.waitForFunction(()=>location.hash==='#work/commissioned'&&!document.querySelector('.mobile-menu').open && document.querySelector('.work[data-category="Commissioned"]'));
    assert.deepEqual(await page.locator('.project-preview:not([hidden])').evaluateAll(nodes=>nodes.map(n=>n.dataset.project)),['two','one']);
    measurements.push({width,height,route,gapBefore:before.gap,gapAfter:after.gap,logo:after.logo,menuLogo:after.menuLogo,toggle:after.toggle,close:after.close});
   }
   await page.locator('.mobile-menu-toggle').click();await page.locator('.mobile-menu-header .brand').click();
   await page.waitForFunction(()=>location.hash==='#home'&&!document.querySelector('.mobile-menu').open);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('.work-toggle').hover();
  assert.deepEqual(await page.locator('.work-submenu a').allTextContents(),['Video','Photography','Graphic']);
  await page.locator('.work-submenu [data-route="work/commissioned"]').click();
  await page.waitForSelector('.work[data-category="Commissioned"]');
  await page.locator('a.project-title').first().click();
  await page.waitForSelector('.detail');
  assert.equal(await page.locator('.header-overview').getAttribute('href'),'#work/commissioned');
  assert.equal(await page.locator('.detail').getAttribute('data-project-id'),'two');
  assert.match(await page.locator('.detail-info-popup').textContent(),/Commissioned editorial text/);
  assert.deepEqual(errors,[]);
  const out=path.join(__dirname,'..','reports','photography-menu');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`${engine}.json`),JSON.stringify(measurements,null,2));
  console.log(JSON.stringify({engine,measurements}));
 }finally{await browser.close();}
});
