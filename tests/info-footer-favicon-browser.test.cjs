'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const out = process.env.INFO_FAVICON_REPORT_DIR || path.join(require('node:os').tmpdir(), 'nk-info-footer-favicon');
const beforeRoot = process.env.INFO_FOOTER_BEFORE_ROOT;
const paragraph = 'A Berlin based multidisciplinary designer, working in photography, motion design and CGI.';
for (const engine of (process.env.INFO_TEST_ENGINES?.split(',') || ['chromium', 'webkit'])) test(`${engine}: repository-relative favicons and natural Info footer across content sizes`, {skip: !process.env.BROWSER_TEST, timeout: 120000}, async () => {
  const pw = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await pw[engine].launch({headless:true, ...(engine === 'chromium' ? {executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'} : {})});
  fs.mkdirSync(out, {recursive:true});
  const results = [];
  const server=require('node:http').createServer((req,res)=>{
    const file=new URL(req.url,'http://localhost').pathname.replace(/^\/NK-Test-II\//,'')||'index.html';
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.jpg':'image/jpeg','.svg':'image/svg+xml'};
    try{res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(path.join(root,file)));}catch{res.statusCode=404;res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try {
    for (const [width,height] of [[1440,900],[1440,1200],[760,900],[390,844],[320,568]]) {
      const page = await browser.newPage({viewport:{width,height}, hasTouch:width<=700});
      page.setDefaultTimeout(15000);
      let before = false, fixture;
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', r => {
        const u = new URL(r.request().url());
        if (u.origin === origin) {
          const prefix = '/NK-Test-II/';
          if (!u.pathname.startsWith(prefix)) return r.fulfill({status:404, body:'Outside repository base'});
          const file = u.pathname.slice(prefix.length) || 'index.html';
          if(before && beforeRoot && file==='style.css')return r.fulfill({path:path.join(beforeRoot,file)});
          return r.continue();
        }
        if (u.pathname.includes('/data/query/')) return r.fulfill({json:{result:fixture}});
        if (u.hostname === 'cdn.sanity.io') return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#555"/></svg>'});
        return r.abort();
      });
      const measure = () => page.evaluate(() => {
        const info=document.querySelector('.info'), footer=document.querySelector('.project-footer'), links=footer.querySelector('nav');
        const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,w:r.width,h:r.height,b:r.bottom+scrollY};};
        const visible=[...info.querySelectorAll('.info-intro, .info-columns section')].filter(n=>n.getClientRects().length);
        const intro=info.querySelector('.info-intro'), style=getComputedStyle(intro), columns=info.querySelector('.info-columns');
        return {lastBottom:visible.length?Math.max(...visible.map(n=>rect(n).b)):rect(info).y+parseFloat(getComputedStyle(info).paddingTop),
          credit:rect(footer.querySelector('.info-footer-credit')),creditLabel:rect(footer.querySelector('.info-footer-credit h2')),creditValue:rect(footer.querySelector('.info-footer-credit p')),reference:info.querySelector('.info-details section')?{label:rect(info.querySelector('.info-details section h2')),value:rect(info.querySelector('.info-details section p'))}:null,creditFont:getComputedStyle(footer.querySelector('.info-footer-credit')).font,linkFont:getComputedStyle(links.querySelector('a')).font,creditHref:footer.querySelector('.info-footer-credit a').href,creditTarget:footer.querySelector('.info-footer-credit a').target,creditRel:footer.querySelector('.info-footer-credit a').rel,info:rect(info),footer:rect(footer),links:rect(links),columns:rect(columns),intro:rect(intro),
          typography:[style.fontFamily,style.fontSize,style.fontWeight,style.lineHeight,style.letterSpacing],
          sections:visible.filter(n=>n.tagName==='SECTION').map(n=>({name:n.className,box:rect(n)})),
          pad:parseFloat(getComputedStyle(info).paddingBottom),position:getComputedStyle(footer).position,
          paddingBottom:parseFloat(getComputedStyle(footer).paddingBottom),paddingTop:parseFloat(getComputedStyle(footer).paddingTop),marginTop:getComputedStyle(footer).marginTop,
          introContentBottom:rect(info.querySelector('.info-intro-content')).b,introGap:parseFloat(getComputedStyle(info.querySelector('.info-introduction')).paddingBottom),baselineOffset:parseFloat(getComputedStyle(info).getPropertyValue('--info-baseline-offset'))||0,grid:getComputedStyle(columns).gridTemplateColumns,documentHeight:document.documentElement.scrollHeight,
          nested:[...info.querySelectorAll('*')].filter(n=>/(auto|scroll|hidden|clip)/.test(getComputedStyle(n).overflowY)).length,
          cv:!!info.querySelector('.info-cv'),overflow:document.documentElement.scrollWidth>innerWidth};
      });
      for (const kind of ['short','multiple','long','intro-only','empty']) {
        const empty=kind==='empty', introOnly=kind==='intro-only'||empty;
        fixture={projects:[{_id:'fixture',_type:'project',slug:{current:'fixture'},title:'Fixture project',category:'Video',modules:[{type:'full',height:'small',slots:[{type:'image',image:{asset:{_ref:'image-fixture-160x90-svg'}}}]}]}],
          siteSettings:{_id:'siteSettings',_type:'siteSettings',email:'hello@example.com'},
          infoPage:{_id:'infoPage',_type:'infoPage',introduction:empty?'':kind==='long'?paragraph.repeat(50):paragraph,
            additionalIntroduction:kind==='multiple'?paragraph:'',cv:[{period:'2026',text:'Hidden CV'}],
            work:introOnly?[]:['Teaching and workshops'],skills:kind==='multiple'?['Photography','Motion design']:[],
            news:kind==='multiple'?[{title:'An exhibition',url:'https://example.com'}]:[],publications:[],contactLinks:[],
            selectedClients:kind==='multiple'?Array.from({length:35},(_,i)=>'Client '+i):[]}};
        const load=async()=>{await page.goto(origin+'/NK-Test-II/?kind='+kind+'&before='+before+'#info');await page.waitForFunction(({text})=>document.querySelector('.info-intro')?.textContent===text,{text:fixture.infoPage.introduction});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
        let prior=null;
        if(beforeRoot){before=true;await load();prior=await measure();if([1440,390].includes(width)&&['short','long'].includes(kind))await page.screenshot({path:path.join(out,`${engine}-${width}x${height}-${kind}-before.png`),fullPage:true});before=false;}
        await load();const after=await measure();
        assert.equal(after.creditHref,'https://meisnerfloriangestaltung.com/');assert.equal(after.creditTarget,'_blank');assert.equal(after.creditRel,'noopener noreferrer');
        assert.equal(after.creditFont,after.linkFont);
        assert.ok(Math.abs(after.creditLabel.y-after.creditValue.y)<.03,'credit label/value top alignment');
        assert.ok(Math.abs(after.credit.y-after.footer.y)<.03,'credit starts at footer top');
        if(width>700)assert.ok(Math.abs(after.credit.y-after.links.y)<.03,'credit and links share desktop top alignment');
        else assert.ok(after.links.y>=after.credit.b,'mobile rows never overlap');
        if(after.reference){assert.ok(Math.abs(after.creditLabel.x-after.reference.label.x)<.03);assert.ok(Math.abs(after.creditValue.x-after.reference.value.x)<.03,'reuse Info text columns');}
        assert.equal(after.position,'static');assert.equal(after.marginTop,'0px');assert.equal(after.paddingTop,0);
        assert.ok(Math.abs(after.pad-height*.375)<.03,'single 37.5%-viewport spacing rule');
        assert.ok(Math.abs(after.footer.y-after.lastBottom-height*.375)<.2,JSON.stringify({engine,width,kind,after}));
        if(!empty){const expectedWidth=width<=700?width-2*after.intro.x:width*.49;assert.ok(Math.abs(after.intro.w-expectedWidth)<.04,'responsive statement width');}
        if(!introOnly)assert.ok(Math.abs(after.columns.y-Math.max(height/2+after.baselineOffset,after.introContentBottom+after.introGap))<.2,'existing half-viewport baseline or content-driven expansion');
        assert.equal(after.nested,0);assert.equal(after.cv,false);assert.equal(after.overflow,false);
        assert.ok(after.footer.y>=after.lastBottom);assert.ok(after.footer.h-after.paddingBottom<200,'footer content retains intrinsic height');
        assert.ok(Math.abs(after.paddingBottom-height*.5)<.03,'50%-viewport empty space after footer links');
        assert.ok(Math.abs(after.footer.b-Math.max(after.credit.b,after.links.b)-height*.5)<.03,'bottom space follows all footer content');
        if(prior){
          assert.deepEqual(after.typography,prior.typography);assert.equal(after.intro.x,prior.intro.x);if(width<=700)assert.equal(after.intro.w,prior.intro.w);assert.equal(after.intro.y,prior.intro.y);
          assert.equal(after.grid,prior.grid);
          const shift=after.columns.y-prior.columns.y;
          for(let i=0;i<after.sections.length;i++){const a=after.sections[i],b=prior.sections[i];assert.equal(a.name,b.name);for(const key of ['x','w','h'])assert.equal(a.box[key],b.box[key]);assert.ok(Math.abs(a.box.y-b.box.y-shift)<.1,'only intrinsic statement reflow can move lower sections');}
        }
        const positions=await page.evaluate(()=>{const n=document.querySelector('.project-footer');const y=n.getBoundingClientRect().top;scrollTo({top:Math.min(100,document.documentElement.scrollHeight-innerHeight),behavior:'instant'});return {before:y,after:n.getBoundingClientRect().top,scroll:scrollY};});
        assert.ok(Math.abs(positions.before-positions.after-positions.scroll)<.1,'footer moves with the document');
        const bottomSpace=await page.evaluate(()=>{scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});return innerHeight-document.querySelector('.project-footer-links').getBoundingClientRect().bottom;});
        assert.ok(bottomSpace>=height*.5-1,JSON.stringify({message:'full empty area after scrolling, allowing integer scrollHeight rounding',engine,width,height,kind,bottomSpace,expected:height*.5}));
        await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
        if(width===1440||width===390)await page.screenshot({path:path.join(out,`${engine}-${width}x${height}-${kind}.png`),fullPage:true});
        results.push({width,height,kind,before:prior,after});
      }
      // Every hash route shares the same head and repository-relative assets.
      for(const route of ['home','info','archive','project/fixture']){
        await page.goto(origin+'/NK-Test-II/?route='+route+'#'+route);
        await page.waitForFunction(route=>document.body.classList.contains({'home':'is-home','info':'is-info','archive':'is-index','project/fixture':'is-detail'}[route]),route);
        // Playwright routing special-cases bare favicon.ico requests; a query
        // exercises the identical file through ordinary HTTP fetching.
        const icons=await page.evaluate(async()=>Promise.all([...document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]')].map(async n=>{
          const url=new URL(n.href);url.searchParams.set('verify','1');
          let r;try{r=await fetch(url.href,{cache:'no-store'});}catch(error){throw new Error(n.href+': '+error.message);}const bytes=new Uint8Array(await r.arrayBuffer());
          const i=new Image();i.src=url.href;await i.decode();const dimensions=[i.naturalWidth,i.naturalHeight];
          const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);
          return {href:n.href,status:r.status,sizes:n.getAttribute('sizes'),dimensions,magic:[...bytes.slice(0,4)],cornerAlpha:ctx.getImageData(0,0,1,1).data[3],centerAlpha:ctx.getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data[3]};
        })));
        assert.equal(icons.length,4);for(const icon of icons){assert.equal(icon.status,200);assert.equal(icon.cornerAlpha,0,'new circular icon retains transparent corners');assert.equal(icon.centerAlpha,255);assert.ok(icon.href.startsWith(origin+'/NK-Test-II/'));if(new URL(icon.href).pathname.endsWith('.ico')){assert.deepEqual(icon.magic,[0,0,1,0]);assert.ok([16,32].includes(icon.dimensions[0]));assert.equal(icon.dimensions[0],icon.dimensions[1]);}else assert.equal(icon.dimensions.join('x'),icon.sizes);}
      }
      assert.equal(await page.locator('.info-footer-credit').count(),0,'project detail never has Info credits');
      // The installed headless WebKit also suppresses this target=_blank link
      // in a minimal standalone page; verify actual popup behavior in Chrome.
      if(width===390 && engine==='chromium'){
        await page.goto(origin+'/NK-Test-II/#info');
        await page.context().route('https://meisnerfloriangestaltung.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Credit destination fixture</title>'}));
        const opened=page.context().waitForEvent('page');
        await page.locator('.info-footer-credit a').click();
        const destination=await opened;await destination.waitForLoadState();
        assert.equal(destination.url(),'https://meisnerfloriangestaltung.com/');
        assert.equal(await destination.evaluate(()=>window.opener===null),true);
        await destination.close();
      }
      assert.deepEqual(errors,[]);await page.close();
    }
    fs.writeFileSync(path.join(out,`${engine}.json`),JSON.stringify(results,null,2));
    console.log(JSON.stringify({engine,footerCases:results.length,routeFaviconChecks:20,maxGap:Math.max(...results.map(r=>r.after.links.y-r.after.lastBottom))}));
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
