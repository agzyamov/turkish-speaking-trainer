// Mocks for account endpoints added after many specs were written:
// - POST /api/auth/me/android-premium (the Android client's account call): answered with the
//   spec's own /api/auth/me account, upgraded to Premium as the backend does for Android.
// - GET/PUT /api/auth/me/preferences (only with { preferences: true }): soft assistance off unless the spec's account says otherwise;
//   a PUT echoes the saved value.
// Register after the spec's own API route (Playwright tries the newest route first). A spec that
// mocks these endpoints itself should not call this.
export async function installAccountRoutes(page, { preferences = false } = {}) {
  const specAccount = () =>
    page.evaluate(async () => {
      const response = await fetch("/api/auth/me", { headers: { Authorization: "Bearer e2e-local-only" } });
      return response.json();
    });
  await page.route("**/api/auth/me/android-premium", async route => {
    const account = await specAccount();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...account, access_tier: "premium" }) });
  });
  if (!preferences) return;
  await page.route("**/api/auth/me/preferences", async route => {
    const request = route.request();
    const body = request.method() === "GET" ? { assistance_enabled: Boolean((await specAccount()).assistance_enabled) } : { assistance_enabled: Boolean(request.postDataJSON()?.assistance_enabled) };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}
