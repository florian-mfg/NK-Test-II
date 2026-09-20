'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const adapterPath = path.join(__dirname, '../sanity-data.js');
const adapterSource = fs.readFileSync(adapterPath, 'utf8');
const data = require(adapterPath);
const imageRef = 'image-abc123-1200x800-jpg';
const img = (alt) => ({asset: {_ref: imageRef}, ...(alt === undefined ? {} : {alt})});
const slot = (alt) => ({type: 'image', image: img(), ...(alt === undefined ? {} : {alt})});
const row = (type = 'full', slots = [slot()], extra = {}) => ({_type: type, type, height: 'auto', slots, ...extra});
const project = (id, category = 'Video', extra = {}) => ({_id: id, _type: 'project', slug: {current: id}, title: id, category, year: 2026, modules: [row()], ...extra});
const doc = (type, fields = {}) => ({_id: type, _type: type, ...fields});
const fixture = (extra = {}) => ({projects: [], ...extra});
const plain = value => JSON.parse(JSON.stringify(value));

function isolated(fetch) {
  const sandbox = {URL, AbortController, setTimeout, clearTimeout, fetch, VimeoMedia: require('../vimeo-media.js')};
  vm.runInNewContext(adapterSource, sandbox);
  return sandbox.SanityData;
}

test('loading the adapter has no DOM, network, or application side effects', () => {
  let requests = 0;
  const adapter = isolated(() => { requests++; throw new Error('Unexpected request'); });
  assert.equal(requests, 0);
  assert.equal(typeof adapter.normalize, 'function');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(html.includes('src="sanity-data.js" defer'));
  assert.ok(html.indexOf('src="sanity-data.js" defer') < html.indexOf('src="app.js" defer'));
});

test('missing documents differ from published empty documents', () => {
  const missing = data.normalize(fixture());
  assert.equal(missing.infoPage, null);
  assert.equal(missing.selectedWork, null);
  assert.equal(missing.indexPage, null);
  assert.equal(missing.availability.infoPage, 'missing');
  const empty = data.normalize(fixture({infoPage: doc('infoPage'), selectedWork: doc('selectedWork'), indexPage: doc('indexPage', {entries: []})}));
  assert.equal(empty.availability.infoPage, 'present');
  assert.deepEqual(empty.infoPage.skills, []);
  assert.deepEqual(empty.selectedWork, {video: [], commissioned: [], graphic: []});
  assert.deepEqual(empty.indexPage.entries, []);
});

test('normalization tolerates malformed arrays and documents', () => {
  for (const value of [null, 0, '', [], {}, {projects: 'bad'}, {projects: [null, 42, 'bad']}, {navigation: doc('navigation', {categories: [null, 1]})}]) {
    assert.doesNotThrow(() => data.normalize(value));
  }
  assert.equal(data.normalize({infoPage: {_id: 'drafts.infoPage', _type: 'infoPage'}}).availability.infoPage, 'invalid');
});

test('all layout/height combinations preserve slot widths and renderer HTML', () => {
  const renderer = vm.createContext({URL, document: {baseURI: 'https://example.com/portfolio/'}});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../project-modules.js'), 'utf8'), renderer);
  const types = {'full': 1, 'half-half': 2, 'half-quarter-quarter': 3, 'quarter-quarter-quarter-quarter': 4, 'third-third-third': 3, 'two-thirds-one-third': 2};
  for (const [type, count] of Object.entries(types)) {
    for (const height of ['auto', 'small', 'medium', 'large', 'viewport']) {
      for (const order of ['default', 'reverse', ...(type === 'half-quarter-quarter' ? ['middle'] : [])]) {
        const slots = Array.from({length: count}, (_, i) => i % 2 ? {type: 'empty', image: img()} : slot(`Image ${i}`));
        const result = data.normalizeModule(row(type, slots, {height, order}));
        assert.deepEqual(result.issues, []);
        assert.equal(result.module.slots.length, count);
        const expected = {type, height, order: order === 'middle' ? [1, 0, 2] : order, slots: slots.map(s => s.type === 'empty' ? null : {type: 'image', src: 'https://cdn.sanity.io/images/ck6xe2er/production/abc123-1200x800.jpg', alt: s.alt})};
        renderer.actual = result.module;
        renderer.expected = expected;
        assert.equal(vm.runInContext('renderProjectModule(actual, "Example")', renderer), vm.runInContext('renderProjectModule(expected, "Example")', renderer), `${type}/${height}/${order}`);
      }
    }
  }
});

