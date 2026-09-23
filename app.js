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

function closeMobileMenu() {
  if (mobileMenu.open) mobileMenu.close();
  mobileMenuToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("mobile-menu-open");
}

mobileMenuToggle.addEventListener("click", () => {
  if (!mobileMenuBreakpoint.matches) return;
  setWorkMenu(false);
  hideOpenCursor();
  mobileMenu.showModal();
  mobileMenu.scrollTop = 0;
  mobileMenuToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("mobile-menu-open");
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

function updateOpenCursor(event) {
  const projectLink = event.target.closest?.(".is-work .project-link, .is-work a.project-title");
  if (event.pointerType !== "mouse" || !projectLink) {
    hideOpenCursor();
    return;
  }
  openCursor.hidden = false;
  const halfWidth = openCursor.offsetWidth / 2;
  const halfHeight = openCursor.offsetHeight / 2;
  openCursor.style.left = `${Math.max(halfWidth, Math.min(event.clientX, document.documentElement.clientWidth - halfWidth))}px`;
  openCursor.style.top = `${Math.max(halfHeight, Math.min(event.clientY, window.innerHeight - halfHeight))}px`;
  document.body.classList.add("has-open-cursor");
}

document.addEventListener("pointermove", updateOpenCursor);
document.addEventListener("pointerover", updateOpenCursor);
document.documentElement.addEventListener("pointerleave", hideOpenCursor);
document.addEventListener("keydown", hideOpenCursor);
window.addEventListener("blur", hideOpenCursor);
window.addEventListener("scroll", hideOpenCursor, { passive: true });
let lastScrollY = window.scrollY;
let headerFrame;
let cleanupPage = () => {};

function image(src, alt = "") { return `<img src="${src}" alt="${alt}" loading="lazy">`; }
let currentPageRoute = "";
function setCurrentPage(route) {
  currentPageRoute = route;
  document.querySelectorAll("[data-route]").forEach(link => {
    const active = link.dataset.route === route || (link.dataset.route === "work" && route.startsWith("work/"));
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
    document.querySelectorAll(".brand").forEach(node => { node.textContent = brand; });
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
      anchor.href = item.href;
      node.hidden = false;
      node.style.display = "";
      container.append(node);
    }
    for (const [destination, node] of nodes) {
      if (!seen.has(destination)) { node.hidden = true; node.style.display = "none"; }
    }
    const categories = desktop ? workSubmenu : group;
    for (const category of navigation.categories) {
      const link = categories.querySelector(`[data-route="${category.destination}"]`);
      link.textContent = category.label;
      categories.append(link);
    }

  }
  setCurrentPage(currentPageRoute);
  fitWorkMenu();
}

function applySanityHome() {
  const section = app.querySelector(".home");
  const home = sanityContent?.homePage;
  if (!section || home?.video?.type !== "vimeo") return;
  const frame = section.querySelector("iframe.home-media");
  // The adapter validates the Vimeo host/id and retains an unlisted privacy hash.
  // Playback policy belongs here; editorial URL parameters cannot enable UI/audio.
  const url = new URL(home.video.embedUrl);
  const background = {background: "1", autoplay: "1", autopause: "0", muted: "1",
    loop: "1", controls: "0", badge: "0", player_id: "0", app_id: "58479"};
  for (const [key, value] of Object.entries(background)) url.searchParams.set(key, value);
  // Avoid restarting the existing player when Sanity supplies the same video.
  if (frame.getAttribute("src") !== url.href) frame.setAttribute("src", url.href);
  frame.title = home.videoTitle.trim() || "Selfscan_RZ";
  if (home.poster) {
    // An iframe has no poster attribute. Show the decorative poster behind it;
    // the iframe title provides the accessible description, avoiding duplicate alt.
    section.style.backgroundImage = `url("${home.poster.src}")`;
    section.style.backgroundSize = "cover";
    section.style.backgroundPosition = home.poster.hotspot
      ? `${home.poster.hotspot.x * 100}% ${home.poster.hotspot.y * 100}%` : "center";
  }
}

function renderHome() {
  document.body.className = "is-home";
  setCurrentPage("");
  app.innerHTML = `<section class="home"><iframe class="home-media" src="https://player.vimeo.com/video/1223949127?background=1&autoplay=1&autopause=0&muted=1&loop=1&controls=0&badge=0&player_id=0&app_id=58479" title="Selfscan_RZ" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" tabindex="-1"></iframe></section>`;
  applySanityHome();
}

function renderWorkModule(module, project) {
  const hasText = module.slots.some(slot => slot?.type === "text");
  const previewModule = {
    ...module,
    slots: module.slots.map(slot => slot?.type === "text" ? null : slot)
  };
  if (hasText && previewModule.slots.every(slot => slot == null)) return "";
  const title = escapeModuleAttribute(project.title);
  const href = `#project/${encodeURIComponent(project.id)}`;
  const empty = previewModule.slots.every(slot => slot == null);
  const titleTag = project.detailPageEnabled === false ? "span" : "a";
  const titleLink = project.detailPageEnabled === false ? "" : ` href="${href}" aria-label="Open ${title}"`;
  return `<section class="project-module-preview${empty ? " is-empty" : ""}" aria-label="${title}">
    <${titleTag} class="project-title"${titleLink}><span>${title}</span>${project.additionalInfo ? `<span class="project-additional-info">${escapeModuleAttribute(project.additionalInfo)}</span>` : ""}</${titleTag}>
    ${renderProjectModule(previewModule, project.title, "overview")}
  </section>`;
}

function renderWorkPreview(project) {
  if (project.selectedWorkPreview) {
    return renderWorkModule({type: "full", height: "auto", slots: [project.selectedWorkPreview]}, project);
  }
  // One reference owns one preview, not the project's entire detail sequence.
  const preview = project.modules.find(module => module.slots.some(slot => slot?.type === "video"))
    || project.modules.find(module => module.slots.some(slot => slot?.type === "image"))
    || project.modules[0];
  return preview ? renderWorkModule(preview, project) : "";
}

function workCategory(category) {
  return WORK_CATEGORIES.find(value => value.toLowerCase() === category?.toLowerCase()) || "Video";
}

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
  const selectedProjects = WORK_CATEGORIES.flatMap(category => useLocal(category)
    ? WORK_PROJECTS.filter(project => project.category === category)
    : sanityContent.selectedWork[category.toLowerCase()].map(id => sanityContent.projectsById[id])
      .filter(project => project && (project.selectedWorkPreview || project.modulesValid !== false)));
  const projects = selectedProjects.map((p, i) => `
    <article class="project-preview" data-category="${p.category}" data-project="${escapeModuleAttribute(p.id)}"${p.category === selectedCategory ? "" : " hidden"}>
      ${p.category === "Commissioned" || p.detailPageEnabled === false ? "" : `<a class="project-link" href="#project/${encodeURIComponent(p.id)}" aria-label="Open ${escapeModuleAttribute(p.title)}"></a>`}
      <div class="project-modules">${renderWorkPreview(p)}</div>
      ${i === selectedProjects.length - 1 ? `<span class="project-kind">${p.category}</span>` : ""}
    </article>`).join("");
  app.innerHTML = `<section class="work" data-category="${selectedCategory}" data-source="${useLocal(selectedCategory) ? "local" : "sanity"}"><div class="projects">${projects}</div></section>`;
  renderedWorkPages.set(app.querySelector(".work"), source);
  cleanupPage = initProjectVideos(app);
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
  app.innerHTML = `<section class="archive" data-source="${unavailable ? "local" : "sanity"}"><div class="archive-background" aria-hidden="true">${entries[0]?.images?.[0] ? image(entries[0].images[0]) : ""}</div><div class="archive-list">${entries.map(entryMarkup).join("")}</div></section>`;
  renderedIndexPages.set(app.querySelector(".archive"), entries);
  const bg = document.querySelector(".archive-background");
  const bgImage = bg.querySelector("img");
  if (bgImage) bgImage.loading = "eager";
  const list = document.querySelector(".archive-list");
  const rows = [...list.querySelectorAll(".archive-row")];
  if (!rows.length) return;
  const mobile = window.matchMedia("(max-width: 700px)");
  const events = new AbortController();
  let activeRow = -1;
  let frame = 0;
  let scrollFrame;
  const showEntryImage = (entry, imageIndex) => {
    if (!bgImage || !entry?.images?.length) {
      bg.classList.remove("visible");
      return;
    }
    const media = entry.previewImages?.[imageIndex % entry.images.length];
    bgImage.alt = media?.alt ?? "";
    // Reuse the module image crop/hotspot mapping without changing Index sizing.
    const position = moduleImagePosition(media);
    bgImage.style.cssText = position ? position.slice(' style="'.length, -1) : "";
    const half = !mobile.matches && (entry.layout === "half") !== (imageIndex % 2 === 1);
    bg.classList.toggle("half", half);
    bg.classList.toggle("full", !half);
    bgImage.src = entry.images[imageIndex % entry.images.length];
    bg.classList.add("visible");
  };
  const updateMobileEntry = () => {
    if (!mobile.matches) return;
    const top = list.getBoundingClientRect().top;
    const index = rows.findIndex(row => row.getBoundingClientRect().bottom > top + 1);
    const next = index < 0 ? rows.length - 1 : index;
    if (next === activeRow) return;
    rows.forEach((row, i) => {
      row.classList.toggle("is-active", i === next);
      if (i === next) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    });
    activeRow = next;
    showEntryImage(entries[next], 0);
  };
  list.addEventListener("scroll", () => {
    if (!mobile.matches || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      updateMobileEntry();
    });
  }, { passive: true, signal: events.signal });
  rows.forEach(row => {
    row.addEventListener("mouseenter", () => {
      if (mobile.matches) return;
      activeRow = Number(row.dataset.index);
      frame = 0;
      showEntryImage(entries[activeRow], frame);
    });
    row.addEventListener("click", () => {
      if (mobile.matches) {
        list.scrollTo({ top: row.offsetTop, behavior: "auto" });
        updateMobileEntry();
        return;
      }
      const rowIndex = Number(row.dataset.index);
      const entry = entries[rowIndex];
      frame = activeRow === rowIndex ? frame + 1 : 0;
      activeRow = rowIndex;
      showEntryImage(entry, frame);
    });
    row.addEventListener("mouseleave", () => {
      if (mobile.matches) return;
      bg.classList.remove("visible");
      activeRow = -1;
      frame = 0;
    });
  });
  const syncLayout = () => {
    activeRow = -1;
    frame = 0;
    rows.forEach(row => {
      row.classList.remove("is-active");
      row.removeAttribute("aria-current");
    });
    bg.classList.remove("visible");
    if (mobile.matches) updateMobileEntry();
    else list.scrollTop = 0;
  };
  mobile.addEventListener("change", syncLayout, { signal: events.signal });
  window.addEventListener("resize", updateMobileEntry, { signal: events.signal });
  cleanupPage = () => {
    events.abort();
    cancelAnimationFrame(scrollFrame);
  };
  syncLayout();
}

