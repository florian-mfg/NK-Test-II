/*
 * Free-plan Sanity adapter. Info, Frontpage and project details consume it in app.js.
 * Loading this file only exposes SanityData; it never fetches or touches the DOM.
 *
 * SanityData.load({timeoutMs?, signal?}) -> Promise<{ok, data, error}>
 * SanityData.normalize(projectedQueryResult) -> normalized data with issues/availability
 * SanityData.normalizeModule(module) -> {module, issues}
 * SanityData.normalizeImage(image) -> {image, issues}
 * SanityData.config / query / defaultCategoryNavigation -> read-only configuration
 *
 * Text is returned as text, not trusted HTML: consumers must escape at rendering.
 * Missing singletons are null (navigation supplies explicit defaults). Published
 * empty arrays stay empty. This adapter never merges in local website content.
 * Projects use slug IDs; selectedWork contains ordered IDs, not copied projects.
 * A malformed module invalidates that project's composition (modulesValid:false,
 * modules:[]). detailModules preserves valid rows and safe empty row frames for
 * defensive detail rendering; unknown layouts remain null. Metadata is retained.
 * Image crop is applied to src; hotspot/dimensions are retained for rendering.
 * No dimensions or CSS are imposed here.
 */
(function (root) {
  'use strict';
  const vimeo = typeof module !== 'undefined' && module.exports ? require('./vimeo-media.js') : root.VimeoMedia;

  const config = Object.freeze({
    projectId: 'ck6xe2er', dataset: 'production', apiVersion: '2025-02-19',
    perspective: 'published', timeoutMs: 10000
  });
  const categories = Object.freeze(['Video', 'Commissioned', 'Graphic']);
  const layouts = Object.freeze({
    full: 1, 'half-half': 2, 'half-quarter-quarter': 3,
    'quarter-quarter-quarter-quarter': 4, 'third-third-third': 3,
    'two-thirds-one-third': 2
  });
  const heights = ['auto', 'small', 'medium', 'large', 'viewport'];
  const defaultCategoryNavigation = Object.freeze(categories.map(label => Object.freeze({
    id: label.toLowerCase(), category: label, label,
    destination: `work/${label.toLowerCase()}`, href: `#work/${label.toLowerCase()}`
  })));
  const imageFields = '{asset->{_id,url,metadata{dimensions{width,height}}},crop,hotspot,alt}';
  const published = '!(_id in path("drafts.**")) && !(_id in path("versions.**"))';
  // Fixed singleton IDs, explicit projections, no per-slot network calls.
  const query = `{
    "homePage": *[_type == "homePage" && _id == "homePage"][0]{_id,_type,backgroundVideoUrl,videoTitle,poster${imageFields}},
    "siteSettings": *[_type == "siteSettings" && _id == "siteSettings"][0]{_id,_type,brandName,email,instagram,phone,defaultPageTitle,defaultDescription,socialImage${imageFields},footerLinks[]{label,destination}},
    "navigation": *[_type == "navigation" && _id == "navigation"][0]{_id,_type,homeLabel,items[]{label,destination},categories[]{label,destination},mobileContact{label,destination}},
    "infoPage": *[_type == "infoPage" && _id == "infoPage"][0]{_id,_type,introduction,cv[]{period,text},work,skills,contactLinks[]{label,destination},selectedClients},
    "projects": *[_type == "project" && ${published}] | order(_id asc) {
      _id,_type,title,slug,category,year,additionalInfo,description,detailPageEnabled,
      modules[]{_type,type,height,order,slots[]{type,text,textSize,alt,vimeoUrl,image${imageFields},video{asset->{_id,url}},poster${imageFields}}}
    },
    "selectedWork": *[_type == "selectedWork" && _id == "selectedWork"][0]{_id,_type,video[]{_ref},commissioned[]{_ref},graphic[]{_ref}},
    "indexPage": *[_type == "indexPage" && _id == "indexPage"][0]{_id,_type,entries[]{_key,project{_ref},displayTitle,yearOverride,additionalInfo,initialLayout,previewImages[]${imageFields}}},
    "legalPages": *[_type == "legalPage" && _id in ["legal-imprint","legal-privacy-policy"]]{_id,_type,pageType,title,body}
  }`;

  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const string = value => typeof value === 'string' ? value : '';
  const text = value => string(value).trim();
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const year = value => Number.isInteger(value) ? String(value) : '';
  const publicId = value => typeof value === 'string' && !/^(drafts|versions)\./.test(value);
  function issue(issues, path, code, message) { issues.push({path, code, message}); }
  function array(value, issues, path) {
    if (value == null) return [];
    if (Array.isArray(value)) return value;
    issue(issues, path, 'invalid_array', 'Expected an ordered array.');
    return [];
  }
  function https(value) {
    try {
      const url = new URL(text(value));
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function asset(value, kind) {
    if (!record(value)) return null;
    const id = value._ref || value._id;
    const pattern = kind === 'images' ? /^image-([a-zA-Z0-9]+)-(\d+)x(\d+)-([a-zA-Z0-9]+)$/ : /^file-([a-zA-Z0-9]+)-([a-zA-Z0-9]+)$/;
    const match = typeof id === 'string' ? id.match(pattern) : null;
    // Native references are supported for local fixtures/exports as well as the
    // dereferenced asset objects returned by the public query.
    const filename = match && (kind === 'images' ? `${match[1]}-${match[2]}x${match[3]}.${match[4]}` : `${match[1]}.${match[2]}`);
    const derived = filename ? `https://cdn.sanity.io/${kind}/${config.projectId}/${config.dataset}/${filename}` : null;
    const src = https(value.url) || derived;
    if (!src) return null;
    const url = new URL(src);
    if (url.hostname !== 'cdn.sanity.io' || !url.pathname.startsWith(`/${kind}/${config.projectId}/${config.dataset}/`)) return null;
    const dimensions = value.metadata?.dimensions;
    const width = Number(dimensions?.width ?? (kind === 'images' && match ? match[2] : NaN));
    const height = Number(dimensions?.height ?? (kind === 'images' && match ? match[3] : NaN));
    return {src, width: width > 0 && Number.isFinite(width) ? width : null, height: height > 0 && Number.isFinite(height) ? height : null};
  }
  function image(value, issues, path) {
    if (!record(value)) return null;
    const resolved = asset(value.asset, 'images');
    if (!resolved) {
      issue(issues, path, 'missing_image', 'Image asset is missing or invalid.');
      return null;
    }
    let crop = null;
    let hotspot = null;
    const unit = number => typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1;
    if (value.crop != null) {
      if (record(value.crop) && ['left', 'right', 'top', 'bottom'].every(key => unit(value.crop[key])) &&
          value.crop.left + value.crop.right < 1 && value.crop.top + value.crop.bottom < 1) {
        crop = Object.fromEntries(['left', 'right', 'top', 'bottom'].map(key => [key, value.crop[key]]));
      } else issue(issues, `${path}.crop`, 'invalid_crop', 'Invalid crop ignored.');
    }
    if (value.hotspot != null) {
      if (record(value.hotspot) && ['x', 'y', 'width', 'height'].every(key => unit(value.hotspot[key])) && value.hotspot.width > 0 && value.hotspot.height > 0) {
        hotspot = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, value.hotspot[key]]));
      } else issue(issues, `${path}.hotspot`, 'invalid_hotspot', 'Invalid hotspot ignored.');
    }
    const url = new URL(resolved.src);
    let cropRect = null;
    if (crop && resolved.width && resolved.height) {
      const left = Math.min(resolved.width - 1, Math.round(crop.left * resolved.width));
      const top = Math.min(resolved.height - 1, Math.round(crop.top * resolved.height));
      const width = Math.max(1, Math.min(resolved.width - left, Math.round((1 - crop.left - crop.right) * resolved.width)));
      const height = Math.max(1, Math.min(resolved.height - top, Math.round((1 - crop.top - crop.bottom) * resolved.height)));
      cropRect = {left, top, width, height};
      url.searchParams.set('rect', `${left},${top},${width},${height}`);
    } else if (crop) issue(issues, path, 'missing_dimensions', 'Crop retained but cannot be applied without image dimensions.');
    return {
      src: url.href, assetUrl: resolved.src,
      alt: typeof value.alt === 'string' ? value.alt : undefined,
      width: resolved.width, height: resolved.height, crop, cropRect, hotspot
    };
  }

  function moduleValue(value, issues, path) {
    if (!record(value)) { issue(issues, path, 'invalid_module', 'Expected a module object.'); return null; }
    const type = value.type ?? value._type;
    const count = own(layouts, type) ? layouts[type] : 0;
    const height = value.height ?? 'auto';
    let order = value.order ?? 'default';
    if (!count || !heights.includes(height) || (value._type && value._type !== type)) {
      issue(issues, path, 'invalid_module', 'Unknown/mismatched layout or height.'); return null;
    }
    if (order === 'middle' && type === 'half-quarter-quarter') order = [1, 0, 2];
    if (order !== 'default' && order !== 'reverse' &&
        !(Array.isArray(order) && order.length === count && new Set(order).size === count && order.every(index => Number.isInteger(index) && index >= 0 && index < count))) {
      issue(issues, path, 'invalid_order', 'Invalid arrangement for this layout.'); return null;
    }
    if (!Array.isArray(value.slots) || value.slots.length > count) {
      issue(issues, path, 'invalid_slots', 'Invalid slot collection.'); return null;
    }
    let valid = true;
    const slots = Array.from({length: count}, (_, index) => {
      const slot = value.slots[index];
      const slotPath = `${path}.slots[${index}]`;
      if (slot == null || (record(slot) && slot.type === 'empty')) return null;
      if (record(slot) && slot.type === 'text' && text(slot.text) && ['s', 'm', 'l'].includes(slot.textSize ?? 's')) {
        return {type: 'text', text: slot.text, textSize: slot.textSize ?? 's'};
      }
      if (record(slot) && slot.type === 'image') {
        const media = image(slot.image, issues, slotPath);
        if (media) return {type: 'image', src: media.src, alt: typeof slot.alt === 'string' ? slot.alt : undefined, image: media};
      }
      if (record(slot) && slot.type === 'video') {
        const media = vimeo.parseVimeoUrl(slot.vimeoUrl);
        if (media) {
          const posterImage = slot.poster ? image(slot.poster, issues, `${slotPath}.poster`) : null;
          return {type: 'video', src: media.src, vimeo: media, alt: typeof slot.alt === 'string' ? slot.alt : undefined,
            ...(posterImage ? {poster: posterImage.src, posterImage} : {})};
        }
        issue(issues, slotPath, slot.video?.asset ? 'legacy_video_requires_migration' : 'invalid_vimeo',
          slot.video?.asset ? 'Uploaded video retained in Sanity; supply a Vimeo URL before connecting this project.' : 'Expected an HTTPS Vimeo video URL.');
      }
      valid = false;
      issue(issues, slotPath, 'invalid_slot', 'Non-empty slot has invalid or missing content.');
      return null;
    });
    return valid ? {type, height, order: Array.isArray(order) ? [...order] : order, slots} : null;
  }

  function normalizeModule(value) {
    const issues = [];
    return {module: moduleValue(value, issues, 'module'), issues};
  }
  function normalizeImage(value) {
    const issues = [];
    return {image: image(value, issues, 'image'), issues};
  }
  function singleton(raw, name, issues, availability) {
    const value = raw[name];
    if (value == null) { availability[name] = 'missing'; return null; }
    if (!record(value) || value._id !== name || value._type !== name) {
      availability[name] = 'invalid';
      issue(issues, name, 'invalid_document', 'Expected the fixed published singleton document.');
      return null;
    }
    availability[name] = 'present';
    return value;
  }
  function stringList(value, issues, path) {
    return array(value, issues, path).flatMap((item, index) => {
      if (text(item)) return [item];
      issue(issues, `${path}[${index}]`, 'invalid_text', 'Empty or non-text list item omitted.');
      return [];
    });
  }
  function sharedLink(value, settings, allowed, issues, path) {
    if (!record(value) || !allowed.includes(value.destination)) {
      issue(issues, path, 'invalid_destination', 'Unknown link destination.'); return null;
    }
    const destination = value.destination;
    const href = ['email', 'instagram', 'phone'].includes(destination)
      ? settings?.contacts[destination]?.href : `#${destination}`;
    if (!href) { issue(issues, path, 'missing_contact', 'Shared contact destination has no valid address.'); return null; }
    return {label: text(value.label) || destination, destination, href};
  }
  function linkList(value, settings, allowed, issues, path) {
    return array(value, issues, path).map((link, index) => sharedLink(link, settings, allowed, issues, `${path}[${index}]`)).filter(Boolean);
  }
  function legalBody(value, issues, path) {
    // Return a restricted Portable Text tree, never HTML. List grouping and DOM
    // creation belong to the later legal renderer.
    return array(value, issues, path).flatMap((block, index) => {
      if (!record(block) || block._type !== 'block' || !Array.isArray(block.children)) {
        issue(issues, `${path}[${index}]`, 'invalid_block', 'Unsupported legal block omitted.'); return [];
      }
      const markDefs = array(block.markDefs, issues, `${path}[${index}].markDefs`).flatMap(mark => {
        if (!record(mark) || mark._type !== 'link' || !text(mark._key)) return [];
        try {
          const url = new URL(mark.href);
          if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) || url.username || url.password || /[\r\n]/.test(mark.href)) throw new Error('Invalid link');
          return [{_type: 'link', _key: mark._key, href: url.href}];
        } catch { issue(issues, path, 'invalid_link', 'Unsafe legal link omitted.'); return []; }
      });
      const marks = new Set(['strong', 'em', ...markDefs.map(mark => mark._key)]);
      return [{_type: 'block', _key: string(block._key), style: block.style === 'h2' ? 'h2' : 'normal',
        ...(block.listItem === 'bullet' || block.listItem === 'number' ? {listItem: block.listItem, level: Number.isInteger(block.level) && block.level > 0 ? block.level : 1} : {}),
        markDefs, children: block.children.flatMap(span => record(span) && span._type === 'span' && typeof span.text === 'string'
          ? [{_type: 'span', _key: string(span._key), text: span.text, marks: (Array.isArray(span.marks) ? span.marks : []).filter(mark => marks.has(mark))}] : [])}];
    });
  }

  function normalize(input) {
    const issues = [];
    const availability = {};
    const raw = record(input) ? input : {};
    if (!record(input)) issue(issues, 'root', 'invalid_payload', 'Expected a projected Sanity content object.');
    const settingsDoc = singleton(raw, 'siteSettings', issues, availability);
    let siteSettings = null;
    if (settingsDoc) {
      const email = text(settingsDoc.email);
      const instagram = https(settingsDoc.instagram);
      const phone = text(settingsDoc.phone).replace(/[\s().-]/g, '');
      siteSettings = {brandName: string(settingsDoc.brandName),
        defaultPageTitle: text(settingsDoc.defaultPageTitle) || string(settingsDoc.brandName),
        defaultDescription: string(settingsDoc.defaultDescription),
        socialImage: settingsDoc.socialImage ? image(settingsDoc.socialImage, issues, 'siteSettings.socialImage') : null,
        contacts: {
          email: /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email) ? {value: email, href: `mailto:${email}`} : null,
          instagram: instagram ? {value: instagram, href: instagram} : null,
          phone: /^\+?\d{5,15}$/.test(phone) ? {value: phone, href: `tel:${phone}`} : null
        }, footerLinks: []};
      for (const key of ['email', 'instagram', 'phone']) {
        if (settingsDoc[key] && !siteSettings.contacts[key]) issue(issues, `siteSettings.${key}`, 'invalid_contact', 'Invalid contact address omitted.');
      }
      siteSettings.footerLinks = linkList(settingsDoc.footerLinks, siteSettings, ['email', 'instagram', 'phone', 'imprint', 'privacy-policy'], issues, 'siteSettings.footerLinks');
    }

    const homeDoc = singleton(raw, 'homePage', issues, availability);
    let homePage = null;
    if (homeDoc) {
      const src = https(homeDoc.backgroundVideoUrl);
      let video = null;
      if (src) {
        const url = new URL(src);
        const match = /^(?:www\.)?vimeo\.com$/.test(url.hostname) ? url.pathname.match(/^\/(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/)
          : url.hostname === 'player.vimeo.com' ? url.pathname.match(/^\/video\/(\d+)\/?$/) : null;
        if (match) {
          const embed = new URL(`https://player.vimeo.com/video/${match[1]}`);
          const privacyHash = url.searchParams.get('h') || match[2];
          if (privacyHash) embed.searchParams.set('h', privacyHash);
          video = {type: 'vimeo', src, id: match[1], embedUrl: embed.href};
        } else if (/\.(mp4|webm)$/i.test(url.pathname)) video = {type: 'file', src};
      }
      if (!video) issue(issues, 'homePage.backgroundVideoUrl', 'invalid_video', 'Expected a Vimeo video or direct HTTPS MP4/WebM URL.');
      homePage = {video, videoTitle: string(homeDoc.videoTitle), poster: homeDoc.poster ? image(homeDoc.poster, issues, 'homePage.poster') : null};
    }

    const navigationDoc = singleton(raw, 'navigation', issues, availability);
    const navigation = {
      home: {label: text(navigationDoc?.homeLabel) || siteSettings?.brandName || '', destination: 'home', href: '#home'},
      items: navigationDoc ? linkList(navigationDoc.items, siteSettings, ['home', 'work', 'archive', 'info'], issues, 'navigation.items') : [],
      categories: [], mobileContact: navigationDoc?.mobileContact ? sharedLink(navigationDoc.mobileContact, siteSettings, ['email', 'instagram', 'phone'], issues, 'navigation.mobileContact') : null
    };
    const seenCategories = new Set();
    for (const [index, item] of array(navigationDoc?.categories, issues, 'navigation.categories').entries()) {
      const base = defaultCategoryNavigation.find(category => category.destination === item?.destination);
      if (!base || seenCategories.has(base.id)) {
        issue(issues, `navigation.categories[${index}]`, 'invalid_category_link', 'Unknown or duplicate category destination omitted.'); continue;
      }
      seenCategories.add(base.id);
      navigation.categories.push({...base, label: text(item.label) || base.label});
    }
    // CMS order wins when provided. Missing categories are appended in the one
    // shared default order; no separate desktop/mobile arrays exist.
    for (const category of defaultCategoryNavigation) {
      if (!seenCategories.has(category.id)) navigation.categories.push({...category});
    }

    const infoDoc = singleton(raw, 'infoPage', issues, availability);
    const infoPage = infoDoc ? {
      introduction: string(infoDoc.introduction),
      cv: array(infoDoc.cv, issues, 'infoPage.cv').flatMap((entry, index) => {
        if (record(entry) && text(entry.text)) return [{period: string(entry.period), text: entry.text}];
        issue(issues, `infoPage.cv[${index}]`, 'invalid_cv', 'CV entry without text omitted.'); return [];
      }),
      work: stringList(infoDoc.work, issues, 'infoPage.work'), skills: stringList(infoDoc.skills, issues, 'infoPage.skills'),
      selectedClients: stringList(infoDoc.selectedClients, issues, 'infoPage.selectedClients'),
      contactLinks: linkList(infoDoc.contactLinks, siteSettings, ['email', 'instagram', 'phone'], issues, 'infoPage.contactLinks')
    } : null;

    const projects = [];
    const projectsById = Object.create(null);
    const byDocumentId = new Map();
    availability.projects = Array.isArray(raw.projects) ? 'present' : raw.projects == null ? 'missing' : 'invalid';
    for (const [index, value] of array(raw.projects, issues, 'projects').entries()) {
      const path = `projects[${index}]`;
      const id = value?.slug?.current;
      if (!record(value) || !publicId(value._id) || !value._id || value._type !== 'project' || typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !text(value.title) || !categories.includes(value.category)) {
        issue(issues, path, 'invalid_project', 'Project requires a published ID, route-safe slug, title, and supported category.'); continue;
      }
      if (own(projectsById, id) || byDocumentId.has(value._id)) {
        issue(issues, path, 'duplicate_project', 'Duplicate slug or document ID omitted.'); continue;
      }
      const rows = array(value.modules, issues, `${path}.modules`);
      const modules = rows.map((row, rowIndex) => moduleValue(row, issues, `${path}.modules[${rowIndex}]`));
      const modulesValid = (value.modules == null || Array.isArray(value.modules)) && modules.every(Boolean);
      const project = {id, documentId: value._id, title: value.title, category: value.category,
        year: year(value.year), additionalInfo: string(value.additionalInfo), description: string(value.description),
        detailPageEnabled: value.detailPageEnabled !== false, modulesValid, modules: modulesValid ? modules : [],
        // Details can keep healthy rows without rebalancing malformed compositions.
        // A valid layout/height/order gets its original empty frame; unknown layouts
        // stay null. Keep the strict modules contract for future overview consumers.
        detailModules: modules.map((module, rowIndex) => module ||
          (record(rows[rowIndex]) ? moduleValue({...rows[rowIndex], slots: []}, [], `${path}.modules[${rowIndex}]`) : null))};
      projects.push(project); projectsById[id] = project; byDocumentId.set(value._id, project);
    }
    const workDoc = singleton(raw, 'selectedWork', issues, availability);
    const selectedWork = workDoc ? Object.fromEntries(categories.map(category => {
      const key = category.toLowerCase();
      const seen = new Set();
      const ids = [];
      for (const [index, ref] of array(workDoc[key], issues, `selectedWork.${key}`).entries()) {
        const project = byDocumentId.get(ref?._ref);
        if (!project || project.category !== category || seen.has(project.id)) {
          issue(issues, `selectedWork.${key}[${index}]`, 'invalid_reference', 'Missing, duplicate, or wrong-category project reference omitted.'); continue;
        }
        seen.add(project.id); ids.push(project.id);
      }
      return [key, ids];
    })) : null;

    const indexDoc = singleton(raw, 'indexPage', issues, availability);
    const indexPage = indexDoc ? {entries: array(indexDoc.entries, issues, 'indexPage.entries').flatMap((entry, index) => {
      const path = `indexPage.entries[${index}]`;
      if (!record(entry)) { issue(issues, path, 'invalid_entry', 'Invalid Index entry omitted.'); return []; }
      const project = byDocumentId.get(entry.project?._ref);
      if (entry.project && !project) issue(issues, `${path}.project`, 'missing_reference', 'Related project unavailable; entry overrides remain usable.');
      const title = text(entry.displayTitle) || project?.title || '';
      const previews = array(entry.previewImages, issues, `${path}.previewImages`).map((item, i) => image(item, issues, `${path}.previewImages[${i}]`)).filter(Boolean);
      if (!title || !previews.length) { issue(issues, path, 'invalid_entry', 'Index entry without a title or usable preview images omitted.'); return []; }
      const layout = ['full', 'half'].includes(entry.initialLayout) ? entry.initialLayout : 'full';
      if (entry.initialLayout != null && entry.initialLayout !== layout) issue(issues, `${path}.initialLayout`, 'invalid_layout', 'Invalid initial layout replaced with full.');
      return [{key: text(entry._key) || `entry-${index}`, projectId: project?.id ?? null, title,
        year: year(entry.yearOverride) || project?.year || '',
        additionalInfo: typeof entry.additionalInfo === 'string' ? entry.additionalInfo : project?.additionalInfo || '',
        layout, images: previews.map(preview => preview.src), previewImages: previews}];
    })} : null;

    const legalPages = {imprint: null, 'privacy-policy': null};
    availability.legalPages = Array.isArray(raw.legalPages) ? 'present' : raw.legalPages == null ? 'missing' : 'invalid';
    for (const page of array(raw.legalPages, issues, 'legalPages')) {
      if (!record(page) || !own(legalPages, page.pageType) || page._id !== `legal-${page.pageType}` || page._type !== 'legalPage') {
        issue(issues, 'legalPages', 'invalid_legal_page', 'Unknown or mismatched legal page omitted.'); continue;
      }
      legalPages[page.pageType] = {id: page.pageType, title: text(page.title) || (page.pageType === 'imprint' ? 'Imprint' : 'Privacy Policy'), body: legalBody(page.body, issues, `legalPages.${page.pageType}.body`)};
    }
    return {homePage, siteSettings, navigation, infoPage, projects, projectsById, selectedWork, indexPage, legalPages, availability, issues};
  }

  async function load(options = {}) {
    const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? Math.min(options.timeoutMs, 60000) : config.timeoutMs;
    const controller = new AbortController();
    let timer;
    let cancel;
    const failure = (code, message) => Object.assign(new Error(message), {code});
    try {
      const interrupted = new Promise((_, reject) => {
        cancel = () => { controller.abort(); reject(failure('aborted', 'Content request cancelled.')); };
        if (options.signal?.aborted) { cancel(); return; }
        options.signal?.addEventListener('abort', cancel, {once: true});
        timer = setTimeout(() => { controller.abort(); reject(failure('timeout', 'Content request timed out.')); }, timeoutMs);
      });
      const request = async () => {
        if (controller.signal.aborted) throw failure('aborted', 'Content request cancelled.');
        const url = new URL(`https://${config.projectId}.apicdn.sanity.io/v${config.apiVersion}/data/query/${config.dataset}`);
        url.searchParams.set('perspective', config.perspective);
        url.searchParams.set('query', query);
        const response = await root.fetch(url.href, {method: 'GET', credentials: 'omit', signal: controller.signal, headers: {Accept: 'application/json'}});
        if (!response.ok) throw failure('http', `Content request failed (HTTP ${response.status}).`);
        const payload = await response.json();
        if (!record(payload) || payload.error || !record(payload.result) || !Array.isArray(payload.result.projects)) throw failure('invalid_response', 'Unexpected Sanity query response.');
        return normalize(payload.result);
      };
      return {ok: true, data: await Promise.race([interrupted, request()]), error: null};
    } catch (error) {
      const code = ['aborted', 'timeout', 'http', 'invalid_response'].includes(error?.code) ? error.code : 'request_failed';
      return {ok: false, data: null, error: {code, message: code === 'request_failed' ? 'Could not load public Sanity content.' : error.message}};
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
    }
  }

  const api = Object.freeze({config, query, defaultCategoryNavigation, load, normalize, normalizeModule, normalizeImage});
  root.SanityData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
