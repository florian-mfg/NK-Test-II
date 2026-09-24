import assert from 'node:assert/strict'
import test from 'node:test'
import {set, unset} from 'sanity'
import {mapProjectDuplicate, duplicateProjectIdentity} from '../actions/duplicateProject.ts'
import {categorySelectionPatch, projectCategories} from '../components/ProjectCategoriesInput.tsx'
import {project} from '../schemaTypes/documents/project.ts'
import {selectedWork} from '../schemaTypes/documents/pages.ts'
import importedConfig from '../sanity.config.ts'
const config = importedConfig.default ?? importedConfig
const field = (schema, name) => schema.fields.find(item => item.name === name)
function validator(field) {
  let validate
  const rule = new Proxy({}, {get: (_, name) => (...args) => {
    if (name === 'custom') validate = args[0]
    return rule
  }})
  field.validation(rule)
  return validate
}

test('native duplicate mapper preserves independent draft content and shared assets in exact order', () => {
  const image = {_type:'image', asset:{_type:'reference', _ref:'image-shared'},
    crop:{top:.1,bottom:.2,left:0,right:0}, hotspot:{x:.4,y:.6,width:.3,height:.2},alt:'Photo'}
  const original = {_id:'original',_type:'project',_rev:'old',_createdAt:'old',_updatedAt:'old',
    title:'002NK-C2',slug:{_type:'slug',current:'002nk-c2'},category:'Video',categories:['Video','Commissioned'],
    additionalInfo:'Client',year:2026,description:'Info',detailPageEnabled:false,textColor:'black',
    modules:[{_key:'first',_type:'half-quarter-quarter',height:'large',order:'reverse',slots:[
      {_key:'a',type:'image',image}, {_key:'b',type:'video',vimeoUrl:'https://vimeo.com/123/private',playback:'manual',posterImage:image},
      {_key:'c',type:'empty'}]}, {_key:'second',_type:'full',slots:[{type:'video',vimeoUrl:'https://vimeo.com/456',playback:'autoplay'}]}],
    selectedWorkPreview:{composition:[{_type:'preview-full',slots:[{type:'image',image}]}]},futureEditableField:{value:'keep'}}
  const before = JSON.parse(JSON.stringify(original))
  const selected = {video:[{_ref:'original'}],commissioned:[]}
  // The native action generates this new draft ID before calling mapDocument.
  const copy = mapProjectDuplicate({...original,_id:'drafts.new-native-uuid'}, [original])
  assert.equal(copy._id,'drafts.new-native-uuid')
  assert.notEqual(copy._id,original._id)
  assert.equal(copy.title,'002NK-C2-2')
  assert.equal(copy.slug.current,'002nk-c2-2')
  for (const key of ['_rev','_createdAt','_updatedAt']) assert.equal(copy[key],undefined)
  for (const key of Object.keys(original).filter(key=>!key.startsWith('_') && !['title','slug'].includes(key))) {
    assert.deepEqual(copy[key],original[key],key)
  }
  copy.modules[0].slots[0].image.alt = 'Changed independently'
  assert.deepEqual(original,before)
  assert.deepEqual(selected,{video:[{_ref:'original'}],commissioned:[]})
  assert.throws(()=>mapProjectDuplicate(original,[]),/must be drafts/)
})

test('duplicate numbering checks titles and slugs, including copies of copies', () => {
  const existing = [{title:'Project Name',slug:{current:'project-name'}},
    {title:'Project Name-2',slug:{current:'project-name-2'}}, {title:'Other',slug:{current:'project-name-3'}}]
  assert.deepEqual(duplicateProjectIdentity('Project Name-2',existing),
    {title:'Project Name-4',slug:{_type:'slug',current:'project-name-4'}})
  assert.equal(duplicateProjectIdentity('002NK-C2',[]).title,'002NK-C2-2')
  assert.equal(duplicateProjectIdentity('Summer-2026',[]).title,'Summer-2026-2')
  assert.equal(duplicateProjectIdentity('Été / Film',[]).slug.current,'ete-film-2')
})

test('only Projects replace native duplication; other actions and singletons remain intact', () => {
  const duplicate = Object.assign(()=>null,{action:'duplicate'})
  const publish = Object.assign(()=>null,{action:'publish'})
  const actions = config.document.actions([duplicate,publish],{schemaType:'project'})
  assert.notEqual(actions[0],duplicate)
  assert.equal(actions[0].action,'duplicate')
  assert.equal(actions[1],publish)
  assert.deepEqual(config.document.actions([duplicate,publish],{schemaType:'other'}),[duplicate,publish])
  assert.deepEqual(config.document.actions([duplicate,publish],{schemaType:'selectedWork'}),[publish])
})

test('native category checkboxes retain legacy values without writing and require one selection', () => {
  const categories = field(project,'categories')
  assert.equal(field(project,'category').hidden,true)
  assert.deepEqual(categories.options.list.map(item=>item.value),['Video','Commissioned','Graphic'])
  const validate = validator(categories)
  for (const value of [['Video'],['Video','Commissioned'],['video','graphic']]) assert.equal(validate(value,{}),true)
  assert.equal(validate(undefined,{document:{category:'video'}}),true)
  for (const value of [[],['Other']]) assert.notEqual(validate(value,{document:{category:'Video'}}),true)
  assert.notEqual(validate(undefined,{document:{}}),true)
  assert.deepEqual(projectCategories({category:'video'}),['Video'])
  assert.deepEqual(projectCategories({categories:['video','commissioned']}),['Video','Commissioned'])
  assert.deepEqual(categorySelectionPatch(unset()),[set([])])
  assert.deepEqual(categorySelectionPatch(set(['Video','Graphic'])),[set(['Video','Graphic'])])
  assert.deepEqual(projectCategories({category:'Video',categories:[]}),[])
})

test('same project is valid in both matching curated lists, with draft membership taking precedence', async () => {
  const document = {_id:'one',category:'Graphic',categories:['video','commissioned']}
  const context = {getClient:()=>({fetch:async()=>[document]})}
  for (const name of ['video','commissioned']) {
    const reference = field(selectedWork,name).of[0]
    assert.match(reference.options.filter,/in categories/)
    assert.equal(await validator(reference)({_ref:'one'},context),true)
  }
  assert.notEqual(await validator(field(selectedWork,'graphic').of[0])({_ref:'one'},context),true)
  const draftContext = {getClient:()=>({fetch:async()=>[document,{...document,_id:'drafts.one',categories:['Graphic']}]})}
  assert.notEqual(await validator(field(selectedWork,'video').of[0])({_ref:'one'},draftContext),true)
})
