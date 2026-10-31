/* Archive entries: title, category, year, images, optional layout, optional additional info.
   Brand names below are illustrative placeholders. Use null for the default layout. */

const ARCHIVE_PROJECTS = [
  ["Mystic Landscapes", "Graphic", "2026", ["material/TextureBump_ARC_W_RZ.jpg", "material/Stone_Conserve_Blau_RZ_v2.jpg"]],
  ["Bilateral", "Video", "2026", ["material/_DSF0857.jpg", "material/_DSF0864.jpg", "material/_DSF2669.jpg"], null, "Palace"],
  ["SS27 Backstage", "Commissioned", "2025", ["material/DSCF6919.jpg", "material/DSCF6978.jpg", "material/DSCF7079.jpg"]],
  ["Unseen Connections", "Video", "2025", ["material/Strommast_Sundown_RZ.jpg", "material/DSCF1339.jpg"]],
  ["A Journey Within", "Graphic", "2025", ["material/Stone_Artefakt_9.jpg", "material/MA_GD_Tanzartefakt_7.jpg"], null, "Loewe"],
  ["Urban Echoes", "Commissioned", "2024", ["material/_DSF5795.jpg", "material/_DSF5962.jpg"]],
  ["Digital Mirage", "Graphic", "2024", ["material/Mountain_v20003.jpg", "material/Mountain_v20006.jpg"], null, "Acne Studios"],
  ["The Hidden Layers", "Graphic", "2024", ["material/Stone_Conserve_Blau_RZ_v2.jpg", "material/TextureBump_ARC_W_RZ.jpg"], null, "Bottega Veneta"],
  ["The Last Light", "Commissioned", "2023", ["material/DSCF7780.jpg", "material/DSCF7807.jpg", "material/DSCF7858.jpg"]],
  ["Kaleidoscope", "Graphic", "2023", ["material/MA_GD_Tanzartefakt_7.jpg", "material/Stone_Artefakt_9.jpg"], null, "Maison Margiela"],
  ["Shadows Of The Past", "Video", "2023", ["material/_DSF4139.jpg", "material/_DSF5771.jpg"]],
  ["Fractal Dreams", "Commissioned", "2022", ["material/Strommast_Sundown_RZ.jpg", "material/Iceland25_Echo.jpg"]],
  ["The Edge Of Reality", "Video", "2022", ["material/MountainRange_raw.jpg", "material/Mountain_v20003.jpg"]]
  ,["Cognitive Dissonance", "Graphic", "2022", ["material/TextureBump_ARC_W_RZ.jpg", "material/MA_GD_Tanzartefakt_7.jpg"], null, "Comme des Garçons"]
  ,["Moments In Time", "Video", "2022", ["material/_DSF2669.jpg", "material/_DSF3392.jpg"]]
  ,["After The Rain", "Graphic", "2021", ["material/Mountain_v20006.jpg", "material/Stone_Artefakt_9.jpg"], null, "Prada"]
  ,["Silent Symphony", "Commissioned", "2021", ["material/DSCF2880.jpg", "material/DSCF6919.jpg", "material/DSCF6978.jpg"]]
  ,["The Fabric Of Dreams", "Video", "2021", ["material/Iceland25_Echo.jpg", "material/_DSF6111.jpg"]]
  ,["Colorful Whispers", "Graphic", "2021", ["material/MA_GD_Tanzartefakt_7.jpg", "material/TextureBump_ARC_W_RZ.jpg"], null, "Loewe"]
  ,["Echoes Of Time", "Commissioned", "2020", ["material/DSCF7079.jpg", "material/DSCF7780.jpg"]]
  ,["Fragments Of Light", "Video", "2020", ["material/_DSF4139.jpg", "material/_DSF5771.jpg"]]
  ,["Reflections Of The Soul", "Graphic", "2020", ["material/Stone_Conserve_Blau_RZ_v2.jpg", "material/Mountain_v20003.jpg"], null, "Palace"]
  ,["Nature's Palette", "Commissioned", "2020", ["material/_DSF5795.jpg", "material/_DSF5962.jpg"]]
  ,["Remote Signals", "Video", "2019", ["material/Strommast_Sundown_RZ.jpg", "material/DSCF1339.jpg"]]
  ,["Soft Geometry", "Graphic", "2019", ["material/Stone_Artefakt_9.jpg", "material/MA_GD_Tanzartefakt_7.jpg"], null, "Carhartt"]
  ,["Fragments Of Reality", "Commissioned", "2019", ["material/DSCF7807.jpg", "material/DSCF7858.jpg"]]
  ,["Aerial Static", "Video", "2019", ["material/_DSF0857.jpg", "material/_DSF0864.jpg"]]
  ,["Blue Residue", "Graphic", "2018", ["material/MountainRange_raw.jpg", "material/Stone_Conserve_Blau_RZ_v2.jpg"], null, "Acne Studios"]
  ,["The Art Of Memory", "Commissioned", "2018", ["material/_DSF5771.jpg", "material/_DSF6111.jpg"]]
  ,["Field Transmission", "Video", "2018", ["material/Iceland25_Echo.jpg", "material/Strommast_Sundown_RZ.jpg"]]
  ,["Infinite Loop", "Graphic", "2018", ["material/TextureBump_ARC_W_RZ.jpg", "material/Stone_Artefakt_9.jpg", "material/Mountain_v20006.jpg"], null, "Miu Miu"]
  ,["Lost In Translation", "Commissioned", "2017", ["material/DSCF6919.jpg", "material/DSCF7079.jpg"]]
  ,["Low Frequency", "Video", "2017", ["material/_DSF2669.jpg", "material/_DSF3392.jpg", "material/_DSF4139.jpg"]]
].map(([title, category, year, images, layout, additionalInfo = ""], index) => ({
  title,
  category,
  year,
  images,
  additionalInfo,
  // Set the optional fifth value in an entry to "half" or "full" to override.
  layout: layout || (index % 3 === 0 ? "half" : "full")
}));

function arrangeArchive(projects) {
  const queues = Object.groupBy
    ? Object.groupBy(projects, project => project.category)
    : projects.reduce((groups, project) => {
        (groups[project.category] ||= []).push(project);
        return groups;
      }, {});
  const sequence = [
    ["Commissioned", 4],
    ["Graphic", 8],
    ["Video", 6],
    ["Commissioned", 6],
    ["Graphic", 4],
    ["Video", 4]
  ];
  const arranged = [];
  sequence.forEach(([category, amount]) => arranged.push(...(queues[category] || []).splice(0, amount)));
  while (Object.values(queues).some(queue => queue.length)) {
    ["Graphic", "Commissioned", "Video"].forEach(category => arranged.push(...(queues[category] || []).splice(0, 3)));
  }
  return arranged;
}

const ARCHIVE_DISPLAY_PROJECTS = arrangeArchive(ARCHIVE_PROJECTS);

const app = document.querySelector("#app");
// Connected pages and global settings share one public content snapshot.
let sanityContent = null;
let sanityLoadSettled = false;
const renderedDetailProjects = new WeakMap();
const renderedWorkPages = new WeakMap();
const renderedIndexPages = new WeakMap();
const WORK_CATEGORIES = ["Video", "Commissioned", "Graphic"];
const hydratedInfoPages = new WeakSet();
const header = document.querySelector(".site-header");
const workMenu = document.querySelector(".work-menu");
const workToggle = document.querySelector(".work-toggle");
const workSubmenu = document.querySelector(".work-submenu");
const mobileMenu = document.querySelector(".mobile-menu");
const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
const mobileMenuBreakpoint = window.matchMedia("(max-width: 700px)");
const mobileWorkSubmenu = mobileMenu.querySelector(".mobile-work-submenu");

function closeMobileMenu() {
  if (mobileMenu.open) mobileMenu.close();
  mobileMenuToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("mobile-menu-open");
  syncViewportBackground();
}

mobileMenuToggle.addEventListener("click", () => {
  if (!mobileMenuBreakpoint.matches) return;
  setWorkMenu(false);
  hideOpenCursor();
  mobileMenu.showModal();
  mobileMenu.scrollTop = 0;
  mobileMenuToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("mobile-menu-open");
  header.classList.remove("is-hidden");
  document.querySelector(".detail-back")?.classList.remove("is-hidden");
  syncViewportBackground();
});
mobileMenu.querySelector(".mobile-menu-close").addEventListener("click", closeMobileMenu);
mobileMenu.addEventListener("close", closeMobileMenu);
mobileMenu.addEventListener("cancel", event => {
  event.preventDefault();
  closeMobileMenu();
});
mobileMenu.addEventListener("click", event => {
  if (event.target.closest("a")) closeMobileMenu();
});
mobileMenuBreakpoint.addEventListener("change", () => {
  header.classList.remove("is-hidden");
  document.querySelector(".detail-back")?.classList.remove("is-hidden");
  lastScrollY = window.scrollY;
  closeMobileMenu();
  setWorkMenu(false);
});
const openCursor = document.createElement("span");
openCursor.className = "open-cursor";
openCursor.textContent = "(Open)";
openCursor.setAttribute("aria-hidden", "true");
openCursor.hidden = true;
document.body.append(openCursor);

function hideOpenCursor() {
  openCursor.hidden = true;
  document.body.classList.remove("has-open-cursor");
}

