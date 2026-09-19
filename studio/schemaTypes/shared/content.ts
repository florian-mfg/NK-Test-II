import {defineArrayMember, defineField} from 'sanity'

// Stored project values remain compatible with the original schema.
export const categories = ['Video', 'Commissioned', 'Graphic'] as const
export const contactDestinations = [
  {title: 'Email (from Site Settings)', value: 'email'},
  {title: 'Instagram (from Site Settings)', value: 'instagram'},
  {title: 'Telephone (from Site Settings)', value: 'phone'},
]
export const pageDestinations = [
  {title: 'Frontpage', value: 'home'},
  {title: 'Selected Work', value: 'work'},
  {title: 'Index', value: 'archive'},
  {title: 'Info', value: 'info'},
]
export const categoryDestinations = categories.map((category) => ({
  title: category,
  value: `work/${category.toLowerCase()}`,
}))
export const footerDestinations = [
  ...contactDestinations,
  {title: 'Imprint', value: 'imprint'},
  {title: 'Privacy Policy', value: 'privacy-policy'},
]

export const orderedStrings = (name: string, title: string, description: string) =>
  defineField({
    name,
    title,
    description,
    type: 'array',
    options: {sortable: true},
    of: [
      defineArrayMember({
        type: 'string',
        validation: (rule) =>
          rule
            .required()
            .custom((value) => !value || Boolean(value.trim()) || 'Enter text rather than spaces.'),
      }),
    ],
  })
