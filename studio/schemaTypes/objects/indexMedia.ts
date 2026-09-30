import {defineArrayMember, defineField} from 'sanity'
import '../../../vimeo-media.js'

const vimeoMedia = (
  globalThis as typeof globalThis & {
    VimeoMedia: typeof import('../../../vimeo-media.js')
  }
).VimeoMedia

// Keep the native image member so existing documents need no migration.
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
        'Desktop portrait images use half the viewport width. Landscape images are always full bleed; mobile display is unchanged. Leave unset to preserve the legacy position.',
      options: {
        list: [
          {title: 'Left Half', value: 'left'},
          {title: 'Centered', value: 'center'},
          {title: 'Right Half', value: 'right'},
        ],
      },
      validation: (rule) =>
        rule.custom(
          (value) =>
            !value || ['left', 'center', 'right'].includes(value) || 'Choose a portrait position.',
        ),
    }),
  ],
  validation: (rule) =>
    rule.required().custom((value) => (value?.asset ? true : 'Upload a preview image.')),
})

export const indexMedia = defineArrayMember({
  name: 'indexMedia',
  title: 'Media item (Image / Vimeo / MP4)',
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
          {title: 'Vimeo Video', value: 'vimeo'},
          {title: 'MP4 Video', value: 'mp4'},
        ],
      },
      validation: (rule) =>
        rule
          .required()
          .custom(
            (value) => ['image', 'vimeo', 'mp4'].includes(value || '') || 'Choose a media type.',
          ),
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
      name: 'vimeoUrl',
      title: 'Vimeo URL',
      type: 'url',
      description:
        'Paste an HTTPS Vimeo video URL, including its privacy hash for unlisted videos.',
      hidden: ({parent}) => parent?.mediaType !== 'vimeo',
      validation: (rule) =>
        rule.custom((value, context) =>
          (context.parent as {mediaType?: string})?.mediaType !== 'vimeo' ||
          vimeoMedia.parseVimeoUrl(value)
            ? true
            : 'Enter a valid Vimeo video URL.',
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
      url: 'vimeoUrl',
      filename: 'video.asset.originalFilename',
    },
    prepare({type, media, url, filename}) {
      return {
        title: type === 'vimeo' ? 'Vimeo Video' : type === 'mp4' ? 'MP4 Video' : 'Image',
        subtitle: type === 'vimeo' ? url : type === 'mp4' ? filename : media?.alt,
        media: type === 'image' ? media : undefined,
      }
    },
  },
})
