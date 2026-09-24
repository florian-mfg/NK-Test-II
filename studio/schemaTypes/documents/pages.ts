import {defineArrayMember, defineField, defineType} from 'sanity'
import {projectCategories} from '../../components/ProjectCategoriesInput'
import {InfoSectionContentField} from '../../components/InfoSectionContentField'
import {categories, orderedStrings, textColorField} from '../shared/content'

const singletonPreview = (title: string) => ({prepare: () => ({title})})

export const homePage = defineType({
  name: 'homePage',
  title: 'Frontpage',
  type: 'document',
  fields: [
    textColorField(),
    defineField({
      name: 'backgroundVideoUrl',
      title: 'Background video source',
      type: 'url',
      description:
        'A Vimeo video URL (including an unlisted privacy hash when needed), or a direct MP4/WebM URL. Enter a URL, not iframe HTML.',
      validation: (rule) => rule.required().uri({scheme: ['https']}),
    }),
    defineField({
      name: 'videoTitle',
      title: 'Accessible video title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'poster',
      title: 'Fallback / poster image',
      type: 'image',
      options: {hotspot: true},
      fields: [defineField({name: 'alt', title: 'Alt text', type: 'string'})],
    }),
  ],
  preview: singletonPreview('Frontpage'),
})

export const selectedWork = defineType({
  name: 'selectedWork',
  title: 'Selected Work',
  type: 'document',
  fields: categories.map((category) =>
    defineField({
      name: category.toLowerCase(),
      title: category,
      type: 'array',
      description: `Choose ${category} projects and drag to reorder. Edit project content under Projects.`,
      options: {sortable: true},
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'project'}],
          options: {disableNew: true, filter: '($category in categories || $lower in categories) || (!defined(categories) && (category == $category || category == $lower))', filterParams: {category, lower: category.toLowerCase()}},
          validation: (rule) =>
            rule.custom(async (value, context) => {
              if (!value?._ref) return true
              const id = value._ref.replace(/^drafts\./, '')
              const client = context.getClient({apiVersion: '2025-02-19'})
              const documents = await client.fetch<Array<{_id: string; category?: string; categories?: string[]}>>(
                '*[_id in $ids]{_id, category, categories}',
                {ids: [id, `drafts.${id}`]},
                {perspective: 'raw'},
              )
              const project = documents.find((item) => item._id === `drafts.${id}`) || documents[0]
              return (
                !project ||
                projectCategories(project).includes(category) ||
                `This project belongs to ${projectCategories(project).join(', ') || 'no category'}. Choose a ${category} project.`
              )
            }),
        }),
      ],
      validation: (rule) => rule.unique(),
    }),
  ),
  preview: singletonPreview('Selected Work'),
})

export const indexPage = defineType({
  name: 'indexPage',
  title: 'Index',
  type: 'document',
  fields: [
    defineField({
      name: 'entries',
      title: 'Index entries',
      type: 'array',
      options: {sortable: true},
      description: 'An independent image browsing list. Drag entries to reorder.',
      of: [defineArrayMember({type: 'indexEntry'})],
    }),
  ],
  preview: singletonPreview('Index'),
})

export const infoPage = defineType({
  name: 'infoPage',
  title: 'Info',
  type: 'document',
  // Fieldsets group existing sibling fields without changing stored paths.
  fieldsets: ['cv', 'work', 'skills', 'contactLinks', 'selectedClients'].map((name) => ({
    name,
    // Sanity substitutes the fieldset name for an empty title; a space keeps it unlabelled.
    title: ' ',
    options: {collapsible: false},
  })),
  fields: [
    defineField({name: 'introduction', title: 'Introduction / biography', type: 'text', rows: 4}),
    defineField({
      name: 'cvLabel',
      title: 'Section name',
      fieldset: 'cv',
      type: 'string',
      initialValue: 'CV',
      description: 'Heading shown on the Info page. Leave blank to use “CV”.',
    }),
    defineField({
      name: 'cv',
      title: 'CV',
      type: 'array',
      options: {sortable: true},
      of: [defineArrayMember({type: 'cvEntry'})],
    }),
    defineField({
      name: 'workLabel',
      title: 'Section name',
      fieldset: 'work',
      type: 'string',
      initialValue: 'Work',
      description: 'Heading shown on the Info page. Leave blank to use “Work”.',
    }),
    orderedStrings('work', 'Work', 'One entry per item. Drag to reorder.'),
    defineField({
      name: 'skillsLabel',
      title: 'Section name',
      fieldset: 'skills',
      type: 'string',
      initialValue: 'Skills',
      description: 'Heading shown on the Info page. Leave blank to use “Skills”.',
    }),
    orderedStrings('skills', 'Skills', 'One skill per item. Drag to reorder.'),
    defineField({
      name: 'contactLabel',
      title: 'Section name',
      fieldset: 'contactLinks',
      type: 'string',
      initialValue: 'Contact',
      description: 'Heading shown on the Info page. Leave blank to use “Contact”.',
    }),
    defineField({
      name: 'contactLinks',
      title: 'Contact',
      type: 'array',
      options: {sortable: true},
      description: 'Choose shared contact destinations. Edit their addresses in Site Settings.',
      of: [defineArrayMember({type: 'contactLink'})],
    }),
    defineField({
      name: 'selectedClientsLabel',
      title: 'Section name',
      fieldset: 'selectedClients',
      type: 'string',
      initialValue: 'Selected Clients',
      description: 'Heading shown on the Info page. Leave blank to use “Selected Clients”.',
    }),
    orderedStrings(
      'selectedClients',
      'Selected Clients',
      'One client name per item. Drag to reorder.',
    ),
  ].map((field) =>
    ['cv', 'work', 'skills', 'contactLinks', 'selectedClients'].includes(field.name)
      ? {...field, fieldset: field.name, components: {field: InfoSectionContentField}}
      : field,
  ),
  preview: singletonPreview('Info'),
})

