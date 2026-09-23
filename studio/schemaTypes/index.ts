import {project} from './documents/project'
import {mediaSlot} from './objects/mediaSlot'
import {
  selectedWorkPreview,
  previewMediaSlot,
  previewCompositions,
} from './objects/selectedWorkPreview'
import {projectModules} from './objects/projectModules'
import {pageDocuments} from './documents/pages'
import {richText, cvEntry, editorialLinks, indexEntry} from './objects/editorial'

export const schemaTypes = [
  project,
  mediaSlot,
  selectedWorkPreview,
  previewMediaSlot,
  ...previewCompositions,
  ...projectModules,
  ...pageDocuments,
  richText,
  cvEntry,
  ...editorialLinks,
  indexEntry,
]
