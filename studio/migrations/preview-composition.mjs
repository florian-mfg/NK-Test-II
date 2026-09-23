// Non-destructive: retain every legacy field for backwards-compatible deployment.
// Media objects/URLs are copied intact; asset documents and detail modules are untouched.
export function previewComposition(value) {
  if (!value || !['image', 'video'].includes(value.type)) return value
  if (value.composition != null && (!Array.isArray(value.composition) || value.composition.length))
    return value
  return {
    ...value,
    composition: [
      {
        _key: 'preview-full',
        _type: 'preview-full',
        type: 'full',
        height: 'auto',
        order: 'default',
        slots: [{...value, _type: 'previewMediaSlot', _key: 'preview-media'}],
      },
    ],
  }
}
