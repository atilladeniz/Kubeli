import { expect, test } from "@playwright/test";

test("shows mocked clusters in tauri mock mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Select a Cluster" })).toBeVisible();
  // Cluster name and context can share the same string (e.g. "kubeli-mock"),
  // so scope to the card title's <span> to stay unambiguous.
  await expect(
    page.locator("[data-slot=card-title] span", { hasText: "kubeli-mock" }).first(),
  ).toBeVisible();
  await expect(
    page.locator("[data-slot=card-title] span", { hasText: "kubeli-eks-demo" }).first(),
  ).toBeVisible();
});
