import {defineField, defineType} from 'sanity'
export const mediaSlot = defineType({
  name: 'mediaSlot',
  title: 'Content Slot',
  type: 'object',
  initialValue: {type: 'empty', mediaDisplay: 'crop'},
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
          {title: 'MP4 Video', value: 'mp4'},
          {title: 'Text', value: 'text'},
        ],
      },
      description: 'Empty preserves this slot’s space. Choose Image, MP4 Video, or Text to fill it.',
      // Sanity adds an enum error from options.list. Reset that inferred rule
      // so stored unsupported values warn without becoming selectable.
      validation: (rule) => {
        const compatible = (rule as typeof rule & {reset(): typeof rule}).reset()
        return [
          compatible.required(),
          compatible.custom(value => !value || ['empty', 'image', 'mp4', 'text'].includes(value)
            ? true : 'Unsupported stored media is omitted from the website. Choose supported media to replace it.').warning(),
        ]
      },
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
      name: 'mediaDisplay',
      title: 'Media Display',
      type: 'string',
      initialValue: 'crop',
      description: "Crop fills the module's predefined dimensions. Auto Height displays the entire image or video at its original aspect ratio.",
      options: {layout: 'radio', list: [
        {title: 'Crop', value: 'crop'},
        {title: 'Auto Height', value: 'auto'},
      ]},
      hidden: ({parent}) => !['image', 'mp4'].includes(parent?.type),
      validation: (rule) => rule.custom(value =>
        value == null || ['crop', 'auto'].includes(value) || 'Choose Crop or Auto Height.'),
    }),
    defineField({
      name: 'playback',
      title: 'Playback',
      type: 'string',
      description: 'Leave unset to use Autoplay in Selected Work and Manual on detail pages. Autoplay is muted and loops; Manual shows the Play/Pause button.',
      options: {list: [
        {title: 'Autoplay', value: 'autoplay'},
        {title: 'Manual', value: 'manual'},
      ]},
      hidden: ({parent}) => !['mp4'].includes(parent?.type),
      validation: (rule) => rule.custom((value) =>
        !value || ['autoplay', 'manual'].includes(value) || 'Choose Autoplay or Manual.'),
    }),
    defineField({
      name: 'video',
      title: 'MP4 upload',
      type: 'file',
      options: {accept: 'video/mp4'},
      hidden: ({parent}) => parent?.type !== 'mp4',
      validation: (rule) =>
        rule.custom((value, context) =>
          (context.parent as {type?: string})?.type !== 'mp4' ||
          /^file-[a-zA-Z0-9]+-mp4$/.test(value?.asset?._ref || '')
            ? true : 'Upload an MP4 video.',
        ),
    }),
    defineField({
      name: 'poster',
      title: 'Video preview image',
      type: 'image',
      options: {hotspot: true},
      hidden: ({parent}) => !['mp4'].includes(parent?.type),
    }),
    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      description: 'Describe the image or video for people using screen readers.',
      hidden: ({parent}) => !['image', 'mp4'].includes(parent?.type),
    }),
  ],
  preview: {
    select: {type: 'type', alt: 'alt', image: 'image', poster: 'poster', text: 'text'},
    prepare({type, alt, image, poster, text}) {
      return {
        title: type === 'image' ? 'Image' : type === 'mp4' ? 'MP4 Video' : type && !['empty', 'image', 'mp4', 'text'].includes(type) ? 'Unsupported stored media' : type === 'text' ? 'Text' : 'Empty',
        subtitle: type === 'empty' ? 'Intentional empty space' : type === 'text' ? text || 'No text' : alt || 'No alt text',
        media: type === 'image' ? image : ['mp4'].includes(type) ? poster : undefined,
      }
    },
  },
})
