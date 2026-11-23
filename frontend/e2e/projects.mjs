// Reasons for per-project skips (playwright.config.mjs projects). Every skip names one of these,
// so `grep -rn projects.mjs e2e` lists them all.

// The phone profiles (iphone, pixel) open at phone width, where the app starts the first topic directly
// and shows no topic list. Specs that rely on the default desktop viewport do not apply there. These flows
// (including the network retry paths) are covered at desktop width in chromium and webkit; the phone
// profiles run every other spec.
export const desktopLayoutOnly = "Desktop layout only: at phone-profile width the app opens the first topic directly, without the topic list";

// Known WebKit defects found by the WebKit projects (webkit, iphone). Marked `fixme`, not skipped silently:
// remove the mark once the application is fixed.
export const webkitLazyRetry =
  "WebKit defect: a failed dynamic import's error message carries no URL ('Importing a module script failed.'), so DeferredPanel retries the same cached failed module and the section never loads";
export const webkitSelectOverflow =
  "WebKit defect (Russian labels; English passes): the native <select> in the speech-recognition experiment card adds 4px of scrollable overflow to the card at 320px (scrollWidth 290 > clientWidth 286; 286 with the select hidden)";
