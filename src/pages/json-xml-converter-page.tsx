import { ArrowLeftRight, Eraser, FileText } from 'lucide-react'
import { useState } from 'react'

import { CodeEditor } from '@/components/tool/code-editor'
import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { JsonPrecisionWarning } from '@/components/tool/json-precision-warning'
import { TextStats } from '@/components/tool/text-stats'
import { Button } from '@/components/ui/button'
import { jsonToXml, xmlToJson } from '@/features/json-xml-converter'
import { useLargeInputConfirmation } from '@/hooks/use-large-input-confirmation'
import { usePersistedInput } from '@/hooks/use-persisted-input'
import { useSaveLocally } from '@/hooks/use-save-locally'

type Direction = 'json-to-xml' | 'xml-to-json'

const jsonSample = '{\n  "name": "MindsKit",\n  "active": true,\n  "tags": ["tools", "browser"]\n}'
const xmlSample = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <name>MindsKit</name>\n  <active>true</active>\n  <tags>\n    <item>tools</item>\n    <item>browser</item>\n  </tags>\n</root>'

export function JsonXmlConverterPage() {
  const { enabled: saveLocally } = useSaveLocally()
  const [input, setInput] = usePersistedInput('json-xml-converter', saveLocally)
  const [direction, setDirection] = useState<Direction>('json-to-xml')
  const [rootName, setRootName] = useState('root')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [hasConverted, setHasConverted] = useState(false)
  const { confirm, dialog } = useLargeInputConfirmation(10 * 1024 * 1024)
  const isJsonToXml = direction === 'json-to-xml'
  const inputFormat = isJsonToXml ? 'JSON' : 'XML'
  const outputFormat = isJsonToXml ? 'XML' : 'JSON'

  const run = (value = input) => {
    try {
      setOutput(isJsonToXml ? jsonToXml(value, rootName) : xmlToJson(value))
      setError('')
      setHasConverted(true)
    } catch (conversionError) {
      setOutput('')
      setError(conversionError instanceof Error ? conversionError.message : `Unable to convert this ${inputFormat}.`)
      setHasConverted(false)
    }
  }

  const changeDirection = (nextDirection: Direction) => {
    setDirection(nextDirection)
    setOutput('')
    setError('')
    setHasConverted(false)
  }

  const useSample = () => {
    const value = isJsonToXml ? jsonSample : xmlSample
    setInput(value)
    run(value)
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader title="JSON ↔ XML" description="Convert JSON and XML locally in your browser." />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-secondary/50 px-3 py-2">
          <div className="flex items-center gap-1 rounded-lg border border-input p-1">
            <Button type="button" size="sm" variant={isJsonToXml ? 'secondary' : 'ghost'} onClick={() => changeDirection('json-to-xml')}>JSON → XML</Button>
            <Button type="button" size="sm" variant={!isJsonToXml ? 'secondary' : 'ghost'} onClick={() => changeDirection('xml-to-json')}>XML → JSON</Button>
          </div>
          {isJsonToXml && <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Root element<input value={rootName} onChange={(event) => { setRootName(event.target.value); setHasConverted(false) }} className="h-7 w-28 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" /></label>}
          <Button type="button" size="sm" onClick={() => confirm(input, () => run())} disabled={!input.trim()}><ArrowLeftRight />Convert to {outputFormat}</Button>
          <Button type="button" variant="outline" size="sm" onClick={useSample}><FileText />Sample</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { setInput(''); setOutput(''); setError(''); setHasConverted(false) }} disabled={!input && !output}><Eraser />Clear</Button>
        </div>
        {error && <div className="shrink-0 px-3 pt-3"><ToolStatus state="invalid" message={error} /></div>}
        <div className="tool-workspace-grid grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          <section className="flex min-h-0 min-w-0 flex-col border-b border-border lg:border-r lg:border-b-0"><div className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">{inputFormat} input</span><TextStats value={input} /></div><CodeEditor bare value={input} onChange={(value) => { setInput(value); setError(''); setHasConverted(false) }} placeholder={`Paste ${inputFormat} here…`} wrap ariaLabel={`${inputFormat} input`} language={isJsonToXml ? 'json' : 'xml'} /></section>
          <section className="flex min-h-0 min-w-0 flex-col"><div className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">{outputFormat} output</span><CopyButton value={hasConverted ? output : ''} /></div><CodeEditor bare value={hasConverted ? output : ''} readOnly placeholder={`Converted ${outputFormat} will appear here.`} wrap ariaLabel={`${outputFormat} output`} language={isJsonToXml ? 'xml' : 'json'} /></section>
        </div>
      </div>
      {isJsonToXml && <JsonPrecisionWarning input={input} />}
      <ToolStatus state={error ? 'invalid' : hasConverted ? 'valid' : 'idle'} message={error} validLabel={`Converted to ${outputFormat} successfully`} />
      {dialog}
    </div>
  )
}
