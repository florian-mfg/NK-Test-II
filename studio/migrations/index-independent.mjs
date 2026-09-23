// Preserve the legacy renderer's effective values before removing its relationship.
// This one-time migration is the only place Index may read Project metadata.
export function independentIndexEntries(document, projects) {
  if (!Array.isArray(document.entries)) throw new Error('Index entries must be an array')
  const byId = new Map(projects.map((project) => [project._id, project]))
  return document.entries.map((entry) => {
    const related = byId.get(entry.project?._ref)
    const title =
      (typeof entry.displayTitle === 'string' && entry.displayTitle.trim()) || related?.title
    const year = Number.isInteger(entry.yearOverride)
      ? entry.yearOverride
      : entry.project
        ? related?.year
        : entry.year
    const additionalInfo =
      typeof entry.additionalInfo === 'string'
        ? entry.additionalInfo
        : typeof related?.additionalInfo === 'string'
          ? related.additionalInfo
          : ''
    if (!entry._key || typeof title !== 'string' || !title.trim()) {
      throw new Error('Cannot preserve an Index entry without a key and resolved title')
    }
    if (
      !Array.isArray(entry.previewImages) ||
      entry.previewImages.length < 1 ||
      entry.previewImages.length > 3 ||
      entry.previewImages.some((image) => !image.asset?._ref)
    ) {
      throw new Error(
        `Entry ${entry._key} needs 1–3 existing preview images; no images will be deleted`,
      )
    }
    const result = {...entry, displayTitle: title, additionalInfo}
    if (Number.isInteger(year)) result.year = year
    else if (entry.project || 'yearOverride' in entry) delete result.year
    delete result.project
    delete result.yearOverride
    return result
  })
}
