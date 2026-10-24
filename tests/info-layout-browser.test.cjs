const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.join(__dirname,'..'),out=path.join(root,'reports','info-bottom-alignment');
for(const engine of ['chromium','webkit'])test(`${engine}: bottom-aligned Info introduction, fixed lower rows and safe overflow`,{skip:!process.env.BROWSER_TEST,timeout:120000},async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 fs.mkdirSync(out,{recursive:true});const results=[];
 const order=['contactLinks','work','cv','skills','news','publications','selectedClients'];
 const labels={contactLinks:'Contact',work:'Teaching',cv:'CV',skills:'Services',news:'News',publications:'Publications',selectedClients:'Selected Clients'};
 const normal='A Berlin based multidisciplinary designer, working in various fields of photography, generativity, motion design and cgi.';
 try{
 for(const [width,height] of [[1920,1080],[1440,600],[1440,900],[1440,1200],[1024,768],[760,900],[844,390],[390,844],[320,568]])for(const kind of ['short','normal','long','additional']){
  const mobile=width<=700,page=await browser.newPage({viewport:{width,height},hasTouch:mobile,isMobile:mobile}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const introduction=kind==='short'?'A Berlin based designer.':kind==='long'?Array(22).fill(normal).join(' '):normal;
  const project={_id:'alignment-project',_type:'project',slug:{current:'alignment-project'},title:'Baseline reference',category:'Video',modules:[],selectedWorkPreview:{composition:[{_type:'preview-full',type:'full',height:'viewport',slots:[{type:'image',image:{asset:{_ref:'image-fixture-160x90-svg'}}}]}]}};
  const raw={projects:[project],selectedWork:{_id:'selectedWork',_type:'selectedWork',video:[{_ref:project._id}],commissioned:[],graphic:[]},siteSettings:{_id:'siteSettings',_type:'siteSettings',brandName:'Nicolas Kawohl',email:'hello@example.com'},infoPage:{_id:'infoPage',_type:'infoPage',introduction,additionalIntroduction:kind==='additional'?'Additional CMS introduction. '+normal.repeat(3):'',sectionOrder:order.map(section=>({section})),workLabel:'Teaching',skillsLabel:'Services',newsLabel:'News',publicationsLabel:'Publications',cv:[{period:'2026',text:'Exhibition and research'}],work:['Teaching and workshops','Berlin'],skills:['Photography','Motion design','CGI'],news:[{title:'An exhibition',url:'https://example.com/news'}],publications:[{title:'A publication',url:'https://example.com/book'}],contactLinks:[{label:'Write',destination:'email'}],selectedClients:Array.from({length:60},(_,i)=>'Client '+(i+1))}};
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='preview.test')return r.fulfill({path:path.join(root,u.pathname==='/'?'index.html':u.pathname)});if(u.pathname.includes('/data/query/'))return r.fulfill({json:{result:raw}});if(u.hostname==='cdn.sanity.io')return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"/>'});return r.abort();});
  await page.goto('https://preview.test/#info');await page.waitForFunction(()=>document.querySelector('.info-intro')?.textContent.startsWith('A Berlin'));await page.waitForFunction(()=>document.querySelector('.info-work h2')?.textContent==='Teaching');await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const data=await page.evaluate(()=>{
   const info=document.querySelector('.info'),intro=info.querySelector('.info-intro'),group=info.querySelector('.info-introduction'),columns=info.querySelector('.info-columns'),clients=info.querySelector('.info-clients');
   const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
   const last=group.querySelector('.info-intro-content').lastElementChild,scroller=group.querySelector('.info-intro-scroll');
   const baseline=n=>{const m=document.createElement('span');Object.assign(m.style,{display:'inline-block',width:'0',height:'0',verticalAlign:'baseline'});n.prepend(m);const y=m.getBoundingClientRect().top;m.remove();return y;};
   const baselines=[baseline(info.querySelector('.info-details h2')),baseline(info.querySelector('.info-details section p')),baseline(clients.querySelector('h2'))];
   return {scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight,scrollTop:scroller.scrollTop,overflowY:getComputedStyle(scroller).overflowY,baselines,offset:parseFloat(getComputedStyle(info).getPropertyValue('--info-baseline-offset'))||0,info:rect(info),intro:rect(intro),group:rect(group),columns:rect(columns),clients:rect(clients),last:rect(last),pad:parseFloat(getComputedStyle(info).paddingLeft),gap:parseFloat(getComputedStyle(group).paddingBottom),introFont:parseFloat(getComputedStyle(intro).fontSize),sectionFont:parseFloat(getComputedStyle(clients).fontSize),family:getComputedStyle(intro).fontFamily,weight:getComputedStyle(intro).fontWeight,introLine:parseFloat(getComputedStyle(intro).lineHeight),headingOrder:[...info.querySelectorAll('h2')].map(n=>n.textContent),contentX:[...info.querySelectorAll('.info-details section p')].map(n=>n.getBoundingClientRect().x),labelX:[...info.querySelectorAll('.info-details h2')].map(n=>n.getBoundingClientRect().x),docHeight:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth,position:getComputedStyle(columns).position,header:rect(document.querySelector('.site-header')),contact:info.querySelector('.info-contact a').href,news:info.querySelector('.info-news a').href};
  });
  assert.equal(data.overflow,false,JSON.stringify({width,height,kind,data}));assert.equal(data.intro.x,data.pad);const previousFont=mobile?Math.min(40,Math.max(26,width*.068)):Math.min(64,Math.max(28,width*.032));assert.ok(Math.abs(data.introFont-Math.max(14,previousFont*.5))<.01,'half-sized responsive introduction');assert.equal(data.weight,'300');assert.match(data.family,/WF Raglan Neue/);assert.ok(Math.abs(data.introLine/data.introFont-1.1)<.01);assert.ok((mobile?data.intro.y:data.group.y)>data.header.bottom,'visible introduction clears navigation');
  assert.ok(Math.abs(data.intro.width-(width-2*data.pad)*(mobile?1:8/12))<.1,'existing track width');
  assert.ok(data.columns.y>=data.last.bottom+data.gap-.2,JSON.stringify({width,height,kind,data}));assert.equal(data.position,'static');
  if(!mobile){assert.ok(Math.abs(data.columns.y-(height/2+data.offset))<.2,JSON.stringify({width,height,kind,data}));assert.ok(Math.abs(data.clients.x-(data.pad+(width-2*data.pad)*.51))<.1,'clients stays in existing right column');}
  else assert.ok(Math.abs(data.columns.y-data.last.bottom-data.gap)<.2,'mobile uses natural content flow');
  assert.deepEqual(data.headingOrder,order.map(id=>labels[id]));assert.ok(data.contentX.every(x=>Math.abs(x-data.contentX[0])<.1));assert.ok(data.labelX.every(x=>Math.abs(x-data.pad)<.1));assert.equal(data.contact,'mailto:hello@example.com');assert.equal(data.news,'https://example.com/news');
  assert.ok(data.docHeight>height,'content controls page height');await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await page.waitForFunction(()=>scrollY>0);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>scrollY===0);
  if((width===1440&&height===900)||width===390)await page.screenshot({path:path.join(out,`${engine}-${width}x${height}-${kind}.png`),fullPage:true});
  if(!mobile){
   assert.ok(Math.abs(data.last.bottom-(data.columns.y-data.gap))<.1,'last line stays on the fixed bottom anchor');
   const prior=results.find(r=>r.width===width&&r.height===height);
   if(prior){assert.ok(Math.abs(data.columns.y-prior.columnsTop)<.1,'introduction never displaces lower rows');assert.ok(Math.abs(data.last.bottom-prior.introductionBottom)<.1,'content changes preserve last-line position');assert.equal(data.docHeight,prior.documentHeight,'long introduction does not expand document above the rows');}
   if(kind==='long'){
    assert.equal(data.overflowY,'auto');assert.ok(data.scrollHeight>data.clientHeight);assert.ok(data.intro.y<data.group.y,'long text extends upward');
    await page.locator('.info-intro-scroll').focus();await page.keyboard.press('PageUp');await page.waitForFunction(()=>document.querySelector('.info-intro-scroll').scrollTop<0);
    assert.ok(Math.abs(await page.locator('.info-columns').evaluate(n=>n.getBoundingClientRect().y)-data.columns.y)<.1);
    await page.locator('.info-intro-scroll').evaluate(n=>{n.scrollTop=-n.scrollHeight;});
    const top=await page.locator('.info-intro').evaluate(n=>n.getBoundingClientRect().top);
    // Native scroll extents are integer-rounded; line boxes may differ by a fraction of a pixel.
    assert.ok(top>=data.group.y-1,JSON.stringify({width,height,kind,top,group:data.group,scroll:await page.locator('.info-intro-scroll').evaluate(n=>({top:n.scrollTop,height:n.scrollHeight,client:n.clientHeight}))}));
    await page.locator('.info-intro-scroll').evaluate(n=>{n.scrollTop=0;});
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
   for(const baseline of data.baselines)assert.ok(Math.abs(baseline-work.baseline)<.1,JSON.stringify({width,height,kind,baseline,work,data}));
  }
  assert.deepEqual(errors,[]);results.push({width,height,kind,introductionTop:data.intro.y,introductionBottom:data.last.bottom,infoBaselines:data.baselines,workBaseline,baselineOffset:data.offset,introFont:data.introFont,sectionFont:data.sectionFont,introWidth:data.intro.width,columnsTop:data.columns.y,documentHeight:data.docHeight});await page.close();
 }
 fs.writeFileSync(path.join(out,`${engine}.json`),JSON.stringify(results,null,2));console.log(JSON.stringify({engine,results}));
 }finally{await browser.close();}
});
