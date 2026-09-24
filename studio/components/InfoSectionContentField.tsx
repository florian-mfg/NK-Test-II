import type {FieldProps} from 'sanity'

// The preceding section-name input provides the visible heading. Keep Sanity's
// standard field controls, description, validation and array editor intact.
export function InfoSectionContentField(props: FieldProps) {
  return props.renderDefault({...props, title: undefined})
}
