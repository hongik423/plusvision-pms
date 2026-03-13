/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  webpack: (config) => {
    // @next/swc 플랫폼별 optional deps 경고 억제 (실제 빌드에는 영향 없음)
    config.infrastructureLogging = { level: 'error' };
    return config;
  },
};

export default nextConfig;
