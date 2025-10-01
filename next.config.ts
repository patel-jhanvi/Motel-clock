/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ❌ Do not block build on ESLint errors
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
