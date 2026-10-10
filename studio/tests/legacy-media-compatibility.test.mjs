import test from 'node:test'
import assert from 'node:assert/strict'
import {createSchema} from 'sanity'
import {validateDocument} from '@sanity/validation'
import {schemaTypes} from '../schemaTypes/index.ts'

const schema = createSchema({name:'legacy-media-compatibility',types:schemaTypes})
const image = {_type:'image',asset:{_type:'reference',_ref:'image-abc-800x1200-jpg'}}
const video = {_type:'file',asset:{_type:'reference',_ref:'file-abc-mp4'}}
test('legacy Vimeo data remains lossless and does not block publishing supported or legacy documents',async()=>{
  for(const slot of [
    {_type:'mediaSlot',type:'image',image},
    {_type:'mediaSlot',type:'mp4',video},
    {_type:'mediaSlot',type:'video',vimeoUrl:'https://vimeo.com/12345/secret'},
  ]){
    const doc={_id:'project-fixture',_type:'project',title:'Project',slug:{_type:'slug',current:'project-fixture'},categories:['Video'],modules:[{_key:'row',_type:'full',type:'full',height:'auto',order:'default',slots:[{_key:'slot',...slot}]}],selectedWorkPreview:{_type:'selectedWorkPreview',type:'video',vimeoUrl:'https://vimeo.com/12345/secret'}}
    const before=JSON.stringify(doc)
    const {markers}=await validateDocument({schema,document:doc,customValidation:true,getDocumentExists:async()=>true})
    assert.deepEqual(markers.filter(marker=>marker.level==='error'),[],JSON.stringify(markers))
    assert.equal(JSON.stringify(doc),before)
  }
  const documents=[
    {_id:'homePage',_type:'homePage',videoTitle:'Video',backgroundVideoUrl:'https://vimeo.com/12345'},
    {_id:'indexPage',_type:'indexPage',entries:[{_key:'entry',_type:'indexEntry',displayTitle:'Legacy',previewImages:[{_key:'media',_type:'indexMedia',mediaType:'vimeo',vimeoUrl:'https://vimeo.com/12345'}]}]},
  ]
  for(const document of documents){
    const before=JSON.stringify(document)
    const {markers}=await validateDocument({schema,document,customValidation:true,getDocumentExists:async()=>true})
    assert.deepEqual(markers.filter(marker=>marker.level==='error'),[],JSON.stringify(markers))
    assert.equal(JSON.stringify(document),before)
  }
})
test('active schemas have no Vimeo choices or URL fields; Frontpage offers an MP4 upload',()=>{
  const visit=value=>{
    if(!value||typeof value!=='object')return
    if(value.name)assert.notEqual(value.name,'vimeoUrl')
    if(value.options?.list)assert.ok(value.options.list.every(option=>!['vimeo','video'].includes(option.value)))
    for(const key of ['fields','of'])for(const child of value[key]||[])visit(child)
  }
  schemaTypes.forEach(visit)
  const home=schemaTypes.find(type=>type.name==='homePage')
  assert.equal(home.fields.some(field=>field.name==='backgroundVideoUrl'),false)
  assert.equal(home.fields.find(field=>field.name==='video').options.accept,'video/mp4')
})
