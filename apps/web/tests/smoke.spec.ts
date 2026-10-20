import { test, expect } from "@playwright/test";

test.describe("Sonara Smoke Tests", () => {
  test("homepage displays bento dashboard and hero resonance", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Sonara").first()).toBeVisible();
    await expect(page.locator("text=Jump Back In")).toBeVisible();
    await expect(page.locator("text=Listening Pulse")).toBeVisible();
    await expect(page.locator("text=Curated Soundscapes")).toBeVisible();
  });

  test("search page allows filtering catalog", async ({ page }) => {
    await page.goto("/search");
    await expect(page.locator("text=Search Catalog")).toBeVisible();
    const searchInput = page.locator('input[placeholder*="Search songs"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Starboy");
    await expect(page.locator("text=Starboy").first()).toBeVisible();
  });

  test("persistent bottom player renders with playback scrubber", async ({ page }) => {
    await page.goto("/");
    // Mini-player bar at bottom
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.locator('button[aria-label="Play"], button[aria-label="Pause"]').first()).toBeVisible();
  });

  test("library page displays playlists and allows creating custom playlist", async ({ page }) => {
    await page.goto("/library");
    await expect(page.locator("text=Your Library")).toBeVisible();
    await expect(page.locator("text=Liked Songs")).toBeVisible();
    await page.click("text=New Playlist");
    await expect(page.locator("text=Create New Playlist")).toBeVisible();
  });

  test("stats dashboard renders listening hours and genre breakdown", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.locator("text=Listening Analytics")).toBeVisible();
    await expect(page.locator("text=Listening Activity")).toBeVisible();
    await expect(page.locator("text=Genre Affinity")).toBeVisible();
  });
});
