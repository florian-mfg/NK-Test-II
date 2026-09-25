import assert from 'node:assert/strict'
import test from 'node:test'
import React, {act} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createRequire} from 'node:module'
import {JSDOM} from 'jsdom'
import {InfoSectionOrderInput, InfoSectionOrderPreview, defaultInfoSectionOrder} from '../components/InfoSectionOrderInput.tsx'
import {infoPage} from '../schemaTypes/documents/pages.ts'

// tsx loads this Studio's TS components through Sanity's CJS export. Use the
// same provider instance rather than the separate ESM context in Node tests.
const {FormValueProvider} = createRequire(import.meta.url)('sanity')

const names = [
  ['cv', 'cvLabel', 'CV', 'CV Custom'],
  ['work', 'workLabel', 'Work', 'Services'],
  ['skills', 'skillsLabel', 'Skills', 'Expertise'],
  ['news', 'newsLabel', 'News', 'Updates'],
  ['publications', 'publicationsLabel', 'Publications', 'Books & Publications'],
  ['contactLinks', 'contactLabel', 'Contact', 'Get in Touch'],
  ['selectedClients', 'selectedClientsLabel', 'Selected Clients', 'Collaborators'],
]
const field = infoPage.fields.find(item => item.name === 'sectionOrder')
const itemSchema = field.of[0]
const renderDefault = props => React.createElement('span', {'data-section': props.section}, props.title)
const previews = () => names.map(([section]) => React.createElement(InfoSectionOrderPreview, {
  key: section, ...itemSchema.preview.prepare({section}), renderDefault,
}))
const provider = (document, children) => React.createElement(FormValueProvider, {value: document}, children)
const document = fields => ({_id: 'drafts.infoPage', _type: 'infoPage', sectionOrder: defaultInfoSectionOrder, ...fields})

test('all seven ordering previews use current label fields with blank/absent fallbacks', () => {
  assert.equal(itemSchema.components.preview, InfoSectionOrderPreview)
  for (const value of [undefined, null, '', ' \n ', 123]) {
    const data = document(Object.fromEntries(names.map(([, field]) => [field, value])))
    const dom = new JSDOM(renderToStaticMarkup(provider(data, previews())))
    assert.deepEqual([...dom.window.document.querySelectorAll('span')].map(node => node.textContent), names.map(([, , fallback]) => fallback))
    dom.window.close()
  }
  const custom = document(Object.fromEntries(names.map(([, field, , label]) => [field, ` ${label} `])))
  const snapshot = JSON.stringify(custom)
  const dom = new JSDOM(renderToStaticMarkup(provider(custom, previews())))
  assert.deepEqual([...dom.window.document.querySelectorAll('span')].map(node => node.textContent), names.map(([, , , label]) => label))
  assert.equal(JSON.stringify(custom), snapshot)
  dom.window.close()
})

test('unsaved and legacy ordering controls also show custom names without issuing patches', () => {
  const data = document({workLabel: 'Services', newsLabel: 'Updates', publicationsLabel: 'Books'})
  const patches = []
  const props = {onChange: patch => patches.push(patch), renderDefault: () => React.createElement('div', null, 'Native array')}
  const unsaved = new JSDOM(renderToStaticMarkup(provider(data, React.createElement(InfoSectionOrderInput, props))))
  assert.equal(unsaved.window.document.querySelectorAll('li')[1].textContent, 'Services')
  const legacy = defaultInfoSectionOrder.filter(item => !['news', 'publications'].includes(item.section))
  const before = JSON.stringify(legacy)
  const missing = new JSDOM(renderToStaticMarkup(provider(data, React.createElement(InfoSectionOrderInput, {...props, value: legacy}))))
  assert.equal(missing.window.document.querySelector('button').textContent, 'Add missing sections: Updates, Books')
  assert.deepEqual(patches, [])
  assert.equal(JSON.stringify(legacy), before)
  unsaved.window.close(); missing.window.close()
})

test('mounted previews update immediately with form edits while stable IDs and native ordering props remain unchanged', async () => {
  const dom = new JSDOM('<div id="root"></div>')
  const originals = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  Object.defineProperty(globalThis, 'window', {configurable: true, value: dom.window})
  Object.defineProperty(globalThis, 'document', {configurable: true, value: dom.window.document})
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {configurable: true, value: true})
  const {createRoot} = await import('react-dom/client')
  const root = createRoot(dom.window.document.querySelector('#root'))
  const order = [...defaultInfoSectionOrder].reverse()
  const before = JSON.stringify(order)
  const onChange = () => {throw new Error('Renaming a label must never patch sectionOrder')}
  const props = {value: order, onChange, readOnly: false, renderDefault: passed => {
    assert.deepEqual(passed, props)
    assert.equal(passed.value, order)
    assert.equal(passed.onChange, onChange)
    return React.createElement('div', null, passed.value.map(({section, _key}) => React.createElement(InfoSectionOrderPreview, {
      key: _key, ...itemSchema.preview.prepare({section}), renderDefault,
    })))
  }}
  try {
    let data = document({sectionOrder: order})
    await act(async () => root.render(provider(data, React.createElement(InfoSectionOrderInput, props))))
    const elements = [...dom.window.document.querySelectorAll('[data-section]')]
    assert.deepEqual(elements.map(node => node.dataset.section), order.map(item => item.section))
    for (const [section, labelField, fallback, label] of names) {
      data = {...data, [labelField]: label}
      await act(async () => root.render(provider(data, React.createElement(InfoSectionOrderInput, props))))
      assert.equal(dom.window.document.querySelector(`[data-section="${section}"]`).textContent, label)
      data = {...data, [labelField]: '   '}
      await act(async () => root.render(provider(data, React.createElement(InfoSectionOrderInput, props))))
      assert.equal(dom.window.document.querySelector(`[data-section="${section}"]`).textContent, fallback)
    }
    assert.deepEqual([...dom.window.document.querySelectorAll('[data-section]')], elements, 'Label edits retain the same mounted items and order')
    assert.equal(field.options.sortable, true)
    assert.deepEqual(order.map(item => Object.keys(item)), order.map(() => ['_key', '_type', 'section']))
    assert.equal(JSON.stringify(order), before)
  } finally {
    await act(async () => root.unmount())
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
    dom.window.close()
  }
})
