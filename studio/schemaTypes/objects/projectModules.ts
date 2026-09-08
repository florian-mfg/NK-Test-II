import {defineArrayMember, defineField, defineType} from 'sanity'

export const heights = ['auto', 'small', 'medium', 'large', 'viewport']
export const layouts = [
  {name: 'full', title: 'Full Width', widths: ['1/1']},
  {name: 'half-half', title: 'Half + Half', widths: ['1/2', '1/2']},
  {name: 'half-quarter-quarter', title: 'Half + Quarter + Quarter', widths: ['1/2', '1/4', '1/4']},
  {
    name: 'quarter-quarter-quarter-quarter',
    title: 'Four Quarters',
    widths: ['1/4', '1/4', '1/4', '1/4'],
  },
  {name: 'third-third-third', title: 'Three Thirds', widths: ['1/3', '1/3', '1/3']},
  {name: 'two-thirds-one-third', title: 'Two Thirds + One Third', widths: ['2/3', '1/3']},
]

export const projectModules = layouts.map(({name, title, widths}) => {
  const arrangements =
    name === 'half-quarter-quarter'
      ? [
          {title: '1/2 | 1/4 | 1/4', value: 'default'},
          {title: '1/4 | 1/2 | 1/4', value: 'middle'},
          {title: '1/4 | 1/4 | 1/2', value: 'reverse'},
        ]
      : name === 'two-thirds-one-third'
        ? [
            {title: '2/3 | 1/3', value: 'default'},
            {title: '1/3 | 2/3', value: 'reverse'},
          ]
        : [
            {title: 'Default', value: 'default'},
            {title: 'Reverse slot order', value: 'reverse'},
          ]

  return defineType({
    name,
    title,
    type: 'object',
    initialValue: {
      type: name,
      height: 'auto',
      order: 'default',
      slots: widths.map((_, index) => ({
        _type: 'mediaSlot',
        _key: `slot-${index + 1}`,
        type: 'empty',
      })),
    },
    fields: [
      defineField({
        name: 'type',
        title: 'Layout',
        type: 'string',
        readOnly: true,
        options: {list: [{title, value: name}]},
        validation: (rule) =>
          rule.required().custom((value) => value === name || 'Layout must match the module type.'),
      }),
      defineField({
        name: 'height',
        title: 'Height',
        type: 'string',
        options: {
          list: heights.map((value) => ({title: value[0].toUpperCase() + value.slice(1), value})),
        },
        validation: (rule) =>
          rule
            .required()
            .custom((value) => !value || heights.includes(value) || 'Choose a listed height.'),
      }),
      defineField({
        name: 'order',
        title: 'Arrangement',
        type: 'string',
        hidden: widths.length === 1,
        options: {layout: 'radio', list: arrangements},
        description: 'Each slot moves together with its media and width.',
        validation: (rule) =>
          rule
            .required()
            .custom(
              (value) =>
                !value ||
                arrangements.some((option) => option.value === value) ||
                'Choose a listed arrangement.',
            ),
      }),
      defineField({
        name: 'slots',
        title: 'Media slots',
        type: 'array',
        description: `Slots in default order: ${widths.map((width, index) => `${index + 1} = ${width}`).join(', ')}. Open a slot to choose its content. Arrangement moves these slots; Empty keeps its width.`,
        of: [defineArrayMember({type: 'mediaSlot'})],
        options: {
          sortable: false,
          disableActions: ['add', 'addBefore', 'addAfter', 'remove', 'duplicate', 'copy'],
        },
        validation: (rule) => rule.required().length(widths.length),
      }),
    ],
    preview: {
      select: {height: 'height', order: 'order', slots: 'slots'},
      prepare({height = 'auto', order, slots = []}) {
        const firstImage = slots.find(
          (slot: {type?: string; image?: {asset?: unknown}}) =>
            slot.type === 'image' && slot.image?.asset,
        )
        return {
          title: `${title} — ${height[0].toUpperCase()}${height.slice(1)}`,
          subtitle: arrangements.find(({value}) => value === order)?.title,
          media: firstImage?.image,
        }
      },
    },
  })
})
