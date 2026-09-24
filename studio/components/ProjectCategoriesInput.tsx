import {type ArrayOfPrimitivesInputProps, PatchEvent, set, useFormValue} from 'sanity'
import '../../project-categories.js'

export const {projectCategories} = (globalThis as typeof globalThis & {
  ProjectCategories: typeof import('../../project-categories.js')
}).ProjectCategories

// Keep an intentional empty selection distinct from a missing legacy field.
export function categorySelectionPatch(event: Parameters<typeof PatchEvent.from>[0]) {
  return PatchEvent.from(event).patches.map(patch =>
    patch.type === 'unset' && patch.path.length === 0 ? set([]) : patch)
}

// Display the legacy selection without silently writing/migrating the document.
// The native checkbox editor writes a complete array on the first user change.
export function ProjectCategoriesInput(props: ArrayOfPrimitivesInputProps) {
  const category = useFormValue(['category'])
  return props.renderDefault({...props,
    value: projectCategories({categories: props.value, category}),
    onChange: event => props.onChange(categorySelectionPatch(event)),
  })
}
