# Capacitor migration — native push + one-tap settings, from the same web app

**Why do this:** the TWA can't give you a "open notification settings" button
(Google sandboxes the web layer inside a TWA). Capacitor wraps the *same* web
app in a native shell that has a real JS↔native bridge, so ThinkThru can:

- open its own notification settings in **one tap**
  (`NativeSettings.openAndroid({ option: AndroidSettings.AppNotification })`),
- deliver **native push** (FCM on Android, APNs on iOS) — the most reliable
  channel, with the native permission prompt,
- ship a real **iOS App Store** app from the same codebase.

**The guiding principle stays the same:** one web codebase is the source of
truth. The native shells just load it. You keep deploying the web app exactly as
now.

---

## 0. The one big decision: how the app loads the web app

**Option A — Remote URL (recommended).** Point Capacitor at the live site
(`server.url = "https://thinkthru.app"`). The native app loads your deployed
website in a WebView, with the Capacitor bridge injected — so the site can call
native plugins (push, settings). This keeps the "app = website, auto-updates on
every deploy" model you have today with the TWA. No re-packaging for web
changes.

**Option B — Bundled build.** Copy a static export of the web app into the
native project. More offline-capable, but you'd re-package the app on every web
change, and Next.js server components + Auth.js don't static-export cleanly. Not
worth it here.

→ **Go with Option A.** Everything below assumes it.

### Gotchas of loading remotely (read before starting)

- **Google OAuth in a WebView is blocked by Google** (`disallowed_useragent`) —
  they refuse embedded WebViews for security. Two clean answers, both already in
  our favour:
  - The **email magic-link is now the default sign-in** — it works perfectly in
    a WebView. Most people never touch Google in the app.
  - If you still want a Google button in the app, use **native Google Sign-In**
    (`@codetrix-studio/capacitor-google-auth`) instead of the web OAuth flow.
- **Cookies/session** work in the WebView like a normal browser; Auth.js JWT
  sessions are fine.

---

## 1. Keep the same identity (so it's an *update*, not a new listing)

- **Package id:** keep `app.thinkthru.twa`. Same id + same signing key = the
  Capacitor build is an **update** to your existing Play listing, not a new app.
- **Signing key:** reuse the `signing.keystore` you already have (the one in the
  "ThinkThru - Google Play package" zip). Do **not** generate a new one.
- `assetlinks.json` no longer matters for Capacitor (that was a TWA concept), but
  leaving it live is harmless.

> One caveat: switching a live app from TWA to Capacitor changes what the app
> *is* under the hood. It's still fine as an update as long as package id +
> signing key match and the version code increments. Test on internal testing
> before rolling wider.

---

## 2. Add Capacitor to the web project

```bash
cd web
npm i @capacitor/core @capacitor/app @capacitor/push-notifications capacitor-native-settings
npm i -D @capacitor/cli
npx cap init ThinkThru app.thinkthru.twa --web-dir=public
```

`capacitor.config.ts`:

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.thinkthru.twa",
  appName: "ThinkThru",
  webDir: "public", // unused at runtime with server.url, but required
  server: {
    url: "https://thinkthru.app",
    cleartext: false,
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};
export default config;
```

Add platforms:

```bash
npx cap add android
npx cap add ios      # macOS + Xcode required
```

---

## 3. Firebase (the native push backend for BOTH platforms)

Firebase Cloud Messaging (FCM) can deliver to Android *and* iOS (via APNs), so
you get one send path.

1. Create a Firebase project (console.firebase.google.com).
2. **Android app** in it → download `google-services.json` → put in
   `android/app/`.
3. **iOS app** in it → download `GoogleService-Info.plist` → add in Xcode.
4. **APNs key** (Apple Developer → Keys → +, enable APNs) → upload the `.p8` to
   Firebase → Project settings → Cloud Messaging → Apple app configuration.
5. Server: add the **Firebase Admin SDK** service-account JSON to Vercel as an
   env var (`FIREBASE_SERVICE_ACCOUNT`).

---

## 4. Wire push in the web app (native-aware, non-breaking)

Add a native branch to the existing push client. On the web it no-ops; in the
Capacitor shell it registers a native token and sends it to our server.

```ts
// src/lib/native-push.ts
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export function isNative() {
  return Capacitor.isNativePlatform();
}

