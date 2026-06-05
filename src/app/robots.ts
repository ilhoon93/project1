import type { MetadataRoute } from 'next';

// 배포 base URL — 다른 서버 코드(certificate/publish)와 동일하게 NEXT_PUBLIC_BASE_URL 사용,
// 없으면 운영 도메인으로 폴백. 끝 슬래시 제거.
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wooridaun.com').replace(/\/$/, '');

/**
 * /robots.txt — 공개 마케팅 영역만 색인 허용, 비공개/앱 영역은 차단.
 *
 * ⚠️ 개인 알림장 페이지 `/[slug]`, `/[slug]/o/[token]` 은 루트 슬러그라 robots 패턴으로
 * 안전하게 막을 수 없다(`/anything` 을 다 막으면 마케팅까지 막힘). 그래서 그 페이지들은
 * 각 generateMetadata 의 `robots: { index: false }` 메타 태그로 색인을 차단한다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/edit/',
          '/preview/',
          '/new',
          '/mypage',
          '/purchase/',
          '/login',
          '/auth/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
