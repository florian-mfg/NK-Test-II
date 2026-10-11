/* Rolling editorial collage. Opacity changes only with accumulated input. */
(function (root) {
  'use strict';
  const media = root.FrontpageMedia || (typeof module !== 'undefined' && module.exports ? require('./frontpage-media.js') : []);

  // Travelled CSS pixels per complete reveal. Higher = slower.
  const PROGRESSION_MULTIPLIER = 3.5 * 2.5;
  const MAX_PROGRESS_PER_INPUT_FRAME = 0.5;
  const DISTANCE_PER_IMAGE = 480 / PROGRESSION_MULTIPLIER;
  const MOBILE_TRANSITIONS_PER_SECOND = 0.70 * PROGRESSION_MULTIPLIER;
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const WINDOW_SIZE = 6;
  function collageState(progress, count = media.length) {
    if (!count) return [];
    if (count === 1) return [{serial:0,index:0,role:progress < 1 ? 'incoming':'current',opacity:Math.max(0,Math.min(1,progress))}];
    const rounded = Math.round(progress);
    const stable = Math.abs(progress-rounded)<1e-9 ? rounded : Math.max(0,progress);
    const completed = Math.floor(stable), serial = completed - 1, fraction = stable - completed;
    const size = Math.min(WINDOW_SIZE, count);
    const first = Math.max(0, serial - size + 1), result = [];
    for (let i = first; i <= serial; i++) {
      result.push({serial:i, index:i % count, role:i === first && serial >= size - 1 && fraction > 0 ? 'outgoing' : 'current',
        opacity:count > 1 && i === first && serial >= size - 1 ? 1 - fraction : 1});
    }
    // A one-item source must not be repeated within its own window.
    if ((count > 1 && fraction > 0) || serial < 0) result.push({serial:serial + 1, index:(serial + 1) % count, role:'incoming', opacity:fraction});
    return result;
  }
  // Six related rectangles form an editorial spread. Each spread has a large
  // anchor, attached medium images and small fragments; later spreads change
  // their corner and proportions. Only positions change, never image orientation.
  function layout(serial, width, height, ratio = 1, sequence = media) {
    const group = Math.floor(serial / WINDOW_SIZE), slot = serial % WINDOW_SIZE;
    const variant = group % 6, mobile = width <= 700;
    const sizes = mobile ? [[.90,.53],[.58,.40],[.28,.19],[.67,.37],[.34,.22],[.48,.32]] :
      [[.62,.78],[.30,.65],[.14,.30],[.38,.48],[.18,.32],[.27,.48]];
    const boxes = [];
    const fit = i => {
      const source = sequence[(group * WINDOW_SIZE+i) % sequence.length];
      const aspect = i === slot ? ratio : source?.aspectRatio || (['mp4','video'].includes(source?.type) ? 16/9 : 1);
      const sourceSize = source?.size;
      const categorySizes = mobile ? {small:[.29,.22],medium:[.57,.40],large:[.90,.57]} :
        {small:[.17,.33],medium:[.35,.57],large:[.62,.78]};
      const [w,h] = categorySizes[sourceSize] || sizes[i];
      const scale = (variant % 3 === 2 ? [.94,1.07,.92,1.05,.90,1.08][i] : 1) *
        (sourceSize ? [1,.90,1.08,.96,.88,1.05][i] : 1);
      const imageWidth = Math.min(width*w*scale,height*h*aspect);
      return {width:imageWidth,height:imageWidth/aspect};
    };
    for (let i=0;i<=slot;i++) {
      const box=fit(i), anchor=boxes[0];
      if (i===0) {box.left=0;box.top=height*(mobile ? .08 : .04);}
      else if (mobile) {
        // A narrow vertical spread, with edge-linked overlaps rather than a
        // reduced copy of the desktop's horizontal composition.
        if(i===1){box.left=anchor.width-box.width*.68;box.top=anchor.top+anchor.height*.48;}
        if(i===2){box.left=boxes[1].left+boxes[1].width-box.width;box.top=boxes[1].top+boxes[1].height-box.height*.30;}
        if(i===3){box.left=anchor.left;box.top=boxes[1].top+boxes[1].height-box.height*.14;}
        if(i===4){box.left=boxes[3].left+boxes[3].width-box.width*.35;box.top=boxes[3].top+boxes[3].height*.16;}
        if(i===5){box.left=boxes[3].left+boxes[3].width*.20;box.top=boxes[3].top+boxes[3].height-box.height*.16;}
      } else {
        if(i===1){box.left=anchor.width-width*.07;box.top=anchor.top+height*.07;}
        if(i===2){box.left=boxes[1].left+boxes[1].width-box.width*.25;box.top=boxes[1].top+boxes[1].height-box.height*.35;}
        if(i===3){box.left=anchor.left+anchor.width*.18;box.top=anchor.top+anchor.height-box.height*.22;}
        if(i===4){box.left=boxes[3].left;box.top=boxes[3].top+boxes[3].height-box.height*.30;}
        if(i===5){box.left=boxes[1].left+boxes[1].width*.25;box.top=boxes[3].top+boxes[3].height*.18;}
      }
      // Alternate attached spreads shift the lower cluster along the anchor.
      // This changes the composition itself, in addition to its viewport corner.
      if (variant >= 3 && i === 3) {
        box.left = mobile ? anchor.width-box.width : anchor.width-box.width*.72;
        box.top = anchor.top+anchor.height-box.height*.32;
      }
      box.left=Math.max(0,Math.min(width-box.width,box.left));
      box.top=Math.max(0,Math.min(height-box.height,box.top));
      boxes.push(box);
    }
    const result={...boxes[slot]};
    if(variant % 3 === 1) result.left=Math.max(0,width-result.left-result.width);
    if(variant % 3 === 2) result.top=Math.max(0,height-result.top-result.height);
    return result;
  }
  function init(layer, sequence = media, initial = {}) {
    layer.replaceChildren();
    layer.dataset.progress = String(initial.progress || 0);
    if (!sequence.length) {layer.dataset.distance = '0'; root.Contrast?.refresh?.(); return () => {layer.replaceChildren();};}
    const fine = root.matchMedia('(pointer: fine)');
    const controller = new root.AbortController();
    const options = {signal: controller.signal};
    let previous = null, totalDistance = 0, progress = Math.max(0, Number(initial.progress) || 0), disposed = false, mouseBudget = 0;
    let frame = 0, lastTouchTime = 0, paintFrame = 0, paintFromMouse = false;
    const touches = new Set();
    function createNode(source) {
      const node = root.document.createElement(['video', 'mp4'].includes(source.type) ? 'video' : 'img');
      node.className = 'frontpage-fade-media';
      if (['video', 'mp4'].includes(source.type)) {node.muted = true; node.playsInline = true; node.preload = 'auto'; node.loop = true; node.controls = false; if (source.poster) node.poster = source.poster;}
      else {node.alt = ''; node.draggable = false; node.decoding = 'async';}
      return node;
    }
    function release(node) {
      if (node.tagName === 'VIDEO') {node.pause(); node.removeAttribute('src'); node.load();}
      else node.removeAttribute('src');
      node.remove();
    }
    // Bounded warm cache for this local 20-item sequence, including fast jumps.
    // Preloads never enter the DOM and never render or advance progress on load.
    const preloads = sequence.filter(source => source.type === 'image').slice(0,24).map(source => {
      const node = createNode(source); node.src = source.src;
      if (!['video', 'mp4'].includes(source.type)) node.decode?.().catch(() => {});
      return node;
    });
    const records = new Map();
    function place(record, serial) {
      const box = layer.getBoundingClientRect();
      const node = record.node;
      // Stable bounds for uploaded videos, even before metadata. The native
      // frame uses contain inside these bounds if its dimensions are unknown.
      const ratio = node.tagName === 'VIDEO' ? sequence[record.index].aspectRatio || 16/9 : node.naturalWidth && node.naturalHeight ? node.naturalWidth / node.naturalHeight :
        node.videoWidth && node.videoHeight ? node.videoWidth / node.videoHeight : sequence[record.index].aspectRatio || 1;
      const rect = layout(serial, box.width || root.innerWidth, box.height || root.innerHeight, ratio, sequence);
      for (const key of ['left','top','width','height']) node.style[key] = `${rect[key]}px`;
    }
    function render() {
      paintFrame = 0;
      if (disposed) return;
      const state = collageState(progress, sequence.length), live = new Set(state.map(item=>item.serial));
      for (const [serial,record] of records) if (!live.has(serial)) {release(record.node); records.delete(serial);}
      state.forEach((item,z)=>{
        let record = records.get(item.serial);
        if (!record) {
          const source = sequence[item.index], node = createNode(source);
          record = {node,index:item.index}; records.set(item.serial,record);
          node.addEventListener('load',()=>{if (!disposed && records.get(item.serial) === record) place(record,item.serial);},{once:true});
          node.addEventListener('loadedmetadata',()=>{if (!disposed && records.get(item.serial) === record) place(record,item.serial);},{once:true});
          node.src = source.src; layer.append(node);
        }
        Object.assign(record.node.dataset,{sequence:String(item.index),serial:String(item.serial),role:item.role,id:sequence[item.index].id || `local-${item.index}`});
        record.node.style.opacity = String(item.opacity); record.node.style.zIndex = String(z+1);
        place(record,item.serial);
        if (record.node.tagName === 'VIDEO') {
          if (item.opacity > 0 && !root.document.hidden && record.node.paused && !record.playPending) {
            record.playPending = true;
            record.node.play().catch(error=>{
              if (error?.name !== 'AbortError') record.node.dataset.autoplay = 'blocked';
            }).finally(()=>{record.playPending = false;});
          }
          else if (item.opacity <= 0 || root.document.hidden) record.node.pause();
        }
      });
      layer.dataset.distance = String(totalDistance); layer.dataset.progress = String(progress);
      root.Contrast?.refresh?.();
    }
    function scheduleRender(fromMouse = false) {
      paintFromMouse ||= fromMouse;
      if (!paintFrame) paintFrame = root.requestAnimationFrame(()=>{
        if (paintFromMouse) {
          // Never jump over a media item during a fast/coalesced pointer burst.
          // Excess travel is retained for the next actual input, never replayed
          // autonomously after the pointer stops.
          const advance = Math.min(MAX_PROGRESS_PER_INPUT_FRAME,mouseBudget);
          progress += advance; mouseBudget -= advance;
        }
        paintFromMouse = false; render();
      });
    }
    function reset() {
      stopTouch(); previous = null; totalDistance = 0; progress = 0;
      if (paintFrame) root.cancelAnimationFrame(paintFrame);
      for (const record of records.values()) release(record.node);
      records.clear(); preloads.forEach(release); preloads.length = 0;
      layer.replaceChildren(); layer.dataset.distance = '0'; layer.dataset.progress = '0';
    }
    render();
    function move(event) {
      if (disposed || !fine.matches || event.pointerType !== 'mouse') return;
      let moved = false;
      const samples = event.getCoalescedEvents?.() || [];
      for (const sample of samples.length ? samples : [event]) {
        const point = {x: sample.clientX, y: sample.clientY};
        if (previous) {
          const travelled = distance(previous, point);
          totalDistance += travelled; mouseBudget += travelled / DISTANCE_PER_IMAGE; moved ||= travelled > 0;
        }
        previous = point;
      }
      if (moved && mouseBudget > 0) scheduleRender(true);
    }
    function stopTouch() {
      touches.clear();
      if (frame) root.cancelAnimationFrame(frame);
      frame = 0; lastTouchTime = 0;
    }
    function tick(now) {
      frame = 0;
      if (disposed || !touches.size || root.document.hidden) {stopTouch(); return;}
      progress += Math.min(MAX_PROGRESS_PER_INPUT_FRAME,Math.max(0, now - lastTouchTime) / 1000 * MOBILE_TRANSITIONS_PER_SECOND);
      lastTouchTime = now;
      render();
      frame = root.requestAnimationFrame(tick);
    }
    function touchDown(event) {
      if (disposed || root.document.hidden || event.pointerType !== 'touch') return;
      // Do not capture or prevent navigation taps, including the menu backdrop.
      if (event.target.closest?.('a, button, input, select, textarea, summary, dialog, [role="button"], [contenteditable]:not([contenteditable="false"]), .site-header')) return;
      touches.add(event.pointerId);
      // Native touch capture keeps release/cancel routed here even after movement.
      event.target.setPointerCapture?.(event.pointerId);
      if (!frame) {
        lastTouchTime = root.performance.now();
        frame = root.requestAnimationFrame(tick);
      }
    }
    function touchEnd(event) {
      if (!touches.delete(event.pointerId)) return;
      if (!touches.size) {
        progress += Math.min(MAX_PROGRESS_PER_INPUT_FRAME,Math.max(0, root.performance.now() - lastTouchTime) / 1000 * MOBILE_TRANSITIONS_PER_SECOND);
        render(); stopTouch();
      }
    }
    root.document.addEventListener('pointerdown', touchDown, options);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      root.document.addEventListener(type, touchEnd, options);
    }
    root.document.addEventListener('visibilitychange', () => {
      for (const record of records.values()) {
        if (record.node.tagName !== 'VIDEO') continue;
        if (root.document.hidden) record.node.pause();
        else if (Number(record.node.style.opacity) > 0) record.node.play().catch(() => {});
      }
      if (root.document.hidden) {previous = null; stopTouch();}
    }, options);
    root.document.addEventListener('pointermove', move, {...options, passive: true});
    root.document.documentElement.addEventListener('pointerleave', () => {previous = null;}, options);
    root.addEventListener('blur', () => {previous = null; stopTouch();}, options);
    root.addEventListener('resize', () => {previous = null; scheduleRender();}, options);
    root.visualViewport?.addEventListener('resize', () => scheduleRender(), options);
    fine.addEventListener('change', () => {previous = null; stopTouch();}, options);
    return () => {disposed = true; controller.abort(); reset();};
  }
  const api = {init, media, distance, collageState, layout, WINDOW_SIZE, MAX_PROGRESS_PER_INPUT_FRAME, PROGRESSION_MULTIPLIER, DISTANCE_PER_IMAGE, MOBILE_TRANSITIONS_PER_SECOND};
  root.FrontpageMediaFade = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