test('empty and omitted trailing slots retain position and discard stale media', () => {
  const result = data.normalizeModule(row('half-quarter-quarter', [{type: 'empty', image: img(), text: 'Old text'}, slot('')], {order: 'middle'}));
  assert.deepEqual(result.module.order, [1, 0, 2]);
  assert.equal(result.module.slots[0], null);
  assert.equal(result.module.slots[1].alt, '');
  assert.equal(result.module.slots[2], null);
  assert.equal(data.normalizeModule(row()).module.slots[0].alt, undefined);
  assert.equal(data.normalizeModule(row('half-half', [null, null])).module.slots.every(s => s === null), true);
});

test('text sizes and paragraph whitespace survive, including overview text', () => {
  for (const textSize of [undefined, 's', 'm', 'l']) {
    const text = 'First line\nSecond line\n\nSecond paragraph';
    const {module, issues} = data.normalizeModule(row('full', [{type: 'text', text, textSize}]));
    assert.deepEqual(issues, []);
    assert.deepEqual(module.slots[0], {type: 'text', text, textSize: textSize ?? 's'});
  }
});

test('invalid modules are isolated without silently compacting project compositions', () => {
  for (const malformed of [null, row('unknown'), row('full', [], {height: 'giant'}), row('half-half', [slot()], {order: 'middle'}), row('full', [slot(), slot()]), row('full', [{type: 'text', text: ' '}]), row('full', [{type: 'video', video: {asset: {_ref: 'file-hash-mov'}}}]), row('full', [{type: 'image'}])]) {
    assert.equal(data.normalizeModule(malformed).module, null);
    const result = data.normalize(fixture({projects: [project('broken', 'Video', {modules: [row(), malformed, row()]}), project('good')]}));
    assert.equal(result.projectsById.broken.modulesValid, false);
    assert.deepEqual(result.projectsById.broken.modules, []);
    assert.equal(result.projectsById.good.modulesValid, true);
    assert.ok(result.issues.length);
  }
});

test('native image references and resolved assets map equally; crop/hotspot survive', () => {
  const native = img('Description');
  native.crop = {left: .1, right: .2, top: .25, bottom: 0};
  native.hotspot = {x: .4, y: .5, width: .2, height: .3};
  const expanded = {...native, asset: {_id: imageRef, url: 'https://cdn.sanity.io/images/ck6xe2er/production/abc123-1200x800.jpg', metadata: {dimensions: {width: 1200, height: 800}}}};
  const result = data.normalizeImage(native);
  assert.deepEqual(result, data.normalizeImage(expanded));
  assert.equal(new URL(result.image.src).searchParams.get('rect'), '120,200,840,600');
  assert.deepEqual(result.image.hotspot, native.hotspot);
  assert.equal(result.image.alt, 'Description');
  assert.equal(data.normalizeImage({asset: {url: 'javascript:alert(1)'}}).image, null);
  assert.equal(data.normalizeImage({asset: {url: 'https://cdn.sanity.io/images/other/private/a.jpg'}}).image, null);
});