export const navigation = defineType({
  name: 'navigation',
  title: 'Navigation',
  type: 'document',
  fields: [
    defineField({
      name: 'homeLabel',
      title: 'Home link label override',
      type: 'string',
      description:
        'Normally leave blank to use the site/brand name from Site Settings. Destination is always the frontpage.',
    }),
    defineField({
      name: 'items',
      title: 'Main menu',
      type: 'array',
      options: {sortable: true},
      description: 'Shared by desktop and mobile. Selected Work displays the category links below.',
      of: [defineArrayMember({type: 'navigationItem'})],
      validation: (rule) =>
        rule.custom((items) => {
          const destinations = (items || [])
            .map((item) => (item as {destination?: string}).destination)
            .filter(Boolean)
          return (
            new Set(destinations).size === destinations.length || 'Use each destination only once.'
          )
        }),
    }),
    defineField({
      name: 'categories',
      title: 'Selected Work category links',
      type: 'array',
      options: {sortable: true},
      description: 'Drag to reorder. Labels may change, but keep all three category destinations.',
      of: [defineArrayMember({type: 'categoryLink'})],
      validation: (rule) =>
        rule
          .required()
          .length(3)
          .custom((items) => {
            if (!items) return true
            const destinations = items.map((item) => (item as {destination?: string}).destination)
            return (
              categories.every((category) =>
                destinations.includes(`work/${category.toLowerCase()}`),
              ) || 'Include Video, Commissioned, and Graphic once each.'
            )
          }),
    }),
    defineField({
      name: 'mobileContact',
      title: 'Mobile menu contact link',
      type: 'contactLink',
      description:
        'The contact link at the bottom of the mobile menu; its destination comes from Site Settings.',
    }),
  ],
  initialValue: {
    items: [
      {_key: 'work', _type: 'navigationItem', label: 'Selected Work', destination: 'work'},
      {_key: 'index', _type: 'navigationItem', label: 'Index', destination: 'archive'},
      {_key: 'info', _type: 'navigationItem', label: 'Info', destination: 'info'},
    ],
    categories: ['Commissioned', 'Graphic', 'Video'].map((label) => ({
      _key: label.toLowerCase(),
      _type: 'categoryLink',
      label,
      destination: `work/${label.toLowerCase()}`,
    })),
    mobileContact: {_type: 'contactLink', label: 'Mail', destination: 'email'},
  },
  preview: singletonPreview('Navigation'),
})

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
    defineField({
      name: 'brandName',
      title: 'Site / brand name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      validation: (rule) => rule.email(),
    }),
    defineField({
      name: 'instagram',
      title: 'Instagram URL',
      type: 'url',
      validation: (rule) => rule.uri({scheme: ['https']}),
    }),
    defineField({
      name: 'phone',
      title: 'Telephone (optional)',
      type: 'string',
      description: 'Use an international number, for example +49….',
    }),
    defineField({
      name: 'defaultPageTitle',
      title: 'Default browser / page title',
      type: 'string',
      description: 'If blank, use the site / brand name.',
    }),
    defineField({
      name: 'defaultDescription',
      title: 'Default page description',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'socialImage',
      title: 'Default social sharing image',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({
      name: 'footerLinks',
      title: 'Footer links',
      type: 'array',
      options: {sortable: true},
      of: [defineArrayMember({type: 'footerLink'})],
      description: 'Ordered labels and shared destinations; no duplicate contact addresses.',
    }),
  ],
  preview: singletonPreview('Site Settings'),
})

export const legalPage = defineType({
  name: 'legalPage',
  title: 'Legal page',
  type: 'document',
  fields: [
    defineField({
      name: 'pageType',
      title: 'Page',
      type: 'string',
      readOnly: true,
      options: {
        list: [
          {title: 'Imprint', value: 'imprint'},
          {title: 'Privacy Policy', value: 'privacy-policy'},
        ],
      },
      validation: (rule) =>
        rule.required().custom((value, context) => {
          const id = context.document?._id?.replace(/^drafts\./, '')
          return (
            (id === 'legal-imprint' && value === 'imprint') ||
            (id === 'legal-privacy-policy' && value === 'privacy-policy') ||
            'Open the intended legal page from Settings → Legal.'
          )
        }),
    }),
    defineField({
      name: 'title',
      title: 'Display title',
      type: 'string',
      description: 'Optional heading override. The page destination does not change.',
    }),
    defineField({
      name: 'body',
      title: 'Legal text',
      type: 'richText',
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: {title: 'title', pageType: 'pageType'},
    prepare({title, pageType}) {
      return {title: title || (pageType === 'imprint' ? 'Imprint' : 'Privacy Policy')}
    },
  },
})

export const pageDocuments = [
  homePage,
  selectedWork,
  indexPage,
  infoPage,
  navigation,
  siteSettings,
  legalPage,
]
