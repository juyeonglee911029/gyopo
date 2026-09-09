import type { Metadata, Viewport } from 'next';
import { Manrope, Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/footer';
import GlobalChat from '@/components/layout/globalchat';
import PortalFrame from '@/components/layout/portalframe';
import MarketTicker from '@/components/layout/MarketTicker';
import MusicPlayer from '@/components/layout/musicplayer';
import SiteBackgroundVideo from '@/components/layout/sitebackgroundvideo';
import PortalTextRail from '@/components/layout/portaltextrail';
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
  keywords: ['한인 포털', '교민 커뮤니티', '해외 구인구직', '한인 업소록', '교민 장터', '랜덤 화상채팅', 'K-POP 라디오'],
  applicationName: 'GYOPO',
  authors: [{ name: 'GYOPO' }],
  alternates: { canonical: 'https://gyopo.pages.dev' },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://gyopo.pages.dev',
    siteName: 'GYOPO',
    title: 'GYOPO | 글로벌 한인 교민 통합 포털',
    description: '교민 커뮤니티, 구인구직, 업소록, 장터, 화상채팅과 K-POP 라디오를 한 곳에서 만나보세요.',
  },
  twitter: {
    card: 'summary',
    title: 'GYOPO | 글로벌 한인 교민 통합 포털',
    description: '전 세계 한인을 위한 커뮤니티와 생활 플랫폼',
  },
  robots: { index: true, follow: true },
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
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'GYOPO',
            alternateName: 'K-Global Portal',
            url: 'https://gyopo.pages.dev',
            description: '전 세계 한인을 위한 커뮤니티, 구인구직, 업소록, 장터, 화상채팅, K-POP 라디오 포털',
            inLanguage: ['ko', 'en'],
            potentialAction: { '@type': 'SearchAction', target: 'https://gyopo.pages.dev/assistant?q={search_term_string}', 'query-input': 'required name=search_term_string' },
          }) }} />
          <SiteBackgroundVideo />
          <div className="portal-chrome">
            <Header />
            <MarketTicker />
            <MusicPlayer />
            <PortalTextRail />
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
