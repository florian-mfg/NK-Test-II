/* Two fullscreen planes. Only accumulated input changes incoming opacity. */
(function (root) {
  'use strict';
  const media = [
    'DSCF6919.jpg', 'Mountain_v20003.jpg', '_DSF0857.jpg', 'Stone_Artefakt_9.jpg',
    'Iceland25_Echo.jpg', 'DSCF2880.jpg', 'MA_GD_Tanzartefakt_7.jpg', '_DSF2669.jpg',
    'Stone_Conserve_Blau_RZ_v2.jpg', 'DSCF1339.jpg', 'DSCF6978.jpg', 'TextureBump_ARC_W_RZ.jpg',
    '_DSF3392.jpg', 'DSCF7780.jpg', 'Strommast_Sundown_RZ.jpg', '_DSF5795.jpg',
    'MountainRange_raw.jpg', '_DSF4139.jpg', 'DSCF7807.jpg', '_DSF6111.jpg'
  ].map(file => ({type: 'image', src: `material/${file}`}));

  // Travelled CSS pixels per complete reveal. Higher = slower.
  const DISTANCE_PER_IMAGE = 1200;
  const MOBILE_TRANSITIONS_PER_SECOND = 0.28;
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  function transitionState(progress, count = media.length) {
    const serial = Math.floor(Math.max(0, progress));
    return {serial, currentIndex: serial % count, incomingIndex: (serial + 1) % count,
      opacity: Math.max(0, Math.min(1, progress - serial))};
  }
  function init(layer, sequence = media) {
    if (!sequence.length) return () => {};
    const fine = root.matchMedia('(pointer: fine)');
    const controller = new root.AbortController();
    const options = {signal: controller.signal};
    let previous = null, totalDistance = 0, progress = 0, disposed = false;
    let frame = 0, lastTouchTime = 0, currentSerial = 0;
    const touches = new Set();
    function createNode(source) {
      const node = root.document.createElement(source.type === 'video' ? 'video' : 'img');
      node.className = 'frontpage-fade-media';
      if (source.type === 'video') {node.muted = true; node.playsInline = true; node.preload = 'metadata';}
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
    const preloads = sequence.map(source => {
      const node = createNode(source); node.src = source.src;
      if (source.type !== 'video') node.decode?.().catch(() => {});
      return node;
    });
    let current = {node: createNode(sequence[0]), index: -1};
    let incoming = {node: createNode(sequence[1 % sequence.length]), index: -1};
    current.node.fetchPriority = 'high';
    layer.replaceChildren(current.node, incoming.node);
    function setSource(record, index, serial, role, opacity, z) {
      const source = sequence[index], tag = source.type === 'video' ? 'VIDEO' : 'IMG';
      if (record.node.tagName !== tag) {
        const next = createNode(source); record.node.replaceWith(next); release(record.node);
        record.node = next; record.index = -1;
      }
      if (record.index !== index) {record.node.src = source.src; record.index = index;}
      Object.assign(record.node.dataset, {sequence: String(index), serial: String(serial), role});
      record.node.style.opacity = String(opacity); record.node.style.zIndex = String(z);
    }
    function render() {
      const state = transitionState(progress, sequence.length);
      // Adjacent transitions promote the already-prepared incoming node.
      // Large jumps select only the final pair; no historical node allocation.
      if ((state.serial - currentSerial) % 2) [current, incoming] = [incoming, current];
      currentSerial = state.serial;
      setSource(current, state.currentIndex, state.serial, 'current', 1, 1);
      setSource(incoming, state.incomingIndex, state.serial + 1, 'incoming', state.opacity, 2);
      layer.dataset.distance = String(totalDistance); layer.dataset.progress = String(progress);
    }
    function reset() {
      stopTouch(); previous = null; totalDistance = 0; progress = 0;
      release(current.node); release(incoming.node);
      preloads.forEach(release); preloads.length = 0;
      layer.replaceChildren(); layer.dataset.distance = '0'; layer.dataset.progress = '0';
    }
    render();
    function move(event) {
      if (disposed || !fine.matches || event.pointerType !== 'mouse') return;
      const samples = event.getCoalescedEvents?.() || [];
      for (const sample of samples.length ? samples : [event]) {
        const point = {x: sample.clientX, y: sample.clientY};
        if (previous) {
          const travelled = distance(previous, point);
          totalDistance += travelled; progress += travelled / DISTANCE_PER_IMAGE;
        }
        previous = point;
      }
      // Synchronous bounded writes: the last event paints the exact final state.
      if (progress > 0) render();
    }
    function stopTouch() {
      touches.clear();
      if (frame) root.cancelAnimationFrame(frame);
      frame = 0; lastTouchTime = 0;
    }
    function tick(now) {
      frame = 0;
      if (disposed || !touches.size || root.document.hidden) {stopTouch(); return;}
      progress += Math.max(0, now - lastTouchTime) / 1000 * MOBILE_TRANSITIONS_PER_SECOND;
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
      if (!touches.size) stopTouch();
    }
    root.document.addEventListener('pointerdown', touchDown, options);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      root.document.addEventListener(type, touchEnd, options);
    }
    root.document.addEventListener('visibilitychange', () => {
      if (root.document.hidden) {previous = null; stopTouch();}
    }, options);
    root.document.addEventListener('pointermove', move, {...options, passive: true});
    root.document.documentElement.addEventListener('pointerleave', () => {previous = null;}, options);
    root.addEventListener('blur', () => {previous = null; stopTouch();}, options);
    root.addEventListener('resize', () => {
      previous = null;
    }, options);
    fine.addEventListener('change', () => {previous = null; stopTouch();}, options);
    return () => {disposed = true; controller.abort(); reset();};
  }
  const api = {init, media, distance, transitionState, DISTANCE_PER_IMAGE, MOBILE_TRANSITIONS_PER_SECOND};
  root.FrontpageMediaFade = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
