import type { Metadata, Viewport } from 'next';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/footer';
import GlobalChat from '@/components/layout/GlobalChat';
import PortalFrame from '@/components/layout/portalframe';
import MusicPlayer from '@/components/layout/musicplayer';
import SiteBackgroundVideo from '@/components/layout/sitebackgroundvideo';
import PortalTextRail from '@/components/layout/portaltextrail';
import AppRuntime from '@/components/layout/AppRuntime';
import FriendDock from '@/components/layout/FriendDock';
import PageTransition from '@/components/layout/PageTransition';
import { AdSenseScript } from '@/components/ads/AdSense';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'K-Global Portal | 글로벌 한인 교민 통합 포털',
  description: '전 세계 한인 교민을 위한 구인구직, 업체목록, 커뮤니티 통합 플랫폼',
  keywords: ['한인 포털', '교민 커뮤니티', '해외 구인구직', '한인 업소록', '랜덤 화상채팅', 'K-POP 라디오'],
  applicationName: 'GYOPO',
  authors: [{ name: 'GYOPO' }],
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: 'GYOPO',
    title: 'GYOPO | 글로벌 한인 교민 통합 포털',
    description: '교민 커뮤니티, 구인구직, 업소록, 화상채팅과 K-POP 라디오를 한 곳에서 만나보세요.',
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
      <body className="font-sans bg-[#070b17] text-slate-100 pt-24 min-h-screen flex flex-col">
        <AppRuntime>
          <AdSenseScript />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'GYOPO',
            alternateName: 'K-Global Portal',
             url: SITE_URL,
            description: '전 세계 한인을 위한 커뮤니티, 구인구직, 업소록, 화상채팅, K-POP 라디오 포털',
            inLanguage: ['ko', 'en'],
            potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/assistant?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
          }) }} />
          <SiteBackgroundVideo />
          <div className="portal-chrome">
            <Header />
            <MusicPlayer />
            <PortalTextRail />
            <GlobalChat />
            <FriendDock />
          </div>

          <PortalFrame>
            <main className="min-w-0 flex-grow">
              <PageTransition>{children}</PageTransition>
            </main>
            <Footer />
          </PortalFrame>
        </AppRuntime>
      </body>
    </html>
  );
}
