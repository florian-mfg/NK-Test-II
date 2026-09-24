import process from 'node:process'
import console from 'node:console'
import {getCliClient} from 'sanity/cli'
import {mkdirSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {indexPortraitPositions} from '../migrations/index-portrait-position.mjs'

// Dry run unless --apply is explicitly supplied. Only Index documents are patched.
const client = getCliClient({apiVersion: '2025-02-19'}).withConfig({useCdn: false, perspective: 'raw'})
const documents = await client.fetch('*[_id in ["indexPage", "drafts.indexPage"]]')
if (!documents.length) throw new Error('No Index documents found')
const plans = documents.map((doc) => ({doc, entries: indexPortraitPositions(doc)}))
const directory = resolve(process.env.INDEX_MIGRATION_BACKUP_DIR || '/tmp/nk-index-portrait-migration')
mkdirSync(directory, {recursive: true})
const backup = resolve(directory, `before-${Date.now()}.json`)
writeFileSync(backup, JSON.stringify(documents, null, 2), {flag: 'wx', mode: 0o600})
console.log(`Backup: ${backup}`)
console.log(JSON.stringify(plans.map(({doc, entries}) => ({id: doc._id, entries})), null, 2))
if (process.argv.includes('--apply')) {
  const changes = plans.filter(({doc, entries}) => !isDeepStrictEqual(doc.entries, entries))
  if (changes.length) {
    let transaction = client.transaction()
    for (const {doc, entries} of changes) {
      transaction = transaction.patch(doc._id, (patch) => patch.ifRevisionId(doc._rev).set({entries}))
    }
    await transaction.commit({visibility: 'sync'})
  }
  console.log('Saved Index portrait positions; existing content and image order preserved.')
} else console.log('Dry run only. Append -- --apply to save portrait positions.')
