'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Real local/published page, live Sanity query and CDN assets. No route interception.
test('actual project pages sustain playback, pause and resume with production MP4s', {
  skip: !process.env.LIVE_SITE_TEST, timeout: 600000
}, async () => {
  const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
  const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:5500/';
  const results = [];
  try {
    for (const width of (process.env.SITE_TEST_WIDTHS || '1440,390').split(',').map(Number)) {
      const page = await browser.newPage({viewport:{width,height:900}, hasTouch:width===390, isMobile:width===390});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const slug of (process.env.SITE_TEST_PROJECTS || 'revoshock,maerzmusik-2022,livevisuals,advection,gaussian-splats').split(',')) {
        for(let attempt=0;attempt<3;attempt++) {
          await page.goto(`${base}#project/${slug}`);
          try {
            await page.waitForSelector(`.detail[data-project-id="${slug}"] [data-video-ready]`, {timeout:20000});
            break;
          } catch(error) {
            const state=await page.evaluate(()=>({hasData:!!sanityContent,settled:sanityLoadSettled,videos:document.querySelectorAll('video').length,hash:location.hash}));
            console.log('Live load diagnostic',width,slug,state);
            if(state.videos || state.hasData || attempt===2) throw error;
          }
        }
        assert.equal(await page.locator('.detail-sound-control').count(),1);
        if(slug==='revoshock') {
          await page.waitForFunction(()=>{const v=document.querySelector('.detail video');return v.readyState>=2&&!v.parentElement.querySelector('button').disabled});
          await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
          await page.waitForTimeout(250);
          await page.evaluate(()=>{window.scrollTo({top:0,behavior:'instant'});document.querySelector('.project-video-toggle').click()});
          const first=page.locator('.detail video').first();
          await page.waitForFunction(v=>!v.paused&&v.currentTime>0,await first.elementHandle());
          const began=await first.evaluate(v=>v.currentTime);
          await page.waitForTimeout(3100);
          assert.ok(await first.evaluate(v=>v.currentTime)>began+.2,'visible control works before IntersectionObserver catches up');
          await page.locator('.project-video-toggle').first().click();
        }

        for (const [index,box] of (await page.locator('.detail .project-video').all()).entries()) {
          await box.scrollIntoViewIfNeeded();
          const video = box.locator('video'), control = box.locator('.project-video-toggle');
          await page.waitForFunction(v=>v.readyState>=2, await video.elementHandle(), {timeout:45000});
          const autoplay = await box.getAttribute('data-playback') === 'autoplay';
          let beforeFrame;
          if(slug==='revoshock') beforeFrame=await box.screenshot();
          if (!autoplay) await control.click();
          await page.waitForFunction(v=>!v.paused && v.currentTime>0,await video.elementHandle()).catch(async error=>{console.log('PLAYBACK FAILURE',width,slug,index,await video.evaluate(v=>({time:v.currentTime,paused:v.paused,ready:v.readyState,network:v.networkState,error:v.error?.message,muted:v.muted,autoplay:v.autoplay,box:v.getBoundingClientRect().toJSON(),control:v.parentElement.querySelector('button')?.outerHTML})));throw error});
          const start = await video.evaluate(v=>v.currentTime);
          const firstSamples=[];
          for(let second=0;second<4;second++){await page.waitForTimeout(800);firstSamples.push(await video.evaluate(v=>v.currentTime));}
          const running = await video.evaluate(v=>({time:v.currentTime,ended:v.ended,paused:v.paused,duration:v.duration,src:v.src,ready:v.readyState,network:v.networkState,rate:v.playbackRate,visible:getComputedStyle(v).visibility}));
          assert.ok(firstSamples.some(t=>t>start+.2) || firstSamples.some((t,i)=>i&&Math.abs(t-firstSamples[i-1])>.2),`${slug} module ${index}: time advances over 3 seconds`);
          assert.ok(!running.paused || running.ended,'only a natural end may stop playback');
          assert.equal(running.visible,'visible');
          if(slug==='revoshock') {
            const afterFrame=await box.screenshot();
            assert.equal(beforeFrame.equals(afterFrame),false,'the real rendered video frame changes after Play');
            const directory=process.env.VIDEO_SCREENSHOT_DIR||'/tmp/nk-revoshock-frames';
            fs.mkdirSync(directory,{recursive:true});
            fs.writeFileSync(path.join(directory,`${width}-module-${index}-before.png`),beforeFrame);
            fs.writeFileSync(path.join(directory,`${width}-module-${index}-playing.png`),afterFrame);
          }
          if (!running.ended) {
            // Explicit playback selects this player when several autoplay modules are visible.
            if(autoplay){await control.click();await control.click();await page.waitForFunction(v=>!v.paused,await video.elementHandle());}
            const sound = page.locator('.detail-sound-control');
            await sound.click();
            await page.waitForFunction(v=>!v.muted,await video.elementHandle());
            assert.equal(await page.locator('.detail video').evaluateAll(vs=>vs.filter(v=>!v.muted).length),1);
            await sound.click();
            await page.waitForFunction(v=>v.muted,await video.elementHandle());
            await control.click();
          }
          const paused = await video.evaluate(v=>({time:v.currentTime,paused:v.paused,ended:v.ended}));
          assert.equal(paused.paused,true);
          await page.waitForTimeout(350);
          assert.ok(Math.abs(await video.evaluate(v=>v.currentTime)-paused.time)<.08,'Pause stops the clock');
          await control.click();
          await page.waitForFunction(v=>!v.paused&&v.currentTime>0,await video.elementHandle());
          const restart = await video.evaluate(v=>v.currentTime);
          const resumeSamples=[];
          for(let second=0;second<4;second++){await page.waitForTimeout(800);resumeSamples.push(await video.evaluate(v=>v.currentTime));}
          const resumed = await video.evaluate(v=>({time:v.currentTime,paused:v.paused,ended:v.ended}));
          assert.ok(resumeSamples.some(t=>t>restart+.2) || resumeSamples.some((t,i)=>i&&Math.abs(t-resumeSamples[i-1])>.2),'Play resumes across loop boundaries or a natural end');
          if(!resumed.ended) await control.click();
          results.push({base,width,slug,index,autoplay,start,firstSamples,running,paused,restart,resumeSamples,resumed});
          console.log(`${width} ${slug} module ${index}: ${start.toFixed(2)} → ${running.time.toFixed(2)}; resumed ${restart.toFixed(2)} → ${resumed.time.toFixed(2)}`);
        }
        await page.evaluate(()=>{window.retiredVideos=[...document.querySelectorAll('video')];location.hash='#info'});
        await page.waitForSelector('.info');
        assert.equal(await page.evaluate(()=>window.retiredVideos.every(v=>v.paused&&!v.hasAttribute('src'))),true);
      }
      assert.deepEqual(errors,[]);
      await page.close();
    }
  } finally {
    fs.writeFileSync(process.env.LIVE_SITE_REPORT || '/tmp/nk-live-site-playback.json',JSON.stringify(results,null,2));
    await browser.close();
  }
});
