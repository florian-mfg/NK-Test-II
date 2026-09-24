/* Shared, non-mutating category compatibility for Studio and the public adapter. */
(function (root) {
  const names = ['Video', 'Commissioned', 'Graphic'];
  function projectCategories(project) {
    const values = project?.categories == null ? [project?.category] : project.categories;
    if (!Array.isArray(values)) return [];
    return [...new Set(values.map(value => names.find(name =>
      typeof value === 'string' && name.toLowerCase() === value.trim().toLowerCase()
    )).filter(value => value !== undefined))];
  }
  const api = {projectCategories};
  root.ProjectCategories = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
