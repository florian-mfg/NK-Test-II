import {defineArrayMember, defineField, defineType} from 'sanity'
import {layouts} from '../objects/projectModules'

export const project = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
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
      description: 'Optional client, brand, or other short information shown beside the project title in the overview.',
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {list: ['Graphic', 'Commissioned', 'Video']},
      description: 'Choose the website section for this project.',
    }),
    defineField({
      name: 'year',
      title: 'Year',
      type: 'number',
      validation: (rule) => rule.integer(),
    }),
    defineField({
      name: 'modules',
      title: 'Modules',
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
