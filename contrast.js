/* Shared binary overlay contrast; Frontpage video sampling is throttled. */
(function (root) {
  'use strict';
  const BLACK = '#000000', WHITE = '#ffffff', SIZE = 64;
  const mode = value => value === 'black' || value === 'white' ? value : 'auto';
  const linear = value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  function choose(value, luminance, previous) {
    if (mode(value) !== 'auto') return value === 'black' ? BLACK : WHITE;
    if (!Number.isFinite(luminance)) return WHITE;
    // WCAG black/white crossover with a dead band to prevent small changes flickering.
    if (previous === BLACK && luminance >= .15) return BLACK;
    if (previous === WHITE && luminance <= .21) return WHITE;
    return luminance > .179 ? BLACK : WHITE;
  }
  function sample(grid, x, y, shade = 1, backdrop = 1) {
    let total = 0, count = 0;
    const cx = Math.round(x * (SIZE - 1)), cy = Math.round(y * (SIZE - 1));
    for (let py = Math.max(0, cy - 2); py <= Math.min(SIZE - 1, cy + 2); py++) {
      for (let px = Math.max(0, cx - 2); px <= Math.min(SIZE - 1, cx + 2); px++) {
        const i = (py * SIZE + px) * 4, alpha = grid[i + 3] / 255;
        const channel = offset => linear((grid[i + offset] / 255 * alpha + backdrop * (1 - alpha)) * shade);
        total += .2126 * channel(0) + .7152 * channel(1) + .0722 * channel(2); count++;
      }
    }
    return count ? total / count : NaN;
  }
  const api = {choose, sample, mode};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Contrast = api;
  if (!root.document) return;
  const document = root.document, cache = new Map();
  const targets = '.site-header > a, .site-header .main-nav :is(a, .work-toggle), .mobile-menu-toggle, .project-title > span, .project-kind, .detail-back, .detail-info-label, .detail-sound-control, .archive-list, .project-video-toggle';
  let timer, cursorTimer, cursorPoint;
  // Reuse decoded images from the loader as small luminance grids.
  // Index and overview routes keep their fixed colors and skip preparation.
  api.prepareImage = (src, image) => {
    if (document.body.matches('.is-index, .is-work') || cache.has(src)) return;
    const data = {grid: null, width: image.naturalWidth, height: image.naturalHeight};
    cache.set(src, data);
    if (cache.size > 64) cache.delete(cache.keys().next().value);
    try {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
      const context = canvas.getContext('2d', {willReadFrequently: true});
      context.drawImage(image, 0, 0, SIZE, SIZE);
      data.grid = context.getImageData(0, 0, SIZE, SIZE).data;
    } catch { /* Keep the existing fallback for unavailable canvas pixels. */ }
  };
  function imageData(src) {
    if (cache.has(src)) return cache.get(src);
    const data = {grid: null, width: 0, height: 0};
    cache.set(src, data);
    if (cache.size > 64) cache.delete(cache.keys().next().value);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
        const context = canvas.getContext('2d', {willReadFrequently: true});
        context.drawImage(image, 0, 0, SIZE, SIZE);
        data.grid = context.getImageData(0, 0, SIZE, SIZE).data;
        data.width = image.naturalWidth; data.height = image.naturalHeight;
      } catch { /* Failed or tainted canvas: cache the predictable fallback. */ }
      schedule();
    };
    image.onerror = () => {}; // Cache failures too; do not repeatedly request blocked images.
    image.src = src;
    return data;
  }
  const videoSamples = new WeakMap();
  let lastHomeRefresh = -Infinity;
  function homeBackground(x, y) {
    if (document.body.classList.contains('mobile-menu-open')) return {setting: 'auto', luminance: 1};
    // Brush media ignore pointer events, so hit-test their painted rectangles
    // explicitly, newest first, rather than relying on elementsFromPoint.
    const media = [...document.querySelectorAll('.frontpage-fade-media')].reverse().find(node => {
      const r = node.getBoundingClientRect();
      return x >= r.left && x < r.right && y >= r.top && y < r.bottom && getComputedStyle(node).visibility !== 'hidden';
    });
    if (!media) return {setting: 'auto', luminance: 1};
    let data;
    if (media.tagName === 'VIDEO') {
      data = videoSamples.get(media);
      if (!data) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
        data = {canvas, context: canvas.getContext('2d', {willReadFrequently: true}), grid: null, stamp: -Infinity};
        videoSamples.set(media, data);
      }
      if (!data.blocked && media.readyState >= 2 && performance.now() - data.stamp >= 250) {
        data.stamp = performance.now();
        try {
          data.context.drawImage(media, 0, 0, SIZE, SIZE);
          data.grid = data.context.getImageData(0, 0, SIZE, SIZE).data;
        } catch { data.blocked = true; } // Cache CORS failures; never retry every frame.
      }
      data.width = media.videoWidth; data.height = media.videoHeight;
    } else data = imageData(media.currentSrc || media.src);
    if (!data.grid) return {setting: 'auto', luminance: NaN};
    const box = media.getBoundingClientRect(), style = getComputedStyle(media);
    let width = box.width, height = box.height, left = box.left, top = box.top;
    if (style.objectFit === 'cover' || style.objectFit === 'contain') {
      const scale = (style.objectFit === 'cover' ? Math.max : Math.min)(width / data.width, height / data.height);
      width = data.width * scale; height = data.height * scale;
      const position = style.objectPosition.split(' ').map(value => parseFloat(value) / 100);
      left += (box.width - width) * (position[0] || 0);
      top += (box.height - height) * (position[1] || 0);
    }
    if (x < left || x > left + width || y < top || y > top + height) return {setting: 'auto', luminance: 1};
    return {setting: 'auto', luminance: sample(data.grid, (x - left) / width, (y - top) / height, 1, 1)};
  }
  function background(x, y, target) {
    if (document.body.classList.contains('is-home')) return homeBackground(x, y);
    const light = !document.body.matches('.is-index') && (root.matchMedia('(max-width: 700px)').matches || document.body.matches('.is-work, .is-detail, .is-info'));
    const stack = document.elementsFromPoint(x, y);
    const media = stack.find(node => node.matches('img, video, .project-video, .home, .project-slot.is-empty, .project-slot-text'));
    const scope = target.closest('[data-text-color]') || media?.closest('[data-text-color]') ||
      stack.find(node => node.matches('[data-text-color]')) || document.querySelector('#app > [data-text-color]');
    const setting = mode(scope?.dataset.textColor);
    if (setting !== 'auto') return {setting};
    if (media?.matches('video') || media?.closest('.project-video, .home')) return {setting, luminance: NaN};
    if (media?.matches('img') && !media.closest('.site-header')) {
      const data = imageData(media.currentSrc || media.src);
      if (!data.grid) return {setting, luminance: NaN};
      const box = media.getBoundingClientRect(), style = getComputedStyle(media);
      let width = box.width, height = box.height, left = box.left, top = box.top;
      if (style.objectFit === 'cover' || style.objectFit === 'contain') {
        const scale = (style.objectFit === 'cover' ? Math.max : Math.min)(width / data.width, height / data.height);
        width = data.width * scale; height = data.height * scale;
        const position = style.objectPosition.split(' ').map(value => parseFloat(value) / 100);
        left += (box.width - width) * (position[0] || 0);
        top += (box.height - height) * (position[1] || 0);
      }
      const nx = Math.max(0, Math.min(1, (x - left) / width));
      const ny = Math.max(0, Math.min(1, (y - top) / height));
      // Match the mobile media filter; uncovered Index areas remain black.
      const shade = media.closest('.archive') && root.matchMedia('(max-width: 700px)').matches ? .72 : 1;
      return {setting, luminance: sample(data.grid, nx, ny, shade, light ? 1 : 0)};
    }
    return {setting, luminance: light ? 1 : 0};
  }
  function apply(target, x, y) {
    const result = background(x, y, target);
    const previous = target.style.getPropertyValue('--contrast-color');
    const color = choose(result.setting, result.luminance, previous);
    if (color !== previous) target.style.setProperty('--contrast-color', color);
  }
  function cursorRefresh() {
    if (document.body.matches('.is-home, .is-index, .is-work')) return;
    const cursor = document.querySelector('.open-cursor');
    if (cursorPoint && cursor && !cursor.hidden) apply(cursor, ...cursorPoint);
  }
  api.cursor = (x, y) => {
    cursorPoint = [x, y];
    if (!cursorTimer) cursorTimer = setTimeout(() => {cursorTimer = null; cursorRefresh();}, 100);
  };
  function refresh() {
    timer = null;
    // Index and overviews keep fixed white colors.
    if (document.body.matches('.is-index, .is-work')) return;
    if (document.body.classList.contains('is-home')) {
      const now = performance.now();
      if (now - lastHomeRefresh < 120) { schedule(); return; }
      lastHomeRefresh = now;
    }
    for (const target of document.querySelectorAll(targets)) {
      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= root.innerHeight) continue;
      // Index list extends down the viewport: sample beside its active/top row.
      const y = target.matches('.archive-list') ? rect.top + 10 : rect.top + rect.height / 2;
      apply(target, Math.max(0, Math.min(root.innerWidth - 1, rect.left + Math.min(rect.width / 2, 160))), Math.min(root.innerHeight - 1, y));
    }
    cursorRefresh();
  }
  function schedule() { if (!timer) timer = setTimeout(refresh, 120); }
  api.refresh = refresh;
  // Moving frames can change behind stationary text. Four checks per second,
  // only on a visible Frontpage with active video; no animation-frame readback.
  setInterval(() => {
    if (!document.hidden && document.body.classList.contains('is-home') &&
        [...document.querySelectorAll('.frontpage-fade-media')].some(n => n.tagName === 'VIDEO' && !n.paused)) schedule();
  }, 250);
  document.addEventListener('load', schedule, true);
  document.addEventListener('scroll', schedule, {capture: true, passive: true});
  root.addEventListener('resize', schedule, {passive: true});
  new MutationObserver(schedule).observe(document.querySelector('#app'), {
    childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'data-text-color']
  });
  schedule();
})(typeof globalThis !== 'undefined' ? globalThis : this);
