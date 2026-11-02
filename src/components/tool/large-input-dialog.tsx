import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LargeInputDialog({
  limitLabel,
  onCancel,
  onContinue,
}: {
  limitLabel: string;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="large-input-title"
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-popover p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <AlertTriangle className="size-5" />
          </div>
          <div className="space-y-1">
            <h2
              id="large-input-title"
              className="font-semibold text-foreground">
              ข้อมูลขนาดใหญ่เกินไป
            </h2>
            <p className="text-sm text-muted-foreground">
              เกิน {limitLabel} อาจทำให้เบราว์เซอร์ช้าหรือค้างได้
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            กลับไปแก้
          </Button>
          <Button type="button" onClick={onContinue}>
            ดำเนินการต่อ
          </Button>
        </div>
      </div>
    </div>
  );
}
