import React from 'react'
import {set, useFormValue, type ArrayOfObjectsInputProps, type PreviewProps} from 'sanity'

export const infoSections = [
  {value: 'cv', title: 'CV'},
  {value: 'work', title: 'Work'},
  {value: 'skills', title: 'Skills'},
  {value: 'news', title: 'News'},
  {value: 'publications', title: 'Publications'},
  {value: 'contactLinks', title: 'Contact'},
  {value: 'selectedClients', title: 'Selected Clients'},
]

export const defaultInfoSectionOrder = infoSections.map(({value}) => ({
  _key: value, _type: 'infoSectionOrderItem', section: value,
}))

const sectionLabelFields: Record<string, string> = {
  cv: 'cvLabel', work: 'workLabel', skills: 'skillsLabel', news: 'newsLabel',
  publications: 'publicationsLabel', contactLinks: 'contactLabel', selectedClients: 'selectedClientsLabel',
}

function useInfoSectionLabel(section: string) {
  const value = useFormValue([sectionLabelFields[section] || ''])
  return typeof value === 'string' && value.trim()
    ? value.trim() : infoSections.find(item => item.value === section)?.title || 'Unknown section'
}

function InfoSectionLabel({section}: {section: string}) {
  return <>{useInfoSectionLabel(section)}</>
}

// Override only the native preview title, retaining the array item's controls
// and drag handle. Form values include local, unpublished edits.
export function InfoSectionOrderPreview(props: PreviewProps & {section?: string}) {
  const title = useInfoSectionLabel(props.section || '')
  return props.renderDefault({...props, title})
}

// Existing documents stay untouched until the editor explicitly chooses to
// customize their order. Once initialized, Sanity supplies native drag and drop.
export function InfoSectionOrderInput(props: ArrayOfObjectsInputProps<{_key: string; section?: string}>) {
  if (props.value !== undefined) {
    const missing = defaultInfoSectionOrder.filter(item => !props.value?.some(value => value.section === item.section))
    if (!missing.length) return props.renderDefault(props)
    return (
      <div>
        {props.renderDefault(props)}
        <button type="button" disabled={props.readOnly}
          onClick={() => props.onChange(set([...props.value || [], ...missing]))}>
          Add missing sections: {missing.map((item, index) => <React.Fragment key={item.section}>
            {index > 0 ? ', ' : ''}<InfoSectionLabel section={item.section} />
          </React.Fragment>)}
        </button>
      </div>
    )
  }
  return (
    <div>
      <ol>{infoSections.map(({value}) => <li key={value}><InfoSectionLabel section={value} /></li>)}</ol>
      <button type="button" disabled={props.readOnly}
        onClick={() => props.onChange(set(defaultInfoSectionOrder))}>
        Customize section order
      </button>
    </div>
  )
}
