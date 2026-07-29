import type { ReactNode } from 'react';
import { AdminBackBar } from './AdminBackBar';

/**
 * 관리자 공통 레이아웃 — 모든 하위 페이지 상단에 "관리자 메인으로" 버튼을 노출한다.
 * (허브 /admin 자신에서는 AdminBackBar 가 스스로 숨는다.)
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminBackBar />
      {children}
    </>
  );
}
