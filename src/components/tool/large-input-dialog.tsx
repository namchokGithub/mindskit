import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}>
      <DialogContent showCloseButton={false} className="max-w-md">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </div>
          <DialogHeader className="space-y-1 gap-0 pr-0">
            <DialogTitle className="font-semibold">
              ข้อมูลขนาดใหญ่เกินไป
            </DialogTitle>
            <DialogDescription>
              เกิน {limitLabel} อาจทำให้เบราว์เซอร์ช้าหรือค้างได้
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter className="mt-1">
          <Button type="button" variant="outline" onClick={onCancel}>
            กลับไปแก้
          </Button>
          <Button type="button" onClick={onContinue}>
            ดำเนินการต่อ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
