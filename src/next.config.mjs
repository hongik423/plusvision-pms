/** @type {import('next').NextConfig} */
const nextConfig = {
  staticPageGenerationTimeout: 120,
  experimental: {
    // typedRoutes: Next.js 14.2에서 .next/types 생성 시 next/server.js 모듈 오류로 비활성화
    // typedRoutes: true,
  },
  webpack: (config, { dev }) => {
    // 인프라 로그 레벨 제한
    config.infrastructureLogging = { level: 'error' };

    // Next.js 14.2.x SWC hashSalt 충돌 방지: 개발 모드에서 캐시 비활성화
    if (dev) {
      config.cache = false;
    }

    return config;
  },
};

export default nextConfig;
