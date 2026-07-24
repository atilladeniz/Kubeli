import { useState } from "react";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { ContextMenuItemDef } from "../types";
import { renderMenuItems, type MenuSlots } from "./menu-items";

const slots: MenuSlots = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

export function ResourceActionsMenu({
  getItems,
}: {
  getItems: () => ContextMenuItemDef[];
}) {
  // Lazy like the row context menu: items are only built once the menu opens,
  // so getItems() is never called during plain row rendering.
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      {open && (
        <DropdownMenuContent align="end" className="w-48">
          {renderMenuItems(getItems(), slots)}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
