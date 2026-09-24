// Additive: keep all entry/image fields, keys, order and legacy layout values.
export function indexPortraitPositions(document) {
  if (!Array.isArray(document.entries)) throw new Error('Index entries must be an array')
  return document.entries.map((entry) => {
    if (!Array.isArray(entry.previewImages)) throw new Error('Preview images must be an array')
    return {...entry, previewImages: entry.previewImages.map((image, index) => {
      if (!image || typeof image !== 'object') throw new Error('Invalid preview image')
      if (image.portraitPosition != null && image.portraitPosition !== '') return image
      const right = (entry.initialLayout === 'half') !== (index % 2 === 1)
      return {...image, portraitPosition: right ? 'right' : 'center'}
    })}
  })
}
