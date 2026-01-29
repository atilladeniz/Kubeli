import { useTranslations } from "next-intl";
import type { Theme } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";

interface ThemeSelectorProps {
  value: Theme;
  onChange: (theme: Theme) => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const t = useTranslations("settings");

  return (
    <div className="grid grid-cols-4 gap-3 p-1">
      <ThemeOption
        theme="light"
        label={t("theme.light")}
        selected={value === "light"}
        onSelect={onChange}
      >
        <div className="h-full bg-[#f5f5f5] p-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <div className="size-1.5 rounded-full bg-gray-300" />
            <div className="h-1.5 w-8 rounded-full bg-gray-300" />
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-300" />
          <div className="h-1.5 w-3/4 rounded-full bg-gray-300" />
          <div className="mt-auto h-1.5 w-6 rounded-full bg-primary" />
        </div>
      </ThemeOption>

      <ThemeOption
        theme="dark"
        label={t("theme.dark")}
        selected={value === "dark"}
        onSelect={onChange}
      >
        <div className="h-full bg-[#1f1f1f] p-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <div className="size-1.5 rounded-full bg-gray-600" />
            <div className="h-1.5 w-8 rounded-full bg-gray-600" />
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-600" />
          <div className="h-1.5 w-3/4 rounded-full bg-gray-600" />
          <div className="mt-auto h-1.5 w-6 rounded-full bg-primary" />
        </div>
      </ThemeOption>

      <ThemeOption
        theme="classic-dark"
        label={t("theme.classic")}
        selected={value === "classic-dark"}
        onSelect={onChange}
      >
        <div className="h-full bg-[#191a22] p-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <div className="size-1.5 rounded-full bg-gray-600" />
            <div className="h-1.5 w-8 rounded-full bg-gray-600" />
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-600" />
          <div className="h-1.5 w-3/4 rounded-full bg-gray-600" />
          <div className="mt-auto h-1.5 w-6 rounded-full bg-indigo-500" />
        </div>
      </ThemeOption>

      <ThemeOption
        theme="system"
        label={t("theme.system")}
        selected={value === "system"}
        onSelect={onChange}
      >
        <div className="h-full flex">
          <div className="w-1/2 bg-[#f5f5f5] p-1.5 flex flex-col gap-1">
            <div className="h-1 w-full rounded-full bg-gray-300" />
            <div className="h-1 w-3/4 rounded-full bg-gray-300" />
            <div className="mt-auto h-1 w-4 rounded-full bg-primary" />
          </div>
          <div className="w-1/2 bg-[#1f1f1f] p-1.5 flex flex-col gap-1">
            <div className="h-1 w-full rounded-full bg-gray-600" />
            <div className="h-1 w-3/4 rounded-full bg-gray-600" />
            <div className="mt-auto h-1 w-4 rounded-full bg-primary" />
          </div>
        </div>
      </ThemeOption>
    </div>
  );
}

interface ThemeOptionProps {
  theme: Theme;
  label: string;
  selected: boolean;
  onSelect: (theme: Theme) => void;
  children: React.ReactNode;
}

function ThemeOption({ theme, label, selected, onSelect, children }: ThemeOptionProps) {
  return (
    <button
      onClick={() => onSelect(theme)}
      className={cn("flex flex-col items-center gap-2 group")}
    >
      <div
        className={cn(
          "w-full aspect-[4/3] rounded-lg border-2 overflow-hidden transition-all",
          selected
            ? "border-primary ring-2 ring-primary/20"
            : "border-border hover:border-muted-foreground/50"
        )}
      >
        {children}
      </div>
      <span
        className={cn(
          "text-xs font-medium transition-colors",
          selected
            ? "text-foreground"
            : "text-muted-foreground group-hover:text-foreground"
        )}
      >
        {label}
      </span>
    </button>
  );
}
