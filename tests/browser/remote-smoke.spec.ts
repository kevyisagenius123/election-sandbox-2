import { expect, test } from "@playwright/test";

test("deployed home, laboratory, and deterministic scenario replay remain connected", async ({ page, context, baseURL }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Remote smoke runs only against an explicit deployed base URL");
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(baseURL!).origin });

  await page.goto("./");
  await expect(page.getByRole("button", { name: "Open Sandbox", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Open Sandbox", exact: true }).first().click();
  await expect(page).toHaveURL(/\/app\/$/);
  await page.getByRole("button", { name: "Pennsylvania", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copy scenario link" })).toBeEnabled();
  await page.getByRole("button", { name: "Open controls" }).click();
  await page.getByRole("button", { name: "Preference", exact: true }).click();
  await page.getByRole("slider", { name: "Two-party preference transfer" }).fill("1");
  await expect(page.getByRole("region", { name: "Flip requirement for Pennsylvania" })).toContainText("49,679");
  await page.getByRole("button", { name: "Copy scenario link" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());

  const replay = await context.newPage();
  await replay.goto(copied);
  await expect(replay.getByRole("button", { name: "Copy scenario link" })).toBeEnabled();
  await expect(replay.getByRole("region", { name: "Flip requirement for Pennsylvania" })).toContainText("49,679");
  await expect(replay.getByRole("status")).toContainText("restored from compatible deterministic recipes");
});
