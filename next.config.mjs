import withPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // This is part of the general Next.js config
  images: {
    domains: ["api.dicebear.com"], // Only add image domains here
  },
  // Add any other general Next.js configuration here.
};

// Now, apply withPWA with the correct options
const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

// Assign to a variable first
const config = {
  ...nextConfig,
  ...pwaConfig,
};

export default config; // Now export the config object
