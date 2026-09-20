import {defineField, defineType} from 'sanity'
import '../../../vimeo-media.js'

// This shared classic-script helper exposes a global, not an ESM default export.
const vimeoMedia = (globalThis as typeof globalThis & {
  VimeoMedia: typeof import('../../../vimeo-media.js')
}).VimeoMedia

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
            ? 'Upload an image, or choose another media type.'
            : true,
        ),
    }),
    defineField({
      name: 'vimeoUrl',
      title: 'Vimeo URL',
      type: 'url',
      description: 'Paste an HTTPS vimeo.com or player.vimeo.com video URL, including its privacy hash for unlisted videos. No file upload needed.',
      hidden: ({parent}) => parent?.type !== 'video',
      validation: (rule) => rule.custom((value, context) =>
        (context.parent as {type?: string})?.type !== 'video' || vimeoMedia.parseVimeoUrl(value)
          ? true : 'Paste a valid HTTPS Vimeo video URL, or choose another media type.',
      ),
    }),
    defineField({
      name: 'video',
      title: 'Legacy uploaded video (migration only)',
      type: 'file',
      readOnly: true,
      description: 'Preserved existing upload. Paste its replacement Vimeo URL above; this file is no longer used for project playback. No data is deleted automatically.',
      hidden: ({value}) => !value?.asset,
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
