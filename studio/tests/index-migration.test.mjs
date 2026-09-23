import test from 'node:test'
import assert from 'node:assert/strict'
import {independentIndexEntries} from '../migrations/index-independent.mjs'
const image = {_key: 'image', asset: {_ref: 'image-example'}}
const project = {_id: 'project', title: '001NK-Test', year: 2026, additionalInfo: 'Client '}
const entry = {
  _key: 'entry',
  _type: 'indexEntry',
  project: {_ref: 'project'},
  previewImages: [image],
  initialLayout: 'full',
}
test('migration materializes inherited content without changing keys, images, layout or input', () => {
  const original = JSON.parse(JSON.stringify(entry))
  const [result] = independentIndexEntries({entries: [entry]}, [project])
  assert.deepEqual(result, {
    _key: 'entry',
    _type: 'indexEntry',
    displayTitle: '001NK-Test',
    year: 2026,
    additionalInfo: 'Client ',
    previewImages: [image],
    initialLayout: 'full',
  })
  assert.deepEqual(entry, original)
  assert.deepEqual(independentIndexEntries({entries: [result]}, []), [result])
})
test('migration preserves explicit overrides including blank info and zero year', () => {
  const [result] = independentIndexEntries(
    {entries: [{...entry, displayTitle: ' Own ', yearOverride: 0, additionalInfo: ''}]},
    [project],
  )
  assert.equal(result.displayTitle, 'Own')
  assert.equal(result.year, 0)
  assert.equal(result.additionalInfo, '')
  assert.equal('project' in result, false)
  assert.equal('yearOverride' in result, false)
})
test('migration refuses missing inherited titles or image loss; keeps draft and published data separate', () => {
  assert.throws(() => independentIndexEntries({entries: [entry]}, []), /resolved title/)
  assert.throws(
    () =>
      independentIndexEntries({entries: [{...entry, previewImages: Array(4).fill(image)}]}, [
        project,
      ]),
    /no images will be deleted/,
  )
  const [draft] = independentIndexEntries(
    {entries: [{...entry, displayTitle: 'Unpublished title'}]},
    [project],
  )
  assert.equal(draft.displayTitle, 'Unpublished title')
})
