import { Eraser, FileText, WrapText, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CodeEditor } from "@/components/tool/code-editor";
import { CopyButton } from "@/components/tool/copy-button";
import { IndentSelect } from "@/components/tool/indent-select";
import { ToolPageHeader } from "@/components/tool/tool-page-header";
import { ToolStatus } from "@/components/tool/tool-status";
import { TextStats } from "@/components/tool/text-stats";
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
    if (result?.ok) run(input, next);
  };

  const handleSample = () => {
    const sample = config.sample();
    setInput(sample);
    run(sample, indent);
  };

  const handleClear = () => {
    setInput("");
    setResult(null);
  };

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader title={config.title} description={config.description} />

      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/50 px-3 py-2">
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

        <div className="tool-workspace-grid grid min-h-0 grid-cols-1 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="flex min-h-65 min-w-0 flex-col bg-editor/40 lg:min-h-0">
            <div className="flex min-h-11 items-center justify-between gap-2 px-3 py-1.5">
              <span className="text-sm font-medium text-muted-foreground">
                Input
              </span>
              <TextStats value={input} />
            </div>
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
          </div>

          <div className="flex min-h-65 min-w-0 flex-col bg-muted/20 lg:min-h-0">
            <div className="flex min-h-11 items-center justify-between gap-2 px-3 py-1.5">
              <span className="text-sm font-medium text-muted-foreground">
                Output
              </span>
              <div className="flex items-center gap-2">
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
              </div>
            </div>
            {config.outputPreview && result?.ok && (outputMode === "form" || outputMode === "tree") ? (
              config.outputPreview(result.output, outputMode)
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
          </div>
        </div>
      </div>

      <div className="shrink-0">
        <ToolStatus
          state={result === null ? "idle" : result.ok ? "valid" : "invalid"}
          message={result && !result.ok ? result.message : undefined}
          line={result && !result.ok ? result.line : undefined}
          column={result && !result.ok ? result.column : undefined}
          validLabel={config.successLabel}
        />
      </div>
      {dialog}
    </div>
  );
}
