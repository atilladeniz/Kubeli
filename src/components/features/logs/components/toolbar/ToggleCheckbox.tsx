"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ToggleCheckboxProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  icon?: React.ReactNode;
}

export function ToggleCheckbox({
  id,
  checked,
  onCheckedChange,
  label,
  icon,
}: ToggleCheckboxProps) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(checked) => onCheckedChange(checked as boolean)}
        className="size-4"
      />
      <Label
        htmlFor={id}
        className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
      >
        {icon}
        {label}
      </Label>
    </div>
  );
}
