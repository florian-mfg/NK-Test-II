import assert from 'node:assert/strict'
import test from 'node:test'
import {InfoSectionContentField} from '../components/InfoSectionContentField.tsx'
import {InfoSectionOrderInput, defaultInfoSectionOrder} from '../components/InfoSectionOrderInput.tsx'
import {project} from '../schemaTypes/documents/project.ts'
import {selectedWork, navigation, legalPage, infoPage} from '../schemaTypes/documents/pages.ts'
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
    ['textColor', 'displayTitle', 'year', 'additionalInfo', 'previewImages', 'initialLayout'],
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
  const projectActions = config.document.actions(actions, {schemaType: 'project'})
  assert.deepEqual(projectActions.map(item => item.action), actions.map(item => item.action))
  for (const [index, action] of actions.entries()) {
    if (action.action === 'duplicate') assert.equal(typeof projectActions[index], 'function')
    else assert.equal(projectActions[index], action)
  }
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

test('Selected Work Preview supports ordered compositions and reuses module geometry and media fields', () => {
  const preview = schemaTypes.find(type => type.name === 'selectedWorkPreview')
  const slot = schemaTypes.find(type => type.name === 'previewMediaSlot')
  const detailSlot = schemaTypes.find(type => type.name === 'mediaSlot')
  assert.equal(field(project, 'selectedWorkPreview').type, 'selectedWorkPreview')
  assert.equal(field(project, 'selectedWorkPreview').validation, undefined)
  assert.deepEqual(slot.fields.map(field => field.name), ['type', 'image', 'vimeoUrl', 'playback', 'poster', 'alt'])
  const [validate] = validators(field(slot, 'type'))
  for (const type of ['image', 'video', 'empty']) assert.equal(validate(type), true)
  for (const type of ['text', undefined]) assert.notEqual(validate(type), true)
  for (const name of ['image', 'vimeoUrl', 'poster', 'alt']) assert.equal(field(slot, name), field(detailSlot, name))
  const composition = field(preview, 'composition')
  const names = ['full', 'half-half', 'half-quarter-quarter', 'quarter-quarter-quarter-quarter', 'third-third-third', 'two-thirds-one-third']
  assert.deepEqual(composition.of.map(item => item.type), [...names.map(name => `preview-${name}`), 'preview-spacer'])
  assert.equal(composition.options.sortable, true)
  assert.equal(composition.validation, undefined)
  for (const name of names) {
    const detail = schemaTypes.find(type => type.name === name)
    const overview = schemaTypes.find(type => type.name === `preview-${name}`)
    assert.deepEqual(overview.initialValue, {...detail.initialValue, slots: detail.initialValue.slots.map(slot=>({...slot,_type:'previewMediaSlot'}))})
    assert.deepEqual(field(overview,'order').options,field(detail,'order').options)
    assert.deepEqual(field(overview,'height').options,field(detail,'height').options)
    assert.equal(field(overview,'slots').of[0].type,'previewMediaSlot')
    assert.equal(field(detail,'slots').of[0].type,'mediaSlot')
    let length
    const rule={required(){return this},length(value){length=value;return this}}
    field(overview,'slots').validation(rule)
    assert.equal(length,detail.initialValue.slots.length)
  }
  const [validatePreview] = validators(preview)
  assert.equal(validatePreview(undefined),true)
  assert.equal(validatePreview({type:'image'}),true) // old records remain readable
  assert.equal(validatePreview({composition:[{}]}),true) // nested validators validate the layout
  assert.notEqual(validatePreview({composition:[]}),true)
  assert.equal(validatePreview({composition:[{},{}]}),true)
})


test('Info sections group editable labels and unchanged arrays without duplicate headings', () => {
  const labels = [
    ['cvLabel', 'CV', 'cv'],
    ['workLabel', 'Work', 'work'],
    ['skillsLabel', 'Skills', 'skills'],
    ['newsLabel', 'News', 'news'],
    ['publicationsLabel', 'Publications', 'publications'],
    ['contactLabel', 'Contact', 'contactLinks'],
    ['selectedClientsLabel', 'Selected Clients', 'selectedClients'],
  ]
  assert.deepEqual(infoPage.fields.filter((item) => !labels.some(([name]) => name === item.name)).map((item) => item.name),
    ['introduction', 'additionalIntroduction', 'sectionOrder', 'cv', 'work', 'skills', 'news', 'publications', 'contactLinks', 'selectedClients'])
  for (const [name, defaultLabel, contentName] of labels) {
    const label = field(infoPage, name)
    assert.equal(label.type, 'string')
    assert.equal(label.title, 'Section name')
    assert.equal(label.fieldset, contentName)
    assert.equal(field(infoPage, contentName).fieldset, contentName)
    assert.equal(field(infoPage, contentName).components.field, InfoSectionContentField)
    const fieldset = infoPage.fieldsets.find((item) => item.name === contentName)
    assert.equal(fieldset.title.trim(), '')
    // A truthy blank title prevents Studio from falling back to the fixed fieldset name.
    assert.ok(fieldset.title)
    assert.equal(fieldset.options.collapsible, false)
    assert.equal(label.initialValue, defaultLabel)
    assert.equal(label.validation, undefined)
    assert.equal(infoPage.fields[infoPage.fields.indexOf(label) + 1].name, contentName)
    assert.equal(field(infoPage, contentName).type, 'array')
  }
})

