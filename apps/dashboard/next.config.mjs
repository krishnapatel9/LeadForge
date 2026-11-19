/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};

export default nextConfig;