let overviewPointer = null, overviewCursorFrame = 0;
function refreshOpenCursor(target) {
  const point = overviewPointer;
  const hit = target || (point && document.elementFromPoint?.(point.x, point.y));
  if (!point || !document.body.classList.contains("is-work") ||
      !hit?.closest?.(".work") || hit.closest(".site-header, .mobile-menu")) {
    hideOpenCursor();
    return;
  }
  openCursor.hidden = false;
  const halfWidth = openCursor.offsetWidth / 2;
  const halfHeight = openCursor.offsetHeight / 2;
  openCursor.style.left = `${Math.max(halfWidth, Math.min(point.x, document.documentElement.clientWidth - halfWidth))}px`;
  openCursor.style.top = `${Math.max(halfHeight, Math.min(point.y, window.innerHeight - halfHeight))}px`;
  document.body.classList.add("has-open-cursor");
}
function scheduleOpenCursor() {
  if (!overviewPointer || !globalThis.document?.body?.classList.contains("is-work")) return;
  if (!overviewCursorFrame) overviewCursorFrame = requestAnimationFrame(() => {
    overviewCursorFrame = 0;
    refreshOpenCursor();
  });
}
function updateOpenCursor(event) {
  overviewPointer = event.pointerType === "mouse" ? {x: event.clientX, y: event.clientY} : null;
  refreshOpenCursor(event.target);
}
function suspendOpenCursor() {
  overviewPointer = null;
  hideOpenCursor();
}
document.addEventListener("pointermove", updateOpenCursor);
document.addEventListener("pointerover", updateOpenCursor);
document.documentElement.addEventListener("pointerleave", suspendOpenCursor);
document.addEventListener("keydown", suspendOpenCursor);
window.addEventListener("blur", suspendOpenCursor);
// Re-hit-test the stationary pointer when scrolling, loading or navigation moves
// content beneath it. Never tie visibility to an individual media/link node.
window.addEventListener("scroll", scheduleOpenCursor, { passive: true, capture: true });
window.addEventListener("resize", scheduleOpenCursor, { passive: true });
document.addEventListener("load", scheduleOpenCursor, true);
header.addEventListener("transitionend", scheduleOpenCursor);
new MutationObserver(scheduleOpenCursor).observe(app, {childList: true, subtree: true});
new MutationObserver(scheduleOpenCursor).observe(header, {attributes: true, subtree: true, attributeFilter: ["class", "style"]});
let lastScrollY = window.scrollY;
let headerFrame;
let cleanupPage = () => {};

