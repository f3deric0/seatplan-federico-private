import { join } from "node:path";
import { tmpdir } from "node:os";
import AxeBuilder from "@axe-core/playwright";
import { demoLinks, expect, lastPart, test } from "./fixtures";
import { openOwnerRoom } from "./room-session";

for (const width of [1440, 390]) {
  test(`owner places fixed elements and zones with undo at ${width}px`, async ({ page, request }) => {
    const links = await demoLinks(request);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await openOwnerRoom(page, request, lastPart(links.restaurant_booking));
    await page.getByRole("button", { name: "Fixed", exact: true }).click();
    await page.getByRole("button", { name: "Place Bar", exact: true }).click();
    await expect(page.getByLabel("Object width (cm)")).toBeHidden();
    await page.getByLabel("Fixture label", { exact: true }).fill("Service bar");
    await page.getByLabel("Fixture label", { exact: true }).press("Tab");
    await page.getByText("Size, position and shape", { exact: true }).click();
    await page.getByLabel("Object x (cm)").fill("650");
    await page.getByLabel("Object x (cm)").press("Tab");
    await page.getByLabel("Object y (cm)").fill("250");
    await page.getByLabel("Object y (cm)").press("Tab");
    await page.getByLabel("Object width (cm)").fill("220");
    await page.getByLabel("Object width (cm)").press("Tab");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByLabel("Object width (cm)")).toHaveValue("150");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(page.getByLabel("Object width (cm)")).toHaveValue("220");
    await page.getByLabel("Object rotation (degrees)").fill("45");
    await page.getByLabel("Object rotation (degrees)").press("Tab");
    await page.screenshot({ path: join(tmpdir(), `seatplan-room-fixed-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Zones", exact: true }).click();
    await page.getByRole("button", { name: "Place quiet zone", exact: true }).click();
    await page.getByRole("button", { name: "Place selected in room", exact: true }).click();
    await page.getByLabel("Zone name", { exact: true }).fill("Quiet corner");
    await page.getByLabel("Zone name", { exact: true }).press("Tab");
    await expect(page.getByLabel("Zone type", { exact: true })).toHaveValue("quiet");
    await page.getByRole("button", { name: "Remove zone", exact: true }).click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.getByLabel("Selected zone").selectOption({ label: "Quiet corner" });
    await expect(page.getByLabel("Zone name", { exact: true })).toHaveValue("Quiet corner");
    await page.screenshot({ path: join(tmpdir(), `seatplan-room-zones-${width}.png`), fullPage: true });
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("palette drop places a fixture and moving it makes one undo step", async ({ page, request }) => {
  const links = await demoLinks(request);
  await openOwnerRoom(page, request, lastPart(links.restaurant_booking));
  await page.getByRole("button", { name: "Fixed", exact: true }).click();
  await page.getByRole("button", { name: "Place Plant", exact: true }).dragTo(page.locator(".room-canvas"), { targetPosition: { x: 400, y: 200 } });
  await expect(page.getByLabel("Fixture label", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Fixed element shape")).toHaveValue("circle");
  const before = await page.getByLabel("Object x (cm)").inputValue();
  const circle = (await page.locator(".room-fixture > circle").boundingBox())!;
  await page.mouse.move(circle.x + circle.width / 2, circle.y + circle.height / 2);
  await page.mouse.down();
  await page.mouse.move(circle.x + circle.width / 2 + 90, circle.y + circle.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(Number(await page.getByLabel("Object x (cm)").inputValue())).toBeGreaterThan(Number(before));
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Object x (cm)")).toHaveValue(before);
});

test("a fixed element stays inside the room, on a chessboard, and can be placed freely", async ({ page, request }) => {
  const links = await demoLinks(request);
  await openOwnerRoom(page, request, lastPart(links.restaurant_booking));
  await expect(page.locator("[data-room-checker]")).toHaveCount(1);
  await page.getByRole("button", { name: "Fixed", exact: true }).click();
  await page.getByRole("button", { name: "Place WC", exact: true }).click();
  await page.getByText("Size, position and shape", { exact: true }).click();
  const x = page.getByLabel("Object x (cm)");
  expect(Number(await x.inputValue()) % 50).toBe(0); // on the grid by default
  const wc = (await page.locator(".room-fixture").first().boundingBox())!;
  const canvas = (await page.locator(".room-canvas").boundingBox())!;
  await page.mouse.move(wc.x + wc.width / 2, wc.y + wc.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width - 4, wc.y + wc.height / 2, { steps: 12 });
  await page.mouse.up();
  expect(Number(await x.inputValue()) + Number(await page.getByLabel("Object width (cm)").inputValue())).toBeLessThanOrEqual(1100); // stopped at the wall
  await x.fill("5000");
  await x.press("Tab");
  await expect(page.getByText("Keep the element inside the room.", { exact: true })).toBeVisible();
  await page.getByLabel("Free placement (no grid snapping)").check();
  await expect(page.getByLabel("Free placement (no grid snapping)")).toBeChecked();
});
