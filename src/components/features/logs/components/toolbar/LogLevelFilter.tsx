"use client";

import { Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LOG_FILTER_OPTIONS, type LogLevelLabels } from "../../types";

interface LogLevelFilterProps {
  value: string;
  onChange: (value: string) => void;
  labels: LogLevelLabels;
}

export function LogLevelFilter({ value, onChange, labels }: LogLevelFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-fit text-sm shrink-0">
        <Filter className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder={labels.all} />
      </SelectTrigger>
      <SelectContent>
        {LOG_FILTER_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.color ? (
              <span className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", option.color)} />
                {labels[option.value]}
              </span>
            ) : (
              labels[option.value]
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
