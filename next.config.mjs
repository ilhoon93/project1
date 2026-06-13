/** @type {import('next').NextConfig} */
const nextConfig = {
  // 레거시/외부에서 참조하던 /terms·/privacy 가 404 나지 않도록 실제 약관
  // 페이지로 영구 리다이렉트. (일반 서비스 약관은 추후 별도 보강 — 현재는
  // AI 웨딩스냅 약관/개인정보 문서로 연결.)
  async redirects() {
    return [
      { source: '/terms', destination: '/legal/terms', permanent: true },
      { source: '/privacy', destination: '/legal/privacy', permanent: true },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // fontkit 의 browser 빌드는 node 의 fs/path 를 require 하지 않지만, dep
      // 트리에서 정적 require('fs') 형태가 잡힐 수 있어 안전망으로 빈 모듈
      // fallback 을 둔다. server bundle 은 그대로 node 모듈 사용.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
