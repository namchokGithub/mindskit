import { CheckCircle2, ShieldCheck } from "lucide-react";

const POINTS = [
  "Pasted data is processed with native browser APIs (JSON, DOMParser, XMLSerializer) and is never transmitted to a MindsKit server.",
  "MindsKit has no backend, no database, and no server-side processing of anything you paste.",
  "Remember input, which saves your typed input across reloads, is opt-in and off by default; when enabled, it's stored in your browser's localStorage. README Builder's saved drafts are separate: they autosave to your browser's IndexedDB automatically, independent of the Remember input setting.",
  "No analytics capture the content of what you paste, and no accounts or tracking are used.",
  "README Builder's badge previews load images from Shields.io (img.shields.io), so a badge's label, message, and color text are sent to that third-party service as part of the image URL — not to any MindsKit-controlled server.",
];

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          <ShieldCheck className="size-5 text-primary" />
          Privacy
        </h1>
        <p className="text-sm text-muted-foreground">
          MindsKit is built to keep your data on your device.
        </p>
      </div>

      <ul className="space-y-3">
        {POINTS.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
