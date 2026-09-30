import test from 'node:test'
import assert from 'node:assert/strict'
import {indexEntry} from '../schemaTypes/objects/editorial.ts'
import {indexMedia, legacyIndexImage} from '../schemaTypes/objects/indexMedia.ts'
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
