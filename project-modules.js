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

function renderProjectModule(module, title = "") {
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
    const src = moduleMediaUrl(slot.src);
    const label = escapeModuleAttribute(slot.alt ?? title);
    let media;
    if (slot.type === "image") media = `<img src="${src}" alt="${label}" loading="lazy" decoding="async">`;
    else if (slot.type === "video") {
      media = `<video src="${src}" aria-label="${label}" controls playsinline preload="metadata"${slot.poster ? ` poster="${moduleMediaUrl(slot.poster)}"` : ""}></video>`;
    } else throw new Error("Unsupported project media type");
    return `<figure class="project-slot" ${style}>${media}</figure>`;
  }).join("");
  const empty = module.slots.every(slot => slot == null);
  return `<div class="project-module height-${height}${empty ? " is-empty" : ""}" data-module-type="${module.type}">${slots}</div>`;
}

function renderProjectModules(modules, title = "") {
  return modules.map(module => renderProjectModule(module, title)).join("");
}