function image(src, alt = "") { return `<img src="${src}" alt="${alt}" loading="lazy">`; }
let currentPageRoute = "";
function syncViewportBackground() {
  const index = document.body.classList.contains("is-index");
  const dark = !mobileMenuBreakpoint.matches && index && !mobileMenu.open;
  document.documentElement.style.backgroundColor = dark ? "#000000" : "#ffffff";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#000000" : "#ffffff";
}
function setCurrentPage(route) {
  currentPageRoute = route;
  syncViewportBackground();
  document.querySelectorAll("[data-route]").forEach(link => {
    const active = !link.classList.contains("mobile-menu-label") && (link.dataset.route === route || (link.dataset.route === "work" && route.startsWith("work/")));
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

const menuMeasureContext = document.createElement("canvas").getContext("2d");

function fitWorkMenu() {
  const style = getComputedStyle(workSubmenu);
  // Match the visible gaps using upright text widths, so hover cannot move the links.
  menuMeasureContext.font = `normal ${style.fontWeight} 100px ${style.fontFamily}`;
  const selectedWidth = menuMeasureContext.measureText(workToggle.textContent).width / 100;
  const indexWidth = menuMeasureContext.measureText(document.querySelector('.main-nav [data-route="archive"]')?.textContent || "").width / 100;
  header.style.setProperty("--index-menu-width", `${Math.max(indexWidth, 7 - selectedWidth + indexWidth)}em`);
  if (sanityContent?.availability?.navigation === "present") {
    const nav = document.querySelector(".main-nav");
    nav.style.gridTemplateColumns = [...nav.children].filter(node => !node.hidden).map(node => {
      const link = node === workMenu ? workToggle : node;
      const width = menuMeasureContext.measureText(link.textContent).width / 100;
      return node === workMenu ? `${Math.max(7, width)}em` : link.dataset.route === "archive"
        ? "var(--index-menu-width, 2.6em)" : `${Math.max(2, width)}em`;
    }).join(" ");
  }
  const bounds = workSubmenu.getBoundingClientRect();
  const viewport = document.documentElement;
  const edge = parseFloat(getComputedStyle(header).right) || 12;
  const width = Math.max(0, Math.min(bounds.width, viewport.clientWidth - bounds.left - edge));
  const height = Math.max(0, viewport.clientHeight - bounds.top - parseFloat(style.paddingTop) - edge);
  let widest = 0;
  // Reserve room for both font styles, including italic glyph overhang.
  for (const fontStyle of ["normal", "italic"]) {
    menuMeasureContext.font = `${fontStyle} ${style.fontWeight} 100px ${style.fontFamily}`;
    workSubmenu.querySelectorAll("a").forEach(link => {
      const metrics = menuMeasureContext.measureText(link.textContent);
      widest = Math.max(widest, metrics.width, Math.max(0, metrics.actualBoundingBoxLeft) + metrics.actualBoundingBoxRight);
    });
  }
  const preferred = parseFloat(style.getPropertyValue("--preferred-menu-size")) * window.innerWidth / 100;
  const size = Math.max(0, Math.min(preferred, width / (widest / 100 + .12), height / 3.2));
  document.documentElement.style.setProperty("--fitted-menu-size", `${size}px`);
}

new ResizeObserver(fitWorkMenu).observe(document.querySelector(".main-nav"));
window.addEventListener("resize", fitWorkMenu);
document.fonts.ready.then(fitWorkMenu);
document.fonts.addEventListener("loadingdone", fitWorkMenu);

function setWorkMenu(open) {
  header.classList.remove("is-hidden");
  if (open) fitWorkMenu();
  workMenu.classList.toggle("is-open", open);
  workToggle.setAttribute("aria-expanded", String(open));
  workSubmenu.inert = !open;
}

function renderGlobalFooter(info = false) {
  return `  <footer class="project-footer" aria-label="Contact and legal information">
    ${info ? `<section class="info-footer-credit" aria-label="Webdesign credit"><h2>Webdesign</h2><p><a href="https://meisnerfloriangestaltung.com" target="_blank" rel="noopener noreferrer">MfG<br>Meisner Florian Gestaltung</a></p></section>` : ""}
    <nav class="project-footer-links" aria-label="Footer">
      <a href="mailto:mail@nicolas-kawohl.com">Mail</a>
      <a href="https://www.instagram.com/nicocaw/" target="_blank" rel="noopener noreferrer">Instagram</a>
      <a href="#imprint">Imprint</a>
      <a href="#privacy-policy">Privacy Policy</a>
    </nav>
  </footer>`;
}

// Global bindings update only existing interface nodes, never the active page/player.
function applySanityFooter() {
  const settings = sanityContent?.siteSettings;
  const footer = app.querySelector(".project-footer-links");
  if (!settings || !footer) return;
  // These four destinations belong to the fixed project footer, independently of
  // the optional editorial footerLinks array. Missing contacts are safely omitted.
  const links = [
    {href: settings.contacts.email?.href, label: "Mail"},
    {href: settings.contacts.instagram?.href, label: "Instagram", newTab: true},
    {href: "#imprint", label: "Imprint"},
    {href: "#privacy-policy", label: "Privacy Policy"}
  ].filter(link => link.href);
  footer.replaceChildren(...links.map(link => {
    const anchor = document.createElement("a");
    anchor.href = link.href;
    anchor.textContent = link.label;
    if (link.newTab) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    return anchor;
  }));
}

function applySanityGlobals() {
  const settings = sanityContent?.siteSettings;
  const navigation = sanityContent?.navigation;
  const hasNavigation = sanityContent?.availability?.navigation === "present";
  const brand = hasNavigation ? navigation.home.label : settings?.brandName;
  // With neither document available the original HTML remains the fallback.
  if (brand !== undefined && (settings || brand)) {
    document.querySelectorAll(".brand").forEach(node => { if(node.textContent!==brand) node.textContent = brand; });
  }
  if (settings) {
    document.title = settings.defaultPageTitle;
    document.querySelector('meta[name="description"]').content = settings.defaultDescription;
    let social = document.querySelector('meta[property="og:image"]');
    if (settings.socialImage) {
      if (!social) {
        social = document.createElement("meta");
        social.setAttribute("property", "og:image");
        document.head.append(social);
      }
      social.content = settings.socialImage.src;
    } else social?.remove();
    applySanityFooter();
  }
  const contact = mobileMenu.querySelector(".mobile-menu-mail");
  // Missing settings alone retain the local contact; published emptiness removes it.
  if (settings || (hasNavigation && !navigation.mobileContact &&
      !sanityContent.issues.some(issue => issue.path === "navigation.mobileContact" && issue.code === "missing_contact"))) {
    const link = hasNavigation ? navigation.mobileContact : settings.contacts.email &&
      {href: settings.contacts.email.href, label: contact.textContent};
    contact.hidden = !link;
    contact.style.display = link ? "" : "none";
    if (link) { contact.href = link.href; contact.textContent = link.label; }
    else contact.removeAttribute("href");
  }
  if (!hasNavigation) return;
  for (const container of [document.querySelector(".main-nav"), mobileMenu.querySelector("nav")]) {
    const desktop = container.classList.contains("main-nav");
    const group = container.querySelector(desktop ? ".work-menu" : ".mobile-menu-work");
    const nodes = new Map([...container.children].map(node =>
      [node === group ? "work" : node.dataset.route, node]));
    const seen = new Set();
    for (const item of navigation.items) {
      if (seen.has(item.destination)) continue;
      seen.add(item.destination);
      let node = nodes.get(item.destination);
      if (!node) {
        node = document.createElement("a");
        node.dataset.route = item.destination;
        if (!desktop) node.className = "mobile-menu-section";
        nodes.set(item.destination, node);
      }
      const anchor = node === group ? node.querySelector('[data-route="work"]') : node;
      anchor.textContent = item.label;
      if (anchor.tagName === "A") anchor.href = item.href;
      node.hidden = false;
      node.style.display = "";
      container.append(node);
    }
    for (const [destination, node] of nodes) {
      if (!seen.has(destination)) { node.hidden = true; node.style.display = "none"; }
    }
    const categories = desktop ? workSubmenu : mobileWorkSubmenu;
    for (const category of navigation.categories) {
      const link = categories.querySelector(`[data-route="${category.destination}"]`);
      link.textContent = category.label;
      categories.append(link);
    }

  }
  setCurrentPage(currentPageRoute);
  fitWorkMenu();
}

function frontpageSequence() {
  return sanityContent?.homePage?.media ?? globalThis.FrontpageMedia;
}

let homeSession = null;
function hydrateFrontpage() {
  if (homeSession) homeSession.start();
}

function renderHome() {
  cleanupPage();
  document.documentElement.classList.add("home-pending");
  document.body.className = "is-home home-loading";
  setCurrentPage("");
  app.innerHTML = `<section class="home" aria-label="Frontpage" data-text-color="auto" aria-busy="true"><div class="frontpage-fade" aria-hidden="true"></div><div class="frontpage-loading-indicator" role="progressbar" aria-label="Preparing Frontpage media" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div></section>`;
  const layer=app.querySelector('.frontpage-fade'), controller=new AbortController();
  const indicator=app.querySelector('.frontpage-loading-indicator');
  let started=false, prepared=null, stopBrush=()=>{}, progress=0;
  layer.dataset.loadingProgress='0';
  const updateProgress=p=>{
    if(controller.signal.aborted)return;
    progress=Math.max(progress,Math.min(1,p));
    layer.dataset.loadingProgress=String(progress);
    indicator.setAttribute('aria-valuenow',String(Math.round(progress*100)));
    indicator.firstElementChild.style.transform=`scaleX(${progress})`;
  };
  const session={start:async()=>{
    if(started || !sanityLoadSettled || controller.signal.aborted)return;
    started=true;
    layer.dataset.source=sanityContent?.homePage?.media!=null?'sanity':'local';
    if(controller.signal.aborted || !globalThis.document)return;
    const visibleMediaLimit=sanityContent?.homePage?.visibleMediaLimit ?? 3;
    prepared=await FrontpageLoading.prepare(frontpageSequence()||[],{visibleMediaLimit,signal:controller.signal,onProgress:updateProgress});
    if(controller.signal.aborted || !globalThis.document){prepared.dispose();return;}
    layer.dataset.preparation=JSON.stringify(prepared.results);
    layer.dataset.source=sanityContent?.homePage?.media!=null?'sanity':'local';
    updateProgress(1);
    document.documentElement.classList.remove('home-pending');
    document.body.classList.remove('home-loading');
    app.querySelector('.frontpage-loading-indicator')?.remove();
    app.querySelector('.home').setAttribute('aria-busy','false');
    stopBrush=globalThis.FrontpageMediaFade?.init(layer,prepared.sequence,{prepared,visibleMediaLimit}) || (()=>{});
    layer.dataset.ready='true';
  }};
  homeSession=session;session.start();
  cleanupPage=()=>{controller.abort();stopBrush();prepared?.dispose();document.documentElement.classList.remove('home-pending');document.body.classList.remove('home-loading');if(homeSession===session)homeSession=null;};
}

function renderWorkModule(module, project) {
  if (module.type === "spacer") return renderProjectModule(module, "", "overview");
  const hasText = module.slots.some(slot => slot?.type === "text");
  const previewModule = {
    ...module,
    slots: module.slots.map(slot => slot?.type === "text" ? null : slot)
  };
  if (hasText && previewModule.slots.every(slot => slot == null)) return "";
  const mediaMarkup = renderProjectModule(previewModule, project.title, "overview");
  if (!mediaMarkup) return "";
  const title = escapeModuleAttribute(project.title);
  const href = `#project/${encodeURIComponent(project.id)}`;
  const empty = previewModule.slots.every(slot => slot == null);
  const titleTag = project.detailPageEnabled === false ? "span" : "a";
  const titleLink = project.detailPageEnabled === false ? "" : ` href="${href}" aria-label="Open ${title}"`;
  return `<section class="project-module-preview${empty ? " is-empty" : ""}" aria-label="${title}">
    <div class="project-title-track"><${titleTag} class="project-title"${titleLink}><span>${title}</span>${project.additionalInfo ? `<span class="project-additional-info">${escapeModuleAttribute(project.additionalInfo)}</span>` : ""}</${titleTag}></div>
    ${mediaMarkup}
  </section>`;
}

function renderWorkPreview(project) {
  if (project.selectedWorkPreview) {
    const modules = project.selectedWorkPreview.composition || [project.selectedWorkPreview];
    return modules.map(module => renderWorkModule(module, project)).join("");
  }
  // One reference owns one preview, not the project's entire detail sequence.
  const preview = project.modules.find(module => module.slots?.some(slot => slot?.type === "mp4"))
    || project.modules.find(module => module.slots?.some(slot => slot?.type === "image"))
    || project.modules[0];
  return preview ? renderWorkModule(preview, project) : "";
}

function workCategory(category) {
  return WORK_CATEGORIES.find(value => value.toLowerCase() === category?.toLowerCase()) || "Video";
}

// This tab's most recent listing → project transition. Never persist across visits.
let projectOverviewOrigin = null;
let pendingOverviewRestore = null;

function overviewHref(fallback) {
  return projectOverviewOrigin?.projectHash === location.hash ? projectOverviewOrigin.hash : fallback;
}

function restoreOverviewPosition() {
  const pending = pendingOverviewRestore;
  const work = app.querySelector(".work:not([aria-busy='true'])");
  if (!pending || pending.started || pending.hash !== location.hash || !work) return;
  pending.started = true;
  // Lazy images need loading even while the return view is concealed. Their
  // natural dimensions can determine the height of automatic-height modules.
  const images = [...work.querySelectorAll(".project-preview:not([hidden]) img")];
  const ready = images.map(image => new Promise(resolve => {
    if (image.complete) return resolve();
    image.addEventListener("load", resolve, {once: true});
    image.addEventListener("error", resolve, {once: true});
    image.loading = "eager";
  }));
  Promise.all([...ready, document.fonts?.ready]).then(() => requestAnimationFrame(() => {
    if (pendingOverviewRestore !== pending || location.hash !== pending.hash) return;
    // Scroll and reveal in the same pre-paint callback: never paint the top first.
    window.scrollTo({left: pending.x, top: pending.y, behavior: "instant"});
    lastScrollY = window.scrollY;
    app.style.visibility = pending.visibility;
    pendingOverviewRestore = null;
  }));
}

document.addEventListener("click", event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest("a");
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
  const href = link.getAttribute("href") || "";
  if (app.querySelector(".work:not([aria-busy='true'])") && /^#\/?project\//.test(href)) {
    projectOverviewOrigin = {projectHash: href, hash: location.hash, x: window.scrollX, y: window.scrollY};
  } else if (link.matches(".header-overview") && projectOverviewOrigin?.projectHash === location.hash) {
    pendingOverviewRestore = {...projectOverviewOrigin, visibility: app.style.visibility};
    app.style.visibility = "hidden";
  }
});

function renderWork(category = "Video") {
  const selectedCategory = workCategory(category);
  const current = app.querySelector(".work");
  const source = sanityContent?.selectedWork || WORK_PROJECTS;
  if (current?.dataset.category === selectedCategory && renderedWorkPages.get(current) === source) return;
  document.body.className = `is-work is-work-${selectedCategory.toLowerCase()}`;
  setCurrentPage(`work/${selectedCategory.toLowerCase()}`);
  if (!sanityLoadSettled) {
    app.innerHTML = `<section class="work" data-category="${selectedCategory}" aria-busy="true" aria-label="Loading selected work"><div class="projects"></div></section>`;
    return;
  }
  const useLocal = category => !sanityContent?.selectedWork || sanityContent.issues.some(issue =>
    issue.path === `selectedWork.${category.toLowerCase()}` && issue.code === "invalid_array");
  const selectedProjects = WORK_CATEGORIES.flatMap(category => (useLocal(category)
    ? WORK_PROJECTS.filter(project => project.category === category)
    : sanityContent.selectedWork[category.toLowerCase()].map(id => sanityContent.projectsById[id])
      .filter(project => project && (project.selectedWorkPreview || project.modulesValid !== false)))
      .filter(project => (!project.unsupportedMediaOnly || project.selectedWorkPreview) &&
        (!project.selectedWorkPreview?.composition || project.selectedWorkPreview.composition.length > 0))
      .map(project => ({project, category})));
  const projects = selectedProjects.map(({project: p, category}, i) => {
    const rows = p.selectedWorkPreview ? p.selectedWorkPreview.composition || [p.selectedWorkPreview] : p.modules;
    const spacerOnly = rows.length > 0 && rows.every(module => module.type === "spacer");
    return `
    <article class="project-preview" data-text-color="${p.textColor || "auto"}" data-category="${category}" data-project="${escapeModuleAttribute(p.id)}"${category === selectedCategory ? "" : " hidden"}>
      ${p.detailPageEnabled === false || spacerOnly ? "" : `<a class="project-link" href="#project/${encodeURIComponent(p.id)}" aria-label="Open ${escapeModuleAttribute(p.title)}"></a>`}
      <div class="project-modules">${renderWorkPreview(p)}</div>
      ${i === selectedProjects.length - 1 && category !== "Graphic" && !spacerOnly ? `<span class="project-kind">${category === "Commissioned" ? "Photography" : category}</span>` : ""}
    </article>`;
  }).join("");
  app.innerHTML = `<section class="work" data-category="${selectedCategory}" data-source="${useLocal(selectedCategory) ? "local" : "sanity"}"><div class="projects">${projects}</div></section>`;
  renderedWorkPages.set(app.querySelector(".work"), source);
  cleanupPage = initProjectVideos(app);
  restoreOverviewPosition();
}

// Index keeps a small decoded working set across routes, never the entire CMS list.
const indexMediaCache = new Map();
let indexPreparationPaused = false, indexImagesRunning = 0, indexVideosRunning = 0;
const indexPreparationQueue = [];
let indexPreparationWanted = new Set();
function releaseIndexMedia(record) {
  if (!record.settled && record.cancel) { record.cancel(); return; }
  // Drop ownership before releasing the native player; queued descriptors own no node.
  if (indexMediaCache.get(record.key) === record) indexMediaCache.delete(record.key);
  if (record.node && record.media.type === 'mp4') {
    record.node.pause(); record.node.removeAttribute('src'); record.node.load();
  }
  record.released = true;
}
function trimIndexMediaCache() {
  for (const type of ['image', 'mp4']) {
    const limit = type === 'mp4' ? 2 : 8;
    const candidates = [...indexMediaCache.entries()].filter(([, r]) => r.media.type === type);
    while (candidates.length > limit) {
      let i = candidates.findIndex(([key, r]) => r.settled && !r.node?.isConnected && !indexPreparationWanted.has(key));
      if (i < 0) i = candidates.findIndex(([, r]) => r.settled && !r.node?.isConnected);
      if (i < 0) break;
      const [key, record] = candidates.splice(i, 1)[0];
      releaseIndexMedia(record);
    }
  }
}
function pumpIndexPreparation() {
  if (indexPreparationPaused) return;
  for (let i = 0; i < indexPreparationQueue.length;) {
    const record = indexPreparationQueue[i], video = record.media.type === 'mp4';
    if (record.settled) {indexPreparationQueue.splice(i, 1); continue;}
    if (video ? indexVideosRunning >= 1 : indexImagesRunning >= 2) {i++; continue;}
    if (video) {
      const owners = [...indexMediaCache.values()].filter(r => r.media.type === 'mp4' && r.node?.hasAttribute('src'));
      if (owners.length >= 2) {
        const victim = owners.find(r => r.settled && !r.node?.isConnected);
        if (!victim) { i++; continue; }
        releaseIndexMedia(victim);
      }
    }
    indexPreparationQueue.splice(i, 1);
    if (video) indexVideosRunning++; else indexImagesRunning++;
    record.start();
  }
}
function indexMediaSource(media) {
  if (media.type === 'mp4' || !media.src.startsWith('https://cdn.sanity.io/images/')) return media.src;
  const wanted = Math.min(2560, Math.ceil(Math.max(innerWidth,innerHeight) * Math.min(devicePixelRatio || 1,2)));
  const original = media.cropRect?.width || media.width;
  if (original && original <= wanted) return media.src;
  const url = new URL(media.src);
  url.searchParams.set('w',String(wanted)); url.searchParams.set('fit','max');
  url.searchParams.set('auto','format'); url.searchParams.set('q','80');
  return url.href;
}
const indexMediaKey = media => `${media.type}:${indexMediaSource(media)}`;
function prepareIndexMedia(media) {
  const source = indexMediaSource(media), key = `${media.type}:${source}`;
  if (indexMediaCache.has(key)) {
    const record = indexMediaCache.get(key);
    indexMediaCache.delete(key); indexMediaCache.set(key, record);
    return record;
  }
  const video = media.type === 'mp4';
  let node = video ? null : document.createElement('img');
  const record = {key, media, node, ready:false, failed:false, settled:false, waiters:[]};
  indexMediaCache.set(key, record);
  let timer, started = false;
  const finish = success => {
    if (record.settled) return;
    record.settled = true; record.ready = success; record.failed = !success;
    clearTimeout(timer);
    if (node) node.onload = node.onerror = node.onloadeddata = node.onloadedmetadata = null;
    if (started) {if (video) indexVideosRunning--; else indexImagesRunning--;}
    if (!success && node) {if (video) node.pause(); node.removeAttribute('src'); if (video) node.load();}
    const callbacks = record.waiters.splice(0);
    callbacks.forEach(callback => callback());
    // A waiter may synchronously attach/play the prepared node. Pausing before
    // that handoff can strand WebKit's media clock at zero despite readyState 4.
    // Only detached warm nodes should pause; the displayed player owns playback.
    if (video && node && !node.isConnected) node.pause();
    trimIndexMediaCache(); pumpIndexPreparation();
  };
  record.fail = () => finish(false);
  record.cancel = () => {finish(false); releaseIndexMedia(record);};
  record.start = () => {
    started = true;
    if (video) { node = document.createElement('video'); record.node = node; }
    timer = setTimeout(() => finish(false), 12000);
    node.onerror = () => finish(false);
    if (video) {
      node.muted = true; node.defaultMuted = true; node.loop = true; node.playsInline = true;
      node.setAttribute('muted',''); node.setAttribute('playsinline','');
      node.preload = 'auto';
      node.onloadeddata = () => finish(node.readyState >= 2);
      // Readiness is a decoded initial frame, never a fully downloaded MP4.
      // A deadline also covers browsers that defer detached video loading.
      node.onloadedmetadata = () => {
        if (node.readyState >= 2) finish(true);
        else if (window.matchMedia('(pointer: coarse)').matches) node.play().catch(()=>{});
      };
      node.src = source; node.load();
    } else {
      node.alt = media.alt || ''; node.loading = 'eager';
      const position = moduleImagePosition(media);
      node.style.cssText = position ? position.slice(' style="'.length, -1) : '';
      node.src = source;
      if (node.decode) node.decode().then(() => finish(true), () => finish(false));
      else node.onload = () => finish(true);
    }
  };
  indexPreparationQueue.push(record); pumpIndexPreparation();
  return record;
}
function whenIndexMediaReady(record, callback) {
  if (record.settled) callback(); else record.waiters.push(callback);
}

function renderArchive() {
  document.body.className = "is-index";
  setCurrentPage("archive");
  const unavailable = !sanityContent?.indexPage || sanityContent.issues.some(issue =>
    issue.path === "indexPage.entries" && issue.code === "invalid_array");
  // The legacy category arrangement applies only to the local fallback.
  const entries = unavailable ? ARCHIVE_DISPLAY_PROJECTS : sanityContent.indexPage.entries;
  const current = app.querySelector(".archive");
  if (renderedIndexPages.get(current) === entries) return;
  if (!sanityLoadSettled) {
    app.innerHTML = `<section class="archive" aria-busy="true" aria-label="Loading Index"><div class="archive-background" aria-hidden="true"></div><div class="archive-list"></div></section>`;
    return;
  }
  const entryMarkup = (entry, index) => {
    const title = escapeModuleAttribute(entry.title);
    const info = `<span class="archive-additional-info">${escapeModuleAttribute(entry.additionalInfo || "")}</span>`;
    const attributes = `class="archive-row" data-index="${index}" data-year="${escapeModuleAttribute(entry.year || "")}"`;
    return `<button ${attributes} type="button"><span>${title}</span>${info}</button>`;
  };
  app.innerHTML = `<section class="archive" data-source="${unavailable ? "local" : "sanity"}"><div class="archive-background" aria-hidden="true"></div><div class="archive-list"><div class="archive-list-track">${entries.map(entryMarkup).join("")}</div></div></section>`;
  renderedIndexPages.set(app.querySelector(".archive"), entries);
  for (const record of [...indexMediaCache.values()]) if (record.failed) releaseIndexMedia(record);
  indexPreparationPaused = false;
  const bg = document.querySelector(".archive-background");
  let imageRequest = 0;
  const list = document.querySelector(".archive-list");
  const rows = [...list.querySelectorAll(".archive-row")];
  if (!rows.length) return;
  const mobile = window.matchMedia("(max-width: 700px)");
  const events = new AbortController();
  const audioState = {muted: true};
  const hasVideos = entries.some(entry => entry.media?.some(media => media.type === "mp4"));
  const soundButton = hasVideos ? document.createElement("button") : null;
  if (soundButton) {
    soundButton.className = "detail-sound-control";
    soundButton.type = "button";
    const label = () => {
      soundButton.textContent = audioState.muted ? "(Sound)" : "(Mute)";
      soundButton.setAttribute("aria-pressed", String(!audioState.muted));
      soundButton.setAttribute("aria-label", audioState.muted ? "Enable Index video sound" : "Mute Index videos");
    };
    label();
    app.querySelector(".archive").append(soundButton);
    soundButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      audioState.muted = !audioState.muted;
      label();
      soundButton.dispatchEvent(new Event("audiochange"));
    }, {signal: events.signal});
  }
  let activeRow = -1;
  let frame = 0;
  let activeVideo = null;
  let cleanupVideo = () => {};
  const stopVideo = () => {
    cleanupVideo();
    cleanupVideo = () => {};
    activeVideo = null;
  };
  const showEntryImage = (entry, imageIndex) => {
    const request = ++imageRequest;
    const items = entry?.media || entry?.images?.map((src, i) => ({
      type: "image", src, ...entry.previewImages?.[i]
    })) || [];
    const media = items[imageIndex % items.length];
    if (!media) {
      stopVideo();
      bg.replaceChildren();
      bg.classList.remove("visible");
      return;
    }
    const prepared = prepareIndexMedia(media);
    whenIndexMediaReady(prepared, () => {
      if (request !== imageRequest || events.signal.aborted) return;
      if (prepared.failed) return; // Retain the current frame on failed later assets.
      if (media.type === "mp4") {
        bg.closest(".archive").dataset.textColor = entry.textColor || "auto";
        if (activeVideo === media) return;
        stopVideo();
        bg.replaceChildren();
        bg.classList.remove("half", "portrait-left", "portrait-center");
        bg.classList.add("full", "visible", "is-video");
        activeVideo = media;
        {
          const video = prepared.node;
          video.autoplay = true;
          video.muted = true;
          video.defaultMuted = true;
          video.loop = true;
          video.playsInline = true;
          video.controls = false;
          video.preload = "auto";
          const sizeVideo = () => video.classList.toggle("is-portrait-video",
            video.videoWidth > 0 && video.videoHeight > video.videoWidth);
          video.addEventListener("loadedmetadata", sizeVideo);
          video.addEventListener("resize", sizeVideo);
          sizeVideo();
          video.dataset.projectNativeSrc = media.src;
          bg.append(video);
          // Autoplay policy or an unavailable file must not interrupt Index navigation.
          const disposePlayer = initProjectVideos(bg, {index: true, audioState, soundButton, retainMedia:true});
          cleanupVideo = () => {
            disposePlayer();
            video.removeEventListener("loadedmetadata", sizeVideo);
            video.removeEventListener("resize", sizeVideo);
            video.remove();
          };
        }
        return;
      }
      // Keep the displayed bitmap and its layout together while the next image
      // loads. Mutating a visible img.src can leave its old bitmap in the new layout.
      const nextImage = prepared.node;
      const position = moduleImagePosition(media);
      nextImage.style.cssText = position ? position.slice(' style="'.length, -1) : '';
      nextImage.alt = media.alt || '';
      {
        const width = media.cropRect?.width ?? media.width ?? nextImage.naturalWidth;
        const height = media.cropRect?.height ?? media.height ?? nextImage.naturalHeight;
        const portrait = width > 0 && height > width;
        const half = !mobile.matches && portrait;
        if (portrait) {
          nextImage.classList.add("is-portrait-image");
          nextImage.style.setProperty("--native-width", `${nextImage.naturalWidth / (window.devicePixelRatio || 1)}px`);
          nextImage.style.setProperty("--native-height", `${nextImage.naturalHeight / (window.devicePixelRatio || 1)}px`);
        }
        const portraitPosition = media.portraitPosition ||
          ((entry.layout === "half") !== ((imageIndex % items.length) % 2 === 1) ? "right" : "center");
        // All layout state and the decoded bitmap commit in one task, before paint.
        stopVideo();
        bg.className = `archive-background visible ${half ? "half" : "full"}${
          half && portraitPosition === "left" ? " portrait-left" :
          half && portraitPosition === "center" ? " portrait-center" : ""}`;
        bg.closest(".archive").dataset.textColor = entry.textColor || "auto";
        bg.replaceChildren(nextImage);
      }
    }); // Prepared nodes commit only while this view/request is current.
  };
  const archive = list.closest(".archive");
  const track = list.querySelector(".archive-list-track");
  let visualRow = 0;
  let mobileRows = rows;
  let moving = false;
  let movementTimer = 0;
  let stripNeedsResize = false;
  const mobileQueue = [];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const rebuildMobileStrip = () => {
    track.querySelectorAll('[data-repeat]').forEach(row => row.remove());
    if (mobile.matches) {
      // Include enough complete cycles to fill even a one-project viewport.
      const cycleHeight = rows.reduce((sum, row) => sum + row.getBoundingClientRect().height, 0);
      const copies = Math.max(2, Math.ceil(list.clientHeight / Math.max(1, cycleHeight)) + 1);
      for (let copy = 1; copy <= copies; copy++) {
        for (const row of rows) {
          const clone = row.cloneNode(true);
          clone.dataset.repeat = String(copy);
          clone.removeAttribute("aria-current");
          clone.classList.remove("is-active");
          track.append(clone);
        }
      }
    }
    mobileRows = [...track.querySelectorAll(".archive-row")];
  };
  let mobileRequest = 0, recoveryTimer = 0;
  let pendingMobileVideo = null;

  const preview = entry => (entry?.media || entry?.images?.map((src, i) => ({type:"image", src, ...entry.previewImages?.[i]})) || []).find(item => item.src);
  const alignMobileList = () => {
    if (!mobile.matches || activeRow < 0 || events.signal.aborted) return;
    const offset = mobileRows[visualRow].getBoundingClientRect().top - mobileRows[0].getBoundingClientRect().top;
    list.style.setProperty("--archive-offset", `${offset}px`);
  };
  const markMobileEntry = next => {
    activeRow = next;
    mobileRows.forEach((row, i) => {
      row.inert = i < visualRow;
      row.classList.toggle("is-active", i === visualRow);
      if (i === visualRow) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    });
    alignMobileList();
  };
  const finishMobileMovement = () => {
    clearTimeout(movementTimer);
    track.classList.remove("is-moving");
    // Equivalent copies occupy exactly the same pixels: normalize between moves.
    visualRow = rows.length + Math.max(0, activeRow);
    if (stripNeedsResize) { rebuildMobileStrip(); stripNeedsResize = false; }
    if (activeRow >= 0) markMobileEntry(activeRow);
    void track.offsetHeight;
    moving = false;
    drainMobileQueue();
  };
  const drainMobileQueue = () => {
    if (!navigationReady || moving || !mobile.matches || events.signal.aborted || !mobileQueue.length) return;
    const selection = mobileQueue.shift();
    const distance = selection.direction ?? ((selection.index - activeRow + rows.length) % rows.length);
    const next = (Math.max(0, activeRow) + distance + rows.length) % rows.length;
    if (!distance) { drainMobileQueue(); return; }
    moving = true;
    activateMobileEntry(next, distance);
  };
  const enqueueMobile = selection => {
    if (!navigationReady) return;
    mobileQueue.push(selection);
    drainMobileQueue();
  };
  const prepareMobileImage = prepareIndexMedia;
  const warmMobileImages = next => {
    if (events.signal.aborted || !navigationReady) return;
    let wanted = (mobile.matches
      ? [next, (next-1+rows.length)%rows.length, (next+1)%rows.length, (next-2+rows.length)%rows.length, (next+2)%rows.length]
      : [next, ...Array.from({length:3}, (_,n)=>(next+n+1)%rows.length)])
      .map(i=>preview(entries[i])).filter(Boolean);
    if (!mobile.matches) wanted.push(...(entries[next]?.media || []));
    let videoCount = 0;
    wanted = wanted.filter(media=>media.type !== 'mp4' || ++videoCount <= 2);
    const keys = new Set(wanted.map(indexMediaKey));
    indexPreparationWanted = keys;
    // Rapid desktop hovering must not build a queue for the entire CMS list.
    indexPreparationPaused = true;
    for (const [key, record] of [...indexMediaCache]) if (!record.settled && !keys.has(key)) record.cancel();
    indexPreparationPaused = false;
    wanted.forEach(prepareIndexMedia); pumpIndexPreparation(); trimIndexMediaCache();
  };
  const cancelPendingMobileVideo = () => {
    if (!pendingMobileVideo) return;
    pendingMobileVideo.pause();
    pendingMobileVideo = null;
  };
  const playMobileVideo = video => {
    if (document.hidden) return;
    video.play().catch(() => {
      if (!video.isConnected || events.signal.aborted) return;
      // Safari can reject audible autoplay after an asynchronous load.
      video.muted = true; audioState.muted = true;
      if (soundButton) {
        soundButton.textContent = "(Sound)";
        soundButton.setAttribute("aria-pressed", "false");
        soundButton.setAttribute("aria-label", "Enable Index video sound");
      }
      video.play().catch(() => {});
    });
  };
  soundButton?.addEventListener("audiochange", () => {
    if (!mobile.matches) return;
    const video = bg.querySelector("video");
    if (video) {video.muted = audioState.muted; playMobileVideo(video);}
  }, {signal:events.signal});
  document.addEventListener("visibilitychange", () => {
    if (!mobile.matches) return;
    const video = bg.querySelector("video");
    if (video) {if (document.hidden) video.pause(); else playMobileVideo(video);}
  }, {signal:events.signal});
  const activateMobileEntry = (next, distance = 0) => {
    const initialNext = next, initialDistance = distance;
    const direction = distance < 0 ? -1 : 1;
    const visited = new Set(activeRow >= 0 ? [activeRow] : []);
    const request = ++mobileRequest;
    ++imageRequest; // Invalidate any pending desktop decode during a resize.
    cancelPendingMobileVideo();
    clearTimeout(recoveryTimer);
    archive.querySelector('.index-retry')?.remove();
    let media;
    let committed = false;
    const currentRequest = () => !committed && request === mobileRequest && mobile.matches && !events.signal.aborted;
    const exhausted = () => {
      if (!currentRequest()) return;
      committed = true; clearTimeout(recoveryTimer);
      cancelPendingMobileVideo();
      const retry = document.createElement('button');
      retry.className = 'index-retry'; retry.type = 'button'; retry.textContent = '(Retry)';
      retry.setAttribute('aria-label', 'Retry unavailable Index media');
      retry.addEventListener('click', () => {
        for (const record of [...indexMediaCache.values()]) if (record.failed) releaseIndexMedia(record);
        moving = true; activateMobileEntry(initialNext, initialDistance);
      }, {signal:events.signal});
      archive.append(retry);
      movementTimer = setTimeout(finishMobileMovement, 0);
    };
    recoveryTimer = setTimeout(exhausted, 20000);
    const commit = (node, video = false) => {
      if (committed || request !== mobileRequest || !mobile.matches || events.signal.aborted) return;
      committed = true; clearTimeout(recoveryTimer);
      track.style.removeProperty("visibility");
      if (node) stopVideo();
      if (node && !video) {
        const position = moduleImagePosition(media);
        node.style.cssText = position ? position.slice(' style="'.length, -1) : '';
        node.alt = media.alt || '';
      }
      bg.className = `archive-background visible full${video ? " is-video" : ""}`;
      if (node) bg.replaceChildren(node);
      archive.dataset.textColor = entries[next].textColor || "auto";
      archive.dataset.activeProject = String(next);
      bg.dataset.projectIndex = String(next);
      visualRow += distance;
      track.classList.toggle("is-moving", distance !== 0 && !reducedMotion.matches);
      markMobileEntry(next);
      if (distance !== 0 && !reducedMotion.matches) {
        movementTimer = setTimeout(finishMobileMovement, 420);
      } else {
        movementTimer = setTimeout(finishMobileMovement, 0);
      }
      if (video) {
        pendingMobileVideo = null;
        node.autoplay = true; node.muted = audioState.muted;
        activeVideo = media;
        cleanupVideo = () => {node.pause(); node.remove();};
        playMobileVideo(node);
      }
      warmMobileImages(next);
    };
    // A failed candidate never updates the title or touches the displayed player.
    // Each queued request visits an entry at most once, in its original direction.
    const attempt = () => {
      if (!currentRequest()) return;
      if (visited.has(next)) { exhausted(); return; }
      visited.add(next);
      media = preview(entries[next]);
      const unavailable = () => {
        if (!currentRequest()) return;
        next = (next + direction + rows.length) % rows.length;
        distance += direction;
        queueMicrotask(attempt);
      };
      if (!media) { unavailable(); return; }
      const record = prepareMobileImage(media);
      pendingMobileVideo = media.type === 'mp4' ? record.node : null;
      whenIndexMediaReady(record, () => {
        if (!currentRequest()) return;
        if (record.failed || record.released) unavailable();
        else commit(record.node, media.type === 'mp4');
      });
    };
    attempt();
  };

  const controls = 'a, button, input, select, textarea, summary, [role="button"], [role="link"], [contenteditable]:not([contenteditable="false"])';
  let swipe = null;
  const pointers = new Set();
  document.addEventListener("pointerdown", event => {
    if (!mobile.matches || event.pointerType === 'mouse') return;
    pointers.add(event.pointerId);
    if (pointers.size !== 1 || !event.isPrimary || !archive.contains(event.target)) { swipe = null; return; }
    const control = event.target.closest(controls);
    if ((control && !control.matches('.archive-row')) || event.clientX < 20 || event.clientX > innerWidth - 20) { swipe = null; return; }
    swipe = {id:event.pointerId, x:event.clientX, y:event.clientY};
  }, {passive:true,signal:events.signal});
  document.addEventListener("pointercancel", event => {
    pointers.delete(event.pointerId); swipe = null;
  }, {passive:true,signal:events.signal});
  document.addEventListener("pointerup", event => {
    pointers.delete(event.pointerId);
    const gesture = swipe; swipe = null;
    if (!gesture || gesture.id !== event.pointerId || pointers.size) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    // One completed, deliberately vertical gesture produces one signed queue item.
    if (Math.abs(dy) >= 45 && Math.abs(dy) >= Math.abs(dx) * 1.5)
      enqueueMobile({direction:dy < 0 ? 1 : -1});
  }, {passive:true,signal:events.signal});
  archive.addEventListener("click", event => {
    if (!mobile.matches) return;
    const row = event.target.closest('.archive-row');
    if (!row) return;
    event.preventDefault();
    // Retain explicit keyboard/assistive activation; touch taps never select.
    if (event.detail === 0) enqueueMobile({index:Number(row.dataset.index)});
  }, {signal:events.signal});
  const resizeMobileStrip = () => {
    if (!mobile.matches || events.signal.aborted) return;
    if (moving) stripNeedsResize = true;
    else { rebuildMobileStrip(); markMobileEntry(activeRow); }
    alignMobileList();
  };
  window.addEventListener("resize", resizeMobileStrip, {signal:events.signal});
  const listObserver = new ResizeObserver(alignMobileList);
  listObserver.observe(track);
  document.fonts?.ready.then(resizeMobileStrip);
  const activateDesktopEntry = next => {
    if (next < 0 || next === activeRow) return;
    activeRow = next;
    frame = 0;
    rows.forEach((row, index) => {
      if (index === next) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    });
    showEntryImage(entries[next], frame);
    if (navigationReady) warmMobileImages(next);
  };
  window.addEventListener("mousemove", event => {
    if (mobile.matches || !navigationReady) return;
    // Use each row's actual vertical area, independent of horizontal position.
    // Outside the list, keep the current preview and its cycling frame visible.
    const next = rows.findIndex(row => {
      const bounds = row.getBoundingClientRect();
      return event.clientY >= bounds.top && event.clientY < bounds.bottom;
    });
    activateDesktopEntry(next);
  }, { passive: true, signal: events.signal });
  rows.forEach(row => {
    row.addEventListener("click", event => {
      if (mobile.matches || !navigationReady) return; // Mobile selection is delegated above.
      const rowIndex = Number(row.dataset.index);
      const entry = entries[rowIndex];
      if (activeRow === rowIndex) {
        // Native click covers mouse, touch and keyboard once. Background pointer
        // gestures exclude buttons, so they cannot also handle this interaction.
        frame += 1;
        showEntryImage(entry, frame);
      } else activateDesktopEntry(rowIndex);
    }, { signal: events.signal });
  });
  const syncLayout = () => {
    clearTimeout(movementTimer);
    mobileQueue.length = 0;
    moving = mobile.matches;
    visualRow = mobile.matches ? rows.length : 0;
    track.style.visibility = mobile.matches ? "hidden" : "";
    clearTimeout(recoveryTimer);
    archive.querySelector(".index-retry")?.remove();
    swipe = null; pointers.clear();
    track.classList.remove("is-moving");
    rebuildMobileStrip();
    activeRow = -1;
    frame = 0;
    rows.forEach(row => {
      row.inert = false;
      row.classList.remove("is-active");
      row.removeAttribute("aria-current");
    });
    list.style.removeProperty("--archive-offset");
    ++mobileRequest; cancelPendingMobileVideo();
    if (mobile.matches) activateMobileEntry(0);
    else {
      list.scrollTop = 0;
      activateDesktopEntry(0);
    }
  };
  mobile.addEventListener("change", syncLayout, { signal: events.signal });
  cleanupPage = () => {
    events.abort();
    clearTimeout(movementTimer); clearTimeout(initialTimer); clearTimeout(recoveryTimer); mobileQueue.length = 0;
    ++mobileRequest; cancelPendingMobileVideo(); listObserver.disconnect();
    stopVideo();
    soundButton?.remove();
    indexPreparationPaused = true;
    for (const record of [...indexMediaCache.values()]) if (!record.settled) record.cancel();
    indexPreparationQueue.length = 0;
    trimIndexMediaCache();
  };
  // Keep real media readiness separate from the directional mobile queue.
  let navigationReady = false, initialTimer;
  rows.forEach(row=>row.setAttribute('aria-disabled','true'));
  archive.setAttribute('aria-busy','true');
  const indicator = document.createElement('div');
  indicator.className = 'index-loading-indicator';
  indicator.setAttribute('role','progressbar'); indicator.setAttribute('aria-label','Preparing Index media');
  indicator.setAttribute('aria-valuemin','0'); indicator.setAttribute('aria-valuemax','100');
  indicator.innerHTML = '<span></span>'; archive.append(indicator);
  let initialVideos = 0;
  const initial = [...new Map((mobile.matches ? [entries[0], entries.at(-1), entries[1]] : entries.slice(0,3)).map(entry=>preview(entry)).filter(Boolean).map(media=>[media.type+media.src,media])).values()].filter(media=>media.type !== 'mp4' || ++initialVideos <= 2).map(prepareIndexMedia);
  let progressValue = 0;
  const progress = () => {
    if (events.signal.aborted || navigationReady) return;
    progressValue = Math.max(progressValue, (initial.length ? initial.filter(r=>r.settled).length / initial.length : 1));
    indicator.setAttribute('aria-valuenow',String(Math.round(progressValue*100)));
    indicator.firstElementChild.style.transform = `scaleX(${progressValue})`;
    if (initial.every(r=>r.settled)) {
      navigationReady = true; clearTimeout(initialTimer);
      track.querySelectorAll('.archive-row').forEach(row=>row.removeAttribute('aria-disabled'));
      archive.setAttribute('aria-busy','false'); archive.dataset.prepared = 'true';
      indicator.remove(); drainMobileQueue(); warmMobileImages(Math.max(0,activeRow));
    }
  };
  syncLayout();
  initial.forEach(record=>whenIndexMediaReady(record,progress)); progress();
  if (!navigationReady) initialTimer = setTimeout(()=>initial.filter(r=>!r.settled).forEach(r=>r.fail()),20000);
}

