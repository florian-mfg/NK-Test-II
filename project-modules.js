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
  return ` style="object-position: ${x * 100}% ${y * 100}%"`;
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
  const slots = order.map(index => {
    const slot = module.slots[index];
    const style = `style="--slot-span: ${spans[index]}"`;
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
    let media;
    if (slot.type === "image") media = `<img src="${moduleMediaUrl(slot.src)}" alt="${label}" loading="lazy" decoding="async"${moduleImagePosition(slot.image)}>`;
    else if (slot.type === "video") {
      const video = VimeoMedia.parseVimeoUrl(slot.vimeoUrl ?? slot.src);
      if (!video) throw new Error("Project videos require a Vimeo URL");
      const url = new URL(video.embedUrl);
      const playback = ["autoplay", "manual"].includes(slot.playback)
        ? slot.playback : mode === "overview" ? "autoplay" : "manual";
      const teaser = playback === "autoplay";
      const options = {background: teaser ? "1" : "0", autoplay: teaser ? "1" : "0",
        muted: teaser ? "1" : "0", loop: teaser ? "1" : "0", controls: "0",
        autopause: "0", title: "0", byline: "0", portrait: "0", badge: "0",
        keyboard: "0", playsinline: "1", dnt: "1"};
      for (const [key, value] of Object.entries(options)) url.searchParams.set(key, value);
      media = `<div class="project-vimeo" data-playback="${playback}">
        ${slot.poster ? `<img class="project-video-poster" src="${moduleMediaUrl(slot.poster)}" alt="" aria-hidden="true"${moduleImagePosition(slot.posterImage)}>` : ""}
        <iframe data-project-video-src="${escapeModuleAttribute(url.href)}" title="${label || "Project video"}" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" tabindex="-1"></iframe>
        ${teaser ? "" : `<button class="project-video-toggle" type="button" aria-label="Play video" disabled>(Play)</button>`}
      </div>`;
    } else throw new Error("Unsupported project media type");
    return `<figure class="project-slot" ${style}>${media}</figure>`;
  }).join("");
  const empty = module.slots.every(slot => slot == null);
  return `<div class="project-module height-${height}${empty ? " is-empty" : ""}" data-module-type="${module.type}">${slots}</div>`;
}

function renderProjectModules(modules, title = "", mode = "detail") {
  return modules.map(module => renderProjectModule(module, title, mode)).join("");
}
