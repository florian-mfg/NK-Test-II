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
  // Display labels are independent of existing stored values and route keys.
  function categoryLabel(value) {
    return typeof value === 'string' && value.trim().toLowerCase() === 'commissioned' ? 'Photography' : value;
  }
  const api = {projectCategories, categoryLabel};
  root.ProjectCategories = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
