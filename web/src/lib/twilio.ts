// Twilio Verify — phone-number sign-in via an SMS one-time code.
//
// Raw REST with Basic auth instead of the `twilio` SDK: it's two endpoints, so a
// heavy dependency isn't worth it. Everything here is gated on the three env
// vars, so when Twilio isn't configured the phone provider is simply absent and
// nothing in this file ever runs. Node-only (uses Buffer) — called from the auth
// authorize() and login server actions, never on the edge.
//
// Required env:
//   TWILIO_ACCOUNT_SID         — your Account SID (starts "AC…")
//   TWILIO_AUTH_TOKEN          — the account auth token
//   TWILIO_VERIFY_SERVICE_SID  — a Verify Service SID (starts "VA…"), created in
//                                the Twilio console under Verify → Services.

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SERVICE = process.env.TWILIO_VERIFY_SERVICE_SID;
// Delivery channel. Defaults to "sms", but in strict-SMS markets (notably India,
// where unregistered SMS is throttled by the DLT regime) "whatsapp" is far
// faster and dodges carrier throttling — set TWILIO_VERIFY_CHANNEL=whatsapp once
// WhatsApp is enabled on the Verify Service. Also supports "call".
const CHANNEL = (process.env.TWILIO_VERIFY_CHANNEL || "sms").trim().toLowerCase();

export function twilioConfigured(): boolean {
  return !!(SID && TOKEN && SERVICE);
}

// Channels Twilio Verify can deliver on. The default primary is env-driven; the
// UI also offers "call" as a universal fallback when the primary doesn't arrive.
const ALLOWED_CHANNELS = new Set(["sms", "whatsapp", "call"]);

// The configured primary channel, surfaced to the sign-in UI so the button copy
// matches ("WhatsApp me a code" vs "Text me a code").
export function verifyChannel(): string {
  return ALLOWED_CHANNELS.has(CHANNEL) ? CHANNEL : "sms";
}

// Best-effort E.164: strip everything but digits and prefix "+". We deliberately
// don't guess the country code server-side — the sign-in UI collects the number
// with its country code — so a bad number simply fails Twilio's own validation
// and we surface a friendly error rather than silently texting the wrong person.
export function normalizeE164(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  return digits ? "+" + digits : "";
}

function authHeader(): string {
  return "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64");
}

// Send an SMS code. Twilio Verify enforces its own per-number rate limits and
// Fraud Guard, so this stays thin; we translate the common error codes into copy
// a person can act on.
export async function sendVerification(
  phone: string,
  channel?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!twilioConfigured()) return { ok: false, error: "Phone sign-in isn't set up yet." };
  if (!phone || phone.replace(/\D/g, "").length < 8)
    return { ok: false, error: "Enter your number with country code, e.g. +91…" };
  // Explicit channel (e.g. the "call me instead" fallback) wins; otherwise the
  // configured primary. Anything unrecognised falls back to SMS.
  const ch = channel && ALLOWED_CHANNELS.has(channel) ? channel : verifyChannel();
  try {
    const res = await fetch(`https://verify.twilio.com/v2/Services/${SERVICE}/Verifications`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, Channel: ch }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { code?: number };
    // 60200 invalid parameter (bad number); 60203 max send attempts reached;
    // 429 too many requests.
    const error =
      body.code === 60200
        ? "That doesn't look like a valid number — include your country code."
        : body.code === 60203 || res.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "Couldn't send the code. Check the number and try again.";
    console.error("twilio sendVerification failed", res.status, body.code);
    return { ok: false, error };
  } catch (err) {
    console.error("twilio sendVerification error", err);
    return { ok: false, error: "Couldn't reach the SMS service. Try again." };
  }
}

// Check a code. Returns true only when Twilio reports the verification "approved".
export async function checkVerification(phone: string, code: string): Promise<boolean> {
  if (!twilioConfigured() || !phone || !code) return false;
  try {
    const res = await fetch(`https://verify.twilio.com/v2/Services/${SERVICE}/VerificationCheck`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, Code: code }),
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => ({}))) as { status?: string };
    return body.status === "approved";
  } catch (err) {
    console.error("twilio checkVerification error", err);
    return false;
  }
}
