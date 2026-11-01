// Public, read-only production verification. Never accepts a mutation endpoint.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const adapter = require('../sanity-data.js');
async function publishedQuery(query) {
  const {projectId, dataset, apiVersion} = adapter.config;
  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set('perspective', 'published');
  url.searchParams.set('query', query);
  const response = await fetch(url, {method: 'GET', signal: AbortSignal.timeout(45000)});
  if (!response.ok) throw new Error(`Sanity query HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(JSON.stringify(payload.error));
  return payload.result;
}
const publishedContent = () => publishedQuery(adapter.query);
module.exports = {publishedQuery, publishedContent};
if (require.main === module) (async () => {
  const [phase, directory] = process.argv.slice(2);
  if (!['before', 'after'].includes(phase) || !directory) throw new Error('Usage: node tests/sanity-readonly.cjs before|after REPORT_DIRECTORY');
  fs.mkdirSync(directory, {recursive: true});
  const documents = await publishedQuery('*[!(_id in path("drafts.**")) && !(_id in path("versions.**"))] | order(_id asc)');
  const content = await publishedContent();
  const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const summary = {timestamp: new Date().toISOString(), projectId: adapter.config.projectId, dataset: adapter.config.dataset,
    count: documents.length, types: documents.reduce((a, d) => (a[d._type] = (a[d._type] || 0) + 1, a), {}),
    documentsHash: hash(documents), contentHash: hash(content), issues: adapter.normalize(content).issues};
  if (phase === 'after') {
    const before = JSON.parse(fs.readFileSync(path.join(directory, 'sanity-before-summary.json')));
    summary.unchanged = summary.documentsHash === before.documentsHash && summary.contentHash === before.contentHash;
    if (!summary.unchanged) process.exitCode = 1;
  }
  fs.writeFileSync(path.join(directory, `sanity-${phase}-documents.json`), JSON.stringify(documents, null, 2));
  fs.writeFileSync(path.join(directory, `sanity-${phase}-content.json`), JSON.stringify(content, null, 2));
  fs.writeFileSync(path.join(directory, `sanity-${phase}-summary.json`), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
})().catch(error => {console.error(error); process.exitCode = 1;});
