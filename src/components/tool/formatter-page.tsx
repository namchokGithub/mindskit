import { Eraser, FileText, WrapText, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CodeEditor } from "@/components/tool/code-editor";
import { CopyButton } from "@/components/tool/copy-button";
import { IndentSelect } from "@/components/tool/indent-select";
import { ToolPageHeader } from "@/components/tool/tool-page-header";
import { ToolStatus } from "@/components/tool/tool-status";
import { JsonPrecisionWarning } from '@/components/tool/json-precision-warning'
import { TextStats } from "@/components/tool/text-stats";
import { ResultReveal, ToolPage, WorkspacePane, WorkspaceSplit } from "@/components/tool/workspace";
import { Button } from "@/components/ui/button";
import { usePersistedInput } from "@/hooks/use-persisted-input";
import { useLargeInputConfirmation } from "@/hooks/use-large-input-confirmation";
import { useSaveLocally } from "@/hooks/use-save-locally";
import { cn } from "@/lib/utils";
import type { FormatResult, IndentOption } from "@/types/format";

export type FormatterOutputMode = "code" | "form" | "text" | "tree";

export interface FormatterPageConfig {
  title: string;
  description: string;
  actionLabel: string;
  actionIcon: LucideIcon;
  successLabel: string;
  sample: () => string;
  showIndent: boolean;
  inputPlaceholder: string;
  storageKey: string;
  process: (input: string, indent: IndentOption) => FormatResult;
  /** Show a warning when JSON input has numbers JavaScript would round. */
  checkJsonPrecision?: boolean;
  outputModes?: FormatterOutputMode[];
  outputPreview?: (output: string, mode: Exclude<FormatterOutputMode, "code" | "text">) => ReactNode;
}

export function FormatterPage(config: FormatterPageConfig) {
  const { enabled: saveLocally } = useSaveLocally();
  const [input, setInput] = usePersistedInput(config.storageKey, saveLocally);
  const [indent, setIndent] = useState<IndentOption>("2");
  const [wrap, setWrap] = useState(false);
  const [result, setResult] = useState<FormatResult | null>(null);
  const outputModes = config.outputModes ?? (config.outputPreview ? ["text", "tree"] : ["text"]);
  const [outputMode, setOutputMode] = useState<FormatterOutputMode>(outputModes[0]);
  const { confirm, dialog } = useLargeInputConfirmation();

  const ActionIcon = config.actionIcon;

  const run = (nextInput: string, nextIndent: IndentOption) => {
    setResult(config.process(nextInput, nextIndent));
  };

  const handleInputChange = (next: string) => {
    setInput(next);
    setResult(null);
  };

  const handleIndentChange = (next: IndentOption) => {
    setIndent(next);
    if (result?.ok) confirm(input, () => run(input, next));
  };

  const handleSample = () => {
    const sample = config.sample();
    setInput(sample);
    confirm(sample, () => run(sample, indent));
  };

  const handleClear = () => {
    setInput("");
    setResult(null);
  };

  return (
    <ToolPage>
      <ToolPageHeader title={config.title} description={config.description} />

      <WorkspaceSplit
        toolbar={<>
          <Button
            type="button"
            size="sm"
            onClick={() => confirm(input, () => run(input, indent))}
            disabled={!input.trim()}>
            <ActionIcon />
            {config.actionLabel}
          </Button>
          {config.showIndent && (
            <IndentSelect value={indent} onChange={handleIndentChange} />
          )}
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
            variant="ghost"
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
        </>}>
          <WorkspacePane label="Input" actions={<TextStats value={input} />}>
            <CodeEditor
              bare
              value={input}
              onChange={handleInputChange}
              placeholder={config.inputPlaceholder}
              wrap={wrap}
              ariaLabel="Input"
              errorLine={result && !result.ok ? result.line : undefined}
              fitContent
            />
          </WorkspacePane>

          <WorkspacePane
            label="Output"
            tone="output"
            actions={<>
                {outputModes.length > 1 && (
                  <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
                    {outputModes.map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        size="xs"
                        variant={outputMode === mode ? "secondary" : "ghost"}
                        aria-pressed={outputMode === mode}
                        onClick={() => setOutputMode(mode)}>
                        {mode[0].toUpperCase() + mode.slice(1)}
                      </Button>
                    ))}
                  </div>
                )}
                <CopyButton value={result?.ok ? result.output : ""} />
            </>}>
            {config.outputPreview && result?.ok && (outputMode === "form" || outputMode === "tree") ? (
              <ResultReveal resultKey={`${outputMode}-${result.output.length}`}>{config.outputPreview(result.output, outputMode)}</ResultReveal>
            ) : (
              <CodeEditor
                bare
                value={result?.ok ? result.output : ""}
                readOnly
                placeholder="Result will appear here."
                wrap={wrap}
                ariaLabel="Output"
                language={outputMode === "text" ? "text" : "json"}
                fitContent
              />
            )}
          </WorkspacePane>
      </WorkspaceSplit>

      <div className="flex shrink-0 flex-col gap-2">
        {config.checkJsonPrecision && <JsonPrecisionWarning input={input} />}
        <ToolStatus
          state={result === null ? "idle" : result.ok ? "valid" : "invalid"}
          message={result && !result.ok ? result.message : undefined}
          line={result && !result.ok ? result.line : undefined}
          column={result && !result.ok ? result.column : undefined}
          validLabel={config.successLabel}
        />
      </div>
      {dialog}
    </ToolPage>
  );
}