function applySanityInfo() {
  const section = app.querySelector(".info");
  const info = sanityContent?.infoPage;
  if (!section || !info || hydratedInfoPages.has(section)) return;
  const issues = sanityContent.issues || [];
  const needsSettings = info.contactLinks.length > 0 || issues.some(issue =>
    issue.path.startsWith("infoPage.contactLinks") && issue.code === "missing_contact");
  // Malformed content is different from intentionally empty published arrays.
  if (issues.some(issue => issue.path.startsWith("infoPage") && issue.code !== "missing_contact")) return;
  const lines = values => values.map(value => escapeModuleAttribute(value).replace(/\r?\n/g, "<br>")).join("<br>");
  const content = {
    ".info-intro": lines([info.introduction]),
    ".info-cv p": lines(info.cv.map(entry => [entry.period, entry.text].filter(Boolean).join(" "))),
    ".info-work p": lines(info.work),
    ".info-skills p": lines(info.skills),
    ".info-contact p": info.contactLinks.map(link =>
      `<a href="${escapeModuleAttribute(link.href)}">${escapeModuleAttribute(link.label)}</a>`).join("<br>"),
    ".info-clients p": lines(info.selectedClients)
  };
  for (const [selector, html] of Object.entries(content)) {
    // A settings failure affects contacts only, never valid published Info text.
    if (selector === ".info-contact p" && needsSettings && !sanityContent.siteSettings) continue;
    const paragraph = section.querySelector(selector);
    if (paragraph.innerHTML !== html) paragraph.innerHTML = html;
  }
  hydratedInfoPages.add(section);
}

