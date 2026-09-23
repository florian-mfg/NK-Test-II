'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Opt-in real CSS/browser check. No CMS writes or real Vimeo playback required.
// BROWSER_TEST=1 PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core node --test tests/selected-work-responsive.test.cjs
// Set BROWSER_EXECUTABLE to a Chrome/Chromium binary when not using macOS Chrome.
test('Selected Work compositions retain module geometry and responsive stacking in Chrome', {skip: !process.env.BROWSER_TEST}, async () => {
  const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const root = path.join(__dirname, '..');
  const spans = {full:[12], 'half-half':[6,6], 'half-quarter-quarter':[6,3,3],
    'quarter-quarter-quarter-quarter':[3,3,3,3], 'third-third-third':[4,4,4], 'two-thirds-one-third':[8,4]};
  const projects=[];
  for(const [type,widths] of Object.entries(spans)) for(const order of ['default','reverse',...(type==='half-quarter-quarter'?['middle']:[])]) {
    const id=`project-${projects.length}`;
    const slots=widths.map((_,i)=>i%3===2?{type:'empty'}:i%3===1?{type:'video',vimeoUrl:'https://vimeo.com/12345/private'}:
      {type:'image',alt:`Image ${i}`,image:{asset:{_ref:'image-fixture-1200x800-jpg'}}});
    projects.push({_id:id,_type:'project',slug:{current:id},title:id,category:'Video',modules:[],
      selectedWorkPreview:{composition:[{_type:`preview-${type}`,type,height:'medium',order,slots}]}});
  }
  // An intentionally empty row must use the same mobile hiding as detail modules.
  projects.push({_id:'empty',_type:'project',slug:{current:'empty'},title:'Empty',category:'Video',modules:[],
    selectedWorkPreview:{composition:[{_type:'preview-half-half',type:'half-half',height:'auto',order:'default',slots:[{type:'empty'},{type:'empty'}]}]}});
  const raw={projects,selectedWork:{_id:'selectedWork',_type:'selectedWork',video:projects.map(p=>({_ref:p._id})),commissioned:[],graphic:[]}};
  try {
    const page=await browser.newPage();
    await page.addInitScript(()=>{
      globalThis.Vimeo={Player:class {
        on() {} off() {} destroy(){return Promise.resolve()}
        ready(){return Promise.resolve()} getVideoWidth(){return Promise.resolve(1920)} getVideoHeight(){return Promise.resolve(1080)}
      }};
    });
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='preview.test') {
        const file=path.join(root,url.pathname==='/'?'index.html':url.pathname);
        const ext=path.extname(file);
        return route.fulfill({path:file,contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.otf':'font/otf','.woff':'font/woff'})[ext] || 'application/octet-stream'});
      }
      if(url.hostname.endsWith('.sanity.io') && url.pathname.includes('/data/query/')) return route.fulfill({json:{result:raw}});
      if(url.hostname==='cdn.sanity.io') return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="gray"/></svg>'});
      return route.fulfill({contentType:'text/html',body:''});
    });
    await page.goto('https://preview.test/#work/video');
    await page.waitForSelector('.work[data-source="sanity"]');
    assert.equal(await page.locator('.project-preview').count(),projects.length);
    assert.equal(await page.locator('.project-module-preview').count(),projects.length);
    assert.deepEqual(await page.locator('.project-preview').evaluateAll(rows=>rows.map(r=>r.dataset.project)),projects.map(p=>p._id));
    for(const width of [1440,701,700,390]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const rows=await page.locator('.project-module').evaluateAll(rows=>rows.map(row=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
        return {type:row.dataset.moduleType,...rect(row),display:getComputedStyle(row).display,slots:[...row.children].map(slot=>({
          ...rect(slot),empty:slot.classList.contains('is-empty'),display:getComputedStyle(slot).display,
          span:Number(slot.style.getPropertyValue('--slot-span')),objectFit:slot.querySelector('img')?getComputedStyle(slot.querySelector('img')).objectFit:null,
          frame:slot.querySelector('iframe')?rect(slot.querySelector('iframe')):null,
        }))};
      }));
      for(const [i,row] of rows.entries()) {
        if(i===rows.length-1 && width<=700) {assert.equal(row.display,'none');continue}
        let lastBottom=row.y;
        for(const slot of row.slots) {
          if(width<=700 && slot.empty) {assert.equal(slot.display,'none');continue}
          const expected=width<=700?row.width:row.width*slot.span/12;
          assert.ok(Math.abs(slot.width-expected)<1,`${row.type} at ${width}: slot width ${slot.width}, expected ${expected}`);
          if(width<=700) {assert.ok(Math.abs(slot.y-lastBottom)<1);lastBottom=slot.y+slot.height}
          else assert.ok(Math.abs(slot.y-row.y)<1);
          if(slot.objectFit) assert.equal(slot.objectFit,'cover');
          if(slot.frame) {
            assert.ok(slot.frame.width>=slot.width-.1);
            assert.ok(slot.frame.height>=slot.height-.1);
            assert.ok(Math.abs(slot.frame.width/slot.frame.height-16/9)<.01);
          }
        }
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    for(const src of await page.locator('iframe[data-project-video-src]').evaluateAll(frames=>frames.map(f=>f.src))) {
      const url=new URL(src);
      for(const key of ['autoplay','muted','loop','background']) assert.equal(url.searchParams.get(key),'1');
      assert.equal(url.searchParams.get('controls'),'0');
    }
    assert.equal(await page.locator('.project-video-toggle').count(),0);
  } finally {await browser.close()}
});
