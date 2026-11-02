import { Download, Eraser, FileCode, FileText, Table2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { CodeEditor } from '@/components/tool/code-editor'
import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { JsonPrecisionWarning } from '@/components/tool/json-precision-warning'
import { TextStats } from '@/components/tool/text-stats'
import { Button } from '@/components/ui/button'
import { jsonToCsv, jsonToYaml } from '@/features/json-converters'
import { usePersistedInput } from '@/hooks/use-persisted-input'
import { useLargeInputConfirmation } from '@/hooks/use-large-input-confirmation'
import { useSaveLocally } from '@/hooks/use-save-locally'

const sample = `[\n  {\n    "id": 1,\n    "name": "MindsKit",\n    "active": true,\n    "tags": ["tools", "browser"]\n  },\n  {\n    "id": 2,\n    "name": "Developer toolbox",\n    "active": false\n  }\n]`

function download(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function JsonToYamlPage() {
  return <JsonConverterPage title="JSON → YAML" description="Convert JSON into readable YAML entirely in your browser." actionLabel="Convert to YAML" actionIcon={<FileCode />} outputLabel="YAML output" extension="yaml" convert={jsonToYaml} />
}

export function JsonToCsvPage() {
  return <JsonConverterPage title="JSON → CSV" description="Convert a JSON array of objects into a CSV table entirely in your browser." actionLabel="Convert to CSV" actionIcon={<Table2 />} outputLabel="CSV output" extension="csv" convert={jsonToCsv} />
}

function JsonConverterPage({ title, description, actionLabel, actionIcon, outputLabel, extension, convert }: { title: string; description: string; actionLabel: string; actionIcon: ReactNode; outputLabel: string; extension: string; convert: (input: string) => string }) {
  const { enabled } = useSaveLocally()
  const [input, setInput] = usePersistedInput(`json-to-${extension}`, enabled)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [hasConverted, setHasConverted] = useState(false)
  const { confirm, dialog } = useLargeInputConfirmation(10 * 1024 * 1024)

  const run = (value = input) => {
    try {
      setOutput(convert(value))
      setError('')
      setHasConverted(true)
    } catch (conversionError) {
      setOutput('')
      setError(conversionError instanceof Error ? conversionError.message : 'Unable to convert this JSON.')
      setHasConverted(false)
    }
  }

  const useSample = () => {
    setInput(sample)
    run(sample)
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader title={title} description={description} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-secondary/50 px-3 py-2">
          <Button type="button" size="sm" onClick={() => confirm(input, () => run())} disabled={!input.trim()}>{actionIcon}{actionLabel}</Button>
          <Button type="button" variant="outline" size="sm" onClick={useSample}><FileText />Sample</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { setInput(''); setOutput(''); setError(''); setHasConverted(false) }} disabled={!input && !output}><Eraser />Clear</Button>
        </div>
        {error && <div className="shrink-0 px-3 pt-3"><ToolStatus state="invalid" message={error} /></div>}
        <div className="tool-workspace-grid grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          <section className="flex min-h-0 min-w-0 flex-col border-b border-border lg:border-r lg:border-b-0"><div className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">JSON input</span><TextStats value={input} /></div><CodeEditor bare value={input} onChange={(value) => { setInput(value); setError(''); setHasConverted(false) }} placeholder="Paste JSON here…" wrap ariaLabel="JSON input" /></section>
          <section className="flex min-h-0 min-w-0 flex-col"><div className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">{outputLabel}</span><div className="flex shrink-0 items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => download(output, `mindskit-output.${extension}`, extension === 'csv' ? 'text/csv;charset=utf-8' : 'text/yaml;charset=utf-8')} disabled={!hasConverted}><Download />Download</Button><CopyButton value={hasConverted ? output : ''} /></div></div><CodeEditor bare value={hasConverted ? output : ''} readOnly placeholder="Converted output will appear here." wrap ariaLabel={outputLabel} language="text" /></section>
        </div>
      </div>
      <JsonPrecisionWarning input={input} />
      <ToolStatus state={error ? 'invalid' : hasConverted ? 'valid' : 'idle'} message={error} validLabel={`${actionLabel} completed`} />
      {dialog}
    </div>
  )
}
