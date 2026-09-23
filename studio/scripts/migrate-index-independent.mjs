import process from 'node:process'
import console from 'node:console'
import {getCliClient} from 'sanity/cli'
import {mkdirSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {independentIndexEntries} from '../migrations/index-independent.mjs'

// Dry-run by default. Writes only entries on indexPage and an existing draft.
const client = getCliClient({apiVersion: '2025-02-19'}).withConfig({
  useCdn: false,
  perspective: 'raw',
})
const snapshot = await client.fetch('*[!(_type match "sanity.*")] | order(_id asc)')
const documents = snapshot.filter((doc) => ['indexPage', 'drafts.indexPage'].includes(doc._id))
if (!documents.length) throw new Error('No Index document found')
const projects = snapshot.filter(
  (doc) => doc._type === 'project' && !/^(drafts|versions)\./.test(doc._id),
)
const plans = documents.map((doc) => ({doc, entries: independentIndexEntries(doc, projects)}))
const backupDirectory = resolve(process.env.INDEX_MIGRATION_BACKUP_DIR || '/tmp/nk-index-migration')
mkdirSync(backupDirectory, {recursive: true})
const backup = resolve(backupDirectory, `before-${Date.now()}.json`)
writeFileSync(backup, JSON.stringify(snapshot, null, 2), {flag: 'wx', mode: 0o600})
console.log(`Backup: ${backup}`)
console.log(
  JSON.stringify(
    plans.map(({doc, entries}) => ({id: doc._id, revision: doc._rev, entries})),
    null,
    2,
  ),
)
if (process.argv.includes('--apply')) {
  const changes = plans.filter(({doc, entries}) => !isDeepStrictEqual(doc.entries, entries))
  if (changes.length) {
    // Refuse stale inputs. Each Index patch also has a server-side revision guard.
    const current = await client.fetch('*[!(_type match "sanity.*")] | order(_id asc)')
    if (!isDeepStrictEqual(snapshot, current))
      throw new Error('Content changed during preparation; rerun the migration')
    let transaction = client.transaction()
    for (const {doc, entries} of changes) {
      transaction = transaction.patch(doc._id, (patch) =>
        patch.ifRevisionId(doc._rev).set({entries}),
      )
    }
    await transaction.commit({visibility: 'sync'})
  }
  const after = await client.fetch('*[!(_type match "sanity.*")] | order(_id asc)')
  const outsideIndex = (docs) =>
    docs.filter((doc) => !documents.some((index) => index._id === doc._id))
  if (!isDeepStrictEqual(outsideIndex(snapshot), outsideIndex(after)))
    throw new Error('Non-Index content changed during verification; inspect backup')
  for (const {doc, entries} of plans) {
    if (!isDeepStrictEqual(after.find((item) => item._id === doc._id)?.entries, entries))
      throw new Error(`Verification failed: ${doc._id}`)
  }
  console.log('Verified: independent Index values saved; all non-Index documents unchanged.')
} else console.log('Dry run only. Append -- --apply to commit the reviewed migration.')
