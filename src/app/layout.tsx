import type { Metadata, Viewport } from 'next';
import { Manrope, Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import GlobalChat from '@/components/layout/GlobalChat';
import PortalSidebar from '@/components/layout/PortalSidebar';
import PortalFrame from '@/components/layout/PortalFrame';
import MarketTicker from '@/components/layout/MarketTicker';
import MusicPlayer from '@/components/layout/MusicPlayer';
import AppRuntime from '@/components/layout/AppRuntime';
import FriendDock from '@/components/layout/FriendDock';
import { AdSenseScript } from '@/components/ads/AdSense';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-noto-sans-kr'
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://gyopo.pages.dev'),
  title: 'K-Global Portal | 글로벌 한인 교민 통합 포털',
  description: '전 세계 한인 교민을 위한 구인구직, 업체목록, 에스크로 장터 통합 플랫폼',
  alternates: { canonical: 'https://gyopo.pages.dev' },
};

export const viewport: Viewport = { themeColor: '#070b17', colorScheme: 'dark' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.variable} ${manrope.variable} font-sans bg-[#070b17] text-slate-100 pt-24 min-h-screen flex flex-col`}>
        <AppRuntime>
          <AdSenseScript />
          <div className="portal-chrome">
            <Header />
            <MarketTicker />
            <MusicPlayer />
            <PortalSidebar />
            <GlobalChat />
            <FriendDock />
          </div>

          <PortalFrame>
            <main className="min-w-0 flex-grow">
              {children}
            </main>
            <Footer />
          </PortalFrame>
        </AppRuntime>
      </body>
    </html>
  );
}
