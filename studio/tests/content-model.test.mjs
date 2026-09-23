import assert from 'node:assert/strict'
import test from 'node:test'
import {project} from '../schemaTypes/documents/project.ts'
import {selectedWork, navigation, legalPage} from '../schemaTypes/documents/pages.ts'
import {indexEntry} from '../schemaTypes/objects/editorial.ts'
import {schemaTypes} from '../schemaTypes/index.ts'
import {structure, singletonTypes} from '../structure.ts'
import importedConfig from '../sanity.config.ts'

const config = importedConfig.default ?? importedConfig

// Exercise actual custom validators without contacting or mutating the dataset.
function validators(field) {
  const custom = []
  const rule = new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args) => {
          if (method === 'custom') custom.push(args[0])
          return rule
        },
    },
  )
  field.validation?.(rule)
  return custom
}
const field = (type, name) => type.fields.find((item) => item.name === name)

test('existing project layouts and slots remain registered', () => {
  for (const name of [
    'project',
    'mediaSlot',
    'full',
    'half-half',
    'half-quarter-quarter',
    'quarter-quarter-quarter-quarter',
    'third-third-third',
    'two-thirds-one-third',
  ]) {
    assert.ok(schemaTypes.some((type) => type.name === name))
  }
  assert.equal(new Set(schemaTypes.map((type) => type.name)).size, schemaTypes.length)
})

test('slugs retain legacy route IDs but reject unsafe routes', () => {
  const [validate] = validators(field(project, 'slug'))
  assert.equal(validate({current: 'ethereal-tides'}), true)
  for (const current of ['Two Words', 'path/part', 'a#info', '../project', 'bad--slug']) {
    assert.notEqual(validate({current}), true)
  }
})

test('Index requires its own title and 1–3 previews and has no Project relationship', () => {
  assert.deepEqual(
    indexEntry.fields.map((item) => item.name),
    ['displayTitle', 'year', 'additionalInfo', 'previewImages', 'initialLayout'],
  )
  const [validate] = validators(field(indexEntry, 'displayTitle'))
  assert.equal(validate('Independent entry'), true)
  assert.notEqual(validate(undefined, {parent: {project: {_ref: 'example'}}}), true)
  assert.notEqual(validate('  '), true)
  for (const [name, expected] of [
    ['displayTitle', [['required'], ['custom']]],
    ['previewImages', [['required'], ['min', 1], ['max', 3]]],
  ]) {
    const calls = []
    const rule = new Proxy(
      {},
      {
        get:
          (_, method) =>
          (...args) => {
            calls.push(method === 'custom' ? [method] : [method, ...args])
            return rule
          },
      },
    )
    field(indexEntry, name).validation(rule)
    assert.deepEqual(calls, expected)
  }
  assert.deepEqual(indexEntry.preview.prepare({title: 'Own title', year: 2026}), {
    title: 'Own title',
    subtitle: '2026',
    media: undefined,
  })
})

test('overview references detect a category changed after selection', async () => {
  const [validate] = validators(field(selectedWork, 'video').of[0])
  const context = {
    getClient: () => ({
      fetch: async () => [
        {_id: 'example', category: 'Video'},
        {_id: 'drafts.example', category: 'Graphic'},
      ],
    }),
  }
  assert.notEqual(await validate({_ref: 'example'}, context), true)
  assert.equal(
    await validate(
      {_ref: 'example'},
      {getClient: () => ({fetch: async () => [{_id: 'example', category: 'Video'}]})},
    ),
    true,
  )
})

test('navigation labels are independent of fixed category destinations', () => {
  const [validate] = validators(field(navigation, 'categories'))
  assert.equal(
    validate(navigation.initialValue.categories.map((item) => ({...item, label: 'Renamed'}))),
    true,
  )
  assert.notEqual(
    validate([
      {destination: 'work/video'},
      {destination: 'work/video'},
      {destination: 'work/graphic'},
    ]),
    true,
  )
})

test('legal pages are bound to their intended fixed IDs', () => {
  const [validate] = validators(field(legalPage, 'pageType'))
  assert.equal(validate('imprint', {document: {_id: 'drafts.legal-imprint'}}), true)
  assert.notEqual(validate('privacy-policy', {document: {_id: 'legal-imprint'}}), true)
})

