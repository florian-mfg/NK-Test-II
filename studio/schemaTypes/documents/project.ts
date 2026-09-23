import {defineArrayMember, defineField, defineType} from 'sanity'
import {layouts} from '../objects/projectModules'
import {categories} from '../shared/content'

export const project = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  initialValue: {detailPageEnabled: true},
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'additionalInfo',
      title: 'Additional info',
      type: 'string',
      description:
        'Optional client, brand, or other short information shown beside the project title in the overview.',
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title'},
      description:
        'Stable URL identifier. Generate once; changing the title does not change the slug. Changing an existing slug later breaks its old link.',
      validation: (rule) =>
        rule
          .required()
          .custom((value) =>
            !value?.current || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.current)
              ? true
              : 'Use lowercase letters, numbers, and single hyphens only.',
          ),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {list: [...categories]},
      description: 'Choose the website section for this project.',
      validation: (rule) =>
        rule
          .required()
          .custom(
            (value) =>
              !value ||
              categories.some((category) => category === value) ||
              'Choose Video, Commissioned, or Graphic.',
          ),
    }),
    defineField({
      name: 'year',
      title: 'Year',
      type: 'number',
      validation: (rule) => rule.integer(),
    }),
    defineField({
      name: 'description',
      title: 'Project Info / Description',
      type: 'text',
      rows: 8,
      description: 'Text for the project Info popup. Separate paragraphs with a blank line.',
    }),
    defineField({
      name: 'detailPageEnabled',
      title: 'Detail Page Enabled',
      type: 'boolean',
      description:
        'Enable a full project detail page. Older projects with this field unset should be treated as enabled by the future frontend adapter.',
    }),
    defineField({
      name: 'selectedWorkPreview',
      title: 'Selected Work Preview',
      type: 'selectedWorkPreview',
      description: 'Optional independent preview for Selected Work. Choose one composition and fill its Image, Vimeo Video or Empty slots. Leave unset to use the existing detail-media fallback.',
    }),
    defineField({
      name: 'modules',
      title: 'Project Modules',
      type: 'array',
      description: 'Add layouts and drag them into the order you want them to appear.',
      options: {sortable: true},
      of: layouts.map(({name}) => defineArrayMember({type: name})),
    }),
  ],
  preview: {
    select: {title: 'title', category: 'category', year: 'year'},
    prepare({title, category, year}) {
      return {
        title: title || 'Untitled project',
        subtitle: [category, year].filter(Boolean).join(' — '),
      }
    },
  },
})
