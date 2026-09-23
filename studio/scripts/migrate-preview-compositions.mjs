import process from 'node:process'
import console from 'node:console'
import {getCliClient} from 'sanity/cli'
import {mkdirSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {previewComposition} from '../migrations/preview-composition.mjs'

const client = getCliClient({apiVersion: '2025-02-19'}).withConfig({
  useCdn: false,
  perspective: 'raw',
})
const query = '*[!(_type match "sanity.*")] | order(_id asc)'
const before = await client.fetch(query)
const plans = before
  .filter((doc) => doc._type === 'project' && !doc._id.startsWith('versions.'))
  .map((doc) => ({doc, preview: previewComposition(doc.selectedWorkPreview)}))
  .filter(({doc, preview}) => !isDeepStrictEqual(doc.selectedWorkPreview, preview))
const directory = resolve(process.env.PREVIEW_MIGRATION_BACKUP_DIR || '/tmp/nk-preview-migration')
mkdirSync(directory, {recursive: true})
const backup = resolve(directory, `before-${Date.now()}.json`)
writeFileSync(backup, JSON.stringify(before, null, 2), {flag: 'wx', mode: 0o600})
console.log(`Backup: ${backup}`)
console.log(
  JSON.stringify(
    plans.map(({doc, preview}) => ({id: doc._id, title: doc.title, revision: doc._rev, preview})),
    null,
    2,
  ),
)
if (process.argv.includes('--apply')) {
  if (plans.length) {
    if (!isDeepStrictEqual(before, await client.fetch(query)))
      throw new Error('Content changed during preparation; rerun')
    let transaction = client.transaction()
    for (const {doc, preview} of plans) {
      transaction = transaction.patch(doc._id, (patch) =>
        patch.ifRevisionId(doc._rev).set({selectedWorkPreview: preview}),
      )
    }
    await transaction.commit({visibility: 'sync'})
  }
  const after = await client.fetch(query)
  const expected = before.map((doc) => {
    const plan = plans.find((plan) => plan.doc._id === doc._id)
    return plan ? {...doc, selectedWorkPreview: plan.preview} : doc
  })
  // Only preview fields and server revision/timestamp on patched Projects may differ.
  const withoutRevision = (docs) =>
    docs.map((doc) => {
      if (!plans.some((plan) => plan.doc._id === doc._id)) return doc
      const {_rev, _updatedAt, ...content} = doc
      return content
    })
  if (!isDeepStrictEqual(withoutRevision(after), withoutRevision(expected)))
    throw new Error('Read-back differs from plan; inspect backup')
  console.log(
    `Verified ${plans.length} previews migrated; all other content and detail modules unchanged.`,
  )
} else console.log('Dry run only. Append -- --apply to commit. Existing drafts stay drafts.')
