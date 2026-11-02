import { Shrink } from 'lucide-react'

import { FormatterPage } from '@/components/tool/formatter-page'
import { JsonFormPreview, JsonTreePreview } from '@/components/tool/json-tree-preview'
import { minifyJson } from '@/features/formatters/json'
import { getRandomSampleJson } from '@/features/formatters/samples'

export function JsonMinifierPage() {
  return (
    <FormatterPage
      checkJsonPrecision
      title="JSON Minifier"
      description="Paste JSON and collapse it into a single compact line."
      actionLabel="Minify"
      actionIcon={Shrink}
      successLabel="Minified successfully"
      sample={getRandomSampleJson}
      showIndent={false}
      inputPlaceholder="Paste JSON here…"
      storageKey="json-minifier"
      process={(input) => minifyJson(input)}
      outputModes={['code', 'form', 'text', 'tree']}
      outputPreview={(output, mode) => mode === 'form' ? <JsonFormPreview value={output} /> : <JsonTreePreview value={output} />}
    />
  )
}
