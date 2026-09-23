import {defineArrayMember, defineField, defineType} from 'sanity'
import {mediaSlot} from './mediaSlot'
import {createProjectModules, layouts} from './projectModules'

// Identical image/Vimeo fields, with no Text or uploaded-video option.
export const previewMediaSlot = defineType({
  name: 'previewMediaSlot',
  title: 'Preview slot',
  type: 'object',
  initialValue: {type: 'empty'},
  fields: [
    defineField({
      name: 'type',
      title: 'Content',
      type: 'string',
      options: {
        layout: 'radio',
        list: [
          {title: 'Empty', value: 'empty'},
          {title: 'Image', value: 'image'},
          {title: 'Vimeo Video', value: 'video'},
        ],
      },
      description: 'Empty preserves this slot’s space.',
      validation: (rule) =>
        rule
          .required()
          .custom(
            (value) =>
              ['empty', 'image', 'video'].includes(value || '') ||
              'Choose Empty, Image or Vimeo Video.',
          ),
    }),
    ...mediaSlot.fields.filter((field) =>
      ['image', 'vimeoUrl', 'poster', 'alt'].includes(field.name),
    ),
  ],
  preview: mediaSlot.preview,
})

export const previewCompositions = createProjectModules({
  namePrefix: 'preview-',
  slotType: 'previewMediaSlot',
})

export const selectedWorkPreview = defineType({
  name: 'selectedWorkPreview',
  title: 'Selected Work Preview',
  type: 'object',
  fields: [
    defineField({
      name: 'composition',
      title: 'Composition',
      type: 'array',
      description:
        'Choose one layout, fill its slots, then choose height and arrangement. This is one preview for the project.',
      options: {sortable: false},
      of: previewCompositions.map(({name}) => defineArrayMember({type: name})),
      validation: (rule) => rule.max(1),
    }),
    // Keep old stored media recognized and lossless. The frontend wraps it in
    // Full Width; the migration moves it into the editor without re-uploading.
    defineField({name: 'type', type: 'string', hidden: true}),
    ...mediaSlot.fields
      .filter((field) => ['image', 'vimeoUrl', 'poster', 'alt'].includes(field.name))
      .map((field) => ({...field, hidden: true, validation: undefined})),
  ],
  validation: (rule) =>
    rule.custom((value) => {
      if (!value) return true // optional Project field
      if (Array.isArray(value.composition) && value.composition.length === 1) return true
      if (
        (value.composition == null ||
          (Array.isArray(value.composition) && !value.composition.length)) &&
        (value.type === 'image' || value.type === 'video')
      )
        return true
      return 'Choose one preview composition.'
    }),
  preview: {
    select: {composition: 'composition', image: 'image', poster: 'poster'},
    prepare({composition, image, poster}) {
      const row = composition?.[0]
      const media = row?.slots?.find(
        (slot: {type?: string}) => slot.type === 'image' || slot.type === 'video',
      )
      return {
        title: layouts.find((layout) => layout.name === row?.type)?.title || 'Full Width',
        subtitle: 'Selected Work Preview',
        media: media?.image || media?.poster || image || poster,
      }
    },
  },
})
