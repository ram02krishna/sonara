import { test, expect, Page } from "@playwright/test";

/**
 * Smoke tests run against mocked API responses, so they need neither Spotify
 * credentials nor the Go backend. They verify the app is driven by API data
 * (not hardcoded content) and that auth, search and theming behave.
 */

const track = (id: string, name: string, artist: string) => ({
  id,
  name,
  uri: `spotify:track:${id}`,
  duration_ms: 200000,
  artists: [{ id: `a-${id}`, name: artist }],
  album: { id: `al-${id}`, name: `${name} (album)`, images: [] },
});

async function mockApi(page: Page, opts: { authenticated: boolean; needsOnboarding?: boolean }) {
  await page.route("**/api/v1/auth/session", (r) =>
    r.fulfill({
      json: opts.authenticated
        ? { authenticated: true, is_premium: false, premium_unknown: true, user: { id: "u1", display_name: "Asha Rao", email: "" } }
        : { authenticated: false, is_premium: false },
    })
  );
  await page.route("**/api/v1/dashboard", (r) =>
    r.fulfill({
      json: {
        needs_onboarding: !!opts.needsOnboarding,
        top_genres: ["bollywood", "punjabi pop"],
        market: "IN",
        generated_at: new Date().toISOString(),
        sections: opts.needsOnboarding
          ? []
          : [
              { id: "genre-bollywood", type: "carousel", kind: "tracks", title: "Because you listen to Bollywood", tracks: [track("1", "Kesariya", "Arijit Singh")] },
              { id: "lang-tamil", type: "carousel", kind: "tracks", title: "Tamil picks", tracks: [track("2", "Vaathi Coming", "Anirudh")] },
            ],
      },
    })
  );
  await page.route("**/api/v1/me/playlists", (r) => r.fulfill({ json: { items: [] } }));
  await page.route("**/api/v1/me/preferences", (r) => r.fulfill({ json: { languages: [], genres: [], artists: [], onboarded: false } }));
  await page.route("**/api/v1/search**", (r) =>
    r.fulfill({ json: { tracks: [track("9", "Tum Hi Ho", "Arijit Singh")], artists: [], albums: [], playlists: [] } })
  );
}

test.describe("Sonara smoke tests", () => {
  test("logged-out visitors are sent to the Spotify login", async ({ page }) => {
    await mockApi(page, { authenticated: false });
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /spotify/i }).first()).toBeVisible();
  });

  test("dashboard is built from API sections in the user's own languages", async ({ page }) => {
    await mockApi(page, { authenticated: true });
    await page.goto("/");
    await expect(page.getByText("Because you listen to Bollywood")).toBeVisible();
    await expect(page.getByText("Tamil picks")).toBeVisible();
    await expect(page.getByText("Vaathi Coming")).toBeVisible();
  });

  test("new accounts with no history are asked for their taste", async ({ page }) => {
    await mockApi(page, { authenticated: true, needsOnboarding: true });
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByText("Languages you listen in")).toBeVisible();
  });

  test("header search and the search page share one results source", async ({ page }) => {
    await mockApi(page, { authenticated: true });
    await page.goto("/");
    await page.getByLabel("Search", { exact: true }).fill("tum hi ho");
    await expect(page).toHaveURL(/\/search\?q=tum%20hi%20ho/);
    await expect(page.getByText("Tum Hi Ho").first()).toBeVisible();
  });

  test("theme toggle switches light/dark and survives a reload", async ({ page }) => {
    await mockApi(page, { authenticated: true });
    await page.goto("/");
    const html = page.locator("html");
    const before = await html.getAttribute("data-theme");
    await page.getByLabel("Toggle Theme").click();
    const after = await html.getAttribute("data-theme");
    expect(after).not.toBe(before);
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", after as string);
  });
});
