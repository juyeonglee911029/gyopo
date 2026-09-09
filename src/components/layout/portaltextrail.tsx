'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  ['/', '홈'],
  ['/news', '오늘의 뉴스'],
  ['/jobs', '구인구직'],
  ['/directory', '업소록'],
  ['/market', '장터'],
  ['/community', '커뮤니티'],
  ['/users', '유저 목록'],
  ['/games', '테트리스'],
  ['/webrtc', '화상채팅'],
  ['/music', 'K-pop 음악'],
  ['/theater', '극장'],
  ['/assistant', 'AI 검색'],
] as const;

export default function PortalTextRail() {
  const pathname = usePathname();
  return (
    <aside className="portal-text-rail" aria-label="GYOPO 메뉴">
      <div className="portal-text-rail-label">EXPLORE</div>
      <nav className="portal-text-rail-nav">
        {links.map(([href, label]) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return <Link key={href} href={href} className={active ? 'portal-text-link portal-text-link-active' : 'portal-text-link'}>{label}</Link>;
        })}
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('gyopo-friends-open'))} className="portal-text-link portal-text-link-button">친구 채팅·통화</button>
      </nav>
    </aside>
  );
}