test('Vimeo slots and posters normalize without introducing playback policy', () => {
  const result = data.normalizeModule(row('full', [{type: 'video', vimeoUrl: 'https://vimeo.com/12345/private', poster: img('Poster'), alt: 'Video'}]));
  assert.equal(result.module.slots[0].src, 'https://vimeo.com/12345/private');
  assert.equal(result.module.slots[0].vimeo.embedUrl, 'https://player.vimeo.com/video/12345?h=private');
  assert.equal(result.module.slots[0].poster, 'https://cdn.sanity.io/images/ck6xe2er/production/abc123-1200x800.jpg');
  assert.equal(result.module.slots[0].alt, 'Video');
  assert.equal('autoplay' in result.module.slots[0], false);
});

test('project lookup is independent from Selected Work order and detail availability', () => {
  const result = data.normalize(fixture({projects: [project('one'), project('two'), project('unlisted'), project('graphic', 'Graphic'), project('disabled', 'Video', {detailPageEnabled: false})],
    selectedWork: doc('selectedWork', {video: [{_ref: 'two'}, {_ref: 'missing'}, {_ref: 'one'}, {_ref: 'graphic'}, {_ref: 'two'}, {_ref: 'disabled'}]})}));
  assert.deepEqual(result.selectedWork.video, ['two', 'one', 'disabled']);
  assert.ok(result.projectsById.unlisted);
  assert.equal(result.projectsById.disabled.detailPageEnabled, false);
  for (const value of [undefined, null, 0, '', 'false', true]) {
    assert.equal(data.normalize(fixture({projects: [project('one', 'Video', {detailPageEnabled: value})]})).projectsById.one.detailPageEnabled, true);
  }
});

test('duplicate slugs, drafts, versions, and invalid project identities are rejected', () => {
  const result = data.normalize(fixture({projects: [project('one'), {...project('duplicate'), slug: {current: 'one'}}, {...project('drafts.one'), slug: {current: 'draft-one'}}, {...project('versions.release.one'), slug: {current: 'version-one'}}, project('bad/slug'), project('bad-category', 'Other')]}));
  assert.deepEqual(result.projects.map(p => p.id), ['one']);
  assert.equal(result.issues.length, 5);
});

test('shared category defaults have the approved order and stable destinations', () => {
  const result = data.normalize(fixture());
  assert.deepEqual(result.navigation.categories.map(c => c.category), ['Video', 'Commissioned', 'Graphic']);
  assert.deepEqual(result.navigation.categories.map(c => c.href), ['#work/video', '#work/commissioned', '#work/graphic']);
  const cms = data.normalize(fixture({navigation: doc('navigation', {categories: [{label: 'New label', destination: 'work/graphic'}, {label: 'Films', destination: 'work/video'}, {label: 'Clients', destination: 'work/commissioned'}]})}));
  assert.deepEqual(cms.navigation.categories.map(c => c.category), ['Graphic', 'Video', 'Commissioned']);
  assert.equal(cms.navigation.categories[0].label, 'New label');
  assert.equal(cms.navigation.categories[0].href, '#work/graphic');
});

test('Index-only entries, overrides and images remain independent of projects', () => {
  const preview = {asset: {_ref: 'image-index123-400x600-png'}};
  const result = data.normalize(fixture({projects: [project('one', 'Video', {additionalInfo: 'Client'})], indexPage: doc('indexPage', {entries: [
    {_key: 'independent', displayTitle: 'Independent', yearOverride: 2020, previewImages: [preview], initialLayout: 'half'},
    {_key: 'linked', project: {_ref: 'one'}, previewImages: [preview]},
    {_key: 'override', project: {_ref: 'one'}, displayTitle: 'Custom', yearOverride: 2022, additionalInfo: '', previewImages: [preview, img()]},
    {project: {_ref: 'missing'}, displayTitle: 'Still usable', previewImages: [preview]},
    {displayTitle: 'No images', previewImages: []}
  ]})}));
  const entries = result.indexPage.entries;
  assert.equal(entries.length, 4);
  assert.deepEqual(entries.map(e => e.title), ['Independent', 'one', 'Custom', 'Still usable']);
  assert.equal(entries[0].projectId, null);
  assert.equal(entries[0].layout, 'half');
  assert.equal(entries[1].additionalInfo, 'Client');
  assert.equal(entries[1].year, '2026');
  assert.equal(entries[2].additionalInfo, '');
  assert.equal(entries[2].year, '2022');
  assert.equal(entries[2].images.length, 2);
  assert.notEqual(entries[1].images[0], result.projects[0].modules[0].slots[0].src);
});

