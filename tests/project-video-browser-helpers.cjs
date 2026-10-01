const assert = require('node:assert/strict');
exports.checkDetailVideos = async (page, width, native) => {
  const sound = page.locator('.detail-sound-control');
  assert.equal(await sound.count(), 1);
  const fixed = await sound.boundingBox();
  const info = await page.locator('.detail-info-label').boundingBox();
  assert.equal(fixed.y + fixed.height, info.y + info.height, 'Info and Sound share a baseline');
  const styles = await sound.evaluate(node => {
    const sound=getComputedStyle(node), info=getComputedStyle(document.querySelector('.detail-info-label'));
    return ['fontFamily','fontSize','fontWeight','lineHeight','bottom','padding','backgroundColor'].map(key=>[sound[key],info[key]]);
  });
  for (const [actual, expected] of styles) assert.equal(actual, expected);
  assert.equal(await sound.evaluate(node=>getComputedStyle(node).position),'fixed');
  for (const box of await page.locator('.detail .project-vimeo').all()) {
    await box.scrollIntoViewIfNeeded();
    const autoplay=await box.getAttribute('data-playback')==='autoplay';
    await page.waitForFunction(({node,playing})=>node.dataset.videoPlaying===String(playing),{node:await box.elementHandle(),playing:autoplay});
    const control=box.locator('.project-video-toggle');
    assert.equal(await control.isVisible(),true);
    assert.equal(await control.textContent(),autoplay?'(Pause)':'(Play)');
    const toggle=async()=>width===390 ? control.tap() : control.click();
    if(width>700) {
      await box.hover({position:{x:80,y:150}});
      assert.notEqual(await box.evaluate(node=>getComputedStyle(node).cursor),'none');
      await box.click({position:{x:80,y:150}});
    } else await box.tap({position:{x:80,y:150}});
    assert.equal(await box.getAttribute('data-video-playing'),String(autoplay),'video-area clicks do not toggle playback');
    assert.equal(await page.locator('.open-cursor').evaluate(node=>node.hidden),true);
    // Explicit playback selects this video even when two modules are visible.
    if(autoplay) {await toggle();await page.waitForFunction(node=>node.dataset.videoPlaying==='false',await box.elementHandle());}
    await toggle();
    await page.waitForFunction(node=>node.dataset.videoPlaying==='true',await box.elementHandle());
    if(await sound.textContent()==='(Sound)') await sound.click();
    await page.waitForFunction(({node,native})=>native ? !node.muted : node.dataset.muted==='false',{node:await box.locator('video,iframe').elementHandle(),native});
    assert.equal(await sound.textContent(),'(Mute)');
    assert.equal(await page.locator('.detail video, .detail iframe').evaluateAll((nodes,native)=>nodes.filter(node=>native?!node.muted:node.dataset.muted==='false').length,native),1);
    const after=await sound.boundingBox();
    assert.equal(after.y+after.height,fixed.y+fixed.height);
    assert.equal(after.x+after.width,fixed.x+fixed.width);
    if(width===390) {
      const local=await control.boundingBox(), global=await sound.boundingBox();
      const left=r=>r.x+r.width-Math.max(44,r.width), top=r=>r.y+r.height-Math.max(44,r.height);
      assert.ok(local.x+local.width<=left(global)||global.x+global.width<=left(local)||local.y+local.height<=top(global)||global.y+global.height<=top(local),'mobile hit areas do not overlap');
    }
    await sound.click();
    await page.waitForFunction(({node,native})=>native ? node.muted : node.dataset.muted==='true',{node:await box.locator('video,iframe').elementHandle(),native});
    assert.equal(await sound.textContent(),'(Sound)');
    await toggle();
    await page.waitForFunction(node=>node.dataset.videoPlaying==='false',await box.elementHandle());
    if(width>700) {
      assert.equal(await control.textContent(),'(Play)');
      await page.locator('.site-header .brand').hover();
      assert.equal(await page.locator('.open-cursor').evaluate(node=>node.hidden),true);
    }
  }
  {
    const last=page.locator('.detail .project-vimeo').last();
    const aligned=await last.evaluate(node=>{
      const bottom=node.getBoundingClientRect().bottom+scrollY;
      const y=bottom-innerHeight;
      if(y<0 || y>document.documentElement.scrollHeight-innerHeight) return false;
      scrollTo({top:y,behavior:'instant'});return true;
    });
    if(aligned) {
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const control=last.locator('.project-video-toggle');
      assert.ok(Number(await control.getAttribute('data-control-lift'))>0,JSON.stringify({message:'playback control clears fixed audio when their anchors coincide',box:await last.boundingBox(),button:await control.boundingBox(),sound:await sound.boundingBox(),scroll:await page.evaluate(()=>scrollY)}));
      const local=await control.boundingBox(),global=await sound.boundingBox(),video=await last.boundingBox();
      assert.ok(local.y>=video.y && local.y+local.height<=video.y+video.height);
      assert.ok(local.y+local.height<=global.y+global.height-Math.max(44,global.height),'touch targets remain separate at the viewport edge');
    }
  }
};
