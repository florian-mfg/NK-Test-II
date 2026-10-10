'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const adapter = require('../sanity-data.js');
const {parse, evaluate} = require('node:module').createRequire(require('node:path').resolve(__dirname, '../studio/package.json'))('groq-js');
const image = position => ({_type: 'indexMedia', mediaType: 'image', image: {
  asset: {_ref: 'image-demo-800x1200-jpg'}, portraitPosition: position,
  crop: {top: 0, bottom: 0, left: .1, right: .1}, hotspot: {x: .4, y: .5, width: .2, height: .2},
}});
const mp4 = {_type: 'indexMedia', mediaType: 'mp4', video: {asset: {_ref: 'file-demo-mp4'}}};
const project = (id, material = {media: [image('left'), mp4, image('right')]}, extra = {}) => ({
  _id: id, _type: 'project', slug: {current: id}, title: `Project ${id}`, category: 'Graphic',
  year: 2026, additionalInfo: 'Existing client', textColor: 'black', modules: [], indexmaterial: material, ...extra,
});
const legacy = (title, ref) => ({_type: 'indexEntry', displayTitle: title, previewImages: [image('center')], ...(ref ? {project: {_ref: ref}} : {})});
const ref = id => ({_type: 'indexProjectReference', project: {_ref: id}});
const normalize = (projects, entries = []) => adapter.normalize({projects, indexPage: {_id: 'indexPage', _type: 'indexPage', entries}});
const titles = result => result.indexPage.entries.map(entry => entry.title);

test('Indexmaterial reuses metadata, crop/hotspot and ordered native media with independent text color', () => {
  for (const color of [undefined, 'auto', 'black', 'white']) {
    const input = project('one', {media: [image('left'), mp4, image('right')], textColor: color});
    const before = structuredClone(input), result = normalize([input]);
    assert.deepEqual(input, before);
    const entry = result.indexPage.entries[0];
    assert.equal(entry.title, input.title); assert.equal(entry.year, '2026');
    assert.equal(entry.additionalInfo, input.additionalInfo);
    assert.equal(entry.textColor, color || 'auto');
    assert.equal(result.projects[0].textColor, 'black');
    assert.equal(entry.projectDocumentId, 'one');
    assert.deepEqual(entry.media.map(item => item.type), ['image', 'mp4', 'image']);
    assert.deepEqual(entry.media.filter(item => item.type === 'image').map(item => item.portraitPosition), ['left', 'right']);
    assert.deepEqual(entry.media[0].hotspot, input.indexmaterial.media[0].image.hotspot);
    assert.match(entry.media[0].src, /rect=/);
    assert.equal(entry.media[1].src, 'https://cdn.sanity.io/files/ck6xe2er/production/demo.mp4');
    assert.equal(result.projects[0].selectedWorkPreview, null);
    assert.deepEqual(result.projects[0].categories, ['Graphic']);
    assert.equal(result.selectedWork, null);
  }
});

test('optional and unusable Indexmaterial creates no placeholder, while healthy siblings survive', () => {
  for (const material of [undefined, {}, {media: []}, {media: [{mediaType: 'image'}]}, {media: [{mediaType: 'vimeo'}]}, {media: [image(), image(), image(), image()]}]) {
    const result = normalize([project('one', material, {indexmaterial: material})]);
    assert.deepEqual(result.indexPage.entries, []);
    if (!material || !material.media?.length) assert.equal(result.issues.some(issue => issue.path.includes('indexmaterial')), false);
  }
  assert.deepEqual(normalize([project('one', {media: [{mediaType: 'mp4', video: {asset: {url: 'https://evil.test/x.mp4'}}}, image('right')]})]).indexPage.entries[0].media.map(item => item.type), ['image']);
  assert.equal(normalize([project('one', {media: [mp4]}, {detailPageEnabled: false})]).indexPage.entries.length, 1);
});

test('manual mixed ordering wins and unlisted Projects follow in stable document-ID order', () => {
  const entries = [ref('b'), legacy('Legacy Z'), ref('a'), legacy('Legacy A')];
  const expected = ['Project b', 'Legacy Z', 'Project a', 'Legacy A', 'Project c', 'Project d'];
  const projects = ['d', 'c', 'b', 'a'].map(id => project(id));
  const before = structuredClone(entries);
  assert.deepEqual(titles(normalize(projects, entries)), expected);
  assert.deepEqual(titles(normalize([...projects].reverse(), entries)), expected);
  assert.deepEqual(entries, before);
});

test('deduplication uses explicit IDs, prefers a reference position and never guesses titles', () => {
  const p = project('one');
  const entries = [legacy('Old title', 'one'), legacy('Middle'), ref('one'), legacy('Another linked copy', 'one'), ref('one'), legacy(p.title)];
  assert.deepEqual(titles(normalize([p], entries)), ['Middle', p.title, p.title]);
  const noRef = [legacy('First'), legacy('Old title', 'one'), legacy('Middle'), legacy('Duplicate', 'one')];
  assert.deepEqual(titles(normalize([p], noRef)), ['First', p.title, 'Middle']);
  assert.deepEqual(titles(normalize([project('one', {media: []})], entries)), ['Old title', 'Middle', 'Another linked copy', p.title]);
});

test('missing, draft, version and ineligible Project references are safely omitted', () => {
  const result = normalize([project('one'), project('empty', {media: []}), project('drafts.two'), project('versions.release.three')], [ref('missing'), ref('empty'), ref('drafts.one'), ref('versions.release.one'), ref('one')]);
  assert.deepEqual(titles(result), ['Project one']);
  assert.equal(result.issues.filter(issue => issue.code === 'ineligible_index_project').length, 4);
});

test('eligible Projects render without an Index singleton; old missing-data semantics remain', () => {
  assert.deepEqual(titles(adapter.normalize({projects: [project('one')]})), ['Project one']);
  assert.equal(adapter.normalize({projects: [project('one', {})]}).indexPage, null);
});

test('published GROQ projects Indexmaterial assets and stable reference identities without copying media', async () => {
  const dataset = [project('one'), project('drafts.two'), project('versions.release.three'),
    {_id: 'indexPage', _type: 'indexPage', entries: [legacy('Old', 'one'), ref('one')]},
    {_id: 'image-demo-800x1200-jpg', _type: 'sanity.imageAsset', url: 'https://cdn.sanity.io/images/ck6xe2er/production/demo-800x1200.jpg', metadata: {dimensions: {width: 800, height: 1200}}},
    {_id: 'file-demo-mp4', _type: 'sanity.fileAsset', url: 'https://cdn.sanity.io/files/ck6xe2er/production/demo.mp4', mimeType: 'video/mp4'},
  ];
  const before = structuredClone(dataset);
  const raw = await (await evaluate(parse(adapter.query), {dataset})).get();
  assert.deepEqual(raw.projects.map(item => item._id), ['one']);
  assert.equal(raw.projects[0].indexmaterial.media[1].video.asset.mimeType, 'video/mp4');
  assert.equal(raw.projects[0].indexmaterial.media[0].image.portraitPosition, 'left');
  assert.equal(raw.indexPage.entries[1].project._ref, 'one');
  assert.deepEqual(titles(adapter.normalize(raw)), ['Project one']);
  assert.deepEqual(dataset, before);
});