test('settings, Info and navigation resolve shared contacts without HTML injection', () => {
  const result = data.normalize(fixture({siteSettings: doc('siteSettings', {brandName: 'Name', email: 'mail@example.com', instagram: 'https://www.instagram.com/example/', phone: '+49 (123) 456789', footerLinks: [{label: 'Mail', destination: 'email'}, {label: 'Legal', destination: 'imprint'}]}),
    infoPage: doc('infoPage', {introduction: '<b>Plain text</b>', cv: [{period: '2020–2025', text: 'Work'}], work: ['One', 'Two'], skills: [], selectedClients: ['A'], contactLinks: [{label: 'Write', destination: 'email'}]}),
    navigation: doc('navigation', {items: [{label: 'Projects', destination: 'work'}, {label: 'Bad', destination: 'javascript:alert(1)'}], mobileContact: {label: 'Call', destination: 'phone'}})}));
  assert.equal(result.siteSettings.defaultPageTitle, 'Name');
  assert.equal(result.infoPage.introduction, '<b>Plain text</b>');
  assert.equal(result.infoPage.contactLinks[0].href, 'mailto:mail@example.com');
  assert.equal(result.navigation.mobileContact.href, 'tel:+49123456789');
  assert.deepEqual(result.navigation.items.map(i => i.href), ['#work']);
});

test('homepage supports Vimeo privacy hashes and direct video', () => {
  for (const url of ['https://vimeo.com/12345/secret', 'https://player.vimeo.com/video/12345?h=secret']) {
    const home = data.normalize(fixture({homePage: doc('homePage', {backgroundVideoUrl: url, videoTitle: 'Film', poster: img()})})).homePage;
    assert.equal(home.video.type, 'vimeo');
    assert.equal(home.video.embedUrl, 'https://player.vimeo.com/video/12345?h=secret');
    assert.ok(home.poster.src);
  }
  assert.equal(data.normalize(fixture({homePage: doc('homePage', {backgroundVideoUrl: 'https://example.com/film.mp4'})})).homePage.video.type, 'file');
  assert.equal(data.normalize(fixture({homePage: doc('homePage', {backgroundVideoUrl: 'javascript:alert(1)'})})).homePage.video, null);
});

test('legal text stays structured; unsafe links and unknown content are removed', () => {
  const result = data.normalize(fixture({legalPages: [{_id: 'legal-imprint', _type: 'legalPage', pageType: 'imprint', body: [{_type: 'block', style: 'normal', markDefs: [{_type: 'link', _key: 'bad', href: 'javascript:alert(1)'}, {_type: 'link', _key: 'good', href: 'https://example.com'}], children: [{_type: 'span', text: '<script>text</script>', marks: ['bad', 'good', 'strong']}]}]}]}));
  const block = result.legalPages.imprint.body[0];
  assert.deepEqual(block.children[0].marks, ['good', 'strong']);
  assert.equal(block.children[0].text, '<script>text</script>');
  assert.equal(block.markDefs.length, 1);
  assert.equal(result.legalPages['privacy-policy'], null);
});

test('fetch is public, published-only, fixed-version, and tokenless', async () => {
  let request;
  const api = isolated(async (url, options) => {request = {url, options}; return {ok: true, json: async () => ({result: fixture()})};});
  const result = await api.load();
  assert.equal(result.ok, true);
  const url = new URL(request.url);
  assert.equal(url.host, 'ck6xe2er.apicdn.sanity.io');
  assert.equal(url.pathname, '/v2025-02-19/data/query/production');
  assert.equal(url.searchParams.get('perspective'), 'published');
  assert.equal(request.options.credentials, 'omit');
  assert.deepEqual(plain(request.options.headers), {Accept: 'application/json'});
  assert.ok(url.searchParams.get('query').includes('versions.**'));
});

