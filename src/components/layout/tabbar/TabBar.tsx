"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToHorizontalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { usePlatform } from "@/lib/hooks/usePlatform";
import { useTabsStore, type Tab } from "@/lib/stores/tabs-store";
import { cn } from "@/lib/utils";
import { AddTabButton } from "./components/AddTabButton";
import { CloseLogTabsDialog } from "./components/CloseLogTabsDialog";
import { SortableTab } from "./components/SortableTab";
import { useTabCloseConfirmation } from "./hooks/useTabCloseConfirmation";
import { useTabTitle } from "./hooks/useTabTitle";

export { useTabTitle };

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, openTab, reorderTabs } =
    useTabsStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("tabs");
  const getTabTitle = useTabTitle();
  const { modKeySymbol } = usePlatform();
  const [isDragging, setIsDragging] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const {
    pendingClose,
    dontAskAgain,
    setPendingClose,
    setDontAskAgain,
    requestCloseTab,
    requestCloseOtherTabs,
    requestCloseTabsToRight,
    confirmClose,
  } = useTabCloseConfirmation({
    tabs,
    closeTab,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsDragging(false);
      const { active, over } = event;
      if (over && active.id !== over.id) {
        reorderTabs(active.id as string, over.id as string);
      }
    },
    [reorderTabs]
  );

  const handleWheel = useCallback((event: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += event.deltaY;
    }
  }, []);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent, tab: Tab) => {
      if (event.button === 1) {
        event.preventDefault();
        if (tabs.length > 1) {
          requestCloseTab(tab);
        }
      }
    },
    [requestCloseTab, tabs.length]
  );

  const isAtLimit = tabs.length >= 10;
  const tabIds = tabs.map((tab) => tab.id);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const checkOverflow = () => {
      setIsOverflowing(element.scrollWidth > element.clientWidth);
    };

    checkOverflow();

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [tabs.length]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !activeTabId) return;

    requestAnimationFrame(() => {
      const activeButton = element.querySelector(
        `[data-tab-id="${activeTabId}"]`
      ) as HTMLElement | null;
      if (!activeButton) return;

      const containerRect = element.getBoundingClientRect();
      const tabRect = activeButton.getBoundingClientRect();
      const rightPadding = 8;

      if (tabRect.right + rightPadding > containerRect.right) {
        element.scrollLeft += tabRect.right - containerRect.right + rightPadding;
      }
      if (tabRect.left < containerRect.left) {
        element.scrollLeft -= containerRect.left - tabRect.left + rightPadding;
      }
    });
  }, [activeTabId, tabs.length]);

  const handleAddTab = useCallback(() => {
    if (isAtLimit) return;
    openTab("cluster-overview", getTabTitle("cluster-overview"), { newTab: true });
  }, [getTabTitle, isAtLimit, openTab]);

  const addButton = (
    <AddTabButton
      isAtLimit={isAtLimit}
      modKeySymbol={modKeySymbol}
      newTabLabel={t("newTab")}
      limitReachedLabel={t("limitReached")}
      onClick={handleAddTab}
    />
  );

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-card/30">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setIsDragging(false)}
        modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
      >
        <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
          <div
            ref={scrollRef}
            onWheel={handleWheel}
            className={cn(
              "flex items-center gap-1.5 overflow-x-auto overflow-y-hidden hide-scrollbar min-w-0 flex-1",
              isDragging && "cursor-grabbing"
            )}
          >
            {tabs.map((tab, index) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={activeTabId === tab.id}
                canClose={tabs.length > 1}
                onActivate={() => setActiveTab(tab.id)}
                onClose={() => requestCloseTab(tab)}
                onCloseOthers={() => requestCloseOtherTabs(tab.id)}
                onCloseToRight={() => requestCloseTabsToRight(tab.id)}
                isLast={index === tabs.length - 1}
                onMiddleClick={(event) => handleMouseDown(event, tab)}
                title={tab.type === "pod-logs" ? tab.title : getTabTitle(tab.type)}
                labels={{
                  close: t("close"),
                  closeOthers: t("closeOthers"),
                  closeToRight: t("closeToRight"),
                }}
              />
            ))}
            {!isOverflowing && addButton}
          </div>
        </SortableContext>
      </DndContext>

      {isOverflowing && (
        <div className="shrink-0 flex items-center pl-1 border-l border-border">
          {addButton}
        </div>
      )}

      <CloseLogTabsDialog
        pendingClose={pendingClose}
        dontAskAgain={dontAskAgain}
        closeLogTabLabel={t("closeLogTab")}
        closeLogTabDescriptionLabel={t("closeLogTabDescription")}
        dontAskAgainLabel={t("dontAskAgain")}
        cancelLabel={t("cancel")}
        closeConfirmLabel={t("closeConfirm")}
        onOpenChange={(open) => {
          if (!open) {
            setPendingClose(null);
          }
        }}
        onDontAskAgainChange={setDontAskAgain}
        onConfirm={confirmClose}
      />
    </div>
  );
}
