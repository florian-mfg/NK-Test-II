import {defineField, defineType} from 'sanity'

export const mediaSlot = defineType({
  name: 'mediaSlot',
  title: 'Media Slot',
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
          {title: 'Video', value: 'video'},
        ],
      },
      description: 'Empty preserves this slot’s space. Choose Image or Video to upload media.',
      validation: (rule) =>
        rule
          .required()
          .custom(
            (value) =>
              !value ||
              ['empty', 'image', 'video'].includes(value) ||
              'Choose Empty, Image, or Video.',
          ),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
      hidden: ({parent}) => parent?.type !== 'image',
      validation: (rule) =>
        rule.custom((value, context) =>
          (context.parent as {type?: string})?.type === 'image' && !value?.asset
            ? 'Upload an image, or choose Empty.'
            : true,
        ),
    }),
    defineField({
      name: 'video',
      title: 'Video',
      type: 'file',
      options: {accept: 'video/mp4,video/webm'},
      description: 'Upload a browser-playable MP4 or WebM file. Plays with controls; no autoplay.',
      hidden: ({parent}) => parent?.type !== 'video',
      validation: (rule) =>
        rule.custom((value, context) =>
          (context.parent as {type?: string})?.type === 'video' && !value?.asset
            ? 'Upload a video, or choose Empty.'
            : true,
        ),
    }),
    defineField({
      name: 'poster',
      title: 'Video preview image',
      type: 'image',
      options: {hotspot: true},
      hidden: ({parent}) => parent?.type !== 'video',
    }),
    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      description: 'Describe the image or video for people using screen readers.',
      hidden: ({parent}) => !parent?.type || parent.type === 'empty',
    }),
  ],
  preview: {
    select: {type: 'type', alt: 'alt', image: 'image', poster: 'poster'},
    prepare({type, alt, image, poster}) {
      return {
        title: type === 'image' ? 'Image' : type === 'video' ? 'Video' : 'Empty',
        subtitle: type === 'empty' ? 'Intentional empty space' : alt || 'No alt text',
        media: type === 'image' ? image : type === 'video' ? poster : undefined,
      }
    },
  },
})
