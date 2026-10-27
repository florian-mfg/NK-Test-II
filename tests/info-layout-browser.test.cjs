const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.join(__dirname,'..'),out=path.join(root,'reports','info-document-scroll');
for(const engine of ['chromium','webkit'])test(`${engine}: Info document scrolling, intrinsic long text and preserved normal baselines`,{skip:!process.env.BROWSER_TEST,timeout:120000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 fs.mkdirSync(out,{recursive:true});const results=[];
 const order=['contactLinks','work','cv','skills','news','publications','selectedClients'];
 const labels={contactLinks:'Contact',work:'Teaching',cv:'CV',skills:'Services',news:'News',publications:'Publications',selectedClients:'Selected Clients'};
 const normal='A Berlin based multidisciplinary designer, working in various fields of photography, generativity, motion design and cgi.';
 try{
 for(const [width,height] of [[1920,1080],[1440,600],[1440,900],[1440,1200],[1024,768],[760,900],[844,390],[430,932],[390,844],[320,568]])for(const kind of ['short','normal','long','additional']){
  const mobile=width<=700,page=await browser.newPage({viewport:{width,height},hasTouch:mobile,isMobile:mobile&&engine==='chromium'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const introduction=kind==='short'?'A Berlin based designer.':kind==='long'?Array(22).fill(normal).join(' '):normal;
  const project={_id:'alignment-project',_type:'project',slug:{current:'alignment-project'},title:'Baseline reference',category:'Video',modules:[],selectedWorkPreview:{composition:[{_type:'preview-full',type:'full',height:'viewport',slots:[{type:'image',image:{asset:{_ref:'image-fixture-160x90-svg'}}}]}]}};
  const raw={projects:[project],selectedWork:{_id:'selectedWork',_type:'selectedWork',video:[{_ref:project._id}],commissioned:[],graphic:[]},siteSettings:{_id:'siteSettings',_type:'siteSettings',brandName:'Nicolas Kawohl',email:'hello@example.com'},infoPage:{_id:'infoPage',_type:'infoPage',introduction,additionalIntroduction:kind==='additional'?'Additional CMS introduction. '+normal.repeat(3):'',sectionOrder:order.map(section=>({section})),workLabel:'Teaching',skillsLabel:'Services',newsLabel:'News',publicationsLabel:'Publications',cv:[{period:'2026',text:'Exhibition and research'}],work:['Teaching and workshops','Berlin'],skills:['Photography','Motion design','CGI'],news:[{title:'An exhibition',url:'https://example.com/news'}],publications:[{title:'A publication',url:'https://example.com/book'}],contactLinks:[{label:'Write',destination:'email'}],selectedClients:Array.from({length:60},(_,i)=>'Client '+(i+1))}};
  let serveBefore=false;
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='preview.test')return r.fulfill({path:serveBefore && ['/app.js','/style.css'].includes(u.pathname)?path.join(process.env.INFO_BEFORE_ROOT,u.pathname):path.join(root,u.pathname==='/'?'index.html':u.pathname)});if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:raw}});if(u.hostname==='cdn.sanity.io')return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"/>'});return r.abort();});
  await page.goto('https://preview.test/#info');await page.waitForFunction(()=>document.querySelector('.info-intro')?.textContent.startsWith('A Berlin'));await page.waitForFunction(()=>document.querySelector('.info-work h2')?.textContent==='Teaching');await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const measure=()=>page.evaluate(()=>{
   const info=document.querySelector('.info'),intro=info.querySelector('.info-intro'),group=info.querySelector('.info-introduction'),columns=info.querySelector('.info-columns'),clients=info.querySelector('.info-clients');
   const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
   const last=group.querySelector('.info-intro-content').lastElementChild,scroller=group.querySelector('.info-intro-scroll')||group.querySelector('.info-intro-content');
   const baseline=n=>{const m=document.createElement('span');Object.assign(m.style,{display:'inline-block',width:'0',height:'0',verticalAlign:'baseline'});n.prepend(m);const y=m.getBoundingClientRect().top;m.remove();return y;};
   const baselines=[baseline(info.querySelector('.info-details h2')),baseline(info.querySelector('.info-details section p')),baseline(clients.querySelector('h2'))];
   return {contentHeight:group.querySelector('.info-intro-content').getBoundingClientRect().height,nested:[...info.querySelectorAll('*')].filter(n=>/(auto|scroll|hidden|clip)/.test(getComputedStyle(n).overflowY)).map(n=>n.className),scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight,scrollTop:scroller.scrollTop,overflowY:getComputedStyle(scroller).overflowY,baselines,offset:parseFloat(getComputedStyle(info).getPropertyValue('--info-baseline-offset'))||0,info:rect(info),intro:rect(intro),group:rect(group),columns:rect(columns),clients:rect(clients),last:rect(last),pad:parseFloat(getComputedStyle(info).paddingLeft),gap:parseFloat(getComputedStyle(group).paddingBottom),introFont:parseFloat(getComputedStyle(intro).fontSize),sectionFont:parseFloat(getComputedStyle(clients).fontSize),family:getComputedStyle(intro).fontFamily,weight:getComputedStyle(intro).fontWeight,introLine:parseFloat(getComputedStyle(intro).lineHeight),headingOrder:[...info.querySelectorAll('h2')].map(n=>n.textContent),contentX:[...info.querySelectorAll('.info-details section p')].map(n=>n.getBoundingClientRect().x),labelX:[...info.querySelectorAll('.info-details h2')].map(n=>n.getBoundingClientRect().x),docHeight:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth,position:getComputedStyle(columns).position,header:rect(document.querySelector('.site-header')),contact:info.querySelector('.info-contact a').href,news:info.querySelector('.info-news a').href};
  });
  let before=null;
  if(process.env.INFO_BEFORE_ROOT && ['short','normal'].includes(kind)) {
    serveBefore=true;
    await page.reload();await page.waitForFunction(()=>document.querySelector('.info-work h2')?.textContent==='Teaching');await page.evaluate(()=>document.fonts.ready);
    before=await measure();
    serveBefore=false;
    await page.reload();await page.waitForFunction(()=>document.querySelector('.info-work h2')?.textContent==='Teaching');await page.evaluate(()=>document.fonts.ready);
  }
  const data=await measure();
  assert.deepEqual(data.nested,[],'no nested scrolling or clipping anywhere in Info');
  assert.equal(await page.locator('.info-intro-scroll').count(),0,'scroll wrapper removed');
  assert.ok(data.intro.y>=data.group.y-.1,'all text begins below navigation');
  const target=height/2+data.offset;
  const expected=Math.max(target,data.group.y+data.contentHeight+data.gap);
  assert.ok(Math.abs(data.columns.y-expected)<.25,'rows move down only by required content height');
  if(before) {
    if(before.scrollHeight<=before.clientHeight+1) {
      assert.ok(Math.abs(data.columns.y-before.columns.y)<.1,'normal lower-section position unchanged');
      assert.ok(Math.abs(data.baselines[0]-before.baselines[0])<.1,'normal baseline unchanged');
    }
    for(const key of ['introFont','introLine','sectionFont','gap'])assert.equal(data[key],before[key],`${key} preserved`);
    assert.deepEqual(data.contentX,before.contentX);assert.deepEqual(data.labelX,before.labelX);
  }
  assert.equal(data.overflow,false,JSON.stringify({width,height,kind,data}));assert.equal(data.intro.x,data.pad);const previousFont=mobile?Math.min(40,Math.max(26,width*.068)):Math.min(64,Math.max(28,width*.032));assert.ok(Math.abs(data.introFont-(mobile?Math.max(22,Math.min(30,width*.056)):Math.max(14,previousFont*.5)))<.01,'responsive introduction size');assert.equal(data.weight,'300');assert.match(data.family,/WF Raglan Neue/);assert.ok(Math.abs(data.introLine/data.introFont-1.1)<.01);assert.ok(data.group.y>data.header.bottom,'visible introduction clears navigation');
  assert.ok(Math.abs(data.intro.width-(width-2*data.pad)*(mobile?1:8/12))<.1,'existing track width');
  assert.ok(data.columns.y>=data.last.bottom+data.gap-.2,JSON.stringify({width,height,kind,data}));assert.equal(data.position,'static');
  if(!mobile){assert.ok(data.columns.y>=height/2+data.offset-.2);assert.ok(Math.abs(data.clients.x-(data.pad+(width-2*data.pad)*.51))<.1,'clients stays in existing right column');}
  else {assert.ok(data.baselines[0]>=height/2-.2);assert.ok(Math.abs(data.columns.y-data.last.bottom-data.gap)<.2,'mobile introduction bottom anchor');}
  assert.deepEqual(data.headingOrder,order.map(id=>labels[id]));assert.ok(data.contentX.every(x=>Math.abs(x-data.contentX[0])<.1));assert.ok(data.labelX.every(x=>Math.abs(x-data.pad)<.1));assert.equal(data.contact,'mailto:hello@example.com');assert.equal(data.news,'https://example.com/news');
  assert.ok(data.docHeight>height,'content controls page height');await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await page.waitForFunction(()=>scrollY>0);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>scrollY===0);
  if((width===1440&&height===900)||width===390)await page.screenshot({path:path.join(out,`${engine}-${width}x${height}-${kind}.png`),fullPage:true});
  {
   assert.ok(Math.abs(data.last.bottom-(data.columns.y-data.gap))<.1,'last line stays on the fixed bottom anchor');
   const prior=results.find(r=>r.width===width&&r.height===height&&r.kind==='short');
   if(prior && kind==='long') {
     assert.ok(data.columns.y>prior.columnsTop,'long text moves lower sections downward');
     assert.ok(data.docHeight>prior.documentHeight,'long text expands document');
   }
  }
  // Wheel over the introduction must scroll the document, not a child.
  if(kind==='long') {
    await page.mouse.move(data.pad+40,Math.min(height-30,data.group.y+80));
    await page.mouse.wheel(0,240);await page.waitForFunction(()=>scrollY>0);
    assert.equal(await page.locator('.info-intro-content').evaluate(n=>n.scrollTop),0);
    assert.ok(Math.abs(await page.locator('.info-columns').evaluate(n=>n.getBoundingClientRect().top+scrollY)-data.columns.y)<.2,'scrolling does not shift document layout');
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>scrollY===0);
    if(mobile && engine==='chromium') {
      const cdp=await page.context().newCDPSession(page),x=width/2,y=height*.7;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y}]});
      for(let step=1;step<=6;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x,y:y-step*25}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForFunction(()=>scrollY>0);
      await cdp.detach();
      await page.waitForTimeout(150);
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    }
  }
  if(width===1440&&kind==='normal'){
   await page.setViewportSize({width:390,height:844});assert.deepEqual(await page.locator('.info h2').allTextContents(),order.map(id=>labels[id]));await page.setViewportSize({width,height});assert.ok(Math.abs(await page.locator('.info-columns').evaluate(n=>n.getBoundingClientRect().y-parseFloat(getComputedStyle(n.closest('.info')).getPropertyValue('--info-baseline-offset')))-height/2)<.2);
  }
  let workBaseline=null;
  if(!mobile){
   await page.goto('https://preview.test/#work/video');await page.waitForSelector('.project-title');await page.evaluate(()=>document.fonts.ready);
   const work=await page.locator('.project-title > span').first().evaluate(n=>{const m=document.createElement('span');Object.assign(m.style,{display:'inline-block',width:'0',height:'0',verticalAlign:'baseline'});n.prepend(m);const baseline=m.getBoundingClientRect().top;m.remove();const r=n.parentElement.getBoundingClientRect();return {baseline,center:r.top+r.height/2,font:getComputedStyle(n).font,height:r.height,transform:getComputedStyle(n.parentElement).transform,scrollY};});
   assert.ok(Math.abs(work.center-height/2)<.5,JSON.stringify({width,height,kind,work,html:await page.locator('.project-module-preview').first().evaluate(n=>({height:n.getBoundingClientRect().height,html:n.outerHTML.slice(0,180)}))}));workBaseline=work.baseline;
   for(const baseline of data.baselines)assert.ok(Math.abs(baseline-work.baseline-(data.columns.y-target))<.1,JSON.stringify({width,height,kind,baseline,work,data}));
  }
  const menuMeasurements=[];
  if(mobile && kind==='normal') {
    for(const route of ['info','work/video','archive','project/alignment-project']) {
      await page.evaluate(route=>location.hash=route,route);
      await page.waitForTimeout(80);
      const measure=selector=>page.locator(selector).evaluate(n=>{
        const m=document.createElement('span');Object.assign(m.style,{display:'inline-block',width:'0',height:'0',verticalAlign:'baseline'});n.prepend(m);
        const r=n.getBoundingClientRect(),baseline=m.getBoundingClientRect().top;m.remove();const s=getComputedStyle(n);return {x:r.x,y:r.y,right:r.right,baseline,font:s.fontSize,line:s.lineHeight};
      });
      const logo=await measure('.site-header .brand'),button=await measure('.mobile-menu-toggle');
      await page.locator('.mobile-menu-toggle').click();
      const menuLogo=await measure('.mobile-menu-header .brand'),close=await measure('.mobile-menu-close');
      for(const key of ['x','y','baseline'])assert.ok(Math.abs(logo[key]-menuLogo[key])<.1,JSON.stringify({route,key,logo,menuLogo}));
      for(const key of ['right','y','baseline'])assert.ok(Math.abs(button[key]-close[key])<.1,JSON.stringify({route,key,button,close}));
      assert.equal(logo.font,menuLogo.font);assert.equal(button.font,close.font);assert.equal(button.line,close.line);
      await page.locator('.mobile-menu-close').click();
      assert.deepEqual(await measure('.site-header .brand'),logo);
      menuMeasurements.push({route,logo,menuLogo,button,close});
    }
    await page.locator('.mobile-menu-toggle').click();await page.locator('.mobile-menu-header .brand').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>location.hash==='#home'&&!document.querySelector('.mobile-menu').open);
  }
  assert.deepEqual(errors,[]);results.push({width,height,kind,menuMeasurements,introductionTop:data.intro.y,introductionBottom:data.last.bottom,infoBaselines:data.baselines,workBaseline,baselineOffset:data.offset,beforeColumnsTop:before?.columns.y??null,beforeBaselines:before?.baselines??null,gapBefore:mobile?null:3*Math.min(22.88,Math.max(13.2,width*.01056)),gapAfter:data.gap,introFont:data.introFont,sectionFont:data.sectionFont,introWidth:data.intro.width,columnsTop:data.columns.y,documentHeight:data.docHeight});await page.close();
 }
 fs.writeFileSync(path.join(out,`${engine}.json`),JSON.stringify(results,null,2));console.log(JSON.stringify({engine,cases:results.length,baselineComparisons:results.filter(r=>r.beforeBaselines).length,maxBaselineChange:Math.max(...results.filter(r=>r.beforeBaselines).map(r=>Math.abs(r.infoBaselines[0]-r.beforeBaselines[0])))}));
 }finally{await browser.close();}
});
