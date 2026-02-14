"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { RESOURCE_I18N_KEYS } from "../constants";

export function useTabTitle() {
  const tNav = useTranslations("navigation");

  return useCallback(
    (type: string): string => {
      const keys = RESOURCE_I18N_KEYS[type];
      if (!keys) return type;

      const [sectionKey, itemKey] = keys;
      const capitalize = (value: string) =>
        value.charAt(0).toUpperCase() + value.slice(1);
      const section = tNav.has(sectionKey)
        ? tNav(sectionKey)
        : capitalize(sectionKey);
      const item = tNav.has(itemKey) ? tNav(itemKey) : capitalize(itemKey);
      return `${section} - ${item}`;
    },
    [tNav]
  );
}
