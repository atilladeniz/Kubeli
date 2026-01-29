import { cn } from "@/lib/utils";
import { getNamespaceColor } from "@/lib/utils/colors";

export function NamespaceColorDot({ namespace }: { namespace: string }) {
  const color = getNamespaceColor(namespace);
  return <span className={cn("size-2 rounded-full shrink-0", color.dot)} />;
}
