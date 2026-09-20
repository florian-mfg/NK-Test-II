import {defineField, defineType} from 'sanity'
import {mediaSlot} from './mediaSlot'

// Reuse media fields and validators, without module/text/empty/upload controls.
export const selectedWorkPreview = defineType({
  name: 'selectedWorkPreview',
  title: 'Selected Work Preview',
  type: 'object',
  initialValue: {type: 'image'},
  fields: [
    defineField({
      name: 'type',
      title: 'Media type',
      type: 'string',
      options: {layout: 'radio', list: [
        {title: 'Image', value: 'image'},
        {title: 'Vimeo Video', value: 'video'},
      ]},
      validation: rule => rule.required().custom(value =>
        value === 'image' || value === 'video' || 'Choose Image or Vimeo Video.',
      ),
    }),
    ...mediaSlot.fields.filter(field => ['image', 'vimeoUrl', 'poster', 'alt'].includes(field.name)),
  ],
  preview: mediaSlot.preview,
})
