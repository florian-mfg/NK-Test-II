/* Stationary, edge-connected media trail. Legacy filename/API retained for callers. */
(function (root) {
  'use strict';
  const media = root.FrontpageMedia || (typeof module !== 'undefined' && module.exports ? require('./frontpage-media.js') : []);
  const WINDOW_SIZE = 6, DISTANCE_PER_IMAGE = 32, MAX_CURSOR_DISTANCE = 96;
  const centerDistance = (rect, point) => Math.hypot(rect.left + rect.width / 2 - point.x, rect.top + rect.height / 2 - point.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const overlaps = (a, b) => a.left < b.left + b.width - .01 && a.left + a.width > b.left + .01 && a.top < b.top + b.height - .01 && a.top + a.height > b.top + .01;
  function dimensions(source, width, height, ratio = source.aspectRatio || 1) {
    const mobile = width <= 700;
    const size = {small: mobile ? 66 : 100, medium: mobile ? 100 : 156, large: mobile ? 140 : 218}[source.size || 'medium'] || 156;
    const longest = Math.min(size, width * .32, height * .28);
    return ratio >= 1 ? {width: longest, height: longest / ratio} : {width: longest * ratio, height: longest};
  }
  // On each side, test the cursor projection and interval endpoints where an
  // obstacle starts/ends. This finds free shared-edge intervals without a grid.
  function placement(previous, size, active, point, vector, bounds, maxCursorDistance = MAX_CURSOR_DISTANCE) {
    if (!previous) {
      const rect = {...size, left: clamp(point.x - size.width / 2, 0, bounds.width - size.width), top: clamp(point.y - size.height / 2, 0, bounds.height - size.height)};
      return centerDistance(rect, point) <= maxCursorDistance && !active.some(box => overlaps(rect, box)) ? rect : null;
    }
    const length = Math.hypot(vector.x, vector.y) || 1;
    const sides = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
    let best = null, score = Infinity;
    for (const side of sides) {
      const horizontal = !!side.x, axis = horizontal ? 'top' : 'left', extent = horizontal ? 'height' : 'width';
      const shared = Math.min(previous[extent], size[extent]) * .25;
      const lo = Math.max(0, previous[axis] - size[extent] + shared);
      const hi = Math.min(bounds[extent] - size[extent], previous[axis] + previous[extent] - shared);
      if (lo > hi) continue;
      const desired = clamp((horizontal ? point.y : point.x) - size[extent] / 2, lo, hi);
      const values = [desired, lo, hi, clamp(previous[axis],lo,hi), clamp(previous[axis]+previous[extent]-size[extent],lo,hi)];
      for (const box of active) values.push(clamp(box[axis] - size[extent],lo,hi), clamp(box[axis] + box[extent],lo,hi));
      for (const value of values) {
        const rect = {...size, left: horizontal ? (side.x > 0 ? previous.left + previous.width : previous.left - size.width) : value,
          top: horizontal ? value : (side.y > 0 ? previous.top + previous.height : previous.top - size.height)};
        if (rect.left < 0 || rect.top < 0 || rect.left + rect.width > bounds.width + .01 || rect.top + rect.height > bounds.height + .01 || active.some(box => overlaps(rect,box))) continue;
        const proximity = centerDistance(rect, point);
        if (proximity > maxCursorDistance) continue;
        // Proximity is primary. Direction only resolves similarly close edges;
        // it must never pull a mark away from the sampled pointer trajectory.
        const candidateScore = proximity + (1 - (side.x * vector.x + side.y * vector.y) / length) * 18;
        if (candidateScore < score) {score = candidateScore; best = rect;}
      }
    }
    return best;
  }
  function init(layer, sequence = media, initial = {}) {
    layer.replaceChildren();
    const controller = new root.AbortController(), options = {signal: controller.signal};
    const threshold = Math.max(8, Number(initial.distancePerImage) || DISTANCE_PER_IMAGE);
    const maxCursorDistance = Math.max(1, Number(initial.maxCursorDistance) || (layer.clientWidth <= 700 ? 64 : MAX_CURSOR_DISTANCE));
    let bounds = layer.getBoundingClientRect(), previous = null, travel = 0, total = 0, serial = Math.max(0, Math.floor(Number(initial.progress) || 0));
    let touch = null, disposed = false, contrastFrame = 0, retryPlacement = false;
    const records = [], ratios = new Map(), warm = new Map();
    const blocked = target => target?.closest?.('a, button, input, select, textarea, summary, dialog, [role="button"], [contenteditable], .site-header, .mobile-menu');
    function release(node) {
      if (node.tagName === 'VIDEO') {node.pause(); node.removeAttribute('src'); node.load();}
      node.remove();
    }
    function warmNext() {
      // A bounded image-only lookahead; never decode inactive videos.
      const wanted = new Set();
      for (let i = 0; i < Math.min(8, sequence.length); i++) {
        const index = (serial+i)%sequence.length, source = sequence[index];
        if (['video','mp4'].includes(source.type)) continue;
        wanted.add(index);
        if (warm.has(index)) continue;
        const img = new root.Image(); warm.set(index,img);
        img.onload = () => {if (!disposed && img.naturalHeight) ratios.set(index,img.naturalWidth/img.naturalHeight);};
        img.src = source.src; img.decode?.().catch(()=>{});
      }
      for (const index of warm.keys()) if (!wanted.has(index)) warm.delete(index);
    }
    function emit(point, vector) {
      if (!sequence.length) return false;
      const index = serial % sequence.length, source = sequence[index];
      const active = records.length === WINDOW_SIZE ? records.slice(1) : records;
      const activeRects = active.map(record => record.rect);
      const anchors = activeRects.slice().reverse();
      const size = dimensions(source,bounds.width,bounds.height,ratios.get(index) || source.aspectRatio || (['video','mp4'].includes(source.type) ? 16/9 : 1));
      let rect;
      // Prefer the latest mark; a reversal may instead join another nearby
      // retained edge. Never attach to an outgoing mark or choose a distant edge.
      // Existing size targets and tight-corner scale fallbacks remain unchanged.
      for (const scale of [1,.75,.5,.3]) {
        const fragment = {width:size.width*scale,height:size.height*scale};
        if (!anchors.length) rect = placement(null,fragment,[],point,vector,bounds,maxCursorDistance);
        for (const anchor of anchors) {
          rect = placement(anchor,fragment,activeRects,point,vector,bounds,maxCursorDistance);
          if (rect) break;
        }
        if (rect) break;
        // Do not shrink a correctly sized mark merely to chase the cursor.
        // Retain the existing smaller-fragment fallback only for geometric
        // collisions/boundaries, and wait if its valid edge is still distant.
        if (anchors.some(anchor => placement(anchor,fragment,activeRects,point,vector,bounds,Infinity))) return false;
      }
      if (!rect) return false;
      const video = ['video','mp4'].includes(source.type), node = root.document.createElement(video ? 'video' : 'img');
      node.className = 'frontpage-fade-media';
      Object.assign(node.dataset,{serial:String(serial),sequence:String(index),id:source.id || `local-${index}`,brushX:String(point.x),brushY:String(point.y)});
      for (const key of ['left','top','width','height']) node.style[key] = `${rect[key]}px`;
      node.style.opacity = '1';
      if (video) {
        node.muted = true; node.autoplay = true; node.loop = true; node.playsInline = true; node.controls = false; node.preload = 'auto';
        if (source.poster) node.poster = source.poster;
        node.addEventListener('loadedmetadata',()=>{if (node.videoHeight) ratios.set(index,node.videoWidth/node.videoHeight);},{once:true, ...options});
      } else {node.alt = ''; node.draggable = false; node.decoding = 'async';}
      node.src = source.src;
      // Remove first: even a MutationObserver never sees a seven-item DOM.
      if (records.length === WINDOW_SIZE) release(records.shift().node);
      records.push({node,rect}); layer.append(node); serial++;
      layer.dataset.progress = String(serial);
      if (video && !root.document.hidden) node.play().catch(()=>{node.dataset.autoplay = 'blocked';});
      warmNext();
      if (!contrastFrame) contrastFrame = root.requestAnimationFrame(()=>{contrastFrame = 0; if (!disposed) root.Contrast?.refresh?.();});
      return true;
    }
    function move(event) {
      if (disposed || (event.pointerType !== 'mouse' && event.pointerId !== touch)) return;
      if (blocked(event.target)) {previous = null; travel = 0; retryPlacement = false; return;}
      const samples = event.getCoalescedEvents?.() || [];
      for (const sample of samples.length ? samples : [event]) {
        const point = {x:sample.clientX-bounds.left,y:sample.clientY-bounds.top};
        if (!previous) {previous = point; continue;}
        const length = distance(previous,point), vector = {x:point.x-previous.x,y:point.y-previous.y};
        if (!length) continue;
        if (!records.length) {
          // Start at the beginning of the travelled segment, not its endpoint.
          // Otherwise a rapid first gesture anchors the chain ahead of its path.
          const step = Math.min(1, length);
          retryPlacement = !emit({x:previous.x + vector.x * step / length,y:previous.y + vector.y * step / length},vector);
        }
        // Consume long/coalesced segments at spatial intervals in this input,
        // with no animation queue that could continue after movement stops.
        let consumed = 0;
        while (travel + length - consumed >= threshold) {
          consumed += threshold - travel; travel = 0;
          retryPlacement = !emit({x:previous.x+vector.x*consumed/length,y:previous.y+vector.y*consumed/length},vector);
        }
        travel += length-consumed;
        // Once travel is eligible but blocked, also test subsequent live path
        // endpoints. Narrow free intervals must not fall between 32px samples.
        // A successful retry consumes the budget; nothing is replayed while idle.
        if (retryPlacement && consumed < length && emit(point,vector)) {retryPlacement = false; travel = 0;}
        total += length; previous = point;
      }
      layer.dataset.distance = String(total);
    }
    function end(event) {if (event.pointerId === touch) {touch = null; previous = null; travel = 0; retryPlacement = false;}}
    root.document.addEventListener('pointerdown',event=>{
      if (event.pointerType !== 'touch' || touch !== null || blocked(event.target)) return;
      touch = event.pointerId; previous = {x:event.clientX-bounds.left,y:event.clientY-bounds.top}; travel = 0; retryPlacement = false;
      if (event.isTrusted) event.target.setPointerCapture?.(event.pointerId);
    },options);
    root.document.addEventListener('pointermove',move,{...options,passive:true});
    for (const type of ['pointerup','pointercancel','lostpointercapture']) root.document.addEventListener(type,end,options);
    root.document.documentElement.addEventListener('pointerleave',()=>{previous = null; travel = 0; retryPlacement = false;},options);
    root.addEventListener('blur',()=>{previous = null; touch = null; travel = 0; retryPlacement = false;},options);
    root.document.addEventListener('visibilitychange',()=>{
      for (const {node} of records) if (node.tagName === 'VIDEO') {
        if (root.document.hidden) node.pause(); else node.play().catch(()=>{});
      }
      previous = null; travel = 0; retryPlacement = false;
    },options);
    function resize() {
      const next = layer.getBoundingClientRect();
      if (next.width === bounds.width && next.height === bounds.height) return;
      // A resized coordinate system starts a fresh trail; sequence order persists.
      records.splice(0).forEach(r=>release(r.node)); bounds = next; previous = null; travel = 0; retryPlacement = false;
    }
    root.addEventListener('resize',resize,options); root.visualViewport?.addEventListener('resize',resize,options);
    layer.dataset.progress = String(serial); layer.dataset.distance = '0'; layer.dataset.maxCursorDistance = String(maxCursorDistance); warmNext();
    return () => {disposed = true; controller.abort(); if (contrastFrame) root.cancelAnimationFrame(contrastFrame); records.splice(0).forEach(r=>release(r.node)); warm.clear(); root.Contrast?.refresh?.();};
  }
  const api = {init,media,distance,dimensions,placement,overlaps,centerDistance,WINDOW_SIZE,DISTANCE_PER_IMAGE,MAX_CURSOR_DISTANCE};
  root.FrontpageMediaFade = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
