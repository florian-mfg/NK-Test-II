/* One renderer for work previews and project detail pages. */
const PROJECT_MODULE_TYPES = Object.freeze({
  full: [12],
  "half-half": [6, 6],
  "half-quarter-quarter": [6, 3, 3],
  "quarter-quarter-quarter-quarter": [3, 3, 3, 3],
  "third-third-third": [4, 4, 4],
  "two-thirds-one-third": [8, 4]
});
const PROJECT_MODULE_HEIGHTS = ["auto", "small", "medium", "large", "viewport"];

function escapeModuleAttribute(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function moduleMediaUrl(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Media requires a source URL");
  const url = new URL(value, document.baseURI);
  if (!["http:", "https:", "file:"].includes(url.protocol)) throw new Error("Unsupported media URL");
  return escapeModuleAttribute(value);
}

function moduleImagePosition(image) {
  if (!image?.hotspot) return "";
  const crop = image.crop || {left: 0, right: 0, top: 0, bottom: 0};
  const x = Math.max(0, Math.min(1, (image.hotspot.x - crop.left) / (1 - crop.left - crop.right)));
  const y = Math.max(0, Math.min(1, (image.hotspot.y - crop.top) / (1 - crop.top - crop.bottom)));
  return ` style="object-position: ${x * 100}% ${y * 100}%; --media-offset-x: ${x}; --media-offset-y: ${y}"`;
}

function renderProjectModule(module, title = "", mode = "detail") {
  if (!["overview", "detail"].includes(mode)) throw new Error("Invalid project playback mode");
  if (module.type === "spacer") {
    const size = module.size ?? "medium";
    if (!["small", "medium", "large"].includes(size)) throw new Error("Invalid spacer size");
    return `<div class="project-module project-module-spacer spacer-${size}" data-module-type="spacer" aria-hidden="true"></div>`;
  }
  const spans = Object.hasOwn(PROJECT_MODULE_TYPES, module.type) && PROJECT_MODULE_TYPES[module.type];
  const height = module.height ?? "auto";
  if (!spans || !PROJECT_MODULE_HEIGHTS.includes(height)) throw new Error("Invalid project module type or height");
  if (!Array.isArray(module.slots) || module.slots.length > spans.length) throw new Error("Invalid module slots");
  let order = spans.map((_, index) => index);
  if (module.order === "reverse") order.reverse();
  else if (Array.isArray(module.order)) order = module.order;
  else if (module.order != null && module.order !== "default") throw new Error("Invalid module order");
  if (order.length !== spans.length || new Set(order).size !== spans.length ||
      order.some(index => !Number.isInteger(index) || index < 0 || index >= spans.length)) {
    throw new Error("Module order must be a permutation of slot indices");
  }
  if (module.slots.some(slot => slot?.type === "video") && module.slots.every(slot => !slot || slot.type === "video" || slot.type === "empty")) return "";
  const slots = order.map(index => {
    const slot = module.slots[index];
    const style = `style="--slot-span: ${spans[index]}"`;
    if (slot?.type === "video") return `<div class="project-slot is-empty" ${style} aria-hidden="true"></div>`;
    if (slot == null) return `<div class="project-slot is-empty" ${style} aria-hidden="true"></div>`;
    if (slot.type === "text") {
      if (typeof slot.text !== "string" || !slot.text.trim()) throw new Error("Text slots require text");
      const textSize = slot.textSize ?? "s";
      if (!["s", "m", "l"].includes(textSize)) throw new Error("Invalid text size");
      const paragraphs = slot.text.trim().split(/\n\s*\n/).map(paragraph =>
        `<p>${escapeModuleAttribute(paragraph).replace(/\n/g, "<br>")}</p>`
      ).join("");
      return `<div class="project-slot project-slot-text text-size-${textSize}" ${style}>${paragraphs}</div>`;
    }
    const label = escapeModuleAttribute(slot.alt ?? title);
    const auto = slot.mediaDisplay === "auto";
    const dimensions = slot.image;
    const imageSize = auto && dimensions?.width > 0 && dimensions?.height > 0
      ? ` width="${Number(dimensions.width)}" height="${Number(dimensions.height)}"` : "";
    let media;
    if (slot.type === "image") media = `<img src="${moduleMediaUrl(slot.src)}" alt="${label}" loading="lazy" decoding="async"${auto ? imageSize : moduleImagePosition(slot.image)}>`;
    else if (slot.type === "mp4") {
      const playback = ["autoplay", "manual"].includes(slot.playback)
        ? slot.playback : mode === "overview" ? "autoplay" : "manual";
      const teaser = playback === "autoplay";
      media = `<div class="project-video"${auto && Number.isFinite(slot.aspectRatio) && slot.aspectRatio > 0 ? ` style="--video-ratio: ${slot.aspectRatio}"` : ""} data-playback="${playback}"${mode === "detail" ? ' data-project-detail-video' : ""}>
        ${slot.poster ? `<img class="project-video-poster" src="${moduleMediaUrl(slot.poster)}" alt="" aria-hidden="true"${moduleImagePosition(slot.posterImage)}>` : ""}
        <video data-project-native-src="${moduleMediaUrl(slot.src)}" aria-label="${label || "Project video"}" playsinline preload="metadata" ${teaser ? "autoplay muted loop" : ""}></video>
        ${teaser && mode !== "detail" ? "" : `<button class="project-video-toggle" type="button" aria-label="Play video" disabled>(Play)</button>`}
      </div>`;
    } else throw new Error("Unsupported project media type");
    return `<figure class="project-slot${auto ? " media-display-auto" : ""}" ${style}>${media}</figure>`;
  }).join("");
  const empty = module.slots.every(slot => slot == null);
  return `<div class="project-module height-${height}${module.slots.some(slot => slot?.mediaDisplay === "auto" && ["image", "mp4"].includes(slot.type)) ? " has-auto-media" : ""}${empty ? " is-empty" : ""}" data-module-type="${module.type}">${slots}</div>`;
}

function renderProjectModules(modules, title = "", mode = "detail") {
  return modules.map(module => renderProjectModule(module, title, mode)).join("");
}

// Keep Crop paint edges on physical pixels, independently of layout geometry.
// Fitting the source proportionally first avoids object-fit rounding and fractional
// overflow-mask antialiasing. Auto Height stays in native, unclipped document flow.
(function () {
  if (!document.documentElement || typeof ResizeObserver === "undefined") return;
  let frame = 0;
  const observed = new Set();
  const observer = new ResizeObserver(schedule);
  function schedule() {
    if (!globalThis.document?.documentElement || (!observed.size && !document.querySelector('.project-module'))) return;
    if (!frame) frame = requestAnimationFrame(update);
  }
  function update() {
    frame = 0;
    if (!globalThis.document?.documentElement) return;
    const rows = new Set(document.querySelectorAll('.project-module'));
    for (const row of observed) if (!rows.has(row)) { observer.unobserve?.(row); observed.delete(row); }
    for (const row of rows) if (!observed.has(row)) { observer.observe(row); observed.add(row); }
    const dpr = window.devicePixelRatio || 1;
    const snap = value => Math.round(value * dpr) / dpr;
    const writes = [];
    for (const media of document.querySelectorAll('.project-slot > img, .project-video > video')) {
      const slot = media.closest('.project-slot'), row = slot?.parentElement;
      if (!row || row.classList.contains('height-auto') || slot.classList.contains('media-display-auto')) continue;
      const video = media.tagName === 'VIDEO', host = video ? media.parentElement : slot;
      const ratio = video ? media.videoWidth / media.videoHeight : media.naturalWidth / media.naturalHeight;
      if (!Number.isFinite(ratio) || ratio <= 0) continue;
      const box = host.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const left = snap(box.left), top = snap(box.top + scrollY) - scrollY;
      const width = snap(box.right) - left, height = snap(box.bottom + scrollY) - scrollY - top;
      const paintHeight = Math.max(height, width / ratio), paintWidth = paintHeight * ratio;
      const position = getComputedStyle(media);
      const x = video ? .5 : parseFloat(position.getPropertyValue('--media-offset-x'));
      const y = video ? .5 : parseFloat(position.getPropertyValue('--media-offset-y'));
      const cropLeft = (paintWidth - width) * (Number.isFinite(x) ? x : .5);
      const cropTop = (paintHeight - height) * (Number.isFinite(y) ? y : .5);
      writes.push({media, width:paintWidth, height:paintHeight, left:left-box.left-cropLeft, top:top-box.top-cropTop,
        clip:`rect(${cropTop}px, ${cropLeft+width}px, ${cropTop+height}px, ${cropLeft}px)`});
    }
    for (const value of writes) {
      value.media.classList.add('pixel-crop-media');
      for (const key of ['width','height','left','top']) value.media.style[key] = `${value[key]}px`;
      value.media.style.clip = value.clip;
      // Override the inset shorthand used by the native-video fallback.
      value.media.style.right = value.media.style.bottom = 'auto';
    }
  }
  document.addEventListener('load', schedule, true);
  document.addEventListener('loadedmetadata', schedule, true);
  document.addEventListener('resize', schedule, true);
  document.fonts?.addEventListener('loadingdone', schedule);
  window.addEventListener('resize', schedule);
  new MutationObserver(schedule).observe(document.documentElement, {childList:true,subtree:true});
  schedule();
})();
