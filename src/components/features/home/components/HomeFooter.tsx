import { useTranslations } from "next-intl";
import packageJson from "../../../../../package.json";

export function HomeFooter() {
  const tw = useTranslations("welcome");

  return (
    <footer className="border-t border-border px-6 py-3 text-center text-xs text-muted-foreground">
      {tw("footer", { version: packageJson.version })}
    </footer>
  );
}
