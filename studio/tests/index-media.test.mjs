import test from 'node:test'
import assert from 'node:assert/strict'
import {indexEntry} from '../schemaTypes/objects/editorial.ts'
import {indexMedia, legacyIndexImage} from '../schemaTypes/objects/indexMedia.ts'
import {createSchema} from 'sanity'
import {validateDocument} from '@sanity/validation'
import {schemaTypes} from '../schemaTypes/index.ts'
const field = (type,name) => type.fields.find(x=>x.name===name)
function validate(field,value,type) {
  const checks=[]
  const rule=new Proxy({}, {get:(_,key)=>(...args)=>{if(key==='custom')checks.push(args[0]);return rule}})
  field.validation(rule)
  return checks.every(fn=>fn(value,{parent:{mediaType:type}})===true)
}
test('Index retains legacy image storage and adds a conditional mixed-media selector',()=>{
  const array=field(indexEntry,'previewImages')
  assert.equal(array.of[0],legacyIndexImage)
  assert.equal(array.of[1],indexMedia)
  assert.deepEqual(field(indexMedia,'mediaType').options.list.map(x=>x.value),['image','vimeo','mp4'])
  for(const [name,type] of [['image','image'],['vimeoUrl','vimeo'],['video','mp4']]) {
    for(const selected of ['image','vimeo','mp4']) assert.equal(field(indexMedia,name).hidden({parent:{mediaType:selected}}),selected!==type)
    assert.equal(validate(field(indexMedia,name),undefined,type),false)
    assert.equal(validate(field(indexMedia,name),undefined,'inactive'),true)
  }
  assert.equal(field(indexMedia,'image').options.hotspot,true)
  assert.equal(field(indexMedia,'image').fields,legacyIndexImage.fields)
  assert.equal(field(indexMedia,'video').options.accept,'video/mp4')
  assert.equal(validate(field(indexMedia,'video'),{asset:{_ref:'file-abc-mp4'}},'mp4'),true)
  assert.equal(validate(field(indexMedia,'video'),{asset:{_ref:'file-abc-webm'}},'mp4'),false)
  assert.equal(validate(field(indexMedia,'vimeoUrl'),'https://vimeo.com/123456/secret','vimeo'),true)
  assert.equal(validate(field(indexMedia,'vimeoUrl'),'https://example.com/video','vimeo'),false)
  assert.equal(validate(field(indexMedia,'mediaType'),'unknown'),false)
})

// Validate through Sanity's compiled schema, including array member resolution
// and hidden fields. No dataset reads or writes are needed for these fixtures.
const schema = createSchema({name: 'index-media-validation-test', types: schemaTypes})
const image = {_type: 'image', asset: {_type: 'reference', _ref: 'image-abc-100x100-jpg'}}
const video = {_type: 'file', asset: {_type: 'reference', _ref: 'file-abc-mp4'}}
async function validateMedia(items) {
  const document = {
    _id: 'index-media-test',
    _type: 'indexPage',
    entries: [{
      _type: 'indexEntry', _key: 'entry', displayTitle: 'Test entry',
      previewImages: items.map((item, index) => ({_key: `media${index}`, ...item})),
    }],
  }
  const before = JSON.stringify(document)
  const result = await validateDocument({
    schema, document, customValidation: true,
    getDocumentExists: async () => true,
  })
  assert.equal(JSON.stringify(document), before)
  return result.markers
}

test('compiled Studio schema accepts each media type without inactive required fields', async () => {
  for (const item of [
    image,
    {_type: 'indexMedia', mediaType: 'image', image},
    {_type: 'indexMedia', mediaType: 'vimeo', vimeoUrl: 'https://vimeo.com/123456'},
    {_type: 'indexMedia', mediaType: 'mp4', video},
  ]) {
    assert.deepEqual(await validateMedia([item]), [], JSON.stringify(item))
  }
})

test('compiled Studio schema requires only the selected media asset or URL', async () => {
  for (const [mediaType, message, path] of [
    ['image', 'Upload a preview image.', 'image'],
    ['vimeo', 'Enter a valid Vimeo video URL.', 'vimeoUrl'],
    ['mp4', 'Upload an MP4 video.', 'video'],
  ]) {
    const markers = await validateMedia([{_type: 'indexMedia', mediaType}])
    assert.deepEqual(markers.map(marker => marker.message), [message])
    assert.equal(markers[0].path.at(-1), path)
  }
  const legacyMarkers = await validateMedia([{_type: 'image'}])
  assert.ok(legacyMarkers.some(marker => marker.message === 'Upload a preview image.'))
})

test('compiled Studio schema preserves 1–3 mixed items and their ordering', async () => {
  const items = [image,
    {_type: 'indexMedia', mediaType: 'mp4', video},
    {_type: 'indexMedia', mediaType: 'vimeo', vimeoUrl: 'https://vimeo.com/123456'},
  ]
  assert.deepEqual(await validateMedia(items), [])
  assert.deepEqual(await validateMedia([...items].reverse()), [])
  for (const invalid of [[], [...items, image]]) {
    assert.ok((await validateMedia(invalid)).some(marker => marker.level === 'error'))
  }
})
