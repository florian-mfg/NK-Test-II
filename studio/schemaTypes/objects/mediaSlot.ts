import {defineField, defineType} from 'sanity'

export const mediaSlot = defineType({
  name: 'mediaSlot',
  title: 'Content Slot',
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
          {title: 'Text', value: 'text'},
        ],
      },
      description: 'Empty preserves this slot’s space. Choose Image, Video, or Text to fill it.',
      validation: (rule) =>
        rule
          .required()
          .custom(
            (value) =>
              !value ||
              ['empty', 'image', 'video', 'text'].includes(value) ||
              'Choose Empty, Image, Video, or Text.',
          ),
    }),
    defineField({
      name: 'text',
      title: 'Text',
      type: 'text',
      rows: 8,
      description: 'Displayed at the top of the slot. Use a blank line between paragraphs.',
      hidden: ({parent}) => parent?.type !== 'text',
      validation: (rule) =>
        rule.custom((value, context) =>
          (context.parent as {type?: string})?.type === 'text' && !value?.trim()
            ? 'Enter text, or choose Empty.'
            : true,
        ),
    }),
    defineField({
      name: 'textSize',
      title: 'Text size',
      type: 'string',
      initialValue: 's',
      options: {
        layout: 'radio',
        list: [
          {title: 'Size S', value: 's'},
          {title: 'Size M', value: 'm'},
          {title: 'Size L', value: 'l'},
        ],
      },
      description: 'S is the original size. M is 1.5× and L is 2.2×. Defaults to S.',
      hidden: ({parent}) => parent?.type !== 'text',
      validation: (rule) =>
        rule.custom((value) =>
          value == null || ['s', 'm', 'l'].includes(value) || 'Choose Size S, M, or L.',
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
      hidden: ({parent}) => !['image', 'video'].includes(parent?.type),
    }),
  ],
  preview: {
    select: {type: 'type', alt: 'alt', image: 'image', poster: 'poster', text: 'text'},
    prepare({type, alt, image, poster, text}) {
      return {
        title: type === 'image' ? 'Image' : type === 'video' ? 'Video' : type === 'text' ? 'Text' : 'Empty',
        subtitle: type === 'empty' ? 'Intentional empty space' : type === 'text' ? text || 'No text' : alt || 'No alt text',
        media: type === 'image' ? image : type === 'video' ? poster : undefined,
      }
    },
  },
})
