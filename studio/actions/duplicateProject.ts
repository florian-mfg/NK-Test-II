import type {SanityDocumentLike} from 'sanity'

export type ProjectIdentity = {title?: string; slug?: {current?: string}}

export function duplicateProjectIdentity(title: unknown, existing: ProjectIdentity[]) {
  const original = typeof title === 'string' && title.trim() ? title.trim() : 'Untitled project'
  const suffix = original.match(/^(.*)-(\d+)$/)
  const base = suffix && Number(suffix[2]) >= 2 && existing.some(item => item.title === suffix[1])
    ? suffix[1] : original
  const titles = new Set(existing.map(item => item.title))
  const slugs = new Set(existing.map(item => item.slug?.current))
  const slugBase = base.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '') || 'project'
  let number = 2
  while (titles.has(`${base}-${number}`) || slugs.has(`${slugBase}-${number}`)) number++
  return {title: `${base}-${number}`, slug: {_type: 'slug', current: `${slugBase}-${number}`}}
}

// Sanity supplies the NEW draft ID before invoking mapDocument. Never invent or
// reuse the source ID here. Keep every editable field and nested key/reference.
export function mapProjectDuplicate(document: SanityDocumentLike, existing: ProjectIdentity[]) {
  if (!document._id?.startsWith('drafts.')) throw new Error('Project copies must be drafts.')
  const copy = JSON.parse(JSON.stringify(document)) as SanityDocumentLike
  for (const key of Object.keys(copy)) {
    if (key.startsWith('_') && key !== '_id' && key !== '_type') delete copy[key]
  }
  return {...copy, ...duplicateProjectIdentity(document.title, existing)}
}
