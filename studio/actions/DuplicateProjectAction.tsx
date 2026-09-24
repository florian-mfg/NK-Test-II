import {useRef, useState} from 'react'
import {type DuplicateDocumentActionComponent, useClient} from 'sanity'
import {mapProjectDuplicate, type ProjectIdentity} from './duplicateProject'

// Extend the native action: it owns permissions, UUID generation, draft creation,
// error handling and navigation to the newly created document.
export function createDuplicateProjectAction(useNativeAction: DuplicateDocumentActionComponent): DuplicateDocumentActionComponent {
  function DuplicateProjectAction(props: Parameters<DuplicateDocumentActionComponent>[0]) {
    const client = useClient({apiVersion: '2025-02-19'})
    const existing = useRef<ProjectIdentity[]>([])
    const pending = useRef(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const native = useNativeAction({...props, mapDocument: document => mapProjectDuplicate(document, existing.current)})
    if (!native) return null
    return {
      ...native,
      label: busy ? 'Duplicating project…' : 'Duplicate project',
      disabled: native.disabled || busy,
      dialog: error ? {type: 'dialog' as const, header: 'Could not duplicate project', content: error,
        onClose: () => setError(null)} : native.dialog,
      onHandle: async () => {
        if (pending.current || native.disabled) return
        pending.current = true
        setBusy(true)
        try {
          existing.current = await client.fetch<ProjectIdentity[]>(
            '*[_type == "project" && !(_id in path("versions.**"))]{title,slug}', {},
            {perspective: 'raw', useCdn: false},
          )
          await native.onHandle?.()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Please retry.')
        } finally {
          pending.current = false
          setBusy(false)
        }
      },
    }
  }
  DuplicateProjectAction.action = 'duplicate' as const
  return DuplicateProjectAction
}
