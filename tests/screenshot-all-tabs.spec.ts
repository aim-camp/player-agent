/**
 * Captures a screenshot of every tab panel in the Player Agent app.
 * Run: npx playwright test tests/screenshot-all-tabs.ts --reporter=line
 * Output: screenshots/ folder
 */
import { test } from "@playwright/test";
import * as fs from "fs";

const TABS = [
  { label: "SYS", index: 0, name: "01-sys-optimizer" },
  { label: "CFG", index: 1, name: "02-cfg-manager" },
  { label: "HW", index: 2, name: "03-hardware-info" },
  { label: "DRV", index: 3, name: "04-drivers" },
  { label: "PROC", index: 4, name: "05-process-manager" },
  { label: "NET", index: 5, name: "06-network" },
  { label: "DEMO", index: 6, name: "07-demo-review" },
  { label: "FDBK", index: 7, name: "08-feedback" },
  { label: "BNCH", index: 8, name: "09-benchmark" },
];

test.describe("Screenshot all tabs", () => {
  test("capture every tab panel", async ({ page }) => {
    const dir = "screenshots";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    await page.goto("http://localhost:5199");
    await page.waitForSelector(".app-sidebar", { timeout: 10000 });

    // Full page dimensions for consistent captures
    await page.setViewportSize({ width: 1280, height: 900 });

    for (const tab of TABS) {
      const btns = page.locator(".sidebar-btn:not(.placeholder-btn)");
      await btns.nth(tab.index).click();
      // Small wait for tab content to render
      await page.waitForTimeout(300);

      // Capture just the main content area
      await page.screenshot({
        path: `${dir}/${tab.name}.png`,
        fullPage: false,
      });

      // Also capture the tab panel scrolled fully (full content)
      const panel = page.locator(".tab-panel.active");
      if (await panel.count() > 0) {
        await panel.first().screenshot({
          path: `${dir}/${tab.name}-panel.png`,
        });
      }
    }

    console.log(`✅ ${TABS.length} tabs captured in screenshots/`);
  });
});
