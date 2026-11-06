import JsBarcode from "jsbarcode";
import { Barcode, Download, Eraser, FileText } from "lucide-react";
import { useRef, useState } from "react";

import { ToolPageHeader } from "@/components/tool/tool-page-header";
import { ToolStatus } from "@/components/tool/tool-status";
import { TextStats } from "@/components/tool/text-stats";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePersistedInput } from "@/hooks/use-persisted-input";
import { useLargeInputConfirmation } from "@/hooks/use-large-input-confirmation";
import { useSaveLocally } from "@/hooks/use-save-locally";

const fieldClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50";

function download(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
}

export function BarcodePage() {
  const { enabled } = useSaveLocally();
  const [input, setInput] = usePersistedInput("barcode", enabled);
  const [format, setFormat] = useState("CODE128");
  const [height, setHeight] = useState("100");
  const [error, setError] = useState("");
  const [hasBarcode, setHasBarcode] = useState(false);
  const { confirm, dialog } = useLargeInputConfirmation(4 * 1024);
  const barcodeRef = useRef<SVGSVGElement>(null);

  const generate = (value = input) => {
    if (!value.trim()) {
      barcodeRef.current?.replaceChildren();
      setHasBarcode(false);
      setError("Enter a value to generate a barcode.");
      return;
    }
    if (!barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, value, {
        format,
        height: Math.max(40, Math.min(300, Number(height) || 100)),
        width: 2,
        margin: 12,
        displayValue: true,
        fontSize: 16,
        lineColor: "#111827",
        background: "#ffffff",
      });
      setHasBarcode(true);
      setError("");
    } catch {
      barcodeRef.current.replaceChildren();
      setHasBarcode(false);
      setError(`“${value}” is not valid for ${format}.`);
    }
  };

  const useSample = () => {
    const sample =
      format === "EAN13"
        ? "5901234123457"
        : format === "EAN8"
          ? "96385074"
          : format === "UPC"
            ? "123456789012"
            : "MindsKit-2026";
    setInput(sample);
    generate(sample);
  };

  const downloadSvg = () => {
    if (!barcodeRef.current?.childNodes.length) return;
    const svg = new XMLSerializer().serializeToString(barcodeRef.current);
    download(
      URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      ),
      "mindskit-barcode.svg",
    );
  };

  return (
    <>
      <GeneratorLayout
        title="Barcode"
        description="Generate a scannable barcode from a value entirely in your browser."
        icon={<Barcode />}
        onGenerate={() => confirm(input, generate)}
        onSample={useSample}
        onClear={() => {
          setInput("");
          barcodeRef.current?.replaceChildren();
          setHasBarcode(false);
          setError("");
        }}
        generateLabel="Generate barcode"
        disabled={!input.trim()}>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="flex items-center justify-between gap-2">
            <span>Value</span>
            <TextStats value={input} />
          </span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Enter a product code or text…"
            className={`${fieldClass} w-full`}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="block">Format</span>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CODE128">Code 128 (text)</SelectItem>
                <SelectItem value="CODE39">Code 39</SelectItem>
                <SelectItem value="EAN13">EAN-13</SelectItem>
                <SelectItem value="EAN8">EAN-8</SelectItem>
                <SelectItem value="UPC">UPC-A</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="block">Height (40–300 px)</span>
            <input
              type="number"
              min="40"
              max="300"
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              className={`${fieldClass} w-full`}
            />
          </label>
        </div>
        <ToolStatus state={error ? "invalid" : hasBarcode ? "valid" : "idle"} message={error} validLabel="Barcode generated successfully" />
        <div className="flex min-h-70 flex-1 items-center justify-center overflow-auto rounded-lg border border-dashed border-border bg-muted/30 p-6">
          <svg
            ref={barcodeRef}
            role="img"
            aria-label="Generated barcode"
            className="max-w-full"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={downloadSvg}
          disabled={!hasBarcode}>
          <Download />
          Download SVG
        </Button>
      </GeneratorLayout>
      {dialog}
    </>
  );
}

function GeneratorLayout({
  title,
  description,
  icon,
  onGenerate,
  onSample,
  onClear,
  generateLabel,
  disabled,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onGenerate: () => void;
  onSample: () => void;
  onClear: () => void;
  generateLabel: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader title={title} description={description} />
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" onClick={onGenerate} disabled={disabled}>
          {icon}
          {generateLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onSample}>
          <FileText />
          Sample
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClear}
          disabled={disabled}>
          <Eraser />
          Clear
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        {children}
      </div>
    </div>
  );
}
