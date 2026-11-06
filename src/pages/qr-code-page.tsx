import { Download, Eraser, FileText, ImagePlus, QrCode, RotateCcw, X } from "lucide-react";
import { createElement, useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { IconType } from "react-icons";
import { SiFacebook, SiGithub, SiInstagram, SiTelegram, SiWhatsapp, SiX, SiYoutube } from "react-icons/si";

import { TextStats } from "@/components/tool/text-stats";
import { ToolPageHeader } from "@/components/tool/tool-page-header";
import { ToolStatus } from "@/components/tool/tool-status";
import { Button } from "@/components/ui/button";
import { defaultQrStyle, renderQrCode } from "@/features/qr-code/render";
import type { QrEye, QrFrame, QrLevel, QrShape, QrStyle } from "@/features/qr-code/render";
import { useLargeInputConfirmation } from "@/hooks/use-large-input-confirmation";
import { usePersistedInput } from "@/hooks/use-persisted-input";
import { useSaveLocally } from "@/hooks/use-save-locally";

type Tab = "frames" | "shapes" | "logo" | "level";

const brands: { name: string; color: string; icon: IconType }[] = [
  { name: "YouTube", color: "#FF0033", icon: SiYoutube },
  { name: "Facebook", color: "#0866FF", icon: SiFacebook },
  { name: "WhatsApp", color: "#25D366", icon: SiWhatsapp },
  { name: "Instagram", color: "#E4405F", icon: SiInstagram },
  { name: "X", color: "#000000", icon: SiX },
  { name: "Telegram", color: "#26A5E4", icon: SiTelegram },
  { name: "GitHub", color: "#181717", icon: SiGithub },
];

function brandDataUrl(icon: IconType, color: string): string {
  const svg = renderToStaticMarkup(createElement(icon, { size: 128, color }))
    .replaceAll("currentColor", color);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function OptionTile({ label, selected, onClick, children }: {
  label: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-label={label} aria-pressed={selected} onClick={onClick}
      className={`flex min-h-22 flex-col items-center justify-center gap-2 rounded-lg border p-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${selected ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-foreground"}`}>
      {children}
      <span>{label}</span>
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
      <span>{label}</span>
      <input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}
        className="size-8 cursor-pointer rounded border border-border bg-transparent" />
    </label>
  );
}

export function QrCodePage() {
  const { enabled } = useSaveLocally();
  const [input, setInput] = usePersistedInput("qr-code", enabled);
  const [generatedInput, setGeneratedInput] = useState("");
  const [style, setStyle] = useState<QrStyle>(defaultQrStyle);
  const [tab, setTab] = useState<Tab>("frames");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useLargeInputConfirmation(3 * 1024);

  const changeStyle = (change: Partial<QrStyle>) => setStyle((current) => ({ ...current, ...change }));

  useEffect(() => {
    if (!generatedInput) return;
    let cancelled = false;
    renderQrCode(generatedInput, style)
      .then((image) => {
        if (!cancelled) {
          setImageUrl(image);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setImageUrl("");
          setError(cause instanceof Error ? cause.message : "Could not generate this QR code.");
        }
      });
    return () => { cancelled = true; };
  }, [generatedInput, style]);

  const generate = (value = input) => {
    if (!value.trim()) {
      setImageUrl("");
      setGeneratedInput("");
      setError("Enter text or a URL to generate a QR code.");
      return;
    }
    setGeneratedInput(value);
    setError("");
  };

  const uploadLogo = (file?: File) => {
    if (!file) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      setError("Choose a PNG or JPEG logo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        changeStyle({ logoUrl: reader.result });
        setError("");
      }
    };
    reader.onerror = () => setError("Could not read the selected logo.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex min-h-0 flex-col gap-4 pb-6 lg:h-full">
      <ToolPageHeader title="QR Code" description="Generate and customize a QR code entirely in your browser." />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!input.trim()} onClick={() => confirm(input, () => generate())}><QrCode />Generate QR code</Button>
        <Button type="button" variant="outline" onClick={() => { const sample = "https://mindskit.dev"; setInput(sample); generate(sample); }}><FileText />Sample</Button>
        <Button type="button" variant="outline" disabled={!input && !generatedInput} onClick={() => { setInput(""); setGeneratedInput(""); setImageUrl(""); setError(""); }}><Eraser />Clear</Button>
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(290px,0.7fr)]">
        <div className="min-w-0 space-y-5 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <label className="block space-y-2 text-sm font-medium">
            <span className="flex items-center justify-between gap-2"><span>Text or URL</span><TextStats value={input} /></span>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="https://example.com or any text…"
              className="min-h-28 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm font-normal text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div role="group" aria-label="QR customization" className="flex flex-wrap gap-1.5">
              {(["frames", "shapes", "logo", "level"] as const).map((item) => (
                <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${tab === item ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>{item}</button>
              ))}
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setStyle(defaultQrStyle); if (fileRef.current) fileRef.current.value = ""; }}><RotateCcw />Reset</Button>
          </div>

          {tab === "frames" && <div className="space-y-5">
            <section className="space-y-3"><h2 className="text-base font-semibold">Frames</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["none", "outline", "corners", "caption"] as QrFrame[]).map((frame) => <OptionTile key={frame} label={frame === "none" ? "None" : frame === "caption" ? "Text frame" : frame === "corners" ? "Corners" : "Outline"} selected={style.frame === frame} onClick={() => changeStyle({ frame })}>
                  <span className={`flex size-9 items-center justify-center border-2 ${frame === "none" ? "border-0" : frame === "corners" ? "border-dashed" : "rounded-sm"}`}><QrCode className="size-5" /></span>
                </OptionTile>)}
              </div>
              {style.frame === "caption" && <label className="block space-y-1 text-sm"><span>Additional text</span><input value={style.caption} maxLength={48} onChange={(event) => changeStyle({ caption: event.target.value })} placeholder="Scan me" className="h-9 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" /></label>}
            </section>
            <section className="space-y-3"><h2 className="text-base font-semibold">Frame background</h2>
              <div className="grid gap-2 sm:grid-cols-2"><ColorField label="Background color" value={style.background} onChange={(background) => changeStyle({ background })} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={style.transparent} onChange={(event) => changeStyle({ transparent: event.target.checked })} className="accent-primary" />Transparent background</label></div>
            </section>
          </div>}

          {tab === "shapes" && <div className="space-y-5">
            <section className="space-y-3"><h2 className="text-base font-semibold">Body shapes</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["square", "rounded", "dots", "diamond"] as QrShape[]).map((shape) => <OptionTile key={shape} label={shape[0].toUpperCase() + shape.slice(1)} selected={style.shape === shape} onClick={() => changeStyle({ shape })}><span className={`size-7 bg-foreground ${shape === "dots" ? "rounded-full" : shape === "rounded" ? "rounded-lg" : shape === "diamond" ? "rotate-45 scale-75" : ""}`} /></OptionTile>)}
            </div></section>
            {(["outerEye", "innerEye"] as const).map((eye) => <section key={eye} className="space-y-3"><h2 className="text-base font-semibold">{eye === "outerEye" ? "External eye" : "Internal eye"}</h2><div className="grid grid-cols-3 gap-2">
              {(["square", "rounded", "circle"] as QrEye[]).map((shape) => <OptionTile key={shape} label={shape[0].toUpperCase() + shape.slice(1)} selected={style[eye] === shape} onClick={() => changeStyle({ [eye]: shape })}><span className={`flex size-8 items-center justify-center border-[5px] border-foreground ${shape === "circle" ? "rounded-full" : shape === "rounded" ? "rounded-lg" : ""}`} /></OptionTile>)}
            </div></section>)}
            <ColorField label="QR color" value={style.foreground} onChange={(foreground) => changeStyle({ foreground })} />
          </div>}

          {tab === "logo" && <div className="space-y-4">
            <h2 className="text-base font-semibold">Logo</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OptionTile label="None" selected={!style.logoUrl} onClick={() => changeStyle({ logoUrl: "" })}><X className="size-7 stroke-1" /></OptionTile>
              {brands.map((brand) => {
                const url = brandDataUrl(brand.icon, brand.color);
                return <OptionTile key={brand.name} label={brand.name} selected={style.logoUrl === url} onClick={() => changeStyle({ logoUrl: url })}><span className="rounded bg-white p-1"><brand.icon className="size-7" style={{ color: brand.color }} /></span></OptionTile>;
              })}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" aria-label="Upload logo image" className="sr-only" onChange={(event) => uploadLogo(event.target.files?.[0])} />
            <Button type="button" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}><ImagePlus />Upload PNG or JPEG</Button>
            <label className="block space-y-2 text-sm"><span>Logo size: {style.logoSize}%</span><input type="range" min="12" max="26" value={style.logoSize} onChange={(event) => changeStyle({ logoSize: Number(event.target.value) })} className="w-full accent-primary" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={style.logoBackground} onChange={(event) => changeStyle({ logoBackground: event.target.checked })} className="accent-primary" />Logo background</label>
            <p className="text-xs text-muted-foreground">Brand icons from Simple Icons. Logos stay in this browser and are never saved.</p>
          </div>}

          {tab === "level" && <div className="space-y-3">
            <div><h2 className="text-base font-semibold">Scannability level <span className="font-normal">(error correction)</span></h2><p className="text-xs text-muted-foreground">Higher levels can recover more of a damaged QR code. Use High or Best with a logo.</p></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {([{ value: "H", label: "Best", detail: "Up to 30% recovery" }, { value: "Q", label: "High", detail: "Up to 25% recovery" }, { value: "M", label: "Medium", detail: "Up to 15% recovery" }, { value: "L", label: "Smallest", detail: "Up to 7% recovery" }] as { value: QrLevel; label: string; detail: string }[]).map((item) => <button key={item.value} type="button" aria-pressed={style.level === item.value} onClick={() => changeStyle({ level: item.value })}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${style.level === item.value ? "border-primary bg-primary/5" : "border-border"}`}><QrCode className="size-9 shrink-0" /><span><strong className="block text-sm">{item.label}</strong><span className="text-xs text-muted-foreground">{item.detail}</span></span></button>)}
            </div>
            <label className="block space-y-1 text-sm"><span>Size (128–1024 px)</span><input type="number" min="128" max="1024" value={style.size} onChange={(event) => changeStyle({ size: Number(event.target.value) })} className="h-9 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" /></label>
          </div>}
        </div>
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div><h2 className="text-base font-semibold">Preview</h2><p className="text-xs text-muted-foreground">Changes to your design update the generated image.</p></div>
          <ToolStatus state={error ? "invalid" : imageUrl ? "valid" : "idle"} message={error} validLabel="QR code generated successfully" />
          <div className="flex min-h-70 flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-5">
            {imageUrl ? <img src={imageUrl} alt="Generated QR code" className="h-auto max-h-80 w-auto max-w-full object-contain" /> : <span className="text-center text-sm text-muted-foreground">Your QR code will appear here.</span>}
          </div>
          <Button type="button" variant="outline" disabled={!imageUrl} onClick={() => { const link = document.createElement("a"); link.href = imageUrl; link.download = "mindskit-qr-code.png"; link.click(); }}><Download />Download PNG</Button>
        </div>
      </div>
      {dialog}
    </div>
  );
}
