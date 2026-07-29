'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 관리자 하위 페이지 상단에 "관리자 메인으로" 돌아가는 버튼.
 * 허브(/admin) 자신에서는 숨긴다(자기 자신으로 가는 링크라 불필요).
 */
export function AdminBackBar() {
  const pathname = usePathname();
  if (pathname === '/admin') return null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 rounded-md border border-[#D4C5B0] bg-white px-3 py-1.5 text-xs font-medium text-[#5C4633] transition-colors hover:bg-[#FAF7F2]"
      >
        ← 관리자 메인
      </Link>
    </div>
  );
}
