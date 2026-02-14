"use client";

import { useEffect, useMemo, useState } from "react";
import {
  implementedViews,
  readSidebarUiState,
  saveSidebarUiState,
} from "../types/constants";
import type { ResourceType, SidebarUiStateHook } from "../types/types";

export function useSidebarUiState(): SidebarUiStateHook {
  const initialSidebarUiState = useMemo(() => readSidebarUiState(), []);

  const [namespaceOpen, setNamespaceOpen] = useState(false);
  const [isNamespaceSectionOpen, setIsNamespaceSectionOpen] = useState(
    typeof initialSidebarUiState.namespaceOpen === "boolean"
      ? initialSidebarUiState.namespaceOpen
      : true,
  );
  const [isPortForwardsSectionOpen, setIsPortForwardsSectionOpen] = useState(
    typeof initialSidebarUiState.portForwardsOpen === "boolean"
      ? initialSidebarUiState.portForwardsOpen
      : true,
  );
  const [isFavoritesSectionOpen, setIsFavoritesSectionOpen] = useState(
    typeof initialSidebarUiState.favoritesOpen === "boolean"
      ? initialSidebarUiState.favoritesOpen
      : true,
  );
  const [isRecentSectionOpen, setIsRecentSectionOpen] = useState(
    typeof initialSidebarUiState.recentOpen === "boolean"
      ? initialSidebarUiState.recentOpen
      : true,
  );
  const [isNavFavoritesSectionOpen, setIsNavFavoritesSectionOpen] = useState(
    typeof initialSidebarUiState.navFavoritesOpen === "boolean"
      ? initialSidebarUiState.navFavoritesOpen
      : true,
  );
  const [navFavorites, setNavFavorites] = useState<ResourceType[]>(() => {
    if (!Array.isArray(initialSidebarUiState.navFavorites)) return [];

    const unique = new Set<ResourceType>();
    for (const value of initialSidebarUiState.navFavorites) {
      if (
        typeof value === "string" &&
        implementedViews.includes(value as ResourceType)
      ) {
        unique.add(value as ResourceType);
      }
    }

    return Array.from(unique);
  });

  useEffect(() => {
    saveSidebarUiState({
      namespaceOpen: isNamespaceSectionOpen,
      portForwardsOpen: isPortForwardsSectionOpen,
      favoritesOpen: isFavoritesSectionOpen,
      recentOpen: isRecentSectionOpen,
      navFavoritesOpen: isNavFavoritesSectionOpen,
      navFavorites,
    });
  }, [
    isNamespaceSectionOpen,
    isPortForwardsSectionOpen,
    isFavoritesSectionOpen,
    isRecentSectionOpen,
    isNavFavoritesSectionOpen,
    navFavorites,
  ]);

  const isNavFavorite = (resource: ResourceType): boolean => {
    return navFavorites.includes(resource);
  };

  const toggleNavFavorite = (resource: ResourceType) => {
    setNavFavorites((prev) =>
      prev.includes(resource)
        ? prev.filter((r) => r !== resource)
        : [...prev, resource],
    );
  };

  return {
    namespaceOpen,
    setNamespaceOpen,
    isNamespaceSectionOpen,
    setIsNamespaceSectionOpen,
    isPortForwardsSectionOpen,
    setIsPortForwardsSectionOpen,
    isFavoritesSectionOpen,
    setIsFavoritesSectionOpen,
    isRecentSectionOpen,
    setIsRecentSectionOpen,
    isNavFavoritesSectionOpen,
    setIsNavFavoritesSectionOpen,
    navFavorites,
    isNavFavorite,
    toggleNavFavorite,
  };
}
