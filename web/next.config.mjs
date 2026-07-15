/** @type {import('next').NextConfig} */

// The commit this bundle was built from — baked into the client so the app can
// tell when a newer version has been deployed and reload itself.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || "dev";

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  // firebase-admin has native/dynamic deps (gRPC, protobufjs) that break when
  // Next tries to bundle them into the serverless output. Keep it external so
  // it's required from node_modules at runtime instead. (It's also loaded
  // lazily in src/lib/firebase-admin.ts, so it never touches non-phone routes.)
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google avatars
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
