/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone so the production image ships a self-contained
  // server instead of the whole node_modules tree. See Dockerfile.
  output: "standalone",
};

export default nextConfig;