async function loadInfoContent() {
  try {
    if (!globalThis.SanityData) return;
    const result = await SanityData.load();
    if (!result.ok) return;
    sanityContent = result.data;
    applySanityGlobals();
    // Update the existing paragraphs even after interaction. Rerunning route()
    // would reset scrolling and menus; applySanityInfo only touches active Info.
    applySanityInfo();
    applySanityHome();
    applySanityLegal();
  } catch {
    // Existing local content remains the fallback, including offline use.
  } finally {
    sanityLoadSettled = true;
    const pending = app.querySelector(".detail[aria-busy='true']");
    const [page, id] = location.hash.replace(/^#\/?/, "").split("/");
    // Complete only the active pending detail. Never reroute or reset scrolling.
    if (pending && page === "project" && pending.dataset.projectId === (id || "")) renderProject(id);
    const pendingWork = app.querySelector(".work[aria-busy='true']");
    if (pendingWork && page === "work" && pendingWork.dataset.category === workCategory(id)) renderWork(id);
    if (page === "archive" && app.querySelector(".archive[aria-busy='true']")) renderArchive();
  }
}

function renderInfo() {
  document.body.className = "is-info";
  setCurrentPage("info");
  app.innerHTML = `<section class="info">
    <p class="info-intro">A Berlin based multidisciplinary designer, working in various fields of photography, generativity, motion design and cgi.</p>
    <div class="info-columns">
      <div class="info-column info-details">
        <section class="info-cv"><h2>CV</h2><p>2022 – 2025 Work at Eps51<br>2014 – 2021 Academy of Fine Arts</p></section>
        <section class="info-work"><h2>Work</h2><p>EPS51<br>Berlin<br>Artistic Director of Der Fahrende Raum<br>Buchhandlung Walther König at Haus der Kunst, Munich</p></section>
        <section class="info-skills"><h2>Skills</h2><p>Video<br>Graphic<br>Animation</p></section>
        <section class="info-contact"><h2>Contact</h2><p><a href="mailto:mail@nicolas-kawohl.com">Mail</a><br><a href="https://www.instagram.com/nicocaw/">Instagram</a></p></section>
      </div>
      <section class="info-column info-clients">
        <h2>Selected Clients</h2>
        <p>Eps51<br>Welt<br>William Fan<br>DNA Club Munich<br>Fachhochschule Potsdam<br>Rethink<br>Icon Magazine<br>Richert Beil<br>European Month of Photography<br>Ahlberg ME<br>Gectalt Jewelry<br>German Press Days<br>Dawid Tomaszewski<br>Horror Vacui<br>On time PR<br>Uhren Magazin<br>CLAV<br>BFW<br>Henkel<br>Some Magazine<br>S/O Berlin Das Stue<br>Bacq Berlin<br>The Alqemist<br>Runtime<br>Friedman Berlin<br>Frederik Constantin Victor<br>MGUN Berlin<br>Zinnober Blumen<br>Suprema<br>Hong Bock<br>The Green Bean<br>Perfect Skin<br>Necklacy</p>
      </section>
    </div>
  </section>`;
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
    document.querySelector(".header-overview").href = localProject ? `#work/${localProject.category.toLowerCase()}` : "#work";
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
  document.querySelector(".header-overview").href = `#work/${project.category.toLowerCase()}`;
  setCurrentPage(`work/${project.category.toLowerCase()}`);
  const description = `${project.title} explores image, material and movement through a sequence of composed visual studies. The work brings contrasting surfaces and perspectives into a shared visual language, creating an open dialogue between detail and landscape.`;
  const infoMarkup = publishedProject || typeof project.description === "string"
    ? paragraphs(project.description || "")
    : `<p>${escapeModuleAttribute(description)}</p>
      <p>Set within a shifting visual environment, the project treats its setting as an active condition—one that obscures, reveals, and unsettles. Individual images form a layered reality in which clarity is deferred and meaning remains fluid, partial, and situational.</p>
      <p>The process becomes a method of introspection and fragmentation, recomposing its subject through a sequence of alternate perspectives. The work questions the coherence of representation and considers how identity, material, and place are mediated and reimagined.</p>`;
  app.innerHTML = `<article class="detail" data-project-id="${escapeModuleAttribute(project.id)}" data-project-source="${publishedProject ? "sanity" : "local"}" data-project-category="${escapeModuleAttribute(project.category)}" data-project-year="${escapeModuleAttribute(project.year || "")}" data-project-additional-info="${escapeModuleAttribute(project.additionalInfo || "")}">
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
  <footer class="project-footer" aria-label="Contact and legal information">
    <nav class="project-footer-links" aria-label="Footer">
      <a href="mailto:mail@nicolas-kawohl.com">Mail</a>
      <a href="https://www.instagram.com/nicocaw/" target="_blank" rel="noopener noreferrer">Instagram</a>
      <a href="#imprint">Imprint</a>
      <a href="#privacy-policy">Privacy Policy</a>
    </nav>
  </footer>`;
  applySanityFooter();
  renderedDetailProjects.set(app.querySelector(".detail"), project);
  cleanupPage = initProjectVideos(app);
}

function route() {
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
  window.scrollTo(0, 0);
  lastScrollY = 0;
}

window.addEventListener("scroll", () => {
  if (headerFrame) return;
  headerFrame = requestAnimationFrame(() => {
    headerFrame = null;
    const currentScrollY = window.scrollY;
    const difference = currentScrollY - lastScrollY;
    if (Math.abs(difference) < 4) return;
    const footer = document.querySelector(".project-footer");
    const footerVisible = footer && footer.getBoundingClientRect().top <= window.innerHeight / 2;
    const hideInterface = !footerVisible && difference > 0 && currentScrollY > 20 && !workMenu.classList.contains("is-open") && !header.contains(document.activeElement);
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
let touchOpenedMenu = false;
workToggle.addEventListener("pointerdown", event => {
  touchOpenedMenu = event.pointerType === "touch" && !workMenu.classList.contains("is-open");
});
workToggle.addEventListener("click", event => {
  if (touchOpenedMenu) {
    event.preventDefault();
    setWorkMenu(true);
    touchOpenedMenu = false;
  } else setWorkMenu(false);
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