test('Spacer is last in both module menus and exposes only Spacing size', () => {
  assert.equal(field(project, 'modules').of.at(-1).type, 'spacer')
  assert.equal(field(schemaTypes.find(type => type.name === 'selectedWorkPreview'), 'composition').of.at(-1).type, 'preview-spacer')
  for (const name of ['spacer', 'preview-spacer']) {
    const spacer = schemaTypes.find(type => type.name === name)
    assert.deepEqual(spacer.initialValue, {type: 'spacer', size: 'medium'})
    assert.deepEqual(spacer.fields.filter(field => !field.hidden).map(field => field.name), ['size'])
    assert.deepEqual(field(spacer, 'size').options.list.map(item => item.value), ['small', 'medium', 'large'])
    const [validate] = validators(field(spacer, 'size'))
    for (const size of [undefined, 'small', 'medium', 'large']) assert.equal(validate(size), true)
    assert.notEqual(validate('viewport'), true)
    assert.match(spacer.preview.prepare({size: 'small'}).subtitle, /Empty vertical space/)
  }
})


test('Info content field only removes the redundant title from the native renderer', () => {
  for (const name of ['cv', 'work', 'skills', 'news', 'publications', 'contactLinks', 'selectedClients']) {
    const schemaType = field(infoPage, name)
    const value = name === 'cv' ? [{_key: 'entry', period: '2025', text: 'Existing CV'}]
      : name === 'contactLinks' ? [{_key: 'contact', label: 'Email', destination: 'email'}]
      : ['Existing content']
    for (const currentValue of [value, []]) {
      const props = {title: schemaType.title, description: schemaType.description,
        schemaType, value: currentValue, children: 'native input', renderDefault: (next) => next}
      const rendered = InfoSectionContentField(props)
      assert.deepEqual(rendered, {...props, title: undefined})
      assert.equal(rendered.value, currentValue)
      assert.equal(rendered.schemaType, schemaType)
    }
  }
})

test('Info adds optional plain text and identifier-only native section ordering without migrating fields', () => {
  const additional = field(infoPage, 'additionalIntroduction')
  assert.equal(additional.type, field(infoPage, 'introduction').type)
  assert.equal(additional.rows, field(infoPage, 'introduction').rows)
  assert.equal(additional.validation, undefined)
  const order = field(infoPage, 'sectionOrder')
  assert.equal(order.components.input, InfoSectionOrderInput)
  assert.equal(order.options.sortable, true)
  assert.deepEqual(order.options.disableActions, ['add', 'remove', 'duplicate', 'copy'])
  assert.deepEqual(order.of[0].fields.map(item => item.name), ['section'])
  assert.equal(order.of[0].fields[0].readOnly, true)
  assert.deepEqual(order.initialValue.map(item => item.section), ['cv', 'work', 'skills', 'news', 'publications', 'contactLinks', 'selectedClients'])
  const [validate] = validators(order)
  assert.equal(validate(undefined), true)
  assert.equal(validate(defaultInfoSectionOrder), true)
  assert.equal(validate([...defaultInfoSectionOrder].reverse()), true)
  for (const invalid of [[], defaultInfoSectionOrder.slice(1), [...defaultInfoSectionOrder.slice(1), defaultInfoSectionOrder[1]],
    [...defaultInfoSectionOrder.slice(1), {section: 'unknown'}]]) assert.notEqual(validate(invalid), true)
  for (const item of defaultInfoSectionOrder) assert.ok(order.of[0].preview.prepare(item).title)
})

