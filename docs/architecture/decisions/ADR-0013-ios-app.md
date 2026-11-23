# ADR-0013: An iOS app as a third Capacitor shell, with Sign in with Apple

- Status: Accepted
- Date: 2026-11-23
- Decided by: owner (asked for an iPhone app after the Android release; accepted Sign in with Apple and the same Premium gift as Android)

## Context
The web app and the Android app share one React client; Android is a Capacitor shell around it (ADR-0003). iPhone users today can only use the website, where iOS often blocks the microphone without a prompt (in-app browsers, earlier denials). An App Store app gives them a native microphone permission and a home-screen app.

App Store rules shape the design:
- An app that offers Google sign-in must also offer an equivalent privacy-focused option; Sign in with Apple is the usual one (App Review Guideline 4.8).
- Digital goods sold inside an iOS app must use Apple's in-app purchase.

## Decision
- **One client, three shells.** iOS is added with `@capacitor/ios` as `frontend/ios`, next to `frontend/android`. The interface, voice recording, practice flow, API client and backend are shared without iOS-specific forks. Code that meant "the Android app" and is really "a native app" now checks the native platform (`android` or `ios`) through one helper.
- **Sign-in.** Google sign-in works on iOS exactly as on Android: Supabase OAuth in the in-app browser, back to the app through the `com.turktalk.trainer://auth/callback` link. Sign in with Apple uses the same Supabase OAuth flow with the `apple` provider, so no native sign-in plugin is added. The Apple button is shown in the iOS app only; the website and Android are unchanged.
- **Premium.** Signing in to the iOS app grants the same perpetual Premium as Android. The existing endpoint `POST /api/auth/me/android-premium` accepts `platform: "ios"` as well as `"android"`; the path and the `android_premium_granted_at` column keep their names so released Android clients and the schema stay as they are. The column now records the native-app gift on either platform.
- **No purchases in the app.** The web payment form is hidden on iOS as on Android, so nothing is sold inside the iOS app.
- **Microphone permission.** `Info.plist` carries the microphone usage text that iOS shows in its permission prompt; without it iOS refuses recording. Microphone failure messages in the native apps point to the phone's app settings, not to a browser.
- **Build.** The iOS web assets use the same native build mode as Android (`vite build --mode android`, the native-app mode). `scripts/build-ios.sh` syncs the web build into the Xcode project and opens Xcode; signing and upload to TestFlight are done in Xcode with the owner's Apple Developer account. Automating iOS releases is left for later.

## Alternatives considered
- **Website only for iPhone**: no new platform, but the microphone problems in iOS browsers stay, and there is no App Store presence.
- **A native Sign in with Apple plugin** (system sheet instead of a web page): a smoother sign-in, but a new native dependency and a second sign-in flow to maintain. The web flow can be swapped for it later without changing the backend.
- **Selling Premium through Apple in-app purchase**: a new payment integration and Apple's commission; the free gift keeps both apps consistent.
- **A separate iOS client (Swift)**: duplicates the whole interface.

## Consequences
- New dependency `@capacitor/ios` and a generated Xcode project in the repository; copied web assets and build output are not tracked.
- Building needs Xcode on a Mac. Uploading needs a paid Apple Developer membership. Apple's review adds its own release time.
- The Apple provider is part of the Supabase Auth settings Terraform owns (`infra/main.tf`), switched on when the repository variable `APPLE_CLIENT_ID` (Services ID) and the production secret `APPLE_SECRET` are set; until then the Apple button opens a Supabase error page ("provider is not enabled") in the in-app browser, which the learner closes; Google sign-in keeps working. The owner creates the App ID, Services ID and key in the Apple Developer account; `docs/infrastructure-setup.md` lists the steps.
- Apple limits the client secret to six months, so it has to be regenerated and the secret updated twice a year, or Apple sign-in stops working.
- The privacy policy and terms name the iOS app and Apple as a sign-in provider.
- Apple's reviewers need a way in: Google or Apple sign-in with their own account is open to anyone.
- Release process, version numbers and CI for iOS releases are not covered yet; until then iOS builds are made by hand from `main`. The backend must be deployed before an iOS build reaches users: an older backend rejects `platform: "ios"` and the app cannot load the profile (found by the first simulator run). Automated simulator tests: ADR-0014.
- Open, needs the owner's decision before App Store review: Apple requires account deletion that starts inside the app (Guideline 5.1.1(v)) and, for accounts created with Sign in with Apple, revoking the user's Apple tokens on deletion. Today deletion is requested by email from the account-deletion page and nothing revokes Apple tokens.
- The iOS microphone prompt text in `Info.plist` is English only; a Russian `InfoPlist.strings` is still to be added in Xcode.