export async function enableNativePush() {
  const perm = await PushNotifications.requestPermissions(); // NATIVE prompt
  if (perm.receive !== "granted") return "denied";
  await PushNotifications.register();
  PushNotifications.addListener("registration", (token) => {
    // Send the FCM/APNs token to our server (new endpoint, step 5).
    void fetch("/api/push/native-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
    });
  });
  PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
    const url = a.notification.data?.url;
    if (url) window.location.assign(url); // route to the seed/thread
  });
  return "on";
}
```

Then in `NotificationSetup` / `NotificationFix`, branch: `if (isNative()) use
enableNativePush()` else the existing web-push path. The "Turn on notifications"
button now fires the **native OS prompt** in the app.

### The one-tap settings button (the whole point)

```ts
import { NativeSettings, AndroidSettings, IOSSettings } from "capacitor-native-settings";

export async function openNotificationSettings() {
  if (Capacitor.getPlatform() === "ios") {
    await NativeSettings.openIOS({ option: IOSSettings.App });
  } else {
    await NativeSettings.openAndroid({ option: AndroidSettings.AppNotification });
  }
}
```

Wire this to the "Fix notifications" button, shown only when `isNative()` — so in
the app, a blocked user taps once and lands on the exact settings screen.

---

## 5. Server: store native tokens + send to both channels

- **New model** `NativePushToken { userId, token, platform, createdAt }` (mirror
  in `schema.prisma` + `pending-ddl.ts` + a migration, like other models).
- **New route** `POST /api/push/native-token` — upsert the caller's token.
- **Delivery** (`src/lib/services/notify.ts` / `push.ts`): when notifying a user,
  send to **both** their web-push subscriptions (existing) **and** their native
  tokens via the Firebase Admin SDK:
  ```ts
  import { getMessaging } from "firebase-admin/messaging";
  await getMessaging().sendEachForMulticast({
    tokens: nativeTokens,
    notification: { title, body },
    data: { url: link },
  });
  ```
  Prune tokens FCM reports as unregistered (the native equivalent of the 410
  cleanup we already do for web push).

This is the main new backend work: a token table + a second send path. Web users
keep web push; app users get native push; nobody is double-notified because they
have different subscription types.

---

## 6. Build, sign, ship

```bash
npx cap sync            # after any plugin/config change
npx cap open android    # Android Studio → Build → Generate Signed Bundle (.aab)
                        # use the EXISTING signing.keystore; bump versionCode
```

- Upload the new `.aab` to the **same** Play listing → Internal testing → roll
  out. It updates the app on your family's phones.
- iOS: `npx cap open ios` → Xcode → set the team + bundle id → Archive → upload
  to App Store Connect → TestFlight for your family. (Needs an Apple Developer
  account, $99/yr.)

---

## Effort & phasing (be realistic)

- **Phase 1 — Android push + settings button:** the highest-value slice.
  Capacitor setup + Firebase + the token endpoint + the dual-send path + the
  settings button. Roughly **1–2 focused days** of work, most of it the
  Firebase/backend push plumbing.
- **Phase 2 — iOS App Store app:** Apple Developer account, APNs, Xcode archive,
  TestFlight. Another focused chunk; do it after Android proves out.

**Recommendation:** ship Phase 1 (Android) first. It grants the wish — native
prompt + one-tap settings + reliable native push — for the platform your family
is already on. Add iOS when you want the App Store presence.

## What does NOT change

- The web app and PWA keep working exactly as now (web push included) for anyone
  in a browser or on Add-to-Home-Screen.
- One codebase. Deploys still reflect instantly in the app (remote load).
- Your signing key and Play listing carry over.

## Honest trade-off

This is real work (mostly the second push channel), versus the TWA which needed
none. You're buying: the one-tap settings button, the most reliable push, and an
iOS app. If the notification hook is central to retention — which you've said it
is — it's worth it. If not, the TWA's native first-time prompt already covers
most new users.
