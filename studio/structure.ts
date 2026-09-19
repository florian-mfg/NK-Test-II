import type {StructureBuilder, StructureResolver} from 'sanity/structure'

export const singletonTypes = new Set([
  'homePage',
  'selectedWork',
  'indexPage',
  'infoPage',
  'navigation',
  'siteSettings',
  'legalPage',
])
export const singletonActions = new Set(['publish', 'discardChanges', 'restore', 'unpublish'])

function page(S: StructureBuilder, type: string, title: string, id = type) {
  let document = S.document().schemaType(type).documentId(id).title(title)
  if (type === 'legalPage') document = document.initialValueTemplate(id)
  return S.listItem().id(id).title(title).child(document)
}

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Nicolas Kawohl')
    .items([
      S.listItem()
        .id('content')
        .title('Content')
        .child(
          S.list()
            .title('Content')
            .items([
              page(S, 'homePage', 'Frontpage'),
              page(S, 'selectedWork', 'Selected Work'),
              S.documentTypeListItem('project').title('Projects'),
              page(S, 'indexPage', 'Index'),
              page(S, 'infoPage', 'Info'),
            ]),
        ),
      S.divider(),
      S.listItem()
        .id('settings')
        .title('Settings')
        .child(
          S.list()
            .title('Settings')
            .items([
              page(S, 'navigation', 'Navigation'),
              page(S, 'siteSettings', 'Site Settings'),
              S.listItem()
                .id('legal')
                .title('Legal')
                .child(
                  S.list()
                    .title('Legal')
                    .items([
                      page(S, 'legalPage', 'Imprint', 'legal-imprint'),
                      page(S, 'legalPage', 'Privacy Policy', 'legal-privacy-policy'),
                    ]),
                ),
            ]),
        ),
    ])