test('HTTP, network and invalid responses produce controlled failures', async () => {
  for (const [fetch, code] of [
    [async () => ({ok: false, status: 503}), 'http'],
    [async () => {throw new Error('network');}, 'request_failed'],
    [async () => ({ok: true, json: async () => ({error: {description: 'bad query'}})}), 'invalid_response'],
    [async () => ({ok: true, json: async () => ({result: []})}), 'invalid_response'],
    [async () => ({ok: true, json: async () => ({result: {}})}), 'invalid_response']
  ]) {
    const result = await isolated(fetch).load();
    assert.equal(result.ok, false);
    assert.equal(result.data, null);
    assert.equal(result.error.code, code);
  }
});

test('timeout covers fetch and body parsing, including an uncooperative fetch', async () => {
  for (const fetch of [() => new Promise(() => {}), async () => ({ok: true, json: () => new Promise(() => {})})]) {
    const result = await isolated(fetch).load({timeoutMs: 10});
    assert.equal(result.error.code, 'timeout');
  }
});

test('caller cancellation is handled before and during a request', async () => {
  const pre = new AbortController(); pre.abort();
  let requested = false;
  assert.equal((await isolated(() => {requested = true;}).load({signal: pre.signal})).error.code, 'aborted');
  assert.equal(requested, false);
  const controller = new AbortController();
  const pending = isolated(() => new Promise(() => {})).load({signal: controller.signal});
  controller.abort();
  assert.equal((await pending).error.code, 'aborted');
});

test('independent Selected Work image and Vimeo previews normalize without changing detail modules', () => {
  const original = project('one');
  const baseline = data.normalize(fixture({projects: [original]})).projects[0];
  const previewImage = {...img(), crop: {left: .1, right: .2, top: .25, bottom: 0}, hotspot: {x: .4, y: .5, width: .2, height: .3}};
  for (const selectedWorkPreview of [
    {type: 'image', image: previewImage, alt: 'Preview alt'},
    {type: 'video', vimeoUrl: 'https://player.vimeo.com/video/98765?h=private&autoplay=0', poster: previewImage, alt: 'Preview film'}
  ]) {
    const normalized = data.normalize(fixture({projects: [{...original, selectedWorkPreview}]}));
    const result = normalized.projects[0];
    assert.deepEqual(normalized.issues, []);
    assert.deepEqual(result.modules, baseline.modules);
    assert.deepEqual(result.detailModules, baseline.detailModules);
    assert.equal(result.selectedWorkPreview.alt, selectedWorkPreview.alt);
    const image = result.selectedWorkPreview.image || result.selectedWorkPreview.posterImage;
    assert.deepEqual(image.hotspot, previewImage.hotspot);
    assert.equal(new URL(image.src).searchParams.get('rect'), '120,200,840,600');
    if (selectedWorkPreview.type === 'video') assert.equal(result.selectedWorkPreview.vimeo.embedUrl, 'https://player.vimeo.com/video/98765?h=private');
  }
  assert.equal(baseline.selectedWorkPreview, null);
  for (const selectedWorkPreview of [{type: 'text', text: 'Forbidden'}, {type: 'empty'}, {type: 'image'}, {type: 'video', vimeoUrl: 'https://example.com/file.mp4'}]) {
    const result = data.normalize(fixture({projects: [{...original, selectedWorkPreview}]}));
    assert.equal(result.projects[0].selectedWorkPreview, null);
    assert.ok(result.issues.some(issue => issue.path.includes('selectedWorkPreview')));
    assert.deepEqual(result.projects[0].modules, baseline.modules);
    assert.equal(result.projects[0].modulesValid, true);
  }
  assert.ok(data.query.includes('selectedWorkPreview{type,alt,vimeoUrl,image'));
});
