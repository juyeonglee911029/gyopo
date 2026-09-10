export function handleNavigationClick(event: React.MouseEvent<HTMLElement>, href: string, pathname: string): 'navigate' | 'blank' | 'restore' {
  if (typeof window === 'undefined') return 'navigate';
  const current = href === '/' ? pathname === '/' : pathname.startsWith(href);
  const key = `gyopo-navigation-cycle:${href}`;
  const stage = Number(window.sessionStorage.getItem(key) || '0');

  if (!current) {
    window.sessionStorage.setItem(key, '1');
    window.dispatchEvent(new CustomEvent('gyopo-navigation-blank', { detail: { visible: false } }));
    window.dispatchEvent(new CustomEvent('gyopo-navigation-fx'));
    return 'navigate';
  }

  if (stage === 1) {
    event.preventDefault();
    window.sessionStorage.setItem(key, '2');
    window.dispatchEvent(new CustomEvent('gyopo-navigation-blank', { detail: { visible: true } }));
    window.dispatchEvent(new CustomEvent('gyopo-navigation-fx'));
    return 'blank';
  }

  event.preventDefault();
  window.sessionStorage.setItem(key, '1');
  window.dispatchEvent(new CustomEvent('gyopo-navigation-blank', { detail: { visible: false } }));
  window.dispatchEvent(new CustomEvent('gyopo-navigation-fx'));
  return 'restore';
}
