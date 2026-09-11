/* Archive entries accept an optional fifth value: "half" or "full". */

const ARCHIVE_PROJECTS = [
  ["Lichen Studies", "Graphic", "2026", ["material/TextureBump_ARC_W_RZ.jpg", "material/Stone_Conserve_Blau_RZ_v2.jpg"]],
  ["Ethereal Tides", "Video", "2026", ["material/_DSF0857.jpg", "material/_DSF0864.jpg", "material/_DSF2669.jpg"]],
  ["Rhythms of the City", "Commissioned", "2025", ["material/DSCF6919.jpg", "material/DSCF6978.jpg", "material/DSCF7079.jpg"]],
  ["Static Landscape", "Video", "2025", ["material/Strommast_Sundown_RZ.jpg", "material/DSCF1339.jpg"]],
  ["Stone Dreams", "Graphic", "2025", ["material/Stone_Artefakt_9.jpg", "material/MA_GD_Tanzartefakt_7.jpg"]],
  ["Silent Witness", "Commissioned", "2024", ["material/_DSF5795.jpg", "material/_DSF5962.jpg"]],
  ["Digital Mirage", "Graphic", "2024", ["material/Mountain_v20003.jpg", "material/Mountain_v20006.jpg"]],
  ["Crystal Veins", "Graphic", "2024", ["material/Stone_Conserve_Blau_RZ_v2.jpg", "material/TextureBump_ARC_W_RZ.jpg"]],
  ["Urban Memory", "Commissioned", "2023", ["material/DSCF7780.jpg", "material/DSCF7807.jpg", "material/DSCF7858.jpg"]],
  ["Future Forms", "Graphic", "2023", ["material/MA_GD_Tanzartefakt_7.jpg", "material/Stone_Artefakt_9.jpg"]],
  ["Field Notes", "Video", "2023", ["material/_DSF4139.jpg", "material/_DSF5771.jpg"]],
  ["Blue Hour", "Commissioned", "2022", ["material/Strommast_Sundown_RZ.jpg", "material/Iceland25_Echo.jpg"]],
  ["Mountain Range", "Video", "2022", ["material/MountainRange_raw.jpg", "material/Mountain_v20003.jpg"]]
  ,["Chromatic Waves", "Graphic", "2022", ["material/TextureBump_ARC_W_RZ.jpg", "material/MA_GD_Tanzartefakt_7.jpg"]]
  ,["Pulse of the Night", "Video", "2022", ["material/_DSF2669.jpg", "material/_DSF3392.jpg"]]
  ,["Digital Reverie", "Graphic", "2021", ["material/Mountain_v20006.jpg", "material/Stone_Artefakt_9.jpg"]]
  ,["Vivid Horizons", "Commissioned", "2021", ["material/DSCF2880.jpg", "material/DSCF6919.jpg", "material/DSCF6978.jpg"]]
  ,["Echo Chamber", "Video", "2021", ["material/Iceland25_Echo.jpg", "material/_DSF6111.jpg"]]
  ,["Kaleidoscope Dreams", "Graphic", "2021", ["material/MA_GD_Tanzartefakt_7.jpg", "material/TextureBump_ARC_W_RZ.jpg"]]
  ,["Urban Serenade", "Commissioned", "2020", ["material/DSCF7079.jpg", "material/DSCF7780.jpg"]]
  ,["Fragments of Light", "Video", "2020", ["material/_DSF4139.jpg", "material/_DSF5771.jpg"]]
  ,["Synthetic Garden", "Graphic", "2020", ["material/Stone_Conserve_Blau_RZ_v2.jpg", "material/Mountain_v20003.jpg"]]
  ,["Night Passage", "Commissioned", "2020", ["material/_DSF5795.jpg", "material/_DSF5962.jpg"]]
  ,["Remote Signals", "Video", "2019", ["material/Strommast_Sundown_RZ.jpg", "material/DSCF1339.jpg"]]
  ,["Soft Geometry", "Graphic", "2019", ["material/Stone_Artefakt_9.jpg", "material/MA_GD_Tanzartefakt_7.jpg"]]
  ,["Changing Ground", "Commissioned", "2019", ["material/DSCF7807.jpg", "material/DSCF7858.jpg"]]
  ,["Aerial Static", "Video", "2019", ["material/_DSF0857.jpg", "material/_DSF0864.jpg"]]
  ,["Blue Residue", "Graphic", "2018", ["material/MountainRange_raw.jpg", "material/Stone_Conserve_Blau_RZ_v2.jpg"]]
  ,["Afterimage", "Commissioned", "2018", ["material/_DSF5771.jpg", "material/_DSF6111.jpg"]]
  ,["Field Transmission", "Video", "2018", ["material/Iceland25_Echo.jpg", "material/Strommast_Sundown_RZ.jpg"]]
  ,["Material Memory", "Graphic", "2018", ["material/TextureBump_ARC_W_RZ.jpg", "material/Stone_Artefakt_9.jpg", "material/Mountain_v20006.jpg"]]
  ,["Parallel Terrain", "Commissioned", "2017", ["material/DSCF6919.jpg", "material/DSCF7079.jpg"]]
  ,["Low Frequency", "Video", "2017", ["material/_DSF2669.jpg", "material/_DSF3392.jpg", "material/_DSF4139.jpg"]]
].map(([title, category, year, images, layout], index) => ({
  title,
  category,
  year,
  images,
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
const header = document.querySelector(".site-header");
const brand = document.querySelector(".brand");
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
  const projectLink = event.target.closest?.(".is-work .project-link, .is-work .project-title");
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
function setCurrentPage(route) {
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
  const indexWidth = menuMeasureContext.measureText("Index").width / 100;
  header.style.setProperty("--index-menu-width", `${7 - selectedWidth + indexWidth}em`);
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
  workSubmenu.style.setProperty("--fitted-menu-size", `${size}px`);
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

function renderHome() {
  document.body.className = "is-home";
  setCurrentPage("");
  app.innerHTML = `<section class="home"><iframe class="home-media" src="https://player.vimeo.com/video/1223949127?background=1&autoplay=1&autopause=0&muted=1&loop=1&controls=0&badge=0&player_id=0&app_id=58479" title="Selfscan_RZ" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" tabindex="-1"></iframe></section>`;
}

function renderWorkModule(module, project) {
  const title = escapeModuleAttribute(project.title);
  const href = `#project/${encodeURIComponent(project.id)}`;
  const empty = module.slots.every(slot => slot == null);
  return `<section class="project-module-preview${empty ? " is-empty" : ""}" aria-label="${title}">
    <a class="project-title" href="${href}" aria-label="Open ${title}"><span>${title}</span></a>
    ${renderProjectModule(module, project.title)}
  </section>`;
}

function renderWork(category = "Graphic") {
  const selectedCategory = ["Graphic", "Commissioned", "Video"].includes(category) ? category : "Graphic";
  document.body.className = `is-work is-work-${selectedCategory.toLowerCase()}`;
  setCurrentPage(`work/${selectedCategory.toLowerCase()}`);
  const projects = WORK_PROJECTS.map((p, i) => `
    <article class="project-preview" data-category="${p.category}" data-project="${p.id}"${p.category === selectedCategory ? "" : " hidden"}>
      ${p.category === "Commissioned" ? "" : `<a class="project-link" href="#project/${p.id}" aria-label="Open ${p.title}"></a>`}
      <div class="project-modules">${p.modules.map(module => renderWorkModule(module, p)).join("")}</div>
      ${i === WORK_PROJECTS.length - 1 ? `<span class="project-kind">${p.category}</span>` : ""}
    </article>`).join("");
  app.innerHTML = `<section class="work"><div class="projects">${projects}</div></section>`;
}

function renderArchive() {
  document.body.className = "is-index";
  setCurrentPage("archive");
  app.innerHTML = `<section class="archive"><div class="archive-background" aria-hidden="true">${image(ARCHIVE_DISPLAY_PROJECTS[0].images[0])}</div><div class="archive-list">${ARCHIVE_DISPLAY_PROJECTS.map((p, i) => `<button class="archive-row" data-index="${i}"><span>${p.title}</span>${["Graphic", "Commissioned", "Video"].map(category => `<span class="archive-category ${p.category === category ? "has-category" : ""}">${p.category === category ? p.category : ""}</span>`).join("")}</button>`).join("")}</div></section>`;
  const bg = document.querySelector(".archive-background");
  const bgImage = bg.querySelector("img");
  bgImage.loading = "eager";
  const list = document.querySelector(".archive-list");
  const rows = [...list.querySelectorAll(".archive-row")];
  const mobile = window.matchMedia("(max-width: 700px)");
  const events = new AbortController();
  let activeRow = -1;
  let frame = 0;
  let scrollFrame;
  const showProjectImage = (project, imageIndex) => {
    bg.classList.toggle("half", !mobile.matches && project.layout === "half");
    bg.classList.toggle("full", mobile.matches || project.layout === "full");
    bgImage.src = project.images[imageIndex];
    bg.classList.add("visible");
  };
  const updateMobileProject = () => {
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
    showProjectImage(ARCHIVE_DISPLAY_PROJECTS[next], 0);
  };
  list.addEventListener("scroll", () => {
    if (!mobile.matches || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      updateMobileProject();
    });
  }, { passive: true, signal: events.signal });
  rows.forEach(row => {
    row.addEventListener("mouseenter", () => {
      if (mobile.matches) return;
      activeRow = Number(row.dataset.index);
      frame = 0;
      showProjectImage(ARCHIVE_DISPLAY_PROJECTS[activeRow], frame);
    });
    row.addEventListener("click", () => {
      if (mobile.matches) {
        list.scrollTo({ top: row.offsetTop, behavior: "auto" });
        updateMobileProject();
        return;
      }
      const rowIndex = Number(row.dataset.index);
      const project = ARCHIVE_DISPLAY_PROJECTS[rowIndex];
      frame = activeRow === rowIndex ? (frame + 1) % project.images.length : 0;
      activeRow = rowIndex;
      showProjectImage(project, frame);
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
    if (mobile.matches) updateMobileProject();
    else list.scrollTop = 0;
  };
  mobile.addEventListener("change", syncLayout, { signal: events.signal });
  window.addEventListener("resize", updateMobileProject, { signal: events.signal });
  cleanupPage = () => {
    events.abort();
    cancelAnimationFrame(scrollFrame);
  };
  syncLayout();
}

function renderInfo() {
  document.body.className = "is-info";
  setCurrentPage("info");
  app.innerHTML = `<section class="info">
    <p class="info-intro">A Berlin based multidisciplinary designer, working in various fields of<br>photography, generativity, motion design and cgi.</p>
    <div class="info-columns">
      <div class="info-cv">
        <section><h2>Teaching</h2><p>FH Potsdam<br>HS Hannover</p></section>
        <section><h2>CV</h2><h3>Studies</h3><p>2014 – 2021<br>Academy of Fine Arts</p></section>
        <section><h3>Work</h3><p>2026<br>EPS51<br>2024 - 2026<br>Berlin<br>2022 - 2025<br>Artistic Director of Der Fahrende Raum<br>2017 - 2021<br>Buchhandlung Walther König at Haus der Kunst, Munich</p></section>
        <section><h3>Mail</h3><p><a href="mailto:mail@nicolas-kawohl.com">mail@nicolas-kawohl.com</a></p><h3>Instagram</h3><p><a href="https://instagram.com/nicokawo">nicokawo</a></p><h3>Phone</h3><p><a href="tel:+491234567892345">0123 4567892345</a></p></section>
      </div>
      <section class="info-clients">
        <h2>Selected Clientes and Collaborators</h2>
        <p>Eps51<br>Welt<br>William Fan<br>DNA Club Munich<br>Fachhochschule Potsdam<br>Rethink<br>Icon Magazine<br>Richert Beil<br>European Month of Photography<br>Ahlberg ME<br>Gectalt Jewelry<br>German Press Days<br>Dawid Tomaszewski<br>Horror Vacui<br>On time PR<br>Uhren Magazin<br>CLAV<br>BFW<br>Henkel<br>Some Magazine<br>S/O Berlin Das Stue<br>Bacq Berlin<br>The Alqemist<br>Runtime<br>Friedman Berlin<br>Frederik Constantin Victor<br>MGUN Berlin<br>Zinnober Blumen<br>Suprema<br>Hong Bock<br>The Green Bean<br>Perfect Skin<br>Necklacy</p>
      </section>
    </div>
  </section>`;
}

function renderProject(id) {
  const project = WORK_PROJECTS.find(p => p.id === id);
  if (!project) { location.hash = "#work"; return; }
  document.body.className = "is-detail";
  const projectBrand = `<span class="project-prefix">NK&nbsp;</span>${project.title}`;
  brand.innerHTML = projectBrand;
  setCurrentPage(`work/${project.category.toLowerCase()}`);
  const description = `${project.title} explores image, material and movement through a sequence of composed visual studies. The work brings contrasting surfaces and perspectives into a shared visual language, creating an open dialogue between detail and landscape.`;
  app.innerHTML = `<article class="detail">
    <a class="detail-back" href="#work/${project.category.toLowerCase()}">Back</a>
    <button class="detail-info-label" type="button" data-project-info-open>Info</button>
    <div class="project-modules">${renderProjectModules(project.modules, project.title)}</div>
    <p class="detail-copy">${description}</p>
    <a class="back" href="#work/${project.category.toLowerCase()}">◁ Project overview</a>
  </article>
  <div class="detail-info-layer" aria-hidden="true">
    <section class="detail-info-popup" role="dialog" aria-modal="true" aria-label="${project.title} information">
      <button class="detail-info-close" type="button">Close</button>
      <p>${description}</p>
      <p>Set within a shifting visual environment, the project treats its setting as an active condition—one that obscures, reveals, and unsettles. Individual images form a layered reality in which clarity is deferred and meaning remains fluid, partial, and situational.</p>
      <p>The process becomes a method of introspection and fragmentation, recomposing its subject through a sequence of alternate perspectives. The work questions the coherence of representation and considers how identity, material, and place are mediated and reimagined.</p>
    </section>
  </div>`;
}

function route() {
  closeMobileMenu();
  cleanupPage();
  cleanupPage = () => {};
  hideOpenCursor();
  header.classList.remove("is-hidden");
  brand.textContent = "Nicolas Kawohl";
  setWorkMenu(false);
  const hash = location.hash.replace(/^#\/?/, "") || "home";
  const [page, id] = hash.split("/");
  if (page === "project") renderProject(id);
  else if (page === "work") renderWork(id ? id[0].toUpperCase() + id.slice(1) : "Graphic");
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
    const hideInterface = difference > 0 && currentScrollY > 20 && !workMenu.classList.contains("is-open") && !header.contains(document.activeElement);
    header.classList.toggle("is-hidden", hideInterface);
    document.querySelectorAll(".detail-info-label, .detail-back").forEach(control => control.classList.toggle("is-hidden", hideInterface));
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
