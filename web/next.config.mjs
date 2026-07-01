/** @type {import('next').NextConfig} */

// The commit this bundle was built from — baked into the client so the app can
// tell when a newer version has been deployed and reload itself.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || "dev";

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google avatars
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
