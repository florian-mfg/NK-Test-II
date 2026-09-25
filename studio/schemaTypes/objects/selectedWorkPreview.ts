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
      ['image', 'vimeoUrl', 'playback', 'poster', 'alt'].includes(field.name),
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
        'Add layouts or Spacers and drag to reorder. Media layouts keep their own slots, height and arrangement. Together these rows form one project preview.',
      options: {sortable: true},
      of: previewCompositions.map(({name}) => defineArrayMember({type: name})),
    }),
    // Keep old stored media recognized and lossless. The frontend wraps it in
    // Full Width; the migration moves it into the editor without re-uploading.
    defineField({name: 'type', type: 'string', hidden: true}),
    ...mediaSlot.fields
      .filter((field) => ['image', 'vimeoUrl', 'playback', 'poster', 'alt'].includes(field.name))
      .map((field) => ({...field, hidden: true, validation: undefined})),
  ],
  validation: (rule) =>
    rule.custom((value) => {
      if (!value) return true // optional Project field
      if (Array.isArray(value.composition) && value.composition.length > 0) return true
      if (
        (value.composition == null ||
          (Array.isArray(value.composition) && !value.composition.length)) &&
        (value.type === 'image' || value.type === 'video')
      )
        return true
      return 'Choose at least one preview composition or Spacer.'
    }),
  preview: {
    select: {composition: 'composition', image: 'image', poster: 'poster'},
    prepare({composition, image, poster}) {
      const row = composition?.[0]
      const media = row?.slots?.find(
        (slot: {type?: string}) => slot.type === 'image' || slot.type === 'video',
      )
      return {
        title: row?.type === 'spacer' ? 'Spacer' : layouts.find((layout) => layout.name === row?.type)?.title || 'Full Width',
        subtitle: 'Selected Work Preview',
        media: media?.image || media?.poster || image || poster,
      }
    },
  },
})
