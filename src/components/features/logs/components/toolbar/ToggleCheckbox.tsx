"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ToggleCheckboxProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export function ToggleCheckbox({
  id,
  checked,
  onCheckedChange,
  label,
  icon,
  disabled,
}: ToggleCheckboxProps) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(checked) => onCheckedChange(checked as boolean)}
        className="size-4"
        disabled={disabled}
      />
      <Label
        htmlFor={id}
        className={`text-xs cursor-pointer flex items-center gap-1 ${disabled ? "text-muted-foreground/50" : "text-muted-foreground"}`}
      >
        {icon}
        {label}
      </Label>
    </div>
  );
}
