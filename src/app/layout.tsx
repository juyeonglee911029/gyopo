import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import GlobalChat from '@/components/layout/GlobalChat';

const notoSansKr = Noto_Sans_KR({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-noto-sans-kr'
});

export const metadata: Metadata = {
  title: 'K-Global Portal | 글로벌 한인 교민 통합 포털',
  description: '전 세계 한인 교민을 위한 구인구직, 업체목록, 에스크로 장터 통합 플랫폼',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.variable} font-sans bg-gray-50 text-gray-900 pt-16 min-h-screen flex flex-col`}>
        <Header />
        <GlobalChat />
        
        {/* Main content wrapper shifted right to accommodate the fixed Global Chat on large screens */}
        <div className="flex-grow flex flex-col lg:ml-80 transition-all">
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}