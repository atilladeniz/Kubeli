import { expect, test } from "@playwright/test";

test("shows mocked clusters in tauri mock mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Select a Cluster" })).toBeVisible();
  await expect(page.getByText("kubeli-mock", { exact: true })).toBeVisible();
  await expect(page.getByText("kubeli-eks-demo", { exact: true })).toBeVisible();
});
