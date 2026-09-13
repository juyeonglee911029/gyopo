'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MarketTicker from '@/components/layout/MarketTicker';
import { useGlobalStore } from '@/store/useGlobalStore';
import { handleNavigationClick } from '@/lib/navigation';

const links = [
  ['/', '홈', 'Home'],
  ['/regions', '지역', 'Regions'],
  ['/jobs', '구인', 'Jobs'],
  ['/life', '생활', 'Life'],
  ['/community', '커뮤니티', 'Community'],
  ['/apps', '앱', 'Apps'],
  ['/news', '오늘의 뉴스', 'News'],
  ['/directory', '업소록', 'Directory'],
  ['/market', '중고장터', 'Market'],
  ['/users', '유저 목록', 'Members'],
  ['/games', '테트리스', 'Tetris'],
  ['/webrtc', '화상채팅', 'Video'],
  ['/music', 'MUSIC VIDEO', 'MUSIC VIDEO'],
   ['/watch', 'Watch', 'Watch'],
   ['/theater', 'LIVE ROOM', 'LIVE ROOM'],
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
               const linkClass = ['portal-text-link', active ? 'portal-text-link-active' : '', href === '/' ? 'portal-text-link-home' : '', href === '/music' ? 'portal-text-link-music' : ''].filter(Boolean).join(' ');
              if (href === '/assistant') return <button key={href} type="button" onClick={(event) => { const phase = handleNavigationClick(event, href, '/assistant'); if (phase !== 'blank') window.dispatchEvent(new CustomEvent('gyopo-assistant-open')); }} className={`${linkClass} portal-text-link-button`}>{language === 'ko' ? label : english}</button>;
              return <Link key={href} href={href} onClick={(event) => handleNavigationClick(event, href, pathname)} className={linkClass}>{language === 'ko' ? label : english}</Link>;
            })}
           <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('gyopo-friends-open'))} className="portal-text-link portal-text-link-button portal-friends-link"><span>{language === 'ko' ? '친구 채팅·통화' : 'Friends Chat / Call'}</span></button>
        </nav>
      </div>
    </aside>
  );
}
