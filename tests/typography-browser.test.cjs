'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('official normal/italic fonts, WOFF fallback and public desktop/mobile typography', {skip: !process.env.BROWSER_TEST}, async () => {
  const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const image = {asset:{_ref:'image-fixture-800x1200-jpg'}};
  const video = {type:'mp4',video:{asset:{_ref:'file-demo-mp4'}},playback:'autoplay'};
  const module = {type:'full',height:'viewport',slots:[video]};
  const project = {_id:'font-project',_type:'project',slug:{current:'font-project'},title:'Typography Project',category:'Commissioned',modules:[module],selectedWorkPreview:{composition:[{...module,_type:'preview-full'}]}};
  const raw = {siteSettings:{_id:'siteSettings',_type:'siteSettings',email:'mail@nicolas-kawohl.com',instagram:'https://www.instagram.com/nicolaskawohl/'},projects:[project],selectedWork:{_id:'selectedWork',_type:'selectedWork',commissioned:[{_ref:project._id}],video:[],graphic:[]},indexPage:{_id:'indexPage',_type:'indexPage',entries:[{displayTitle:'Typography Index',previewImages:[image,{mediaType:'mp4',video:{asset:{_ref:'file-demo-mp4'}}}]}]}};
  try {
    for (const fallback of [false,true]) {
      const page = await browser.newPage({viewport:{width:1440,height:900},hasTouch:true});
      const mp4Bytes=await require('./native-media-fixture.cjs').recordMP4(page);
      const loaded = [], errors = [];
      page.on('response',response=>{if (/\.woff2?$/.test(response.url())) {loaded.push(response.url());if(response.status()!==200)errors.push(response.url());}});
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>{
        const url = new URL(route.request().url());
        if(fallback && url.pathname.endsWith('.woff2')) return route.abort();
        if(url.hostname==='preview.test') return route.fulfill({path:path.join(__dirname,'..',url.pathname==='/'?'index.html':url.pathname),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff':'font/woff','.woff2':'font/woff2','.svg':'image/svg+xml'})[url.pathname==='/'?'.html':path.extname(url.pathname)]||'application/octet-stream'});
        if(url.pathname.endsWith('.mp4'))return route.fulfill({body:mp4Bytes,contentType:'video/mp4'});
        if(url.pathname.includes('/data/query/'))return route.fulfill({json:{result:raw}});
        if(url.hostname==='cdn.sanity.io')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#b5c3c8"/></svg>'});
        return route.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#555"></body></html>'});
      });
      await page.goto('https://preview.test/#home');
      assert.deepEqual(await page.evaluate(async()=>{
        const faces = await Promise.all(['normal','italic'].map(style=>document.fonts.load(`${style} 300 16px "WF Raglan Neue"`)));
        return faces.map(list=>list.map(face=>({status:face.status,style:face.style,weight:face.weight})));
      }),[[{status:'loaded',style:'normal',weight:'300'}],[{status:'loaded',style:'italic',weight:'300'}]]);
      for (const name of ['Light','LightItalic']) assert.ok(loaded.some(url=>url.endsWith(`WFRaglanNeue-${name}.${fallback?'woff':'woff2'}`)));
      assert.equal(loaded.some(url=>url.includes('Trial')),false);
      if (!fallback) for (const width of [1440,390]) {
        await page.setViewportSize({width,height:900});
        for (const route of ['home','work/commissioned','archive','project/font-project','info','imprint','privacy-policy']) {
          await page.evaluate(route=>location.hash='#'+route,route);
          await page.waitForFunction(route=>document.body.classList.contains(route==='home'?'is-home':route.startsWith('work')?'is-work':route==='archive'?'is-index':route.startsWith('project')?'is-detail':route==='info'?'is-info':'is-legal'),route);
          await page.evaluate(()=>document.fonts.ready);
          await page.waitForTimeout(150);
          const bad = await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().width && [...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).filter(el=>{const s=getComputedStyle(el);return !s.fontFamily.startsWith('"WF Raglan Neue"')||s.fontWeight!=='300'||s.fontSynthesis!=='none';}).map(el=>el.outerHTML.slice(0,100)));
          assert.deepEqual(bad,[],`${width} ${route}: all text inherits the official Light face`);
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${route}: no overflow`);
          await page.screenshot({path:`/tmp/nk-font-${width}-${route.replaceAll('/','-')}.png`,fullPage:false});
          if(route.startsWith('project')){
            await page.locator('.project-footer').scrollIntoViewIfNeeded();
            await page.screenshot({path:`/tmp/nk-font-${width}-footer.png`});
            await page.evaluate(()=>scrollTo(0,0));
            await page.waitForTimeout(200);
          }
        }
        if(width===390){
          await page.locator('.mobile-menu-toggle').click();
          await page.waitForSelector('.mobile-menu[open]');
          assert.ok(await page.locator('.mobile-menu').evaluate(el=>el.scrollWidth<=el.clientWidth));
          await page.screenshot({path:'/tmp/nk-font-mobile-menu.png'});
          await page.locator('.mobile-menu-close').click();
        }
        const client=await page.context().newCDPSession(page);
        await client.send('DOM.enable');
        await client.send('CSS.enable');
        const {root}=await client.send('DOM.getDocument');
        const {nodeId}=await client.send('DOM.querySelector',{nodeId:root.nodeId,selector:'.legal-page h1'});
        const {fonts}=await client.send('CSS.getPlatformFontsForNode',{nodeId});
        assert.ok(fonts.some(font=>font.isCustomFont&&font.familyName.includes('Raglan')));
        await page.locator('.legal-copy a[href="#privacy-policy"]').hover();
        const italicNode = await client.send('DOM.querySelector',{nodeId:root.nodeId,selector:'.legal-copy a[href="#privacy-policy"]'});
        const italic = await client.send('CSS.getPlatformFontsForNode',{nodeId:italicNode.nodeId});
        assert.ok(italic.fonts.some(font=>font.isCustomFont&&/italic/i.test(font.postScriptName)), 'hover uses the real italic face');
        await client.detach();
      }
      assert.deepEqual(errors,[]);
      await page.close();
    }
  } finally {await browser.close();}
});
