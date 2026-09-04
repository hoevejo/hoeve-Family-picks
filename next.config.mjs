/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // firebase-admin/auth pulls in jwks-rsa -> jose, which has a CJS-requiring-
  // ESM interop pattern Turbopack's server bundler can't handle -- crashes
  // every route that imports it with ERR_REQUIRE_ESM. Leaving firebase-admin
  // as a native Node require() at runtime instead of bundling it avoids that.
  serverExternalPackages: ["firebase-admin"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
};

export default nextConfig;
