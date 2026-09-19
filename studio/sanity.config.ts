import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {structure, singletonActions, singletonTypes} from './structure'

export default defineConfig({
  name: 'default',
  title: 'Nicolas Kawohl',

  projectId: 'ck6xe2er',
  dataset: 'production',

  plugins: [structureTool({structure}), visionTool()],

  schema: {
    types: schemaTypes,
    templates: (templates) => [
      ...templates.filter(({schemaType}) => !singletonTypes.has(schemaType)),
      {
        id: 'legal-imprint',
        title: 'Imprint',
        schemaType: 'legalPage',
        value: {pageType: 'imprint'},
      },
      {
        id: 'legal-privacy-policy',
        title: 'Privacy Policy',
        schemaType: 'legalPage',
        value: {pageType: 'privacy-policy'},
      },
    ],
  },
  document: {
    newDocumentOptions: (options) =>
      options.filter(
        ({templateId}) => !singletonTypes.has(templateId) && !templateId.startsWith('legal-'),
      ),
    actions: (actions, context) =>
      singletonTypes.has(context.schemaType)
        ? actions.filter(({action}) => action && singletonActions.has(action))
        : actions,
  },
})
