import test from 'node:test'
import assert from 'node:assert/strict'
import {createSchema} from 'sanity'
import {validateDocumentWithWorkspace} from '@sanity/validation'
import {schemaTypes} from '../schemaTypes/index.ts'
import {project} from '../schemaTypes/documents/project.ts'
import {indexPage} from '../schemaTypes/documents/pages.ts'
import {indexMedia} from '../schemaTypes/objects/indexMedia.ts'
const schema = createSchema({name: 'project-index-test', types: schemaTypes})
const field = (type, name) => type.fields.find(item => item.name === name)
const image = {_type: 'indexMedia', mediaType: 'image', image: {_type: 'image', asset: {_type: 'reference', _ref: 'image-demo-800x1200-jpg'}, portraitPosition: 'left'}}
const mp4 = {_type: 'indexMedia', mediaType: 'mp4', video: {_type: 'file', asset: {_type: 'reference', _ref: 'file-demo-mp4'}}}
const document = material => ({_id: 'one', _type: 'project', title: 'Project', slug: {_type: 'slug', current: 'one'}, categories: ['Graphic'], indexmaterial: material})
// The Studio slug uniqueness query returns a boolean; this isolated fixture is unique.
const client = {withConfig() {return this}, fetch: async () => true}
async function markers(doc) {
  const before = JSON.stringify(doc)
  // The CLI validator downgrades object-field checks while adding unknown-field
  // warnings. Use the Studio entry point to verify actual editor error severity.
  const result = await validateDocumentWithWorkspace({workspace: {schema, getClient: () => client}, document: doc, environment: 'studio', customValidation: true, getDocumentExists: async () => true})
  assert.equal(JSON.stringify(doc), before)
  return result
}
test('Project Indexmaterial is optional and reuses Index media instead of creating another document', async () => {
  const section = field(project, 'indexmaterial')
  assert.equal(section.title, 'Indexmaterial'); assert.equal(section.type, 'object')
  assert.equal(section.options.collapsed, false)
  assert.deepEqual(field(section, 'media').of, [indexMedia])
  assert.deepEqual(section.fields.map(item => item.name), ['media', 'textColor'])
  assert.equal(field(section, 'textColor').initialValue, 'auto')
  for (const material of [undefined, {}, {media: []}, {media: [image]}, {media: [mp4]}, {media: [image, mp4, image]}]) {
    const value = material && {...material, media: material.media?.map((item, i) => ({...item, _key: `item${i}`}))}
    assert.deepEqual(await markers(document(value)), [], JSON.stringify(value))
  }
})
test('Indexmaterial validates the three-item limit and each selected asset', async () => {
  for (const media of [[image, image, image, image], [{_type: 'indexMedia', mediaType: 'image'}], [{_type: 'indexMedia', mediaType: 'mp4'}], [{...mp4, video: {_type: 'file', asset: {_type: 'reference', _ref: 'file-demo-webm'}}}]]) {
    assert.ok((await markers(document({media: media.map((item, i) => ({...item, _key: `item${i}`}))}))).some(marker => marker.level === 'error'), JSON.stringify(media))
  }
})
test('existing Index entries and Project references share the sortable array without media copies', async () => {
  const order = field(indexPage, 'entries')
  assert.equal(order.options.sortable, true)
  assert.deepEqual(order.of.map(item => item.name || item.type), ['indexEntry', 'indexProjectReference'])
  assert.deepEqual(order.of[1].fields.map(item => item.name), ['project'])
  const legacy = {_type: 'indexEntry', _key: 'legacy', displayTitle: 'Standalone', previewImages: [{...image, _key: 'image'}]}
  const reference = {_type: 'indexProjectReference', _key: 'project', project: {_type: 'reference', _ref: 'one'}}
  assert.deepEqual(await markers({_id: 'indexPage', _type: 'indexPage', entries: [legacy, reference]}), [])
  assert.ok((await markers({_id: 'indexPage', _type: 'indexPage', entries: [{_type: 'indexProjectReference', _key: 'empty'}]})).some(marker => marker.level === 'error'))
})
