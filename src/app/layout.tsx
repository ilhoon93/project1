import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { cn } from '@/lib/utils';
import { AutoLogout } from '@/components/auth/AutoLogout';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: '우리다운 — 우리 다운 결혼 알림장',
  description: '우리 다운 결혼 알림장과 AI 화보를 한 곳에서',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={cn(geistSans.variable, geistMono.variable, 'antialiased')}>
        <AutoLogout />
        {children}
      </body>
    </html>
  );
}
