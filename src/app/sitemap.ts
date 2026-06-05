import type { MetadataRoute } from 'next';

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://wooridaun.com').replace(/\/$/, '');

/**
 * /sitemap.xml — 공개 마케팅 페이지만 등록.
 * 개인 알림장(/[slug])·에디터·마이페이지 등 비공개/동적 페이지는 제외.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes: { path: string; priority: number }[] = [
    { path: '', priority: 1 }, // 홈 /
    { path: '/designs', priority: 0.8 }, // 디자인 샘플
    { path: '/wedding-snap', priority: 0.8 }, // AI 웨딩스냅 소개
    { path: '/legal/snap-terms', priority: 0.3 },
    { path: '/legal/snap-privacy', priority: 0.3 },
  ];
  return routes.map(({ path, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified,
    changeFrequency: 'weekly',
    priority,
  }));
}
