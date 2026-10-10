'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
test('Chrome omits legacy media, removes only the Graphic bottom label, and makes no Vimeo requests', {skip:!process.env.BROWSER_TEST},async()=>{
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright-core');
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true});
    const bytes=await require('./native-media-fixture.cjs').recordMP4(page),errors=[],external=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(/vimeo/i.test(request.url()))external.push(request.url());});
    const image={type:'image',image:{asset:{_ref:'image-photo-800x1200-jpg'}},alt:'Portrait'};
    const mp4={type:'mp4',video:{asset:{_ref:'file-demo-mp4'}},playback:'autoplay'};
    const legacy={type:'video',vimeoUrl:'https://vimeo.com/12345'};
    const projects=['Graphic','Commissioned','Video'].map(category=>({_id:category.toLowerCase(),_type:'project',title:`${category} Project`,slug:{current:category.toLowerCase()},category,modules:[{type:'full',slots:[legacy]},{type:'half-half',height:'viewport',slots:[image,mp4]}],selectedWorkPreview:{composition:[{_type:'preview-full',type:'full',slots:[legacy]},{_type:'preview-half-half',type:'half-half',height:'viewport',slots:[image,legacy]}]}}));
    const raw={projects,selectedWork:{_id:'selectedWork',_type:'selectedWork',video:[],commissioned:[],graphic:[{_ref:'graphic'}]}};
    const before=JSON.stringify(projects);
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='preview.test'){
        const file=path.join(__dirname,'..',url.pathname==='/'?'index.html':url.pathname);
        return route.fulfill({path:file,contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});
      }
      if(url.pathname.includes('/data/query/'))return route.fulfill({json:{result:raw}});
      if(url.pathname.endsWith('.mp4'))return route.fulfill({body:bytes,contentType:'video/mp4'});
      if(url.hostname==='cdn.sanity.io')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#ddd"/></svg>'});
      return route.fulfill({body:''});
    });
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});
      for(const category of ['graphic','commissioned','video']){
        for(const key of ['graphic','commissioned','video'])raw.selectedWork[key]=key===category?[{_ref:key}]:[];
        await page.goto(`https://preview.test/#work/${category}`);await page.reload();
        await page.waitForSelector(`.project-preview[data-project="${category}"] img`);
        assert.equal(await page.locator('.project-module').count(),1);
        assert.equal(await page.locator('.project-title').textContent(),`${category[0].toUpperCase()+category.slice(1)} Project`);
        assert.equal(await page.locator('.project-kind').count(),category==='graphic'?0:1);
        assert.ok(await page.locator('a[href="#work/graphic"]').count()>0);
        assert.equal(await page.locator('iframe').count(),0);
        if(category==='graphic')await page.screenshot({path:`/tmp/nk-graphic-no-bottom-label-${width}.png`});
      }
      await page.evaluate(()=>location.hash='#project/graphic');
      await page.waitForSelector('.detail .project-video');
      assert.equal(await page.locator('.detail .project-module').count(),1);
      await page.locator('.detail .project-video').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>{const video=document.querySelector('.detail video');return video&&!video.paused;});
      await page.locator('.detail-sound-control').click();
      await page.waitForFunction(()=>!document.querySelector('.detail video').muted);
      await page.evaluate(()=>location.hash='#info');await page.waitForSelector('.info');
      assert.equal(await page.locator('video').count(),0);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    assert.equal(JSON.stringify(projects),before);
  }finally{await browser.close();}
});
