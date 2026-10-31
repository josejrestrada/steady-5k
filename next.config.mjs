/** @type {import('next').NextConfig} */
// Strict mode would run the page's setup twice in dev and attach every listener twice.
const nextConfig = {
  reactStrictMode: false,
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
