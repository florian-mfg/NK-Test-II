import {defineField, defineType} from 'sanity'

export const frontpageMedia = defineType({
  name: 'frontpageMedia', title: 'Media', type: 'object',
  initialValue: {type: 'image', size: 'medium'},
  fields: [
    defineField({name: 'type', title: 'Media type', type: 'string', initialValue: 'image',
      options: {list: [{title: 'Image', value: 'image'}, {title: 'MP4', value: 'mp4'}]},
      validation: rule => rule.required().custom((value, context) => {
        const parent = context.parent as {image?: {asset?: unknown}; video?: {asset?: {_ref?: string}}}
        if (value === 'image' && !parent?.image?.asset) return 'Upload an image.'
        if (value === 'mp4' && !/^file-[a-zA-Z0-9]+-mp4$/.test(parent?.video?.asset?._ref || '')) return 'Upload an MP4 video.'
        return true
      })}),
    defineField({name: 'image', title: 'Image upload', type: 'image', options: {hotspot: true},
      hidden: ({parent}) => parent?.type !== 'image',
      validation: rule => rule.custom((value, context) =>
        (context.parent as {type?: string})?.type === 'image' && !value?.asset ? 'Upload an image.' : true).error()}),
    defineField({name: 'video', title: 'MP4 upload', type: 'file', options: {accept: 'video/mp4'},
      hidden: ({parent}) => parent?.type !== 'mp4',
      validation: rule => rule.custom((value, context) =>
        (context.parent as {type?: string})?.type !== 'mp4' || /^file-[a-zA-Z0-9]+-mp4$/.test(value?.asset?._ref || '')
          ? true : 'Upload an MP4 video.').error()}),
    defineField({name: 'size', title: 'Size', type: 'string', initialValue: 'medium',
      options: {list: [{title: 'Small', value: 'small'}, {title: 'Medium', value: 'medium'}, {title: 'Large', value: 'large'}]},
      validation: rule => rule.required()}),
    defineField({name: 'poster', title: 'Video preview image', type: 'image', options: {hotspot: true},
      description: 'Recommended for a stable video layout and a fallback when autoplay is unavailable.',
      hidden: ({parent}) => parent?.type !== 'mp4'}),
  ],
  preview: {
    select: {type: 'type', size: 'size', image: 'image', poster: 'poster', filename: 'video.asset.originalFilename'},
    prepare({type, size, image, poster, filename}) {
      return {title: type === 'mp4' ? filename || 'MP4' : 'Image',
        subtitle: ({small: 'Small', medium: 'Medium', large: 'Large'} as Record<string, string>)[size || 'medium'],
        media: type === 'mp4' ? poster : image}
    },
  },
})
