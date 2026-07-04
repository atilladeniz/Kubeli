import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ContextMenuItemDef } from "../types";

interface MenuItemProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
  className?: string;
  children: ReactNode;
}

export interface MenuSlots {
  Item: ComponentType<MenuItemProps>;
  Separator: ComponentType;
  Sub: ComponentType<{ children: ReactNode }>;
  SubTrigger: ComponentType<{ disabled?: boolean; className?: string; children: ReactNode }>;
  SubContent: ComponentType<{ children: ReactNode }>;
}

function MenuItemBody({ item }: { item: ContextMenuItemDef }) {
  return (
    <>
      {item.icon}
      {item.label}
      {item.hint && (
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[10px] font-mono font-medium",
            item.hintVariant === "active"
              ? "bg-purple-500/20 text-purple-400"
              : "bg-muted text-foreground"
          )}
        >
          {item.hint}
        </span>
      )}
    </>
  );
}

export function renderMenuItems(items: ContextMenuItemDef[], slots: MenuSlots) {
  const { Item, Separator, Sub, SubTrigger, SubContent } = slots;

  return items.map((item, index) =>
    item.separator ? (
      <Separator key={`sep-${index}`} />
    ) : item.children ? (
      <Sub key={item.label}>
        <SubTrigger disabled={item.disabled} className="gap-2">
          {item.icon}
          {item.label}
        </SubTrigger>
        <SubContent>
          {item.children.map((child) => (
            <Item
              key={child.label}
              onClick={child.onClick}
              disabled={child.disabled}
              variant={child.variant}
              className="gap-2"
            >
              <MenuItemBody item={child} />
            </Item>
          ))}
        </SubContent>
      </Sub>
    ) : (
      <Item
        key={item.label}
        onClick={item.onClick}
        disabled={item.disabled}
        variant={item.variant}
        className="gap-2"
      >
        <MenuItemBody item={item} />
      </Item>
    )
  );
}