function renderInfoContactLink(link) {
  if (!["email", "instagram"].includes(link.destination)) {
    return `<a href="${escapeModuleAttribute(link.href)}">${escapeModuleAttribute(link.label)}</a>`;
  }
  const contact = sanityContent?.siteSettings?.contacts[link.destination];
  if (!contact) return "";
  const instagram = link.destination === "instagram";
  const value = instagram ? "@" + (new URL(contact.href).pathname.split("/").filter(Boolean)[0] || new URL(contact.href).hostname) : contact.value;
  const escapedValue = escapeModuleAttribute(value);
  return `<a class="info-contact-value" href="${escapeModuleAttribute(contact.href)}" data-value="${escapedValue}"${instagram ? ' target="_blank" rel="noopener noreferrer"' : ""}><span>${escapedValue}</span></a>`;
}

function applySanityInfo() {
  const section = app.querySelector(".info");
  const info = sanityContent?.infoPage;
  if (!section || !info || hydratedInfoPages.has(section)) return;
  const issues = sanityContent.issues || [];
  const needsSettings = info.contactLinks.length > 0 || issues.some(issue =>
    issue.path.startsWith("infoPage.contactLinks") && issue.code === "missing_contact");
  // Malformed content is different from intentionally empty published arrays.
  // Ignore empty entries, but retain the fallback for malformed field containers.
  if (issues.some(issue => issue.path.startsWith("infoPage") && ["invalid_array", "invalid_document"].includes(issue.code))) return;
  const labels = {
    ".info-work h2": info.workLabel,
    ".info-skills h2": info.skillsLabel,
    ".info-contact h2": info.contactLabel,
    ".info-clients h2": info.selectedClientsLabel
  };
  for (const [selector, label] of Object.entries(labels)) {
    section.querySelector(selector).textContent = label;
  }
  const lines = values => values.map(value => escapeModuleAttribute(value).replace(/\r?\n/g, "<br>")).join("<br>");
  const content = {
    ".info-intro": lines([info.introduction]),
    ".info-work p": lines(info.work),
    ".info-skills p": lines(info.skills),
    ".info-contact p": info.contactLinks.map(renderInfoContactLink).join("<br>"),
    ".info-clients p": lines(info.selectedClients)
  };
  for (const [selector, html] of Object.entries(content)) {
    // A settings failure affects contacts only, never valid published Info text.
    if (selector === ".info-contact p" && needsSettings && !sanityContent.siteSettings) continue;
    const paragraph = section.querySelector(selector);
    if (paragraph.innerHTML !== html) paragraph.innerHTML = html;
  }
  if (info.additionalIntroduction.trim()) {
    const additional = document.createElement("p");
    additional.className = "info-intro info-additional-intro";
    additional.innerHTML = lines([info.additionalIntroduction]);
    section.querySelector(".info-intro").after(additional);
  }
  const details = section.querySelector(".info-details");
  for (const id of ["news", "publications"]) {
    if (!info[id].length) continue;
    const node = document.createElement("section");
    node.className = `info-${id}`;
    const heading = document.createElement("h2");
    heading.textContent = info[`${id}Label`];
    const paragraph = document.createElement("p");
    paragraph.innerHTML = info[id].map(entry => {
      const label = lines([[entry.title, entry.additionalInfo].filter(Boolean).join(" ") || entry.href]);
      return entry.href ? `<a href="${escapeModuleAttribute(entry.href)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
    }).join("<br>");
    node.append(heading, paragraph);
    details.append(node);
  }
  const sectionSelectors = {
    cv: ".info-cv", work: ".info-work", skills: ".info-skills",
    news: ".info-news", publications: ".info-publications",
    contactLinks: ".info-contact", selectedClients: ".info-clients"
  };
  // Remove empty sections themselves, including their grid slots and spacing.
  section.querySelector('.info-cv')?.remove();
  for (const [id, selector] of Object.entries(sectionSelectors)) {
    if (id !== 'cv' && !info[id]?.length) section.querySelector(selector)?.remove();
  }
  if (!info.introduction.trim()) section.querySelector('.info-intro').hidden = true;
  const orderedSections = info.sectionOrder.filter(id => id !== 'cv').map(id => section.querySelector(sectionSelectors[id])).filter(Boolean);
  const columns = section.querySelector(".info-columns");
  const arrange = () => {
    // Desktop pins Clients to the right. Mobile retains the saved sequence and
    // the existing spacing between the stacked columns, without duplicate DOM.
    const side = mobileMenuBreakpoint.matches ? orderedSections.at(-1) : section.querySelector(".info-clients");
    const ordered = [...orderedSections.filter(node => node !== side), side].filter(Boolean);
    details.hidden = !orderedSections.some(node => node !== side);
    columns.hidden = !orderedSections.length;
    ordered.forEach((node, index) => {
      const isSide = node === side;
      node.classList.toggle("info-column", isSide);
      node.classList.toggle("info-side-section", isSide);
      const parent = isSide ? columns : details;
      const position = isSide ? 1 : index;
      if (parent.children[position] !== node) parent.insertBefore(node, parent.children[position] || null);
    });
  };
  arrange();
  const layoutEvents = new AbortController();
  mobileMenuBreakpoint.addEventListener("change", arrange, {signal: layoutEvents.signal});
  const cleanupLayout = cleanupPage;
  cleanupPage = () => { layoutEvents.abort(); cleanupLayout(); };
  hydratedInfoPages.add(section);
}

async function loadInfoContent() {
  try {
    if (!globalThis.SanityData) return;
    const result = await SanityData.load();
    if (!result.ok) return;
    sanityContent = result.data;
    if (['localhost','127.0.0.1'].includes(location.hostname)) {
      const issues = sanityContent.issues.filter(issue => issue.path.startsWith('homePage.media'));
      if (issues.length) console.warn('Startseite media diagnostics', issues);
    }
    applySanityGlobals();
    hydrateFrontpage();
    // Update the existing Info text even after interaction. Rerunning route()
    // would reset scrolling and menus; applySanityInfo only touches active Info.
    applySanityInfo();
    applySanityLegal();
  } catch {
    // Existing local content remains the fallback, including offline use.
  } finally {
    sanityLoadSettled = true;
    hydrateFrontpage();
    const pending = app.querySelector(".detail[aria-busy='true']");
    const [page, id] = location.hash.replace(/^#\/?/, "").split("/");
    // Complete only the active pending detail. Never reroute or reset scrolling.
    if (pending && page === "project" && pending.dataset.projectId === (id || "")) renderProject(id);
    const pendingWork = app.querySelector(".work[aria-busy='true']");
    if (pendingWork && page === "work" && pendingWork.dataset.category === workCategory(id)) renderWork(id);
    if (page === "archive" && app.querySelector(".archive[aria-busy='true']")) renderArchive();
  }
}

// Selected Work centers its title line box at 50vh. Measure the actual font
// baselines so Info can use that reference without changing section typography.
function alignInfoBaseline(section) {
  const events = new AbortController();
  const update = () => {
    if (!section.isConnected) return;
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.inert = true;
    Object.assign(probe.style, {position:'fixed', left:'0', top:'0', height:'100vh', visibility:'hidden', pointerEvents:'none'});
    const reference = document.createElement('a');
    reference.className = 'project-title';
    Object.assign(reference.style, {width:'max-content', margin:'0'});
    const referenceText = document.createElement('span');
    const infoText = document.createElement('div');
    const heading = section.querySelector('.info-details h2, .info-side-section h2');
    infoText.style.font = getComputedStyle(heading || section).font;
    const marker = node => {
      const baseline = document.createElement('span');
      Object.assign(baseline.style, {display:'inline-block', width:'0', height:'0', verticalAlign:'baseline'});
      node.append(document.createTextNode('Ag'), baseline);
      return baseline;
    };
    const titleBaseline = marker(referenceText), infoBaseline = marker(infoText);
    reference.append(referenceText); probe.append(reference, infoText); document.body.append(probe);
    const infoBox = infoText.getBoundingClientRect();
    const infoAscent = infoBaseline.getBoundingClientRect().top - infoBox.top;
    const offset = mobileMenuBreakpoint.matches ? -infoAscent
      : titleBaseline.getBoundingClientRect().top - parseFloat(getComputedStyle(reference).top) - infoAscent;
    section.style.setProperty('--info-baseline-offset', `${offset}px`);
    probe.remove();
  };
  update();
  window.addEventListener('resize', update, {signal:events.signal});
  document.fonts.addEventListener('loadingdone', update, {signal:events.signal});
  return () => events.abort();
}

function renderInfo() {
  document.body.className = "is-info";
  setCurrentPage("info");
  app.innerHTML = `<section class="info">
    <div class="info-introduction">
      <div class="info-intro-content">
        <p class="info-intro">A Berlin based multidisciplinary designer, working in various fields of photography, generativity, motion design and cgi.</p>
      </div>
    </div>
    <div class="info-columns">
      <div class="info-column info-details">
        <section class="info-work"><h2>Work</h2><p>EPS51<br>Berlin<br>Artistic Director of Der Fahrende Raum<br>Buchhandlung Walther König at Haus der Kunst, Munich</p></section>
        <section class="info-skills"><h2>Skills</h2><p>Video<br>Graphic<br>Animation</p></section>
        <section class="info-contact"><h2>Contact</h2><p></p></section>
      </div>
      <section class="info-column info-side-section info-clients">
        <h2>Selected Clients</h2>
        <p>Eps51<br>Welt<br>William Fan<br>DNA Club Munich<br>Fachhochschule Potsdam<br>Rethink<br>Icon Magazine<br>Richert Beil<br>European Month of Photography<br>Ahlberg ME<br>Gectalt Jewelry<br>German Press Days<br>Dawid Tomaszewski<br>Horror Vacui<br>On time PR<br>Uhren Magazin<br>CLAV<br>BFW<br>Henkel<br>Some Magazine<br>S/O Berlin Das Stue<br>Bacq Berlin<br>The Alqemist<br>Runtime<br>Friedman Berlin<br>Frederik Constantin Victor<br>MGUN Berlin<br>Zinnober Blumen<br>Suprema<br>Hong Bock<br>The Green Bean<br>Perfect Skin<br>Necklacy</p>
      </section>
    </div>
  </section>${renderGlobalFooter(true)}`;
  applySanityFooter();
  cleanupPage = alignInfoBaseline(app.querySelector(".info"));
  applySanityInfo();
}

// Render only the adapter's restricted Portable Text model using DOM text nodes.
function renderLegalBody(blocks) {
  const fragment = document.createDocumentFragment();
  const lists = [];
  for (const block of blocks) {
    let parent = fragment;
    if (block.listItem) {
      const tag = block.listItem === "number" ? "ol" : "ul";
      // Normalize skipped levels without allocating arbitrary-depth empty lists.
      const level = Math.min(block.level || 1, lists.length + 1);
      while (lists.length > level) lists.pop();
      if (lists.length === level && lists.at(-1).tag !== tag) lists.pop();
      if (lists.length < level) {
        const list = document.createElement(tag);
        (lists.at(-1)?.node.lastElementChild || fragment).append(list);
        lists.push({tag, node: list});
      }
      parent = document.createElement("li");
      lists.at(-1).node.append(parent);
    } else lists.length = 0;
    const element = document.createElement(block.style === "h2" ? "h2" : block.listItem ? "span" : "p");
    for (const span of block.children) {
      let node = document.createDocumentFragment();
      span.text.split(/\r?\n/).forEach((line, index) => {
        if (index) node.append(document.createElement("br"));
        node.append(document.createTextNode(line));
      });
      let linked = false;
      for (const mark of [...new Set(span.marks)]) {
        let wrapper;
        if (mark === "strong" || mark === "em") wrapper = document.createElement(mark);
        else {
          const definition = block.markDefs.find(item => item._key === mark);
          if (!definition || linked) continue;
          // Defence in depth: never accept executable or credential-bearing URLs.
          let url;
          try { url = new URL(definition.href); } catch { continue; }
          if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol) || url.username || url.password) continue;
          wrapper = document.createElement("a");
          wrapper.href = url.href;
          linked = true;
        }
        wrapper.append(node);
        node = wrapper;
      }
      element.append(node);
    }
    parent.append(element);
  }
  return fragment;
}

const hydratedLegalPages = new WeakSet();
function applySanityLegal() {
  const article = app.querySelector(".legal-page");
  const page = article && sanityContent?.legalPages?.[article.dataset.legalPage];
  if (!page || hydratedLegalPages.has(article)) return;
  article.querySelector("h1").textContent = page.title;
  const copy = article.querySelector(".legal-copy");
  const navigation = copy.querySelector('nav[aria-label="Legal pages"]');
  // Keep the existing navigation node and listeners, replacing only editorial text.
  [...copy.childNodes].forEach(node => { if (node !== navigation) node.remove(); });
  copy.insertBefore(renderLegalBody(page.body), navigation);
  hydratedLegalPages.add(article);
}

function renderLegal(page) {
  const isImprint = page === "imprint";
  const title = isImprint ? "Imprint" : "Privacy Policy";
  document.body.className = "is-legal";
  setCurrentPage(page);
  app.innerHTML = `<article class="legal-page" data-legal-page="${page}">
    <h1>${title}</h1>
    <div class="legal-copy">
      ${isImprint ? `<section><h2>Contact</h2><p>Nicolas Kawohl<br><a href="mailto:mail@nicolas-kawohl.com">mail@nicolas-kawohl.com</a></p></section>` : ""}
      <p class="legal-placeholder">${isImprint ? "Imprint details will be added here." : "The privacy policy will be added here."}</p>
      <nav aria-label="Legal pages">
        <a href="#imprint"${isImprint ? ' aria-current="page"' : ""}>Imprint</a>
        <a href="#privacy-policy"${!isImprint ? ' aria-current="page"' : ""}>Privacy Policy</a>
      </nav>
    </div>
  </article>`;
  applySanityLegal();
}

function renderProject(id) {
  const localProject = WORK_PROJECTS.find(p => p.id === id);
  if (!sanityLoadSettled) {
    // Keep direct CMS-only hashes while the one shared request is pending. Do not
    // create fallback players that would have to be replaced when it completes.
    document.body.className = "is-detail";
    setCurrentPage(localProject ? `work/${localProject.category.toLowerCase()}` : "work");
    document.querySelector(".header-overview").href = overviewHref(localProject ? `#work/${localProject.category.toLowerCase()}` : "#work");
    app.innerHTML = `<article class="detail" data-project-id="${escapeModuleAttribute(id || "")}" aria-busy="true" aria-label="Loading project"></article>`;
    return;
  }
  const publishedProject = sanityContent?.projectsById?.[id];
  const project = publishedProject || localProject;
  if (!project) { location.hash = "#work"; return; }
  if (project.detailPageEnabled === false) { location.hash = `#work/${project.category.toLowerCase()}`; return; }
  if (renderedDetailProjects.get(app.querySelector(".detail")) === project) return;
  const modules = publishedProject ? project.detailModules || project.modules : project.modules;
  const moduleMarkup = publishedProject
    ? modules.map(module => module ? renderProjectModule(module, project.title, "detail") : "").join("")
    : renderProjectModules(modules, project.title, "detail");
  const paragraphs = value => value.trim() ? value.trim().split(/\r?\n\s*\r?\n/).map(paragraph =>
    `<p>${escapeModuleAttribute(paragraph).replace(/\r?\n/g, "<br>")}</p>`).join("") : "";
  document.body.className = "is-detail";
  document.querySelector(".header-overview").href = overviewHref(`#work/${project.category.toLowerCase()}`);
  setCurrentPage(`work/${project.category.toLowerCase()}`);
  const description = `${project.title} explores image, material and movement through a sequence of composed visual studies. The work brings contrasting surfaces and perspectives into a shared visual language, creating an open dialogue between detail and landscape.`;
  const infoMarkup = publishedProject || typeof project.description === "string"
    ? paragraphs(project.description || "")
    : `<p>${escapeModuleAttribute(description)}</p>
      <p>Set within a shifting visual environment, the project treats its setting as an active condition—one that obscures, reveals, and unsettles. Individual images form a layered reality in which clarity is deferred and meaning remains fluid, partial, and situational.</p>
      <p>The process becomes a method of introspection and fragmentation, recomposing its subject through a sequence of alternate perspectives. The work questions the coherence of representation and considers how identity, material, and place are mediated and reimagined.</p>`;
  app.innerHTML = `<article class="detail" data-text-color="${project.textColor || "auto"}" data-project-id="${escapeModuleAttribute(project.id)}" data-project-source="${publishedProject ? "sanity" : "local"}" data-project-category="${escapeModuleAttribute(project.category)}" data-project-year="${escapeModuleAttribute(project.year || "")}" data-project-additional-info="${escapeModuleAttribute(project.additionalInfo || "")}">
    <a class="detail-back" href="#work/${project.category.toLowerCase()}">${escapeModuleAttribute(project.title)}</a>
    <button class="detail-info-label" type="button" data-project-info-open>Info</button>
    <div class="project-modules">${moduleMarkup}</div>
  </article>
  <div class="detail-info-layer" aria-hidden="true">
    <section class="detail-info-popup" role="dialog" aria-modal="true" aria-label="${escapeModuleAttribute(project.title)} information">
      <button class="detail-info-close" type="button">(Close)</button>
      ${infoMarkup}
    </section>
  </div>
  ${renderGlobalFooter()}`;
  applySanityFooter();
  renderedDetailProjects.set(app.querySelector(".detail"), project);
  // The fixed, vertically centered title has no flow height. Reserve its actual
  // lower half above the mobile footer links, including font/width-driven wraps.
  const title = app.querySelector(".detail-back");
  const footer = app.querySelector(".project-footer");
  const titleSize = new ResizeObserver(() => {
    footer.style.setProperty("--detail-title-height", `${title.getBoundingClientRect().height}px`);
  });
  titleSize.observe(title);
  const cleanupVideos = initProjectVideos(app);
  cleanupPage = () => { titleSize.disconnect(); cleanupVideos(); };
}

function route() {
  if (pendingOverviewRestore && location.hash !== pendingOverviewRestore.hash) {
    app.style.visibility = pendingOverviewRestore.visibility;
    pendingOverviewRestore = null;
  }
  if (projectOverviewOrigin && location.hash !== projectOverviewOrigin.projectHash) projectOverviewOrigin = null;
  const activeHash = location.hash.replace(/^#\/?/, "") || "home";
  const [activePage, activeId] = activeHash.split("/");
  const detail = app.querySelector(".detail");
  if (activePage === "project" && detail?.dataset.projectId === activeId && renderedDetailProjects.has(detail)) return;
  const work = app.querySelector(".work");
  if (activePage === "work" && work?.dataset.category === workCategory(activeId) && renderedWorkPages.has(work)) return;
  if (activePage === "archive" && renderedIndexPages.has(app.querySelector(".archive"))) return;
  closeMobileMenu();
  cleanupPage();
  cleanupPage = () => {};
  hideOpenCursor();
  header.classList.remove("is-hidden");
  setWorkMenu(false);
  const hash = location.hash.replace(/^#\/?/, "") || "home";
  const [page, id] = hash.split("/");
  if (page === "project") renderProject(id);
  else if (page === "imprint" || page === "privacy-policy") renderLegal(page);
  else if (page === "work") renderWork(id);
  else ({ home: renderHome, archive: renderArchive, info: renderInfo }[page] || renderHome)();
  if (!pendingOverviewRestore) {
    window.scrollTo(0, 0);
    lastScrollY = 0;
  }
}

window.addEventListener("scroll", () => {
  if (headerFrame) return;
  headerFrame = requestAnimationFrame(() => {
    headerFrame = null;
    const currentScrollY = Math.max(0, window.scrollY);
    const mobileDetail = mobileMenuBreakpoint.matches && document.body.classList.contains("is-detail");
    if (mobileDetail && (currentScrollY <= 20 || mobileMenu.open)) {
      header.classList.remove("is-hidden");
      document.querySelector(".detail-back")?.classList.remove("is-hidden");
      lastScrollY = currentScrollY;
      return;
    }
    const difference = currentScrollY - lastScrollY;
    if (Math.abs(difference) < 4) return;
    const footer = document.querySelector(".project-footer");
    const footerVisible = footer && footer.getBoundingClientRect().top <= window.innerHeight / 2;
    const hideInterface = !(footerVisible && !mobileDetail) && !mobileMenu.open && difference > 0 && currentScrollY > 20 && !workMenu.classList.contains("is-open") && !header.contains(document.activeElement);
    header.classList.toggle("is-hidden", hideInterface);
    document.querySelectorAll(".detail-back").forEach(control => control.classList.toggle("is-hidden", hideInterface));
    lastScrollY = currentScrollY;
  });
}, { passive: true });

workMenu.addEventListener("pointerenter", event => {
  if (event.pointerType !== "touch") setWorkMenu(true);
});
workMenu.addEventListener("pointerleave", () => {
  if (!workMenu.contains(document.activeElement)) setWorkMenu(false);
});
workMenu.addEventListener("focusin", () => setWorkMenu(true));
workMenu.addEventListener("focusout", event => {
  if (!workMenu.contains(event.relatedTarget)) setWorkMenu(false);
});
let workTouchState=null;
workToggle.addEventListener('pointerdown',event=>{workTouchState=event.pointerType==='touch'?workMenu.classList.contains('is-open'):null;});
workToggle.addEventListener("click", event => {
  event.preventDefault();
  setWorkMenu(workTouchState===null?true:!workTouchState);
  workTouchState=null;
});
const mobileWorkToggle=mobileMenu.querySelector('.mobile-menu-label');
mobileWorkToggle.addEventListener('click',()=>{
  const open=mobileWorkToggle.getAttribute('aria-expanded')!=='true';
  mobileWorkToggle.setAttribute('aria-expanded',String(open));
  mobileWorkSubmenu.hidden=!open;
});
workSubmenu.addEventListener("click", event => {
  if (event.target.closest("a")) {
    document.activeElement.blur();
    setWorkMenu(false);
  }
});
document.addEventListener("click", event => {
  if (!workMenu.contains(event.target)) setWorkMenu(false);
});
document.addEventListener("click", event => {
  const layer = document.querySelector(".detail-info-layer");
  if (!layer) return;
  if (event.target.closest("[data-project-info-open]")) {
    layer.classList.add("open");
    layer.setAttribute("aria-hidden", "false");
    layer.querySelector(".detail-info-close").focus();
  } else if (event.target.closest(".detail-info-close") || event.target === layer) {
    layer.classList.remove("open");
    layer.setAttribute("aria-hidden", "true");
  }
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (workMenu.classList.contains("is-open")) {
    workToggle.focus();
    setWorkMenu(false);
  }
  const layer = document.querySelector(".detail-info-layer.open");
  if (layer) {
    layer.classList.remove("open");
    layer.setAttribute("aria-hidden", "true");
  }
});
window.addEventListener("hashchange", route);
route();
loadInfoContent();
