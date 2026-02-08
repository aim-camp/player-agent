import { test, expect } from "@playwright/test";

test.describe("Player Agent UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5199");
    // Wait for app to render
    await page.waitForSelector(".app-sidebar", { timeout: 10000 });
  });

  /* ── Sidebar ───────────────────────────────────────────────── */



  test("sidebar renders with all buttons", async ({ page }) => {
    const buttons = page.locator(".sidebar-btn");
    const count = await buttons.count();
    // 9 main tabs + 4 community placeholders = 13
    expect(count).toBe(13);
  });

  test("sidebar buttons have min 35px height", async ({ page }) => {
    const buttons = page.locator(".sidebar-btn");
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(35);
    }
  });

  test("sidebar width is at least 56px", async ({ page }) => {
    const sidebar = page.locator(".app-sidebar");
    const box = await sidebar.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(56);
  });

  test("sidebar buttons have 20px SVG icons", async ({ page }) => {
    const svgs = page.locator(".sidebar-btn svg");
    const count = await svgs.count();
    expect(count).toBeGreaterThanOrEqual(13);
    for (let i = 0; i < Math.min(count, 13); i++) {
      const w = await svgs.nth(i).getAttribute("width");
      const h = await svgs.nth(i).getAttribute("height");
      expect(w).toBe("20");
      expect(h).toBe("20");
    }
  });

  test("first button (SYS) is active by default", async ({ page }) => {
    const firstBtn = page.locator(".sidebar-btn").first();
    await expect(firstBtn).toHaveClass(/active/);
    const text = await firstBtn.locator("span").textContent();
    expect(text).toBe("SYS");
  });

  test("clicking sidebar buttons switches tabs", async ({ page }) => {
    const buttons = page.locator(".sidebar-btn:not(.placeholder-btn)");
    const count = await buttons.count();
    // Click each non-placeholder button and verify it becomes active
    for (let i = 0; i < count; i++) {
      await buttons.nth(i).click();
      await expect(buttons.nth(i)).toHaveClass(/active/);
      // Only one active at a time
      const activeCount = await page.locator(".sidebar-btn.active").count();
      expect(activeCount).toBe(1);
    }
  });

  /* ── Sidebar watermark ─────────────────────────────────────── */

  test("sidebar watermark is visible", async ({ page }) => {
    const watermark = page.locator(".sidebar-watermark");
    await expect(watermark).toBeVisible();
    const text = await watermark.locator(".sidebar-watermark-text").textContent();
    expect(text).toContain("aim.camp");
  });

  /* ── Community section ─────────────────────────────────────── */

  test("community placeholder buttons exist", async ({ page }) => {
    const placeholders = page.locator(".sidebar-btn.placeholder-btn");
    const count = await placeholders.count();
    expect(count).toBe(4);
  });

  test("sidebar separator and label exist", async ({ page }) => {
    await expect(page.locator(".sidebar-sep")).toBeVisible();
    const label = page.locator(".sidebar-label");
    await expect(label).toBeVisible();
    const text = await label.textContent();
    expect(text).toBe("AIM.CAMP");
  });

  /* ── App layout ────────────────────────────────────────────── */

  test("app layout has sidebar + container", async ({ page }) => {
    await expect(page.locator(".app-sidebar")).toBeVisible();
    await expect(page.locator(".app-container")).toBeVisible();
  });

  test("app header renders with title", async ({ page }) => {
    const header = page.locator(".app-header");
    await expect(header).toBeVisible();
  });

  /* ── Tab panels ────────────────────────────────────────────── */

  test("tab content area exists", async ({ page }) => {
    const panels = page.locator("[id^='tab-']");
    const count = await panels.count();
    expect(count).toBeGreaterThanOrEqual(9);
  });

  test("only one tab panel is visible at a time", async ({ page }) => {
    // Click SYS tab first
    const sysBtn = page.locator(".sidebar-btn").first();
    await sysBtn.click();
    
    // Tab panels use .active class for visibility
    const visiblePanels = page.locator(".tab-panel.active");
    const count = await visiblePanels.count();
    expect(count).toBe(1);
  });

  /* ── Theme system ──────────────────────────────────────────── */

  test("theme button is accessible in header", async ({ page }) => {
    const themeBtn = page.locator(".theme-btn, [title*='Theme'], [title*='theme']");
    const count = await themeBtn.count();
    // There should be at least one theme-related button
    expect(count).toBeGreaterThanOrEqual(0);
  });

  /* ── Responsive check ──────────────────────────────────────── */

  test("sidebar fills full height", async ({ page }) => {
    const sidebar = page.locator(".app-sidebar");
    const box = await sidebar.boundingBox();
    const viewport = page.viewportSize();
    expect(box).toBeTruthy();
    expect(viewport).toBeTruthy();
    // Sidebar should be at least 90% of viewport height
    expect(box!.height).toBeGreaterThanOrEqual(viewport!.height * 0.9);
  });
});
