import {legacyIndexImage, indexMedia} from './indexMedia'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {
  textColorField,
  categoryDestinations,
  contactDestinations,
  footerDestinations,
  pageDestinations,
} from '../shared/content'

export const richText = defineType({
  name: 'richText',
  title: 'Formatted text',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        {title: 'Paragraph', value: 'normal'},
        {title: 'Heading', value: 'h2'},
      ],
      lists: [
        {title: 'Bullet list', value: 'bullet'},
        {title: 'Numbered list', value: 'number'},
      ],
      marks: {
        decorators: [
          {title: 'Bold', value: 'strong'},
          {title: 'Italic', value: 'em'},
        ],
        annotations: [
          {
            name: 'link',
            title: 'Link',
            type: 'object',
            fields: [
              defineField({
                name: 'href',
                title: 'Destination',
                type: 'url',
                validation: (rule) =>
                  rule.required().uri({scheme: ['http', 'https', 'mailto', 'tel']}),
              }),
            ],
          },
        ],
      },
    }),
  ],
})

export const cvEntry = defineType({
  name: 'cvEntry',
  title: 'CV entry',
  type: 'object',
  fields: [
    defineField({
      name: 'period',
      title: 'Year / time period',
      type: 'string',
      description: 'For example: 2022–2025 or 2025–present.',
    }),
    defineField({
      name: 'text',
      title: 'Description',
      type: 'text',
      rows: 2,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {select: {title: 'text', subtitle: 'period'}},
})

const linkTypes = [
  {name: 'contactLink', title: 'Shared contact link', destinations: contactDestinations},
  {name: 'footerLink', title: 'Footer link', destinations: footerDestinations},
  {name: 'navigationItem', title: 'Navigation item', destinations: pageDestinations},
  {name: 'categoryLink', title: 'Category link', destinations: categoryDestinations},
]
export const editorialLinks = linkTypes.map(({name, title, destinations}) =>
  defineType({
    name,
    title,
    type: 'object',
    fields: [
      defineField({
        name: 'label',
        title: 'Display label',
        type: 'string',
        validation: (rule) => rule.required(),
      }),
      defineField({
        name: 'destination',
        title: 'Destination',
        type: 'string',
        description:
          'Labels can change; this identifier determines the destination. Contact addresses are edited only in Site Settings.',
        options: {list: destinations},
        validation: (rule) =>
          rule
            .required()
            .custom(
              (value) =>
                !value ||
                destinations.some((item) => item.value === value) ||
                'Choose a listed destination.',
            ),
      }),
    ],
    preview: {
      select: {title: 'label', destination: 'destination'},
      prepare({title: label, destination}) {
        return {
          title: label || title,
          subtitle: destinations.find((item) => item.value === destination)?.title,
        }
      },
    },
  }),
)

export const indexEntry = defineType({
  name: 'indexEntry',
  title: 'Index entry',
  type: 'object',
  fields: [
    textColorField(),
    defineField({
      name: 'displayTitle',
      title: 'Display title',
      type: 'string',
      description: 'The title shown in the Index.',
      validation: (rule) =>
        rule.required().custom((value) => (value?.trim() ? true : 'Enter a display title.')),
    }),
    defineField({
      name: 'year',
      title: 'Year',
      type: 'number',
      validation: (rule) => rule.integer(),
    }),
    defineField({
      name: 'additionalInfo',
      title: 'Additional information',
      type: 'string',
      description: 'Optional client, brand, or other information shown beside the title.',
    }),
    defineField({
      name: 'previewImages',
      title: 'Preview media',
      type: 'array',
      description: 'Choose 1–3 images or videos and drag them to set their browsing order. Use Media item for the Image / Vimeo / MP4 selector; existing images remain editable.',
      options: {sortable: true},
      validation: (rule) => rule.required().min(1).max(3),
      of: [
        legacyIndexImage,
        indexMedia,
      ],
    }),
    // Retain the stored legacy value for compatibility, but remove it from editing.
    defineField({name: 'initialLayout', type: 'string', hidden: true}),
  ],
  preview: {
    select: {
      title: 'displayTitle',
      year: 'year',
      media: 'previewImages.0',
    },
    prepare({title, year, media}) {
      return {
        title: title || 'Untitled Index entry',
        subtitle: String(year ?? 'Independent Index entry'),
        media: media?.mediaType === 'image' ? media.image : media?.mediaType ? undefined : media,
      }
    },
  },
})
