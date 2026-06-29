# Shipping ThinkThru to the Play Store (TWA)

Goal: get a real, installable Android app onto your wife's phone via the Play
Store's **Internal Testing** track — no public launch, no long review wait.

The app is a TWA (Trusted Web Activity): a thin Android wrapper around the live
PWA at https://thinkthru.app. Your web push notifications show up as normal
Android notifications inside it. You don't maintain any Android code — the app
is the website.

---

## Accounts (fill these in once)

- **Owner / admin Google account:** `siva1793@gmail.com` — sign into ThinkThru
  with this, own the Play Console app with it, and set it as `ADMIN_EMAILS` in
  Vercel (gates the `/api/admin/migrate` button to you).
- **Tester:** your wife's Google account (whatever is signed in on the phone
  that installs the app) — added under Internal testing → Testers.

## 0. One-time prerequisites

- A **Google Play Developer account** — https://play.google.com/console — $25
  once. (Sign up with the Google account you want to own the app.)
- The PWA must be installable. It is: manifest, service worker (with a fetch
  handler), and 192/512 icons are all in `public/`. Confirm at
  https://www.pwabuilder.com by entering `https://thinkthru.app` — aim for a
  green/installable score before packaging.

## 1. Generate the Android package with PWABuilder (no local tools)

1. Go to https://www.pwabuilder.com and enter `https://thinkthru.app`.
2. Click **Package For Stores → Android**.
3. Settings to set:
   - **Package ID**: `app.thinkthru.twa` (must match `assetlinks.json` in this
     repo — see step 3).
   - **App name**: `ThinkThru`
   - **Launcher name**: `ThinkThru`
   - Signing key: **let PWABuilder create a new signing key**, OR choose "use
     Play App Signing" (recommended — see step 3). Either way, **download and
     keep the generated `.zip`**; it contains the keystore and a
     `signing-key-info.txt` with passwords. Losing this = you can never update
     the app. Store it somewhere safe (password manager).
4. Download the generated `.zip`. Inside you get an **`.aab`** (the upload
   bundle) and the signing assets.

## 2. Create the app in Play Console

1. Play Console → **Create app** → name `ThinkThru`, App, Free.
2. Complete the required declarations (privacy policy URL, content rating,
   data safety, target audience). For data safety, declare what you collect:
   Google account email/name (auth), user-generated content. Be honest and
   minimal.
3. Left nav → **Testing → Internal testing → Create new release**.

## 3. Wire Digital Asset Links (hides the browser URL bar)

This is what makes it feel like a native app instead of a Chrome tab.

1. In Play Console → **Release → Setup → App signing**, copy the
   **SHA-256 certificate fingerprint** (the one under "App signing key
   certificate", since you're using Play App Signing).
2. Paste it into `web/public/.well-known/assetlinks.json`, replacing
   `REPLACE_WITH_SHA256_FINGERPRINT_FROM_PLAY_APP_SIGNING`. Keep the
   `package_name` as `app.thinkthru.twa`.
3. Commit + deploy so it's live at
   https://thinkthru.app/.well-known/assetlinks.json (it must return that JSON
   publicly). Verify by opening that URL in a browser.

> If you let PWABuilder make the key instead of Play App Signing, use that
> key's SHA-256 instead. You can include multiple fingerprints in the array —
> safe to list both the upload key and the Play signing key.

## 4. Upload + send to your wife

1. In the Internal testing release, upload the **`.aab`** from step 1.
2. Add a release name + notes, **Save → Review release → Start rollout**.
3. **Testers** tab → create an email list → add your wife's Google account
   email (the one on her phone) → save.
4. Copy the **"Copy link"** opt-in URL and send it to her. She opens it on her
   phone, taps "Become a tester", then "Download it on Google Play". Installs
   like any app.

Internal testing has effectively no review delay, so she can install within
minutes of rollout.

---

## Checklist before you send the link

- [ ] `assetlinks.json` live with the real fingerprint (URL bar hidden on launch)
- [ ] Sign in with Google works inside the app
- [ ] A push notification actually arrives on the phone (use the "Send a test"
      button in Notifications settings)
- [ ] First-run "Plant → Weigh in → Bloom" intro shows for a brand-new account
- [ ] Privacy policy URL is real and reachable

## Updating later

Re-run PWABuilder (or just bump the version), upload a new `.aab` to the same
track with a higher version code, roll out. The website itself updates
instantly on every deploy — you only re-package when you change the manifest,
icons, or Android shell.
