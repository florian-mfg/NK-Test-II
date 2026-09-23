import {defineArrayMember, defineField, defineType} from 'sanity'
import {
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
      title: 'Preview images',
      type: 'array',
      description: 'Choose 1–3 images and drag them to set their browsing order.',
      options: {sortable: true},
      validation: (rule) => rule.required().min(1).max(3),
      of: [
        defineArrayMember({
          type: 'image',
          options: {hotspot: true},
          fields: [
            defineField({
              name: 'alt',
              title: 'Alt text',
              type: 'string',
              description: 'Describe the image for screen readers.',
            }),
          ],
          validation: (rule) =>
            rule.required().custom((value) => (value?.asset ? true : 'Upload a preview image.')),
        }),
      ],
    }),
    defineField({
      name: 'initialLayout',
      title: 'Initial preview layout',
      type: 'string',
      initialValue: 'full',
      description:
        'Desktop starting layout. The frontend controls subsequent image cycling and mobile display.',
      options: {
        list: [
          {title: 'Full width', value: 'full'},
          {title: 'Right half', value: 'half'},
        ],
      },
      validation: (rule) =>
        rule
          .required()
          .custom(
            (value) =>
              !value || ['full', 'half'].includes(value) || 'Choose Full width or Right half.',
          ),
    }),
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
        media,
      }
    },
  },
})