test('singletons cannot be created or duplicated from Studio menus', () => {
  const templates = schemaTypes
    .filter((type) => type.type === 'document')
    .map((type) => ({id: type.name, schemaType: type.name}))
  const configured = config.schema.templates(templates)
  const createOptions = config.document.newDocumentOptions(
    configured.map((item) => ({templateId: item.id})),
  )
  assert.deepEqual(createOptions, [{templateId: 'project'}])
  const actions = ['publish', 'delete', 'duplicate', 'unpublish', 'discardChanges'].map(
    (action) => ({action}),
  )
  for (const schemaType of singletonTypes) {
    const allowed = config.document.actions(actions, {schemaType}).map((item) => item.action)
    assert.ok(!allowed.includes('delete') && !allowed.includes('duplicate'))
    assert.ok(allowed.includes('publish'))
  }
  assert.deepEqual(config.document.actions(actions, {schemaType: 'project'}), actions)
})

test('structure opens fixed documents with explicit legal initial values', () => {
  // Model Sanity’s immutable builders to catch accidentally discarded builder calls.
  function builder(state = {}) {
    return new Proxy(state, {
      get: (target, key) =>
        key === 'state' ? target : (...args) => builder({...target, [key]: args[0] ?? true}),
    })
  }
  const S = new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args) =>
          builder({kind: method, argument: args[0]}),
    },
  )
  const root = structure(S)
  const content = root.state.items[0].state.child.state.items
  assert.deepEqual(
    content.filter((item) => item.state.child).map((item) => item.state.child.state.documentId),
    ['homePage', 'selectedWork', 'indexPage', 'infoPage'],
  )
  const settings = root.state.items[2].state.child.state.items
  const legal = settings[2].state.child.state.items
  for (const item of legal) {
    const document = item.state.child.state
    assert.equal(document.initialValueTemplate, document.documentId)
    const template = config.schema.templates([]).find((entry) => entry.id === document.documentId)
    assert.ok(template?.value.pageType)
  }
})

test('shared video slots accept Vimeo URLs and preserve uploads only for migration', () => {
  const slot = schemaTypes.find(type => type.name === 'mediaSlot')
  const [validate] = validators(field(slot, 'vimeoUrl'))
  for (const url of ['https://vimeo.com/12345', 'https://vimeo.com/12345/secret', 'https://player.vimeo.com/video/12345?h=secret&autoplay=1']) {
    assert.equal(validate(url, {parent: {type: 'video'}}), true)
  }
  for (const url of [undefined, '', 'https://example.com/12345', 'https://vimeo.com/not-a-video', 'http://vimeo.com/12345']) {
    assert.notEqual(validate(url, {parent: {type: 'video'}}), true)
  }
  assert.equal(validate(undefined, {parent: {type: 'empty'}}), true)
  assert.equal(validate('bad retained value', {parent: {type: 'image'}}), true)
  const legacy = field(slot, 'video')
  assert.equal(legacy.readOnly, true)
  assert.equal(legacy.hidden({value: undefined}), true)
  assert.equal(legacy.hidden({value: {asset: {_ref: 'file-old-mp4'}}}), false)
  assert.equal(legacy.validation, undefined)
  for (const name of ['full', 'half-half', 'half-quarter-quarter', 'quarter-quarter-quarter-quarter', 'third-third-third', 'two-thirds-one-third']) {
    assert.equal(field(schemaTypes.find(type => type.name === name), 'slots').of[0].type, 'mediaSlot')
  }
})

test('Selected Work Preview is optional and reuses only image/Vimeo media fields', () => {
  const preview = schemaTypes.find(type => type.name === 'selectedWorkPreview')
  const slot = schemaTypes.find(type => type.name === 'mediaSlot')
  assert.equal(field(project, 'selectedWorkPreview').type, 'selectedWorkPreview')
  assert.equal(field(project, 'selectedWorkPreview').validation, undefined)
  assert.deepEqual(preview.fields.map(field => field.name), ['type', 'image', 'vimeoUrl', 'poster', 'alt'])
  const [validate] = validators(field(preview, 'type'))
  for (const type of ['image', 'video']) assert.equal(validate(type), true)
  for (const type of ['text', 'empty', undefined]) assert.notEqual(validate(type), true)
  for (const name of ['image', 'vimeoUrl', 'poster', 'alt']) {
    assert.equal(field(preview, name), field(slot, name))
  }
})
