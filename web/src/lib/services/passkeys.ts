import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";
import { db } from "@/lib/db";
import { rpConfig, saveChallenge, consumeChallenge } from "@/lib/webauthn";

// ── Registration (must be signed in) ────────────────────────────────
// Build the options the browser passes to navigator.credentials.create(). We
// exclude the user's existing passkeys so the same authenticator can't register
// twice, and stash the challenge for the verify step.
export async function startPasskeyRegistration(userId: string) {
  const { rpID, rpName } = rpConfig();
  const [user, existing] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
    db.passkey.findMany({ where: { userId }, select: { id: true, transports: true } }),
  ]);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: userId,
    userName: user?.email || "you",
    userDisplayName: user?.name || user?.email || "You",
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: isoBase64URL.toBuffer(p.id),
      type: "public-key",
      transports: (p.transports ? p.transports.split(",") : undefined) as
        | AuthenticatorTransportFuture[]
        | undefined,
    })),
    // A resident (discoverable) key is what lets someone sign in later with no
    // email typed — the platform just offers their ThinkThru passkey.
    // userVerification "required" enforces the biometric/PIN so every sign-in is
    // genuinely two-factor (device you have + face/finger/PIN you are/know), not
    // just possession of an unlocked phone.
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  const challengeId = await saveChallenge("reg", options.challenge, userId);
  return { options, challengeId };
}

// Verify the attestation and store the new credential against the user.
export async function finishPasskeyRegistration(
  userId: string,
  challengeId: string,
  response: RegistrationResponseJSON,
  label?: string,
) {
  const saved = await consumeChallenge(challengeId, "reg");
  // The challenge must be the one we issued to THIS user — never trust a
  // challenge bound to someone else.
  if (!saved || saved.userId !== userId) return { ok: false as const, error: "Challenge expired — try again." };
  const { rpID, origin } = rpConfig();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: saved.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return { ok: false as const, error: "Could not verify this passkey." };
  }
  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false as const, error: "Could not verify this passkey." };
  }
  const info = verification.registrationInfo;
  const id = isoBase64URL.fromBuffer(info.credentialID);
  await db.passkey.upsert({
    where: { id },
    update: { counter: info.counter, lastUsedAt: new Date() },
    create: {
      id,
      userId,
      publicKey: isoBase64URL.fromBuffer(info.credentialPublicKey),
      counter: info.counter,
      transports: (response.response.transports ?? []).join(","),
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      name: label?.trim() || "Passkey",
    },
  });
  return { ok: true as const };
}

// ── Authentication (usernameless login) ─────────────────────────────
// Discoverable credentials → allowCredentials empty, so the platform offers
// whichever ThinkThru passkey the person has on this device.
export async function startPasskeyLogin() {
  const { rpID } = rpConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: [],
  });
  const challengeId = await saveChallenge("auth", options.challenge, null);
  return { options, challengeId };
}

// Verify the assertion and return the user it belongs to (or null). Called from
// the Auth.js "passkey" Credentials provider, so a success mints a normal JWT
// session — nothing about the session layer changes.
export async function verifyPasskeyLogin(
  challengeId: string,
  response: AuthenticationResponseJSON,
): Promise<{ id: string; email: string; name: string | null; image: string | null } | null> {
  const saved = await consumeChallenge(challengeId, "auth");
  if (!saved) return null;
  const passkey = await db.passkey.findUnique({ where: { id: response.id } }).catch(() => null);
  if (!passkey) return null;
  const { rpID, origin } = rpConfig();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: saved.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: isoBase64URL.toBuffer(passkey.id),
        credentialPublicKey: isoBase64URL.toBuffer(passkey.publicKey),
        counter: passkey.counter,
        transports: (passkey.transports ? passkey.transports.split(",") : undefined) as
          | AuthenticatorTransportFuture[]
          | undefined,
      },
      requireUserVerification: true,
    });
  } catch {
    return null;
  }
  if (!verification.verified) return null;
  // Advance the signature counter (replay defence) and stamp last use.
  await db.passkey
    .update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
    })
    .catch(() => {});
  const user = await db.user.findUnique({
    where: { id: passkey.userId },
    select: { id: true, email: true, name: true, image: true },
  });
  return user ?? null;
}
