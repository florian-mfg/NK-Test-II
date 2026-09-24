/* Shared binary overlay contrast. No iframe/video pixels are ever read. */
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
  const targets = '.site-header > a, .site-header .main-nav a, .mobile-menu-toggle, .project-title > span, .project-kind, .detail-back, .detail-info-label, .archive-list, .project-video-toggle';
  let timer, cursorTimer, cursorPoint;
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
  function background(x, y, target) {
    const light = root.matchMedia('(max-width: 700px)').matches || document.body.matches('.is-work, .is-detail, .is-info');
    const stack = document.elementsFromPoint(x, y);
    const media = stack.find(node => node.matches('img, iframe, video, .project-vimeo, .home, .project-slot.is-empty, .project-slot-text'));
    const scope = target.closest('[data-text-color]') || media?.closest('[data-text-color]') ||
      stack.find(node => node.matches('[data-text-color]')) || document.querySelector('#app > [data-text-color]');
    const setting = mode(scope?.dataset.textColor);
    if (setting !== 'auto') return {setting};
    if (media?.matches('iframe, video') || media?.closest('.project-vimeo, .home')) return {setting, luminance: NaN};
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
      // Match the existing mobile Index scrim without touching its appearance.
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
    const cursor = document.querySelector('.open-cursor');
    if (cursorPoint && cursor && !cursor.hidden) apply(cursor, ...cursorPoint);
  }
  api.cursor = (x, y) => {
    cursorPoint = [x, y];
    if (!cursorTimer) cursorTimer = setTimeout(() => {cursorTimer = null; cursorRefresh();}, 100);
  };
  function refresh() {
    timer = null;
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
  document.addEventListener('load', schedule, true);
  document.addEventListener('scroll', schedule, {capture: true, passive: true});
  root.addEventListener('resize', schedule, {passive: true});
  new MutationObserver(schedule).observe(document.querySelector('#app'), {
    childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'data-text-color']
  });
  schedule();
})(typeof globalThis !== 'undefined' ? globalThis : this);
