'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MarketTicker from '@/components/layout/MarketTicker';
import { useGlobalStore } from '@/store/useGlobalStore';

const links = [
  ['/', '홈', 'Home'],
  ['/news', '오늘의 뉴스', 'News'],
  ['/jobs', '구인구직', 'Jobs'],
  ['/directory', '업소록', 'Directory'],
  ['/market', '장터', 'Market'],
  ['/community', '커뮤니티', 'Community'],
  ['/users', '유저 목록', 'Members'],
  ['/games', '테트리스', 'Tetris'],
  ['/webrtc', '화상채팅', 'Video'],
  ['/music', 'K-pop 음악', 'K-pop Music'],
  ['/watch', '빈 화면', 'Watch'],
  ['/theater', '극장', 'Theater'],
  ['/assistant', 'AI 검색', 'AI Search'],
] as const;

export default function PortalTextRail() {
  const pathname = usePathname();
  const language = useGlobalStore((state) => state.language);
  return (
    <aside className="portal-text-rail" aria-label="GYOPO 메뉴">
      <MarketTicker />
      <div className="portal-rail-card">
        <div className="portal-text-rail-label">EXPLORE / LIVE</div>
        <nav className="portal-text-rail-nav">
          {links.map(([href, label, english]) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return <Link key={href} href={href} className={active ? 'portal-text-link portal-text-link-active' : 'portal-text-link'}>{language === 'ko' ? label : english}</Link>;
          })}
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('gyopo-friends-open'))} className="portal-text-link portal-text-link-button">{language === 'ko' ? '친구 채팅·통화' : 'Friends'}</button>
        </nav>
      </div>
    </aside>
  );
}

