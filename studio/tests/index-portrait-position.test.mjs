import test from 'node:test'
import {serialize, deserialize} from 'node:v8'
import assert from 'node:assert/strict'
import {indexPortraitPositions} from '../migrations/index-portrait-position.mjs'

test('migration preserves all content, keys and order and is idempotent for drafts and published data', () => {
  for (const _id of ['indexPage', 'drafts.indexPage']) for (const initialLayout of ['half', 'full', undefined]) {
    const doc = {_id, entries: [{_key: 'entry', displayTitle: 'Title', year: 2020,
      additionalInfo: 'Info', initialLayout, previewImages: [
        {_key: 'a', asset: {_ref: 'image-a-800x1200-jpg'}, alt: 'A', crop: {left: .1}},
        {_key: 'b', asset: {_ref: 'image-b-1200x800-jpg'}, hotspot: {x: .5}},
        {_key: 'c', asset: {_ref: 'image-c-800x1200-jpg'}, portraitPosition: 'left'},
      ]}]}
    const before = deserialize(serialize(doc))
    const result = indexPortraitPositions(doc)
    assert.deepEqual(doc, before)
    assert.deepEqual(result[0].previewImages.map(image => image.portraitPosition),
      initialLayout === 'half' ? ['right', 'center', 'left'] : ['center', 'right', 'left'])
    assert.deepEqual(result.map(entry => ({...entry, previewImages: entry.previewImages.map((image, i) => {
      const copy = {...image}; if (i < 2) delete copy.portraitPosition; return copy
    })})), doc.entries)
    assert.deepEqual(indexPortraitPositions({...doc, entries: result}), result)
  }
  assert.deepEqual(indexPortraitPositions({entries: []}), [])
})
