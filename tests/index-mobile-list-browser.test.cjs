'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

test('complete mobile Index retains historical list geometry and stable rows', {skip: !process.env.BROWSER_TEST}, async () => {
  const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const root = path.join(__dirname, '..');
  const oldCSS = execFileSync('git', ['show','245d3aa:style.css'], {cwd:root,encoding:'utf8'});
  try {
    for (const width of [390,700]) {
      const snapshots=[];
      for (const historical of [true,false]) {
        const page = await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
        await page.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.pathname.includes('/data/query/')) return route.fulfill({json:{result:{projects:[]}}});
          if (url.hostname !== 'preview.test') return route.fulfill({body:''});
          if (historical && url.pathname === '/style.css') return route.fulfill({body:oldCSS,contentType:'text/css'});
          if (/\.(jpg|png)$/.test(url.pathname)) return route.fulfill({body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"/>',contentType:'image/svg+xml'});
          return route.fulfill({path:path.join(root,url.pathname==='/'?'index.html':url.pathname)});
        });
        await page.goto('https://preview.test/#archive');
        await page.waitForSelector('.archive[data-source="local"]');
        await page.evaluate(()=>document.fonts.ready);
        const snapshot=await page.locator('.archive-row').evaluateAll(rows=>rows.map(row=>{
          const r=row.getBoundingClientRect(),s=getComputedStyle(row),t=getComputedStyle(row.firstElementChild);
          return {title:row.firstElementChild.textContent,x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontFamily,size:s.fontSize,line:s.lineHeight,padding:s.padding,align:s.textAlign,style:t.fontStyle};
        }));
        snapshots.push(snapshot);
        assert.equal(snapshot.length,33);
        assert.ok(snapshot.every(row=>row.height>0 && row.y+row.height<=844));
        if (!historical) {
          await page.evaluate(()=>{window.originalList=document.querySelector('.archive-list');window.originalRows=[...originalList.children];});
          await page.locator('.archive-row').last().tap();
          assert.equal(await page.locator('.archive-row[aria-current]').getAttribute('data-index'),'32');
          for(let i=0;i<3;i++) await page.touchscreen.tap(width/2,820);
          assert.equal(await page.locator('.archive-row[aria-current]').getAttribute('data-index'),'0');
          await page.mouse.wheel(500,500);
          assert.deepEqual(await page.evaluate(()=>({x:scrollX,y:scrollY,list:document.querySelector('.archive-list').scrollTop,stable:originalList===document.querySelector('.archive-list')&&originalRows.every((row,i)=>row===originalList.children[i])})),{x:0,y:0,list:0,stable:true});
          await page.screenshot({path:`/tmp/nk-mobile-index-full-${width}.png`});
        }
        await page.close();
      }
      assert.deepEqual(snapshots[1],snapshots[0]);
    }
  } finally {await browser.close();}
});
