import { Label } from "@/components/ui/label";
import type { SettingSectionProps } from "../types";

export function SettingSection({ title, description, children }: SettingSectionProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