test('Info ordering input never writes on mount and delegates saved values to the native editor', () => {
  const patches = []
  const props = {value: undefined, onChange: patch => patches.push(patch), renderDefault: next => next}
  const output = InfoSectionOrderInput(props)
  assert.equal(patches.length, 0)
  const button = output.props.children[1]
  button.props.onClick()
  assert.equal(patches.length, 1)
  assert.equal(patches[0].type, 'set')
  assert.deepEqual(patches[0].value, defaultInfoSectionOrder)
  assert.equal(InfoSectionOrderInput({...props, readOnly: true}).props.children[1].props.disabled, true)
  const saved = {...props, value: defaultInfoSectionOrder}
  assert.equal(InfoSectionOrderInput(saved), saved)
})

test('legacy Info order remains valid and only an explicit click adds missing identifiers', () => {
  const legacy = defaultInfoSectionOrder.filter(item => !['news', 'publications'].includes(item.section)).reverse()
  const before = JSON.stringify(legacy)
  const [validate] = validators(field(infoPage, 'sectionOrder'))
  assert.equal(validate(legacy), true)
  const patches = []
  const props = {value: legacy, onChange: patch => patches.push(patch), renderDefault: () => 'native array'}
  const output = InfoSectionOrderInput(props)
  assert.equal(patches.length, 0)
  assert.equal(output.props.children[0], 'native array')
  output.props.children[1].props.onClick()
  assert.deepEqual(patches[0].value.slice(0, 5), legacy)
  assert.deepEqual(patches[0].value.slice(5).map(item => item.section), ['news', 'publications'])
  assert.equal(validate(patches[0].value), true)
  assert.equal(JSON.stringify(legacy), before)
})

test('News and Publications use optional native arrays with titles, detail text and optional web URLs', () => {
  for (const name of ['news', 'publications']) {
    const list = field(infoPage, name)
    assert.equal(list.type, 'array')
    assert.equal(list.options.sortable, true)
    assert.equal(list.options.disableActions, undefined)
    assert.equal(list.validation, undefined)
    const entry = list.of[0]
    assert.deepEqual(entry.fields.map(item => item.name), ['title', 'additionalInfo', 'url'])
    assert.equal(field(entry, 'additionalInfo').type, 'string')
    assert.deepEqual(entry.preview.select, {title: 'title', subtitle: 'additionalInfo'})
    let required = false
    field(entry, 'title').validation({required() {required = true; return this}})
    assert.equal(required, true)
    let schemes
    field(entry, 'url').validation({uri(options) {schemes = options.scheme; return this}})
    assert.deepEqual(schemes, ['http', 'https'])
  }
})

test('Index positions belong to each image and legacy entry layout is hidden without validation', () => {
  const image = field(indexEntry, 'previewImages').of[0]
  assert.deepEqual(image.fields.map(item => item.name), ['alt', 'portraitPosition'])
  const position = field(image, 'portraitPosition')
  assert.equal(position.title, 'Portrait position')
  assert.equal(position.initialValue, 'center')
  assert.deepEqual(position.options.list, [
    {title: 'Left Half', value: 'left'}, {title: 'Centered', value: 'center'}, {title: 'Right Half', value: 'right'},
  ])
  assert.equal(field(indexEntry, 'initialLayout').hidden, true)
  assert.equal(field(indexEntry, 'initialLayout').validation, undefined)
})

test('media-driven documents expose one optional Auto/Black/White text color control', () => {
  for (const type of [schemaTypes.find(type => type.name === 'homePage'), project, indexEntry]) {
    const control = field(type, 'textColor')
    assert.equal(control.title, 'Text color')
    assert.equal(control.initialValue, 'auto')
    assert.deepEqual(control.options.list.map(option => option.value), ['auto', 'black', 'white'])
    const [validate] = validators(control)
    for (const value of [undefined, 'auto', 'black', 'white']) assert.equal(validate(value), true)
    assert.notEqual(validate('difference'), true)
  }
})


test('Vimeo playback is an optional per-slot choice immediately after its URL', () => {
  for (const name of ['mediaSlot', 'previewMediaSlot']) {
    const slot = schemaTypes.find(type => type.name === name)
    const playback = field(slot, 'playback')
    assert.equal(slot.fields[slot.fields.indexOf(field(slot, 'vimeoUrl')) + 1], playback)
    assert.equal(playback.title, 'Playback')
    assert.deepEqual(playback.options.list.map(option => option.value), ['autoplay', 'manual'])
    assert.equal(playback.initialValue, undefined) // Contextual defaults must not become stored overrides.
    assert.equal(playback.hidden({parent: {type: 'video'}}), false)
    for (const type of ['image', 'empty', 'text']) assert.equal(playback.hidden({parent: {type}}), true)
    const [validate] = validators(playback)
    for (const value of [undefined, '', 'autoplay', 'manual']) assert.equal(validate(value), true)
    assert.notEqual(validate('invalid'), true)
  }
})
