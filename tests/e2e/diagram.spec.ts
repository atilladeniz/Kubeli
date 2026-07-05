import { expect, test } from "@playwright/test";

// Regression test for the blank-diagram bug: the ELK layout must produce
// positioned nodes end-to-end (elk-api on the main thread driving ELK's
// worker). If the worker dies on load, the store fills but no React Flow
// nodes ever render — exactly what this asserts against.
test("renders positioned diagram nodes via the ELK worker", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Connect" }).first().click();
  await expect(page.getByRole("complementary")).toBeVisible();

  await page.getByText("Resource Diagram").first().click();

  // Toolbar proves graph data arrived...
  await expect(page.getByText(/10 nodes/i)).toBeVisible();

  // ...and the canvas must actually contain laid-out nodes.
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 15000 });
  expect(await page.locator(".react-flow__node").count()).toBeGreaterThanOrEqual(10);
  await expect(page.locator(".react-flow__node", { hasText: "demo-web-pod-0" })).toBeVisible();
});
