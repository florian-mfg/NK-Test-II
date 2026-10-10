import {defineArrayMember, defineField} from 'sanity'
export const legacyIndexImage = defineArrayMember({
  type: 'image',
  options: {hotspot: true},
  fields: [
    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      description: 'Describe the image for screen readers.',
    }),
    defineField({
      name: 'portraitPosition',
      title: 'Portrait position',
      type: 'string',
      initialValue: 'center',
      description:
        'Desktop portrait images retain their natural proportions within half the viewport width. Landscape images are always full bleed; mobile display is unchanged. Leave unset to preserve the legacy position.',
      options: {
        list: [
          {title: 'Left Half', value: 'left'},
          {title: 'Centered', value: 'center'},
          {title: 'Right Half', value: 'right'},
        ],
      },
      validation: (rule) => rule.custom(value =>
        !value || ['left','center','right'].includes(value) || 'Choose a portrait position.'),
    }),
  ],
  validation: (rule) =>
    rule.required().custom((value) => (value?.asset ? true : 'Upload a preview image.')),
})

export const indexMedia = defineArrayMember({
  name: 'indexMedia',
  title: 'Media item (Image / MP4)',
  type: 'object',
  initialValue: {mediaType: 'image'},
  fields: [
    defineField({
      name: 'mediaType',
      title: 'Media type',
      type: 'string',
      options: {
        layout: 'radio',
        list: [
          {title: 'Image', value: 'image'},
          {title: 'MP4 Video', value: 'mp4'},
        ],
      },
      // Sanity adds an enum error from options.list. Reset that inferred rule
      // so stored unsupported values warn without becoming selectable.
      validation: (rule) => {
        const compatible = (rule as typeof rule & {reset(): typeof rule}).reset()
        return [
          compatible.required(),
          compatible.custom(value => !value || ['image','mp4'].includes(value)
            ? true : 'Unsupported stored media is omitted from the website. Choose supported media to replace it.').warning(),
        ]
      },
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
      fields: legacyIndexImage.fields,
      hidden: ({parent}) => parent?.mediaType !== 'image',
      validation: (rule) =>
        rule.custom((value, context) =>
          (context.parent as {mediaType?: string})?.mediaType !== 'image' || value?.asset
            ? true
            : 'Upload a preview image.',
        ),
    }),
    defineField({
      name: 'video',
      title: 'MP4 upload',
      type: 'file',
      options: {accept: 'video/mp4'},
      hidden: ({parent}) => parent?.mediaType !== 'mp4',
      validation: (rule) =>
        rule.custom((value, context) =>
          (context.parent as {mediaType?: string})?.mediaType !== 'mp4' ||
          /^file-[a-zA-Z0-9]+-mp4$/.test(value?.asset?._ref || '')
            ? true
            : 'Upload an MP4 video.',
        ),
    }),
  ],
  preview: {
    select: {
      type: 'mediaType',
      media: 'image',
      filename: 'video.asset.originalFilename',
    },
    prepare({type, media, filename}) {
      return {
        title: type === 'mp4' ? 'MP4 Video' : type === 'image' ? 'Image' : 'Unsupported stored media',
        subtitle: type === 'mp4' ? filename : media?.alt,
        media: type === 'image' ? media : undefined,
      }
    },
  },
})
