import { ShieldCheck } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Checkbox } from "@/components/ui/checkbox";
import { categories, tools } from "@/config/tools";
import { useSaveLocally } from "@/hooks/use-save-locally";

export function ToolPageHeader({
  title,
  description,
  showRememberInput = true,
}: {
  title: string;
  description: string;
  showRememberInput?: boolean;
}) {
  const { enabled, setEnabled } = useSaveLocally();
  const { pathname } = useLocation();

  const category = tools.find((tool) => tool.path === pathname)?.category;
  const categoryName = categories.find((c) => c.id === category)?.name;

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-6 lg:pt-1">
      <div className="min-w-0 max-w-[760px] space-y-1">
        {categoryName && (
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {categoryName}
          </p>
        )}
        <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {title}
        </h1>
        <p className="text-sm leading-snug text-muted-foreground">{description}</p>
      </div>
      {showRememberInput && <label className="flex w-full shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:w-fit">
        <Checkbox
          checked={enabled}
          onCheckedChange={(checked) => setEnabled(checked === true)}
        />
        <ShieldCheck className="size-3.5 shrink-0 text-primary" />
        <span className="flex flex-col leading-tight">
          <span>Remember input</span>
          <span className="text-[11px] text-muted-foreground/80">
            Stored only in this browser
          </span>
        </span>
      </label>}
    </div>
  );
}
