import {defineArrayMember, defineField, defineType} from 'sanity'
import {projectModules} from '../objects/projectModules'
import {ProjectCategoriesInput, projectCategories} from '../../components/ProjectCategoriesInput'
import {categories, categoryLabel, textColorField} from '../shared/content'
import {indexMedia} from '../objects/indexMedia'

export const project = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  initialValue: {detailPageEnabled: true},
  fields: [
    textColorField(),
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
    defineField({name: 'category', type: 'string', hidden: true}),
    defineField({
      name: 'categories',
      title: 'Categories',
      description: 'Select one or more categories for this project.',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      options: {list: categories.map(value => ({title: categoryLabel(value), value}))},
      components: {input: ProjectCategoriesInput},
      validation: (rule) => rule.unique().custom((value, context) => {
        if (value == null) return projectCategories(context.document).length > 0 || 'Select at least one category.'
        return (value.length > 0 && value.every(item => typeof item === 'string' &&
          categories.some(name => name.toLowerCase() === item.toLowerCase()))) || 'Select one or more listed categories.'
      }),
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
      description: 'Optional independent preview for Selected Work. Add compositions and optional Spacers in display order. Leave unset to use the existing detail-media fallback.',
    }),
    defineField({
      name: 'modules',
      title: 'Project Modules',
      type: 'array',
      description: 'Add layouts and drag them into the order you want them to appear.',
      options: {sortable: true},
      of: projectModules.map(({name}) => defineArrayMember({type: name})),
    }),
    defineField({
      name: 'indexmaterial',
      title: 'Indexmaterial',
      type: 'object',
      description: 'Optional media for the Index. Title, year and additional info come from this Project. Publishing media makes it eligible for Index without changing Selected Work.',
      options: {collapsible: true, collapsed: false},
      fields: [
        defineField({
          name: 'media', title: 'Index media', type: 'array',
          description: 'Upload up to 3 images or MP4s and drag to set their cycling order. Leave empty to omit this Project from Index. Arrange Project references under Content → Index; unlisted Projects follow in document-ID order.',
          options: {sortable: true},
          of: [indexMedia],
          validation: rule => rule.max(3),
        }),
        {...textColorField(), description: 'Index text color only. Auto is the default; the Project detail text color remains independent.'},
      ],
    }),
  ],
  preview: {
    select: {title: 'title', category: 'category', categories: 'categories', year: 'year'},
    prepare({title, category, categories, year}) {
      return {
        title: title || 'Untitled project',
        subtitle: [projectCategories({category, categories}).map(categoryLabel).join(', '), year].filter(Boolean).join(' — '),
      }
    },
  },
})
