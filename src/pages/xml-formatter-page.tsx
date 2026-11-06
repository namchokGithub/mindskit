import { Eraser, FileCode2, FileText, Shrink, WrapText } from "lucide-react";
import { useState } from "react";

import { CodeEditor } from "@/components/tool/code-editor";
import { CopyButton } from "@/components/tool/copy-button";
import { IndentSelect } from "@/components/tool/indent-select";
import { ToolPageHeader } from "@/components/tool/tool-page-header";
import { ToolStatus } from "@/components/tool/tool-status";
import { TextStats } from "@/components/tool/text-stats";
import { Button } from "@/components/ui/button";
import { formatXml, minifyXml } from "@/features/formatters/xml";
import { getRandomSampleXml } from "@/features/formatters/samples";
import { usePersistedInput } from "@/hooks/use-persisted-input";
import { useLargeInputConfirmation } from "@/hooks/use-large-input-confirmation";
import { useSaveLocally } from "@/hooks/use-save-locally";
import { cn } from "@/lib/utils";
import type { FormatResult, IndentOption } from "@/types/format";

type XmlFormatterPageProps = {
  title?: string
  description?: string
  storageKey?: string
}

export function XmlFormatterPage({
  title = 'XML Formatter',
  description = 'Paste XML, beautify or minify it, and catch malformed markup.',
  storageKey = 'xml-formatter',
}: XmlFormatterPageProps) {
  const { enabled: saveLocally } = useSaveLocally();
  const [input, setInput] = usePersistedInput(storageKey, saveLocally);
  const [indent, setIndent] = useState<IndentOption>("2");
  const [wrap, setWrap] = useState(false);
  const [result, setResult] = useState<FormatResult | null>(null);
  const [mode, setMode] = useState<"format" | "minify">("format");
  const { confirm, dialog } = useLargeInputConfirmation();

  const handleInputChange = (next: string) => {
    setInput(next);
    setResult(null);
  };

  const handleFormat = () => {
    setMode("format");
    setResult(formatXml(input, indent));
  };

  const handleMinify = () => {
    setMode("minify");
    setResult(minifyXml(input));
  };

  const handleIndentChange = (next: IndentOption) => {
    setIndent(next);
    if (mode === "format" && result?.ok) confirm(input, () => setResult(formatXml(input, next)));
  };

  const handleSample = () => {
    const sample = getRandomSampleXml();
    setInput(sample);
    setMode("format");
    setResult(formatXml(sample, indent));
  };

  const handleClear = () => {
    setInput("");
    setResult(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <ToolPageHeader
        title={title}
        description={description}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/50 px-3 py-2">
          <Button
            type="button"
            size="sm"
            onClick={() => confirm(input, handleFormat)}
            disabled={!input.trim()}>
            <FileCode2 />
            Format
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => confirm(input, handleMinify)}
            disabled={!input.trim()}>
            <Shrink />
            Minify
          </Button>
          <IndentSelect value={indent} onChange={handleIndentChange} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSample}>
            <FileText />
            Sample
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={!input}>
            <Eraser />
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={wrap}
            onClick={() => setWrap((w) => !w)}
            className={cn(wrap && "bg-accent text-accent-foreground")}>
            <WrapText />
            Wrap
          </Button>
        </div>

        <div className="tool-workspace-grid grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          <div className="flex min-h-0 min-w-0 flex-col border-b border-border lg:border-r lg:border-b-0">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">Input</span><TextStats value={input} /></div>
            <CodeEditor
              bare
              value={input}
              onChange={handleInputChange}
              placeholder="Paste XML here…"
              wrap={wrap}
              ariaLabel="Input"
              language="xml"
              errorLine={result && !result.ok ? result.line : undefined}
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-sm font-medium text-muted-foreground">
                Output
              </span>
              <CopyButton value={result?.ok ? result.output : ""} />
            </div>
            <CodeEditor
              bare
              value={result?.ok ? result.output : ""}
              readOnly
              placeholder="Result will appear here."
              wrap={wrap}
              ariaLabel="Output"
              language="xml"
            />
          </div>
        </div>
      </div>

      <div className="shrink-0">
        <ToolStatus
          state={result === null ? "idle" : result.ok ? "valid" : "invalid"}
          message={result && !result.ok ? result.message : undefined}
          line={result && !result.ok ? result.line : undefined}
          column={result && !result.ok ? result.column : undefined}
          validLabel={
            mode === "format"
              ? "Formatted successfully"
              : "Minified successfully"
          }
        />
      </div>
      {dialog}
    </div>
  );
}
