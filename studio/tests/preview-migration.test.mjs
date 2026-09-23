import test from 'node:test'
import assert from 'node:assert/strict'
import adapter from '../../sanity-data.js'
import {previewComposition} from '../migrations/preview-composition.mjs'

const image = {
  _type: 'image',
  asset: {_type: 'reference', _ref: 'image-abc-1200x800-jpg'},
  crop: {left: 0.1, right: 0.2, top: 0.3, bottom: 0},
  hotspot: {x: 0.4, y: 0.5, width: 0.2, height: 0.3},
  alt: 'Nested alt',
}
for (const media of [
  {_type: 'selectedWorkPreview', type: 'image', image, alt: 'Image alt'},
  {
    _type: 'selectedWorkPreview',
    type: 'video',
    vimeoUrl: 'https://vimeo.com/12345/private?share=copy#t=0',
    poster: image,
    alt: 'Video alt',
  },
])
  test(`legacy ${media.type} wraps in Full Width with every existing field preserved`, () => {
    const before = JSON.parse(JSON.stringify(media))
    const migrated = previewComposition(media)
    const row = migrated.composition[0]
    assert.deepEqual(media, before)
    assert.equal(row._type, 'preview-full')
    assert.equal(row.type, 'full')
    assert.equal(row.height, 'auto')
    assert.equal(row.order, 'default')
    assert.equal(row.slots.length, 1)
    assert.deepEqual(row.slots[0], {...before, _type: 'previewMediaSlot', _key: 'preview-media'})
    for (const key of Object.keys(media)) assert.deepEqual(migrated[key], media[key])
    assert.deepEqual(previewComposition(migrated), migrated)
    const normalize = (selectedWorkPreview) =>
      adapter.normalize({
        projects: [
          {
            _id: 'project',
            _type: 'project',
            title: 'Project',
            slug: {current: 'project'},
            category: 'Video',
            modules: [],
            selectedWorkPreview,
          },
        ],
      }).projects[0].selectedWorkPreview
    assert.deepEqual(normalize(migrated), normalize(media))
  })
test('unset, malformed and existing composed previews are never overwritten', () => {
  for (const value of [
    undefined,
    null,
    {},
    {type: 'text'},
    {composition: [{}]},
    {type: 'image', image, composition: [{}]},
    {type: 'image', composition: 'bad'},
  ]) {
    assert.equal(previewComposition(value), value)
  }
})
