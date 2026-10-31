/* Stationary, edge-connected media trail. Legacy filename/API retained for callers. */
(function (root) {
  'use strict';
  const media = root.FrontpageMedia || (typeof module !== 'undefined' && module.exports ? require('./frontpage-media.js') : []);
  const WINDOW_SIZE = 3, MAX_CURSOR_DISTANCE = 168;
  const centerDistance = (rect, point) => Math.hypot(rect.left + rect.width / 2 - point.x, rect.top + rect.height / 2 - point.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const overlaps = (a, b) => a.left < b.left + b.width - 1e-7 && a.left + a.width > b.left + 1e-7 && a.top < b.top + b.height - 1e-7 && a.top + a.height > b.top + 1e-7;
  function dimensions(source, width, height, ratio = source.aspectRatio || 1) {
    const mobile = width <= 700;
    const size = {small: mobile ? 66 : 100, medium: mobile ? 100 : 156, large: mobile ? 140 : 218}[source.size || 'medium'] || 156;
    // Preserve the enlarged CMS size targets and responsive viewport limits.
    const longest = Math.min(size * 1.75, width * .48, height * .48);
    return ratio >= 1 ? {width: longest, height: longest / ratio} : {width: longest * ratio, height: longest};
  }
  const inside = (rect, point) => point.x >= rect.left && point.x <= rect.left + rect.width && point.y >= rect.top && point.y <= rect.top + rect.height;
  // Clip a pointer segment to the rectangle. A segment can enter and then exit
  // after a fast previous move ended beyond the newly created media.
  function boundaryExit(rect, from, to) {
    if (inside(rect, to)) return null;
    const vector = {x: to.x - from.x, y: to.y - from.y};
    let enter = 0, exit = Infinity, edge = null;
    for (const [axis, lo, hi, lowEdge, highEdge] of [
      ['x', rect.left, rect.left + rect.width, 'left', 'right'],
      ['y', rect.top, rect.top + rect.height, 'top', 'bottom']
    ]) {
      if (!vector[axis]) {
        if (from[axis] < lo || from[axis] > hi) return null;
        continue;
      }
      const low = (lo - from[axis]) / vector[axis], high = (hi - from[axis]) / vector[axis];
      enter = Math.max(enter, Math.min(low, high));
      const far = Math.max(low, high);
      // Strict comparison gives horizontal edges priority at exact corners.
      if (far < exit) {exit = far; edge = vector[axis] > 0 ? highEdge : lowEdge;}
    }
    if (!edge || exit < 0 || exit > 1 || enter > exit || (!inside(rect, from) && enter === exit)) return null;
    const point = {x: from.x + vector.x * exit, y: from.y + vector.y * exit};
    // Pin the crossed coordinate to the exact edge, avoiding arithmetic drift.
    if (edge === 'left' || edge === 'right') point.x = rect.left + (edge === 'right' ? rect.width : 0);
    else point.y = rect.top + (edge === 'bottom' ? rect.height : 0);
    return {edge, point, vector, t: exit};
  }
  function adjacentPlacement(previous, size, active, crossing) {
    const edge=crossing.edge, horizontal=edge==='left'||edge==='right';
    const axis=horizontal?'top':'left', extent=horizontal?'height':'width';
    const cursor=horizontal?crossing.point.y:crossing.point.x;
    const rect={...size,edge,
      left:horizontal?(edge==='right'?previous.left+previous.width:previous.left-size.width):cursor-size.width/2,
      top:horizontal?cursor-size.height/2:(edge==='bottom'?previous.top+previous.height:previous.top-size.height)};
    // Check at most nine retained rectangles and two shifts around the first
    // obstacle. Keep the existing bounded heuristic for every FIFO size; do
    // not search combinations of alignments when more obstacles remain.
    const obstacle=active.find(box=>box!==previous && overlaps(rect,box));
    if (!obstacle) return rect;
    const lo=previous[axis]-size[extent]+.001, hi=previous[axis]+previous[extent]-.001;
    const shifts=[obstacle[axis]-size[extent],obstacle[axis]+obstacle[extent]];
    if(Math.abs(shifts[1]-rect[axis])<Math.abs(shifts[0]-rect[axis])) shifts.reverse();
    for(const value of shifts) {
      if(value<lo||value>hi) continue;
      const candidate={...rect,[axis]:value};
      if(!active.some(box=>overlaps(candidate,box))) return candidate;
    }
    // Keep speed, full size and the crossed edge when the retained obstacle
    // covers every alignment along the shared edge.
    return {...rect,overlapFallback:true};
  }
  const exitPlacement = adjacentPlacement;
  const EDGE_MARGIN = 8;
  function visiblePortion(rect, bounds, margin=0) {
    const left=Math.max(rect.left,bounds.viewLeft+margin),top=Math.max(rect.top,bounds.viewTop+margin);
    return {left,top,width:Math.max(0,Math.min(rect.left+rect.width,bounds.viewRight-margin)-left),
      height:Math.max(0,Math.min(rect.top+rect.height,bounds.viewBottom-margin)-top)};
  }
  function viewportExit(rect, from, to, bounds) {
    const visible=visiblePortion(rect,bounds,EDGE_MARGIN);
    if(!visible.width||!visible.height) return null;
    const hit=boundaryExit(visible,from,to);
    if(!hit) return null;
    const unreachable={left:rect.left<bounds.viewLeft,right:rect.left+rect.width>bounds.viewRight,
      top:rect.top<bounds.viewTop,bottom:rect.top+rect.height>bounds.viewBottom};
    return unreachable[hit.edge]?{...hit,continuation:true}:null;
  }
  function init(layer, sequence = media, initial = {}) {
    const requestedLimit = initial.visibleMediaLimit ?? initial.prepared?.visibleMediaLimit;
    const windowSize = Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 10 ? requestedLimit : WINDOW_SIZE;
    layer.replaceChildren();
    layer.dataset.visibleMediaLimit = String(windowSize);
    const controller = new root.AbortController(), options = {signal: controller.signal};
    function viewportBounds() {
      // Measurements occur only at initialization and viewport changes.
      const box=layer.getBoundingClientRect(),vv=root.visualViewport;
      const viewLeft=(vv?.offsetLeft||0)-box.left,viewTop=(vv?.offsetTop||0)-box.top;
      const width=vv?.width||root.innerWidth||box.width,height=vv?.height||root.innerHeight||box.height;
      return {left:box.left,top:box.top,width,height,viewLeft,viewTop,viewRight:viewLeft+width,viewBottom:viewTop+height};
    }
    let bounds=viewportBounds(),previous=null,serial=Math.max(0,Math.floor(Number(initial.progress)||0)),resume=false;
    let strandedTravel=0;
    let touch = null, disposed = false, contrastFrame = 0;
    const records = [], ratios = new Map(), sizes = new Map(), warm = new Map();
    const blocked = target => target?.closest?.('a, button, input, select, textarea, summary, dialog, [role="button"], [contenteditable], .site-header, .mobile-menu');
    function release(node) {
      if (node.tagName === 'VIDEO') {node.pause(); if(!initial.prepared){node.removeAttribute('src'); node.load();}}
      node.remove();
    }
    function warmNext() {
      if(initial.prepared)return;
      // A bounded image-only lookahead; never decode inactive videos.
      const wanted = new Set();
      for (let i = 0; i < Math.min(8, sequence.length); i++) {
        const index = (serial+i)%sequence.length, source = sequence[index];
        if (['video','mp4'].includes(source.type)) continue;
        wanted.add(index);
        if (warm.has(index)) continue;
        const img = new root.Image(); warm.set(index,img);
        img.onload = () => {if (!disposed && img.naturalHeight) {ratios.set(index,img.naturalWidth/img.naturalHeight); sizes.delete(index);}};
        img.src = source.src; img.decode?.().catch(()=>{});
      }
      for (const index of warm.keys()) if (!wanted.has(index)) warm.delete(index);
    }
    function emit(point, crossing = null) {
      if (!sequence.length || !bounds.width || !bounds.height) return false;
      const index = serial % sequence.length, source = sequence[index];
      const active = records.length === windowSize ? records.slice(1) : records;
      const activeRects = active.map(record => record.rect);
      let size=sizes.get(index);
      if(!size) {
        size=dimensions(source,bounds.width,bounds.height,ratios.get(index)||source.aspectRatio||(['video','mp4'].includes(source.type)?16/9:1));
        sizes.set(index,size);
      }
      let rect=crossing && !crossing.continuation ? exitPlacement(records.at(-1).rect,size,activeRects,crossing)
        : {...size,left:point.x-size.width/2,top:point.y-size.height/2,edge:crossing?'continuation':undefined};
      // A flush item can be wholly beyond the screen after a captured pointer
      // event. Re-anchor only the new item; never resize or move the trail.
      const visible=visiblePortion(rect,bounds,EDGE_MARGIN);
      if(crossing && (!visible.width||!visible.height)) {
        rect={...size,left:clamp(point.x,bounds.viewLeft+EDGE_MARGIN,bounds.viewRight-EDGE_MARGIN)-size.width/2,
          top:clamp(point.y,bounds.viewTop+EDGE_MARGIN,bounds.viewBottom-EDGE_MARGIN)-size.height/2,edge:'continuation'};
      }
      // Release FIFO before acquiring so even a one-item sequence can reuse nodes.
      if (records.length === windowSize) release(records.shift().node);
      const video = ['video','mp4'].includes(source.type), node = initial.prepared
        ? initial.prepared.acquire(source,records.map(r=>r.node)) : root.document.createElement(video ? 'video' : 'img');
      node.className = 'frontpage-fade-media';
      for(const key of ['exitEdge','sharedEdge','overlapFallback']) delete node.dataset[key];
      Object.assign(node.dataset,{serial:String(serial),sequence:String(index),id:source.id || `local-${index}`,brushX:String(point.x),brushY:String(point.y)});
      for (const key of ['left','top','width','height']) node.style[key] = `${rect[key]}px`;
      node.style.opacity = '1';
      if (crossing) {node.dataset.exitEdge = crossing.edge; node.dataset.sharedEdge = rect.edge; if(rect.overlapFallback) node.dataset.overlapFallback='true';}
      if (video) {
        node.muted = true; node.autoplay = true; node.loop = true; node.playsInline = true; node.controls = false; node.preload = 'auto';
        if (source.poster && !initial.prepared) node.poster = source.poster;
        if(!initial.prepared) node.addEventListener('loadedmetadata',()=>{if (node.videoHeight) {ratios.set(index,node.videoWidth/node.videoHeight); sizes.delete(index);}},{once:true, ...options});
      } else {node.alt = ''; node.draggable = false; node.decoding = 'async';}
      if (!initial.prepared) { if (video) node.crossOrigin = 'anonymous'; node.src = source.src; }
      records.push({node,rect}); layer.append(node); serial++;
      layer.dataset.progress = String(serial);
      if (video) {
        node.onerror = () => {
          node.dataset.playbackError = String(node.error?.code || 'unknown');
          if (!initial.prepared && node.crossOrigin === 'anonymous') {node.removeAttribute('crossorigin'); node.src = source.src; node.load(); node.play().catch(()=>{}); return;}
          console.warn('Frontpage video playback failed', source.src, node.error?.code, node.error?.message);
        };
        if (!root.document.hidden) node.play().then(()=>{delete node.dataset.autoplay;}).catch(error=>{
          node.dataset.autoplay = error.name === 'NotSupportedError' ? 'unsupported' : 'blocked';
          if (error.name === 'NotSupportedError') console.warn('Unsupported Frontpage video codec or source', source.src, error.message);
        });
      }
      warmNext();
      if (!contrastFrame) contrastFrame = root.requestAnimationFrame(()=>{contrastFrame = 0; if (!disposed) root.Contrast?.refresh?.();});
      return true;
    }
    function move(event) {
      if (disposed || (event.pointerType !== 'mouse' && event.pointerId !== touch)) return;
      if (blocked(event.target)) {previous = null; return;}
      const samples=event.getCoalescedEvents?.()||[];
      let attempted=false;
      for(let i=0;i<=samples.length;i++) {
        const sample=i===samples.length?event:samples[i];
        const point={x:sample.clientX-bounds.left,y:sample.clientY-bounds.top};
        if(previous && !attempted && (point.x!==previous.x||point.y!==previous.y)) {
          if(!records.length||resume) {
            const crossing=resume?{edge:'viewport',point,continuation:true}:null;
            const length=resume?0:distance(previous,point),step=length?Math.min(1,length)/length:1;
            const seed=resume?point:{x:previous.x+(point.x-previous.x)*step,y:previous.y+(point.y-previous.y)*step};
            attempted=true;emit(seed,crossing);resume=false;
          } else {
            const rect=records.at(-1).rect;
            const crossing=boundaryExit(rect,previous,point)||viewportExit(rect,previous,point,bounds);
            if(crossing) {strandedTravel=0;attempted=true;emit(crossing.point,crossing);}
            else if(!inside(rect,previous)&&!inside(rect,point)) {
              // A fast event may skip past the new rectangle entirely. Require
              // fresh movement beyond the same 8px boundary band before recovery.
              strandedTravel+=distance(previous,point);
              if(strandedTravel>EDGE_MARGIN){strandedTravel=0;attempted=true;emit(point,{edge:'viewport',point,continuation:true});}
            } else strandedTravel=0;
          }
        }
        previous=point;
      }
    }
    function end(event) {if (event.pointerId === touch) {touch = null; previous = null;}}
    root.document.addEventListener('pointerdown',event=>{
      if (event.pointerType !== 'touch' || touch !== null || blocked(event.target)) return;
      touch = event.pointerId; previous = {x:event.clientX-bounds.left,y:event.clientY-bounds.top};
      if (event.isTrusted) event.target.setPointerCapture?.(event.pointerId);
    },options);
    root.document.addEventListener('pointermove',move,{...options,passive:true});
    for (const type of ['pointerup','pointercancel','lostpointercapture']) root.document.addEventListener(type,end,options);
    root.document.documentElement.addEventListener('pointerleave',()=>{previous = null;},options);
    root.addEventListener('blur',()=>{previous = null; touch = null;},options);
    root.document.addEventListener('visibilitychange',()=>{
      for (const {node} of records) if (node.tagName === 'VIDEO') {
        if (root.document.hidden) node.pause(); else node.play().catch(()=>{});
      }
      previous = null;
    },options);
    function resize() {
      bounds=viewportBounds();sizes.clear();previous=null;
      if(records.length) {
        const visible=visiblePortion(records.at(-1).rect,bounds,EDGE_MARGIN);
        resume=!visible.width||!visible.height;
      }
    }
    root.addEventListener('resize',resize,options); root.visualViewport?.addEventListener('resize',resize,options); root.visualViewport?.addEventListener('scroll',resize,options);
    layer.dataset.progress=String(serial);warmNext();
    return () => {disposed = true; controller.abort(); if (contrastFrame) root.cancelAnimationFrame(contrastFrame); records.splice(0).forEach(r=>release(r.node)); warm.clear(); sizes.clear(); root.Contrast?.refresh?.();};
  }
  const api = {init,media,distance,dimensions,boundaryExit,adjacentPlacement,exitPlacement,inside,overlaps,centerDistance,viewportExit,visiblePortion,EDGE_MARGIN,WINDOW_SIZE,MAX_CURSOR_DISTANCE};
  root.FrontpageMediaFade = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
