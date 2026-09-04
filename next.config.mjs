/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Not the fix for the firebase-admin/auth ERR_REQUIRE_ESM crash (that
  // turned out to be a genuine upstream bug -- jwks-rsa@4.x requiring a
  // pure-ESM jose@6, fixed via the jose override in pnpm-workspace.yaml,
  // not a bundling issue at all). Kept as a general good practice for a
  // large SDK like firebase-admin regardless.
  serverExternalPackages: ["firebase-admin"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
};

export default nextConfig;
