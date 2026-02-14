import { useTranslations } from "next-intl";

interface HomeFooterProps {
  version: string;
}

export function HomeFooter({ version }: HomeFooterProps) {
  const tw = useTranslations("welcome");

  return (
    <footer className="border-t border-border px-6 py-3 text-center text-xs text-muted-foreground">
      {tw("footer", { version })}
    </footer>
  );
}
