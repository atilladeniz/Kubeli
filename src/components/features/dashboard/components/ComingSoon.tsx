import { Box } from "lucide-react";

interface ComingSoonProps {
  resource: string;
}

export function ComingSoon({ resource }: ComingSoonProps) {
  const title = resource
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="rounded-2xl bg-muted p-6">
        <Box className="size-16 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">This view is coming soon.</p>
    </div>
  );
}
